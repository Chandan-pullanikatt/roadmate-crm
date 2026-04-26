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
    if (req.user.role !== 'executive') {
      return res.status(403).json({ message: 'Only executives can start work' });
    }
    const result = await attendanceService.startWork(req.user._id);
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
