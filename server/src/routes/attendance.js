const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/auth');
const attendanceService = require('../services/attendanceService');
const Attendance = require('../models/Attendance');

// Protect all routes
router.use(verifyToken);

/**
 * POST /api/attendance/start - Executive starts work day
 */
router.post('/start', async (req, res) => {
  try {
    if (!['executive', 'industry_manager', 'state_manager'].includes(req.user.role)) {
      return res.status(403).json({ message: 'Forbidden: Role not authorized to start work' });
    }
    const result = await attendanceService.startWork(req.user._id, req.body);
    res.json(result);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

/**
 * POST /api/attendance/complete - Executive marks work complete
 */
router.post('/complete', async (req, res) => {
  try {
    const { attendanceId } = req.body;
    if (!attendanceId) return res.status(400).json({ message: 'attendanceId required' });

    const attendance = await attendanceService.completeWork(req.user._id, attendanceId);
    
    // Notify Manager via Socket.io
    const io = req.app.get('io');
    if (io && req.user.reportingTo) {
      io.to(req.user.reportingTo.toString()).emit('attendance:updated', {
        userId: req.user._id,
        userName: req.user.name,
        status: attendance.status,
        completionPct: attendance.completionPct
      });
    }

    res.json(attendance);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

/**
 * GET /api/attendance/today - Get today's attendance record
 */
router.get('/today', async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const attendance = await Attendance.findOne({ user: req.user._id, date: today });
    const status = await attendanceService.checkTodayStatus(req.user._id);
    
    res.json({
      attendance,
      status
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/**
 * GET /api/attendance - List attendance (filters: userId, month, year)
 */
router.get('/', async (req, res) => {
  try {
    const { userId, month, year } = req.query;
    
    // Authorization check
    if (req.user.role === 'executive' && userId && userId !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Forbidden: You can only view your own attendance' });
    }

    // Managers see team (handled by service if we pass filters correctly)
    const filters = {
      userId: userId || (req.user.role === 'executive' ? req.user._id : null),
      month: month ? parseInt(month) : null,
      year: year ? parseInt(year) : null
    };

    const list = await attendanceService.listAttendance(filters);
    res.json(list);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/**
 * GET /api/attendance/summary/:userId - Monthly summary
 */
router.get('/summary/:userId', async (req, res) => {
  try {
    const { month, year } = req.query;
    if (!month || !year) return res.status(400).json({ message: 'month and year required' });
    
    // Authorization
    if (req.user.role === 'executive' && req.params.userId !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    const summary = await attendanceService.getMonthlySummary(
      req.params.userId,
      parseInt(month),
      parseInt(year)
    );
    res.json(summary);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/**
 * PUT /api/attendance/:id - Manager edit record
 */
/**
 * GET /api/attendance/team - Get team attendance (State Manager view)
 * Accepts: date (single day), fromDate+toDate (range), or period (today/week/month)
 */
router.get('/team', async (req, res) => {
  try {
    const { date, fromDate, toDate, period } = req.query;

    const { User } = require('../models');
    const Leave = require('../models/Leave');
    const users = await User.find({ state: req.user.state, role: { $in: ['industry_manager', 'executive'] } });
    const userIds = users.map(u => u._id);

    // Determine date range
    let rangeStart, rangeEnd;
    const now = new Date();
    if (fromDate && toDate) {
      rangeStart = new Date(fromDate); rangeStart.setHours(0, 0, 0, 0);
      rangeEnd = new Date(toDate); rangeEnd.setHours(23, 59, 59, 999);
    } else if (period === 'week') {
      rangeStart = new Date(now);
      const day = rangeStart.getDay();
      rangeStart.setDate(rangeStart.getDate() - day + (day === 0 ? -6 : 1));
      rangeStart.setHours(0, 0, 0, 0);
      rangeEnd = new Date(rangeStart); rangeEnd.setDate(rangeStart.getDate() + 6); rangeEnd.setHours(23, 59, 59, 999);
    } else if (period === 'month') {
      rangeStart = new Date(now.getFullYear(), now.getMonth(), 1);
      rangeEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    } else {
      // Single day (default: today or provided date)
      const targetDate = date ? new Date(date) : new Date();
      targetDate.setHours(0, 0, 0, 0);
      rangeStart = targetDate;
      rangeEnd = new Date(targetDate); rangeEnd.setHours(23, 59, 59, 999);
    }

    const attendance = await Attendance.find({
      user: { $in: userIds },
      date: { $gte: rangeStart, $lte: rangeEnd }
    }).populate('user', 'name role industry');

    const leaves = await Leave.find({
      user: { $in: userIds },
      status: 'approved',
      fromDate: { $lte: rangeEnd },
      toDate: { $gte: rangeStart }
    }).populate('user', 'name role industry');

    // Aggregate per user across the range
    const results = users.map(u => {
      const uid = u._id.toString();
      const userAtts = attendance.filter(a => a.user?._id.toString() === uid);
      const userLeave = leaves.find(l => l.user?._id.toString() === uid);
      const latest = userAtts.sort((a, b) => new Date(b.date) - new Date(a.date))[0];

      const avgWorkPct = userAtts.length
        ? Math.round(userAtts.reduce((sum, a) => sum + (a.workPercentage || 0), 0) / userAtts.length)
        : 0;

      return {
        _id: latest?._id || `temp-${u._id}`,
        user: u,
        status: userLeave ? 'leave' : (latest ? latest.status : 'absent'),
        startTime: latest?.workStartedAt ? new Date(latest.workStartedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : null,
        workPercentage: avgWorkPct,
        completionPct: latest?.completionPct || 0,
        note: latest?.note || (userLeave ? `On Leave: ${userLeave.reason}` : null)
      };
    });

    res.json(results);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    if (req.user.role === 'executive') {
      return res.status(403).json({ message: 'Executive cannot edit attendance' });
    }
    
    const attendance = await Attendance.findByIdAndUpdate(req.params.id, {
      status: req.body.status,
      note: req.body.note,
      salaryDeduction: req.body.salaryDeduction
    }, { new: true });
    
    if (!attendance) return res.status(404).json({ message: 'Record not found' });
    res.json(attendance);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

module.exports = router;
