const express = require('express');
const router = express.Router();
const Leave = require('../models/Leave');
const LeavePolicy = require('../models/LeavePolicy');
const Attendance = require('../models/Attendance');
const User = require('../models/User');
const { verifyToken } = require('../middleware/auth');
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

// POST /request
router.post('/request', verifyToken, async (req, res, next) => {
  try {
    const { type, fromDate, toDate, reason } = req.body;
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
    const policy = await LeavePolicy.findOne({ state: user.state, year: new Date().getFullYear() });

    if (!policy) {
      return res.status(400).json({ message: 'Leave policy not found for your state' });
    }

    // 2. Check balance
    if (type === 'paid') {
      const isProbation = user.probationEndDate && new Date() < new Date(user.probationEndDate);
      if (isProbation) {
        return res.status(400).json({ message: 'Paid leaves are not allowed during probation' });
      }

      // Calculate total earned leaves (1 per month)
      const joinDate = user.createdAt;
      const monthsServed = Math.floor((new Date() - joinDate) / (1000 * 60 * 60 * 24 * 30.44));
      const totalEarned = monthsServed * policy.paidLeavesPerMonth;

      // Get count of approved/pending paid leaves
      const usedPaid = await Leave.aggregate([
        { $match: { user: userId, type: 'paid', status: { $in: ['approved', 'pending'] } } },
        { $group: { _id: null, total: { $sum: '$days' } } }
      ]);
      const usedCount = usedPaid.length > 0 ? usedPaid[0].total : 0;

      if (usedCount + days > totalEarned) {
        return res.status(400).json({ message: `Insufficient paid leave balance. Earned: ${totalEarned}, Used/Pending: ${usedCount}` });
      }
    }

    // 3. Check Optional Holiday Quota
    if (type === 'optional_holiday') {
      const optionalHolidays = policy.holidays.filter(h => h.type === 'optional').length;
      const maxAllowed = Math.ceil(optionalHolidays * policy.optionalHolidayQuota);

      const usedOptional = await Leave.aggregate([
        { $match: { user: userId, type: 'optional_holiday', status: { $in: ['approved', 'pending'] } } },
        { $group: { _id: null, total: { $sum: '$days' } } }
      ]);
      const usedCount = usedOptional.length > 0 ? usedOptional[0].total : 0;

      if (usedCount + days > maxAllowed) {
        return res.status(400).json({ message: `Optional holiday quota exceeded. Max: ${maxAllowed}, Used/Pending: ${usedCount}` });
      }
    }

    const leaveRequest = new Leave({
      user: userId,
      type,
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
      io.to(user.reportingTo.toString()).emit('leave:requested', {
        leaveId: leaveRequest._id,
        requesterName: user.name,
        type,
        days
      });
    }

    res.status(201).json(leaveRequest);
  } catch (err) {
    next(err);
  }
});

// GET /
router.get('/', verifyToken, async (req, res, next) => {
  try {
    const { role, _id } = req.user;
    const { userId } = req.query;
    let query = {};

    if (userId) {
      // Permission check: Founder can see all, managers can see their subordinates
      if (role !== 'founder') {
        const isSubordinate = await User.findOne({ _id: userId, reportingTo: _id });
        if (!isSubordinate && userId.toString() !== _id.toString()) {
          return res.status(403).json({ message: 'Forbidden: You can only view leave history for yourself or your subordinates' });
        }
      }
      query = { user: userId };
    } else if (role === 'executive') {
      query = { user: _id };
    } else if (role === 'industry_manager') {
      // "leaves for their executives + their own pending to state manager"
      const subordinates = await User.find({ reportingTo: _id }).select('_id');
      const subIds = subordinates.map(s => s._id);
      query = {
        $or: [
          { user: { $in: subIds } },
          { user: _id, status: 'pending' }
        ]
      };
    } else if (role === 'state_manager') {
      // "leaves for their industry managers + their own pending to founder"
      const subordinates = await User.find({ reportingTo: _id }).select('_id');
      const subIds = subordinates.map(s => s._id);
      query = {
        $or: [
          { user: { $in: subIds } },
          { user: _id, status: 'pending' }
        ]
      };
    } else if (role === 'founder') {
      // "all pending leave requests"
      query = { status: 'pending' };
    }

    const leaves = await Leave.find(query)
      .populate('user', 'name role state industry')
      .sort({ requestedAt: -1 });

    res.json(leaves);
  } catch (err) {
    next(err);
  }
});

// PUT /:id/approve
router.put('/:id/approve', verifyToken, async (req, res, next) => {
  try {
    const leave = await Leave.findById(req.params.id);
    if (!leave) return res.status(404).json({ message: 'Leave request not found' });

    leave.status = 'approved';
    leave.approvedBy = req.user._id;
    await leave.save();

    // Create Attendance docs
    const dates = getDatesInRange(leave.fromDate, leave.toDate);
    for (const date of dates) {
      // Use findOneAndUpdate to avoid duplicate key errors if attendance already exists
      await Attendance.findOneAndUpdate(
        { user: leave.user, date: date.setHours(0,0,0,0) },
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

    res.json(leave);
  } catch (err) {
    next(err);
  }
});

// PUT /:id/reject
router.put('/:id/reject', verifyToken, async (req, res, next) => {
  try {
    const { approvalNote } = req.body;
    const leave = await Leave.findById(req.params.id);
    if (!leave) return res.status(404).json({ message: 'Leave request not found' });

    leave.status = 'rejected';
    leave.approvedBy = req.user._id;
    leave.approvalNote = approvalNote;
    await leave.save();

    // Emit event to requester
    const io = req.app.get('io');
    io.to(leave.user.toString()).emit('leave:rejected', {
      leaveId: leave._id,
      status: 'rejected',
      note: approvalNote
    });

    res.json(leave);
  } catch (err) {
    next(err);
  }
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
