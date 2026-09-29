const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/auth');
const User = require('../models/User');
const Lead = require('../models/Lead');
const LeadActivity = require('../models/LeadActivity');
const Attendance = require('../models/Attendance');
const { createdAtRange, getDateRange } = require('../utils/dateRange');
const { getPerformanceMetrics, EMPTY_METRICS } = require('../services/performanceService');
const { sumRevenue } = require('../services/revenueService');
const { isCallAction } = require('../constants/workActions');
const { getWorkPct, NON_WORKING_STATUSES } = require('../services/workPercentService');

const MEETING_ACTIONS = ['meeting_scheduled', 'meeting_done'];

/**
 * 'virtual' / 'direct' for a meeting activity, else null. Meetings logged before
 * meetingType was recorded fall back to the lead's own status, the same way the
 * targets report resolves them (routes/targets.js) — so the two buckets still
 * add up to the meeting total.
 */
const meetingTypeOf = (a) => {
  if (!MEETING_ACTIONS.includes(a.action)) return null;
  if (a.metadata?.meetingType === 'virtual') return 'virtual';
  if (a.metadata?.meetingType === 'direct') return 'direct';
  return a.lead?.status === 'meeting_virtual' ? 'virtual' : 'direct';
};

// Counts of each lead action in a list of LeadActivity records.
const countActions = (activities) => ({
  // Every logged outcome means a call was placed -- see CALL_ACTIONS.
  calls: activities.filter(a => isCallAction(a.action)).length,
  meetings: activities.filter(a => MEETING_ACTIONS.includes(a.action)).length,
  meetingsVirtual: activities.filter(a => meetingTypeOf(a) === 'virtual').length,
  meetingsDirect: activities.filter(a => meetingTypeOf(a) === 'direct').length,
  followups: activities.filter(a => a.action === 'followup_set').length,
  conversions: activities.filter(a => a.action === 'converted').length,
  rnr: activities.filter(a => a.action === 'rnr').length,
  blocking: activities.filter(a => a.action === 'blocking_amount_received').length,
  fullAmount: activities.filter(a => a.action === 'full_amount_received').length,
  lost: activities.filter(a => ['lost', 'not_interested'].includes(a.action)).length,
  escalated: activities.filter(a => a.action === 'escalated').length,
  revenue: sumRevenue(activities)
});

// Protect all routes
router.use(verifyToken);

/**
 * GET /api/stats/user/:id
 * Get performance stats for a specific user
 */
router.get('/user/:id', async (req, res) => {
  try {
    const userId = req.params.id;
    const { month, year } = req.query;

    const now = new Date();
    const currentMonth = month ? parseInt(month) : now.getMonth();
    const currentYear = year ? parseInt(year) : now.getFullYear();

    const startOfMonth = new Date(currentYear, currentMonth, 1);
    const endOfMonth = new Date(currentYear, currentMonth + 1, 0, 23, 59, 59, 999);

    // 1. Basic User Info
    const user = await User.findById(userId).select('-password');
    if (!user) return res.status(404).json({ message: 'User not found' });

    // 2. Lead Stats
    const totalLeads = await Lead.countDocuments({ owner: userId });
    const activeLeads = await Lead.countDocuments({ 
      owner: userId, 
      status: { $nin: ['converted', 'lost', 'not_interested'] } 
    });
    const convertedLeads = await Lead.countDocuments({ 
      owner: userId, 
      status: 'converted',
      updatedAt: { $gte: startOfMonth, $lte: endOfMonth }
    });

    // 3. Activity Stats (Monthly)
    const activities = await LeadActivity.find({
      performedBy: userId,
      createdAt: { $gte: startOfMonth, $lte: endOfMonth }
    }).populate('lead', 'status');

    const stats = countActions(activities);

    // 4. Attendance Stats (Monthly)
    const attendanceRecords = await Attendance.find({
      user: userId,
      date: { $gte: startOfMonth, $lte: endOfMonth }
    });

    // The month's work %: the average of its daily work percentages, from the
    // one definition in workPercentService.
    const workPctById = await getWorkPct([userId], startOfMonth, endOfMonth);
    const avgWorkPct = Math.round(workPctById.get(String(userId))?.workPct || 0);

    const presentDays = attendanceRecords.filter(a => ['present', 'half_day'].includes(a.status)).length;

    // Attendance quality: share of this month's recorded working days the user was
    // present (a half day counts half). Holidays are not working days.
    const workingDays = attendanceRecords.filter(a => !NON_WORKING_STATUSES.includes(a.status));
    const attendedDays = workingDays.reduce(
      (sum, a) => sum + (a.status === 'present' ? 1 : a.status === 'half_day' ? 0.5 : 0), 0
    );
    const attendancePct = workingDays.length > 0 ? Math.round((attendedDays / workingDays.length) * 100) : 0;

    res.json({
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        state: user.state,
        district: user.district,
        industry: user.industry,
        employeeId: user.employeeId,
        basicSalary: user.basicSalary,
        dateOfJoining: user.dateOfJoining,
        documents: user.documents,
        achievements: user.achievements
      },
      performance: {
        totalLeads,
        activeLeads,
        convertedLeads,
        monthly: stats,
        avgWorkPct,
        presentDays,
        attendancePct
      }
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/**
 * GET /api/stats/user/:id/actions?period=&value=
 * Lead actions the user performed in the selected period (same periods as the
 * Founder Summary filter: today / week / month / quarter / year).
 */
router.get('/user/:id/actions', async (req, res) => {
  try {
    const { period = 'month', value } = req.query;
    const activities = await LeadActivity.find({
      performedBy: req.params.id,
      createdAt: createdAtRange(period, value)
    }).select('action metadata lead').populate('lead', 'status').lean();
    res.json(countActions(activities));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/**
 * GET /api/stats/user/:id/performance?period=&value=
 * One user's own row of the Team Performance Leaderboard — Work %, Leads, Calls,
 * Direct/Virtual Meetings, Blockings, Revenue — from performanceService, so a
 * person's My Performance card and their line in a manager's table can never
 * disagree.
 */
router.get('/user/:id/performance', async (req, res) => {
  try {
    const { period = 'month', value } = req.query;
    const { start, end } = getDateRange(period, value);
    const metrics = await getPerformanceMetrics([req.params.id], start, end);
    res.json(metrics.get(String(req.params.id)) || EMPTY_METRICS);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
