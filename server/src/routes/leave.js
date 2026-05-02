const express = require('express');
const router = express.Router();
const Leave = require('../models/Leave');
const LeavePolicy = require('../models/LeavePolicy');
const Attendance = require('../models/Attendance');
const User = require('../models/User');
const { verifyToken } = require('../middleware/auth');
const notificationService = require('../services/notificationService');
const mongoose = require('mongoose');

// Helper to get dates between range
const getDatesInRange = (startDate, endDate) => {
  const dates = [];
  let curr = new Date(startDate);
  while (curr <= endDate) {
    dates.push(new Date(curr));
    curr.setDate(curr.getDate() + 1);
  }
  return dates;
};

// Authorization Helper: enforces strict role hierarchy
const checkSuperior = async (requesterId, approver) => {
  if (approver.role === 'founder') return true;

  const requester = await User.findById(requesterId);
  if (!requester) return false;

  // State Manager's leave → Founder only
  if (requester.role === 'state_manager') return false;

  // Industry Manager's leave → direct State Manager
  if (requester.role === 'industry_manager') {
    return requester.reportingTo?.toString() === approver._id.toString();
  }

  // Executive's leave → direct Industry Manager OR the SM above that IM
  if (requester.role === 'executive') {
    if (requester.reportingTo?.toString() === approver._id.toString()) return true;
    if (approver.role === 'state_manager') {
      const im = await User.findById(requester.reportingTo);
      return im?.reportingTo?.toString() === approver._id.toString();
    }
  }

  return false;
};

// POST / (Create Leave)
router.post('/', verifyToken, async (req, res, next) => {
  try {
    const { leaveType, fromDate, toDate, reason, type: legacyType } = req.body;
    const type = leaveType || legacyType; // Handle both field names
    const userId = req.user._id;

    const start = new Date(fromDate);
    const end = new Date(toDate);
    const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;

    // 1. Check for conflicts
    const conflict = await Leave.findOne({
      user: userId,
      status: 'approved',
      $or: [
        { fromDate: { $lte: end }, toDate: { $gte: start } }
      ]
    });

    if (conflict) {
      return res.status(400).json({ message: 'Date range conflicts with existing approved leave' });
    }

    const user = await User.findById(userId);
    let policy = await LeavePolicy.findOne({ state: user.state, year: new Date().getFullYear() });

    // FIX 3: Safe defaults if policy is missing
    if (!policy) {
      policy = {
        paidLeavesPerMonth: 1.25, // 15 per year
        optionalHolidayQuota: 0.5,
        holidays: []
      };
    }

    // 2. Check balance (if paid)
    if (type === 'paid') {
      const isProbation = user.probationEndDate && new Date() < new Date(user.probationEndDate);
      if (isProbation) {
        return res.status(400).json({ message: 'Paid leaves are not allowed during probation' });
      }

      // Calculate total earned leaves — use dateOfJoining if set, fall back to createdAt.
      // New accounts (< 1 month) get at least 1 month's accrual so they can apply from day one.
      const joinDate = user.dateOfJoining || user.createdAt;
      const rawMonths = Math.floor((new Date() - new Date(joinDate)) / (1000 * 60 * 60 * 24 * 30.44));
      const monthsServed = Math.max(1, rawMonths);
      const totalEarned = monthsServed * policy.paidLeavesPerMonth;

      const usedPaid = await Leave.aggregate([
        { $match: { user: userId, type: 'paid', status: { $in: ['approved', 'pending'] } } },
        { $group: { _id: null, total: { $sum: '$days' } } }
      ]);
      const usedCount = usedPaid.length > 0 ? usedPaid[0].total : 0;

      if (usedCount + days > totalEarned) {
        return res.status(400).json({ message: `Insufficient paid leave balance. Earned: ${totalEarned.toFixed(1)}, Used/Pending: ${usedCount}` });
      }
    }

    const leaveRequest = new Leave({
      user: userId,
      applicantRole: user.role,
      type: type || 'unpaid',
      fromDate: start,
      toDate: end,
      days,
      reason,
      status: 'pending'
    });

    await leaveRequest.save();

    // Emit socket event to manager
    if (user.reportingTo) {
      const io = req.app.get('io');
      if (io) {
        io.to(user.reportingTo.toString()).emit('leave:requested', {
          leaveId: leaveRequest._id,
          requesterName: user.name,
          type: type || 'unpaid',
          days
        });
      }
    }

    res.status(201).json(leaveRequest);
  } catch (err) {
    next(err);
  }
});

// Alias for backward compatibility
router.post('/request', verifyToken, async (req, res, next) => {
  req.url = '/';
  router.handle(req, res, next);
});

// GET / (List Leaves)
router.get('/', verifyToken, async (req, res, next) => {
  try {
    const { role, _id } = req.user;
    const { userId, status, month } = req.query;
    let query = {};

    // Base Scoping
    if (role === 'founder') {
      // Sees everything
      query = {};
    } else if (role === 'state_manager') {
      // Subordinates only — SM's own leave is fetched separately when needed
      const ims = await User.find({ reportingTo: _id }).select('_id');
      const imIds = ims.map(im => im._id);
      const execs = await User.find({ reportingTo: { $in: imIds } }).select('_id');
      const execIds = execs.map(ex => ex._id);
      query = { user: { $in: [...imIds, ...execIds] } };
    } else if (role === 'industry_manager') {
      // Subordinates only — IM's own leave is fetched separately when needed
      const execs = await User.find({ reportingTo: _id }).select('_id');
      const execIds = execs.map(ex => ex._id);
      query = { user: { $in: execIds } };
    } else {
      // Executive sees only their own
      query = { user: _id };
    }

    // Apply Filters
    if (userId) {
      // Verify permission to see this specific user
      const canSee = (role === 'founder') || (query.user && query.user.$in.some(id => id.toString() === userId.toString())) || (userId.toString() === _id.toString());
      if (!canSee) return res.status(403).json({ message: 'Not authorized to view this user\'s leaves' });
      query.user = userId;
    }

    if (status) {
      query.status = status;
    }

    if (month) {
      const targetYear = new Date().getFullYear();
      const m = parseInt(month);
      const start = new Date(targetYear, m - 1, 1);
      const end = new Date(targetYear, m, 0);
      query.$or = [
        { fromDate: { $lte: end }, toDate: { $gte: start } }
      ];
    }

    const leaves = await Leave.find(query)
      .populate('user', 'name role state industry reportingTo')
      .sort({ requestedAt: -1 });

    res.json(leaves);
  } catch (err) {
    next(err);
  }
});

// GET /pending
router.get('/pending', verifyToken, async (req, res, next) => {
  try {
    const { role, _id } = req.user;
    let query = { status: 'pending' };

    // Scoping for pending leaves (who can approve what)
    if (role === 'founder') {
      // Sees all pending leaves from State Managers
      const stateManagers = await User.find({ role: 'state_manager' }).select('_id');
      const smIds = stateManagers.map(sm => sm._id);
      // Also potentially anything else if direct reporting is used
      query.user = { $exists: true }; 
    } else if (role === 'state_manager') {
      // Sees pending leaves from IMs and their DEs (SM cannot approve own leave)
      const ims = await User.find({ reportingTo: _id }).select('_id');
      const imIds = ims.map(im => im._id);
      const execs = await User.find({ reportingTo: { $in: imIds } }).select('_id');
      const execIds = execs.map(ex => ex._id);
      query.user = { $in: [...imIds, ...execIds] };
    } else if (role === 'industry_manager') {
      // Sees pending leaves from Executives reporting to them
      const execs = await User.find({ reportingTo: _id }).select('_id');
      const execIds = execs.map(ex => ex._id);
      query.user = { $in: execIds };
    } else {
      // Executive sees no pending leaves to approve
      return res.json([]);
    }

    const leaves = await Leave.find(query)
      .populate('user', 'name role state industry reportingTo')
      .sort({ requestedAt: -1 });

    res.json(leaves);
  } catch (err) {
    next(err);
  }
});

// PATCH /:id/approve
router.patch('/:id/approve', verifyToken, async (req, res, next) => {
  try {
    const leave = await Leave.findById(req.params.id);
    if (!leave) return res.status(404).json({ message: 'Leave request not found' });

    // FIX 2: Authorization Check
    const isAuthorized = await checkSuperior(leave.user, req.user);
    if (!isAuthorized) {
      return res.status(403).json({ message: 'Not authorized to approve this leave' });
    }

    leave.status = 'approved';
    leave.approvedBy = req.user._id;
    leave.approvedAt = new Date();
    await leave.save();

    // Create Attendance docs
    const dates = getDatesInRange(leave.fromDate, leave.toDate);
    for (const date of dates) {
      await Attendance.findOneAndUpdate(
        { user: leave.user, date: new Date(date).setHours(0,0,0,0) },
        { status: 'leave' },
        { upsert: true, new: true }
      );
    }

    // Emit event to requester
    const io = req.app.get('io');
    io.to(leave.user.toString()).emit('leave:approved', {
      leaveId: leave._id,
      status: 'approved'
    });

    // Create notification for requester
    await notificationService.onLeaveDecision({
      userId: leave.user,
      decision: 'approved',
      managerName: req.user.name || 'Manager',
      io,
    });

    res.json(leave);
  } catch (err) {
    next(err);
  }
});

// PATCH /:id/reject
router.patch('/:id/reject', verifyToken, async (req, res, next) => {
  try {
    const { approvalNote } = req.body;
    const leave = await Leave.findById(req.params.id);
    if (!leave) return res.status(404).json({ message: 'Leave request not found' });

    // FIX 2: Authorization Check
    const isAuthorized = await checkSuperior(leave.user, req.user);
    if (!isAuthorized) {
      return res.status(403).json({ message: 'Not authorized to reject this leave' });
    }

    leave.status = 'rejected';
    leave.approvedBy = req.user._id;
    leave.rejectedAt = new Date();
    leave.approvalNote = approvalNote;
    await leave.save();

    // Emit event to requester
    const io = req.app.get('io');
    io.to(leave.user.toString()).emit('leave:rejected', {
      leaveId: leave._id,
      status: 'rejected',
      note: approvalNote
    });

    // Create notification for requester
    await notificationService.onLeaveDecision({
      userId: leave.user,
      decision: 'rejected',
      managerName: req.user.name || 'Manager',
      io,
    });

    res.json(leave);
  } catch (err) {
    next(err);
  }
});

// Backward compatibility for PUT approve/reject
router.put('/:id/approve', verifyToken, async (req, res, next) => {
  req.method = 'PATCH';
  router.handle(req, res, next);
});

router.put('/:id/reject', verifyToken, async (req, res, next) => {
  req.method = 'PATCH';
  router.handle(req, res, next);
});

// GET /balance/:userId
router.get('/balance/:userId', verifyToken, async (req, res, next) => {
  try {
    const userId = req.params.userId;
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const policy = await LeavePolicy.findOne({ state: user.state, year: new Date().getFullYear() });
    if (!policy) return res.status(400).json({ message: 'Policy not found' });

    // Paid Balance
    const isProbation = user.probationEndDate && new Date() < new Date(user.probationEndDate);
    const joinDate = user.createdAt;
    const monthsServed = Math.floor((new Date() - joinDate) / (1000 * 60 * 60 * 24 * 30.44));
    const totalEarned = isProbation ? 0 : monthsServed * policy.paidLeavesPerMonth;

    const usedPaid = await Leave.aggregate([
      { $match: { user: new mongoose.Types.ObjectId(userId), type: 'paid', status: 'approved' } },
      { $group: { _id: null, total: { $sum: '$days' } } }
    ]);
    const paidLeaveBalance = totalEarned - (usedPaid.length > 0 ? usedPaid[0].total : 0);

    // Optional Quota
    const optionalHolidays = policy.holidays.filter(h => h.type === 'optional').length;
    const maxAllowed = Math.ceil(optionalHolidays * policy.optionalHolidayQuota);
    const usedOptional = await Leave.aggregate([
      { $match: { user: new mongoose.Types.ObjectId(userId), type: 'optional_holiday', status: 'approved' } },
      { $group: { _id: null, total: { $sum: '$days' } } }
    ]);
    const optionalHolidayBalance = maxAllowed - (usedOptional.length > 0 ? usedOptional[0].total : 0);

    // Pending
    const pendingRequests = await Leave.countDocuments({ user: userId, status: 'pending' });

    // Approved this month
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0,0,0,0);
    const approvedThisMonthResult = await Leave.aggregate([
      { 
        $match: { 
          user: new mongoose.Types.ObjectId(userId), 
          status: 'approved',
          fromDate: { $gte: startOfMonth }
        } 
      },
      { $group: { _id: null, total: { $sum: '$days' } } }
    ]);
    const approvedThisMonth = approvedThisMonthResult.length > 0 ? approvedThisMonthResult[0].total : 0;

    res.json({
      paidLeaveBalance: Math.max(0, paidLeaveBalance),
      optionalHolidayBalance: Math.max(0, optionalHolidayBalance),
      pendingRequests,
      approvedThisMonth
    });
  } catch (err) {
    next(err);
  }
});

// GET /policy/:state
router.get('/policy/:state', verifyToken, async (req, res, next) => {
  try {
    const policy = await LeavePolicy.findOne({ 
      state: req.params.state, 
      year: new Date().getFullYear() 
    });
    res.json(policy);
  } catch (err) {
    next(err);
  }
});

// POST /policy
router.post('/policy', verifyToken, async (req, res, next) => {
  try {
    if (req.user.role !== 'founder' && req.user.role !== 'state_manager') return res.status(403).json({ message: 'Forbidden' });
    
    const { state, year, holidays, paidLeavesPerMonth, optionalHolidayQuota, normalWorkStart } = req.body;
    
    let policy = await LeavePolicy.findOne({ state, year });
    if (policy) {
      Object.assign(policy, req.body);
    } else {
      policy = new LeavePolicy(req.body);
    }
    
    await policy.save();
    res.json(policy);
  } catch (err) {
    next(err);
  }
});

// PUT /policy/:id
router.put('/policy/:id', verifyToken, async (req, res, next) => {
  try {
    if (req.user.role !== 'founder' && req.user.role !== 'state_manager') return res.status(403).json({ message: 'Forbidden' });
    
    const policy = await LeavePolicy.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(policy);
  } catch (err) {
    next(err);
  }
});

// GET /calendar/:state
router.get('/calendar/:state', verifyToken, async (req, res, next) => {
  try {
    const { state } = req.params;
    const { month, year } = req.query;
    
    const targetYear = year ? parseInt(year) : new Date().getFullYear();
    const policy = await LeavePolicy.findOne({ state, year: targetYear });
    
    if (!policy) return res.status(404).json({ message: 'Policy not found for this state/year' });

    // Fetch approved leaves for users in this state
    const usersInState = await User.find({ state }).select('_id');
    const userIds = usersInState.map(u => u._id);

    let leaveQuery = { 
      user: { $in: userIds }, 
      status: 'approved' 
    };

    if (month) {
      const m = parseInt(month); // 0-indexed or 1-indexed? Usually 1-12 in query
      const start = new Date(targetYear, m - 1, 1);
      const end = new Date(targetYear, m, 0);
      leaveQuery.$or = [
        { fromDate: { $lte: end }, toDate: { $gte: start } }
      ];
    }

    const approvedLeaves = await Leave.find(leaveQuery).populate('user', 'name');

    // Merge logic
    const calendar = [];

    // Add holidays
    policy.holidays.forEach(h => {
      const hDate = new Date(h.date);
      if (!month || (hDate.getMonth() + 1 === parseInt(month))) {
        calendar.push({
          date: h.date,
          type: h.type === 'optional' ? 'optional' : 'holiday',
          name: h.name,
          users: []
        });
      }
    });

    // Add leaves
    approvedLeaves.forEach(l => {
      const dates = getDatesInRange(l.fromDate, l.toDate);
      dates.forEach(d => {
        if (!month || (d.getMonth() + 1 === parseInt(month))) {
          // Find if holiday exists on this date
          const existing = calendar.find(c => new Date(c.date).toDateString() === d.toDateString());
          if (existing) {
            existing.users.push(l.user.name);
          } else {
            calendar.push({
              date: d,
              type: 'leave',
              name: 'Leave',
              users: [l.user.name]
            });
          }
        }
      });
    });

    res.json(calendar.sort((a, b) => new Date(a.date) - new Date(b.date)));
  } catch (err) {
    next(err);
  }
});

module.exports = router;
