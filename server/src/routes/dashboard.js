const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { verifyToken } = require('../middleware/auth');
const User = require('../models/User');
const Lead = require('../models/Lead');
const LeadActivity = require('../models/LeadActivity');
const Attendance = require('../models/Attendance');
const Leave = require('../models/Leave');
const LeavePolicy = require('../models/LeavePolicy');
const Salary = require('../models/Salary');

// Protect all routes
router.use(verifyToken);

/**
 * Helper: Get Date Ranges
 */
/**
 * Helper: Get Date Ranges
 */
const getDateRange = (type, value) => {
  const now = new Date();
  let start = new Date(now);
  let end = new Date(now);

  const normalizeType = (t) => {
    if (t === 'day' || t === 'daily' || t === 'today') return 'today';
    if (t === 'week' || t === 'weekly') return 'weekly';
    if (t === 'month' || t === 'monthly') return 'monthly';
    if (t === 'year' || t === 'yearly') return 'yearly';
    return t;
  };

  const period = normalizeType(type);

  if (period === 'today') {
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
  } else if (period === 'weekly') {
    if (value && value.startsWith('Week ')) {
      const weekNum = parseInt(value.split(' ')[1]);
      // Approximate week start by day of month (1, 8, 15, 22, 29)
      start.setDate(1 + (weekNum - 1) * 7);
      start.setHours(0, 0, 0, 0);
      end = new Date(start);
      if (weekNum === 4 || weekNum === 5) {
        // Last week goes to end of month
        end = new Date(start.getFullYear(), start.getMonth() + 1, 0, 23, 59, 59, 999);
      } else {
        end.setDate(start.getDate() + 6);
        end.setHours(23, 59, 59, 999);
      }
    } else {
      const day = now.getDay();
      const diff = now.getDate() - day + (day === 0 ? -6 : 1);
      start.setDate(diff);
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
    }
  } else if (period === 'monthly') {
    if (value) {
      const monthMap = { 'January': 0, 'February': 1, 'March': 2, 'April': 3, 'May': 4, 'June': 5, 'July': 6, 'August': 7, 'September': 8, 'October': 9, 'November': 10, 'December': 11 };
      const monthIdx = monthMap[value];
      if (monthIdx !== undefined) start.setMonth(monthIdx);
    }
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
    end = new Date(start.getFullYear(), start.getMonth() + 1, 0, 23, 59, 59, 999);
  } else if (period === 'quarter') {
    const qMap = { 'Q1': 0, 'Q2': 3, 'Q3': 6, 'Q4': 9 };
    const qMonth = qMap[value] !== undefined ? qMap[value] : Math.floor(now.getMonth() / 3) * 3;
    start.setMonth(qMonth, 1);
    start.setHours(0, 0, 0, 0);
    end = new Date(start.getFullYear(), qMonth + 3, 0, 23, 59, 59, 999);
  } else if (period === 'yearly') {
    if (value) {
      const yr = parseInt(value);
      if (!isNaN(yr)) start.setFullYear(yr);
    }
    start.setMonth(0, 1);
    start.setHours(0, 0, 0, 0);
    end = new Date(start.getFullYear(), 11, 31, 23, 59, 59, 999);
  }

  return { start, end };
};

/**
 * Helper: Calculate Leave Balance
 */
const getLeaveBalance = async (user) => {
  const year = new Date().getFullYear();
  const policy = await LeavePolicy.findOne({ state: user.state, year });
  if (!policy) return { paid: 0, optionalHoliday: 0 };

  const approvedLeaves = await Leave.find({
    user: user._id,
    status: 'approved',
    fromDate: { $gte: new Date(year, 0, 1) },
    toDate: { $lte: new Date(year, 11, 31) }
  });

  const used = approvedLeaves.reduce((acc, l) => {
    acc[l.type] = (acc[l.type] || 0) + l.days;
    return acc;
  }, {});

  return {
    paid: (policy.paidLeavesPerMonth || 0) - (used.paid || 0),
    optionalHoliday: (policy.optionalHolidayQuota || 0) - (used.optional_holiday || 0)
  };
};

/**
 * GET /executive -> personal execution dashboard for all roles
 */
router.get('/executive', async (req, res) => {
  try {
    // Allow any role to see their OWN stats if they are assigned leads
    const userId = req.user._id;

    const { start: todayStart, end: todayEnd } = getDateRange('today');
    const { start: monthStart } = getDateRange('monthly');
    const { start: weekStart } = getDateRange('weekly');

    const prevWeekStart = new Date(weekStart);
    prevWeekStart.setDate(prevWeekStart.getDate() - 7);
    const prevWeekEnd = new Date(weekStart);

    // 1. Today Stats from LeadActivity
    const todayActivities = await LeadActivity.find({
      performedBy: req.user._id,
      createdAt: { $gte: todayStart, $lte: todayEnd }
    });

    // Attendance data for completionPct
    const attendance = await Attendance.findOne({ user: req.user._id, date: { $gte: todayStart, $lte: todayEnd } });

    const todayStats = {
      totalLeads: attendance ? attendance.totalLeads : await Lead.countDocuments({ 
        owner: req.user._id, 
        status: { $nin: ['converted', 'lost', 'not_interested'] } 
      }),
      completedLeads: await LeadActivity.distinct('lead', {
        performedBy: req.user._id,
        createdAt: { $gte: todayStart },
        action: { $in: ['called', 'followup_set', 'meeting_scheduled', 'meeting_done', 'converted'] }
      }).then(res => res.length),
      calls: todayActivities.filter(a => a.action === 'called').length,
      followups: todayActivities.filter(a => a.action === 'followup_set').length,
      meetings: todayActivities.filter(a => ['meeting_scheduled', 'meeting_done'].includes(a.action)).length,
      converted: todayActivities.filter(a => a.action === 'converted').length,
      revenueToday: todayActivities
        .filter(a => a.action === 'converted' && a.metadata?.revenue)
        .reduce((sum, a) => sum + (a.metadata.revenue || 0), 0),
      hotPipelineCount: await Lead.countDocuments({
        owner: req.user._id,
        priority: 'hot',
        status: { $nin: ['converted', 'lost'] }
      }),
      points: (todayActivities.filter(a => a.action === 'called').length * 10) +
              (todayActivities.filter(a => ['meeting_scheduled', 'meeting_done'].includes(a.action)).length * 50) +
              (todayActivities.filter(a => a.action === 'converted').length * 200),
      completionPct: attendance ? attendance.completionPct : 0
    };

    // 2. Weekly Stats for growth
    const weeklyCalls = await LeadActivity.countDocuments({
      performedBy: req.user._id,
      action: 'called',
      createdAt: { $gte: weekStart }
    });

    const prevWeeklyCalls = await LeadActivity.countDocuments({
      performedBy: req.user._id,
      action: 'called',
      createdAt: { $gte: prevWeekStart, $lt: prevWeekEnd }
    });

    const callGrowth = prevWeeklyCalls > 0 ? weeklyCalls - prevWeeklyCalls : 0;

    // 3. Monthly Stats
    const monthlyActivities = await LeadActivity.find({
      performedBy: req.user._id,
      createdAt: { $gte: monthStart }
    });

    const monthlyStats = {
      totalLeads: await Lead.countDocuments({ owner: req.user._id, createdAt: { $gte: monthStart } }),
      converted: monthlyActivities.filter(a => a.action === 'converted').length,
      revenue: monthlyActivities
        .filter(a => a.action === 'converted' && a.metadata?.revenue)
        .reduce((sum, a) => sum + (a.metadata.revenue || 0), 0),
      totalCalls: monthlyActivities.filter(a => a.action === 'called').length,
      totalMeetings: monthlyActivities.filter(a => ['meeting_scheduled', 'meeting_done'].includes(a.action)).length,
      leaveDays: await Leave.countDocuments({ 
        user: req.user._id, 
        status: 'approved', 
        fromDate: { $gte: monthStart } 
      })
    };

    // 4. Upcoming Meetings
    const upcomingMeetings = await Lead.find({
      owner: req.user._id,
      meetingAt: { $gte: new Date() }
    })
    .sort({ meetingAt: 1 })
    .limit(3)
    .select('name meetingAt status meetingLink company');

    const meetingsFormatted = upcomingMeetings.map(m => ({
      lead: m.company || m.name,
      meetingAt: m.meetingAt,
      type: m.status.includes('virtual') ? 'Virtual' : 'Direct',
      meetingLink: m.meetingLink
    }));

    // 5. Leave Balance
    const leaveBalance = await getLeaveBalance(req.user);

    // 6. Performance Score
    const performanceScore = (monthlyStats.totalLeads > 0 ? (monthlyStats.converted / monthlyStats.totalLeads) : 0) * 100;

    // 7. Lead Sources Breakdown
    const myLeads = await Lead.find({ owner: userId });
    const leadSourcesMap = myLeads.reduce((acc, lead) => {
      const source = lead.source || 'Other';
      acc[source] = (acc[source] || 0) + 1;
      return acc;
    }, {});

    const sourcesFormatted = Object.entries(leadSourcesMap).map(([label, count]) => ({
      label,
      count,
      icon: label === 'Industry Partner' ? '🏢' : label === 'Corporate Account' ? '🤝' : '🔗'
    }));

    // 8. Strategy Logs
    const strategyLogs = await LeadActivity.find({
      performedBy: userId,
      action: 'converted'
    })
    .sort({ createdAt: -1 })
    .limit(5)
    .populate('lead', 'company name');

    res.json({
      user: { name: req.user.name, state: req.user.state, industry: req.user.industry },
      todayStats,
      weeklyStats: {
        calls: weeklyCalls,
        callGrowth
      },
      monthlyStats,
      workStarted: !!attendance?.workStartedAt && !attendance?.workCompletedAt,
      attendance: {
        _id: attendance?._id,
        status: attendance?.status || 'absent',
        workStartedAt: attendance?.workStartedAt,
        workCompletedAt: attendance?.workCompletedAt,
        completionPct: attendance?.completionPct || 0
      },
      upcomingMeetings: meetingsFormatted,
      leadSources: sourcesFormatted,
      strategyLogs: strategyLogs.map(s => ({
        leadName: s.lead?.company || s.lead?.name || 'Unknown',
        strategy: s.note || 'No strategy logged',
        date: s.createdAt
      })),
      performanceScore: Math.round(performanceScore * 10) / 10
    });

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/**
 * GET /meetings -> detailed meeting management for executive
 */
router.get('/meetings', async (req, res) => {
  try {
    const userId = req.user._id;
    const { start: todayStart, end: todayEnd } = getDateRange('today');
    const { start: monthStart } = getDateRange('monthly');

    // 1. All relevant leads with meetings
    const meetingLeads = await Lead.find({
      owner: userId,
      meetingAt: { $exists: true }
    }).sort({ meetingAt: 1 });

    // 2. Filter categorized lists
    const directMeetings = meetingLeads.filter(l => l.status === 'meeting_direct' || l.status === 'direct_meeting');
    const virtualMeetings = meetingLeads.filter(l => l.status === 'meeting_virtual' || l.status === 'virtual_meeting');

    // 3. Metrics
    const metrics = {
      directCount: directMeetings.length,
      pendingConfirm: directMeetings.filter(l => !l.meetingConfirmed).length,
      virtualCount: virtualMeetings.length,
      happeningToday: meetingLeads.filter(l => l.meetingAt >= todayStart && l.meetingAt <= todayEnd).length,
      completedMonth: await LeadActivity.countDocuments({
        performedBy: userId,
        action: 'meeting_done',
        createdAt: { $gte: monthStart }
      }),
      rnrCancelled: meetingLeads.filter(l => l.status === 'rnr' || l.status === 'cancelled').length
    };

    // 4. Format for UI
    const formatMeeting = (l) => ({
      id: l._id,
      company: l.company || l.name,
      contactName: l.name,
      contactRole: l.role || 'Managing Director',
      time: l.meetingAt,
      location: l.city || l.address || 'Mumbai',
      link: l.meetingLink,
      revenuePotential: l.expectedRevenue || 0,
      status: l.status.toUpperCase(),
      priority: l.priority,
      rnrCount: l.rnrCount || 0,
      isConfirmed: l.meetingConfirmed || false,
      lastInteraction: l.updatedAt
    });

    res.json({
      metrics,
      directMeetings: directMeetings.map(formatMeeting),
      virtualMeetings: virtualMeetings.map(formatMeeting)
    });

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/**
 * POST /strategy -> Log a winning strategy
 */
router.post('/strategy', async (req, res) => {
  try {
    const { note } = req.body;
    if (!note) return res.status(400).json({ message: 'Strategy note is required' });

    await LeadActivity.create({
      performedBy: req.user._id,
      action: 'strategy_logged',
      note: note,
      metadata: { type: 'personal_strategy' }
    });

    res.json({ message: 'Strategy logged successfully' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/**
 * GET /industry-manager -> role: industry_manager
 */
router.get('/industry-manager', async (req, res) => {
  try {
    if (req.user.role !== 'industry_manager') {
      return res.status(403).json({ message: 'Forbidden: Industry Manager only' });
    }

    // Accept optional period/value for time-filtered summary
    const { period = 'month', value } = req.query;

    const { start: todayStart, end: todayEnd } = getDateRange('today');
    const { start: weekStart } = getDateRange('weekly');
    const { start: monthStart } = getDateRange('monthly');

    // Selected period range used for lead stats & revenue summary
    const { start: periodStart, end: periodEnd } = getDateRange(period, value);

    const prevMonthStart = new Date(monthStart);
    prevMonthStart.setMonth(prevMonthStart.getMonth() - 1);
    const prevMonthEnd = new Date(monthStart);

    const prevWeekStart = new Date(weekStart);
    prevWeekStart.setDate(prevWeekStart.getDate() - 7);
    const prevWeekEnd = new Date(weekStart);

    // 1. Team Summary
    const teamUsers = await User.find({ industry: req.user.industry, state: req.user.state, role: 'executive' });
    const teamIds = teamUsers.map(u => u._id);

    const activeAttendances = await Attendance.find({
      user: { $in: teamIds },
      date: { $gte: todayStart },
      workStartedAt: { $exists: true }
    });

    // 2. Revenue & Growth
    const revenueStats = await LeadActivity.aggregate([
      { 
        $match: { 
          action: 'converted', 
          performedBy: { $in: teamIds },
          createdAt: { $gte: prevMonthStart }
        } 
      },
      {
        $group: {
          _id: {
            isCurrent: { $gte: ['$createdAt', monthStart] }
          },
          total: { $sum: '$metadata.revenue' }
        }
      }
    ]);

    const currentRevenue = revenueStats.find(r => r._id.isCurrent)?.total || 0;
    const prevRevenue = revenueStats.find(r => !r._id.isCurrent)?.total || 0;
    const revGrowth = prevRevenue > 0 ? ((currentRevenue - prevRevenue) / prevRevenue) * 100 : 0;

    // 3. Calls & Weekly Growth
    const callStats = await LeadActivity.aggregate([
      { 
        $match: { 
          action: 'called', 
          performedBy: { $in: teamIds },
          createdAt: { $gte: prevWeekStart }
        } 
      },
      {
        $group: {
          _id: {
            isCurrent: { $gte: ['$createdAt', weekStart] }
          },
          count: { $sum: 1 }
        }
      }
    ]);

    const currentCalls = callStats.find(c => c._id.isCurrent)?.count || 0;
    const prevCalls = callStats.find(c => !c._id.isCurrent)?.count || 0;
    const callGrowth = prevCalls > 0 ? ((currentCalls - prevCalls) / prevCalls) * 100 : 0;

    // 4. Meetings Breakdown
    const meetingStats = await Lead.aggregate([
      {
        $match: {
          industry: req.user.industry,
          state: req.user.state,
          meetingAt: { $gte: weekStart, $lte: todayEnd }
        }
      },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    const meetings = {
      total: meetingStats.reduce((sum, s) => sum + s.count, 0),
      virtual: meetingStats.find(s => s._id === 'meeting_scheduled' || s._id === 'virtual_meeting')?.count || 0,
      direct: meetingStats.find(s => s._id === 'meeting_done' || s._id === 'direct_meeting')?.count || 0
    };

    // 5. Lead Stats & Funnel — period-filtered when a period is selected
    // Scoped to industry only (no state), matching the leads API behaviour for IM role
    const baseLeadQuery = { industry: req.user.industry };
    const periodLeadQuery = { ...baseLeadQuery, createdAt: { $gte: periodStart, $lte: periodEnd } };

    const [allLeads, periodLeads] = await Promise.all([
      Lead.find(baseLeadQuery),
      Lead.find(periodLeadQuery)
    ]);

    // Overall funnel (all-time) for the pipeline card
    const leadStats = {
      total: allLeads.length,
      new: allLeads.filter(l => l.status === 'new').length,
      hot: allLeads.filter(l => l.priority === 'hot' && !['converted', 'lost'].includes(l.status)).length,
      warm: allLeads.filter(l => l.priority === 'warm' && !['converted', 'lost'].includes(l.status)).length,
      followup: allLeads.filter(l => l.status === 'followup').length,
      converted: allLeads.filter(l => l.status === 'converted').length,
      lost: allLeads.filter(l => l.status === 'lost').length,
      rnr: allLeads.filter(l => l.status === 'rnr').length,
      escalated: allLeads.filter(l => l.status === 'escalated').length,
    };

    // Period-filtered activity stats (calls, revenue) + live meeting count (status-based, not date-based)
    const [periodActivities, periodMeetingLeads, activeLeadsCount] = await Promise.all([
      LeadActivity.find({
        performedBy: { $in: teamIds },
        createdAt: { $gte: periodStart, $lte: periodEnd }
      }),
      // Count leads currently in meeting stage — matches the Lead Management meeting tab exactly
      Lead.countDocuments({
        industry: req.user.industry,
        status: { $in: ['meeting_virtual', 'meeting_direct'] }
      }),
      // Active leads — live snapshot, not period-filtered
      Lead.countDocuments({
        owner: { $in: teamIds },
        status: { $nin: ['converted', 'lost', 'not_interested'] }
      })
    ]);

    const periodStats = {
      totalLeads: periodLeads.length,
      converted: periodLeads.filter(l => l.status === 'converted').length,
      new: periodLeads.filter(l => l.status === 'new').length,
      hot: periodLeads.filter(l => l.priority === 'hot' && !['converted', 'lost'].includes(l.status)).length,
      calls: periodActivities.filter(a => a.action === 'called').length,
      meetings: periodMeetingLeads,
      revenue: periodActivities
        .filter(a => a.action === 'converted' && a.metadata?.revenue)
        .reduce((sum, a) => sum + (a.metadata.revenue || 0), 0),
    };

    // 6. Optimized Executive Performance (Bulk queries)
    const [teamAttendance, teamActivities, teamLeads] = await Promise.all([
        Attendance.find({ user: { $in: teamIds }, date: { $gte: prevWeekStart } }),
        LeadActivity.find({ performedBy: { $in: teamIds }, createdAt: { $gte: monthStart } }),
        Lead.find({ owner: { $in: teamIds } })
    ]);

    const executivePerformance = teamUsers.map((u) => {
      const att = teamAttendance.find(a => a.user.toString() === u._id.toString() && new Date(a.date) >= todayStart);
      const prevWeekAtt = teamAttendance.filter(a => a.user.toString() === u._id.toString() && new Date(a.date) < monthStart);
      
      const userActs = teamActivities.filter(a => a.performedBy.toString() === u._id.toString());
      const userLeads = teamLeads.filter(l => l.owner.toString() === u._id.toString());
      const activeLeads = userLeads.filter(l => !['converted', 'lost'].includes(l.status));

      const avgWorkPrevWeek = prevWeekAtt.length > 0 
        ? prevWeekAtt.reduce((sum, a) => sum + a.completionPct, 0) / prevWeekAtt.length 
        : 0;
      
      const workGrowth = (att?.completionPct || 0) - avgWorkPrevWeek;

      return {
        _id: u._id,
        name: u.name,
        district: u.district,
        completionPct: att?.completionPct || 0,
        workGrowth: Math.round(workGrowth),
        calls: userActs.filter(a => a.action === 'called').length,
        meetings: userActs.filter(a => a.action.startsWith('meeting')).length,
        converted: userActs.filter(a => a.action === 'converted').length,
        revenue: userActs
          .filter(a => a.action === 'converted' && a.metadata?.revenue)
          .reduce((sum, a) => sum + (a.metadata.revenue || 0), 0),
        hotCount: activeLeads.filter(l => l.priority === 'hot').length,
        leadsCount: activeLeads.length,
        followupsCount: activeLeads.filter(l => l.status === 'followup').length,
        isWorking: !!att?.workStartedAt && !att?.workCompletedAt,
        status: att?.workStartedAt && !att?.workCompletedAt ? 'Active' : 'Offline'
      };
    });

    // Calculate Average Work Growth for the whole team
    const avgWorkPct = executivePerformance.length > 0
        ? executivePerformance.reduce((sum, e) => sum + e.completionPct, 0) / executivePerformance.length
        : 0;
    
    const avgWorkGrowth = executivePerformance.length > 0
        ? executivePerformance.reduce((sum, e) => sum + e.workGrowth, 0) / executivePerformance.length
        : 0;

    const onLeaveCount = await Leave.countDocuments({
        user: { $in: teamIds },
        status: 'approved',
        fromDate: { $lte: todayEnd },
        toDate: { $gte: todayStart }
    });

    const below30Count = executivePerformance.filter(e => e.completionPct < 30 && e.isWorking).length;

    const convertedLastMonth = await LeadActivity.countDocuments({
      action: 'converted',
      performedBy: { $in: teamIds },
      createdAt: { $gte: prevMonthStart, $lt: prevMonthEnd }
    });

    // 7. Escalated Leads
    const escalatedLeads = await Lead.find({
      industry: req.user.industry,
      escalatedTo: req.user._id,
      status: { $nin: ['converted', 'lost'] }
    }).populate('owner', 'name');

    // 8. Upcoming Events
    const upcomingLeads = await Lead.find({
      industry: req.user.industry,
      $or: [
        { meetingAt: { $gte: todayStart } },
        { nextActionAt: { $gte: todayStart } }
      ]
    })
    .sort({ meetingAt: 1, nextActionAt: 1 })
    .limit(10)
    .populate('owner', 'name');

    const upcomingEvents = upcomingLeads.map(l => ({
      leadId: l._id,
      type: l.status.includes('meeting') ? 'meeting' : 'followup',
      name: l.status.includes('meeting') ? `Meeting - ${l.company || l.name}` : `Follow-up - ${l.company || l.name}`,
      ownerName: l.owner?.name,
      ownerId: l.owner?._id,
      company: l.company || 'Private Client',
      contactName: l.name,
      phone: l.phone,
      district: l.district,
      priority: l.priority,
      time: l.meetingAt || l.nextActionAt,
      status: l.status,
      notes: l.notes || l.remarks || '',
    }));

    // 9. Leave Requests
    const leaveRequests = await Leave.find({
      user: { $in: teamIds },
      status: 'pending'
    }).populate('user', 'name role district');

    // 10. All Leads for Management Table
    const allLeadsPopulated = await Lead.find({
      industry: req.user.industry
    })
    .populate('owner', 'name')
    .sort({ createdAt: -1 });

    const leadsFormatted = allLeadsPopulated.map((l, idx) => ({
      _id: l._id,
      leadId: l.leadId || `RM-A${String(idx + 1).padStart(3, '0')}`,
      company: l.company || 'Private Client',
      name: l.name,
      district: l.district,
      owner: l.owner?.name || 'Unassigned',
      status: l.status.toUpperCase(),
      priority: l.priority,
      rnrCount: l.rnrCount || 0,
      revenue: l.expectedRevenue || 0,
      createdAt: l.createdAt,
      age: Math.floor((new Date() - new Date(l.createdAt)) / (1000 * 60 * 60 * 24))
    }));

    res.json({
      user: { name: req.user.name, state: req.user.state, industry: req.user.industry },
      stats: {
        totalExecutives: teamUsers.length,
        activeToday: activeAttendances.length,
        avgWorkPct: Math.round(avgWorkPct),
        avgWorkGrowth: Math.round(avgWorkGrowth),
        onLeaveToday: onLeaveCount,
        below30Work: below30Count,
        revenue: currentRevenue,
        revGrowth: Math.round(revGrowth),
        totalLeads: leadStats.total,
        hotLeads: leadStats.hot,
        warmLeads: leadStats.warm,
        convertedThisMonth: leadStats.converted,
        callsThisWeek: currentCalls,
        callGrowth: Math.round(callGrowth),
        meetings: meetings,
        rnrLeads: leadStats.rnr,
        convertedLastMonth
      },
      periodStats,
      activeLeads: activeLeadsCount,
      activePeriod: { period, value: value || null },
      executivePerformance,
      leads: leadsFormatted,
      leadStats,
      escalatedLeads,
      upcomingEvents,
      leaveRequests
    });

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/**
 * GET /state-manager -> role: state_manager
 */
router.get('/state-manager', async (req, res) => {
    try {
        if (req.user.role !== 'state_manager') {
            return res.status(403).json({ message: 'Forbidden: State Manager only' });
        }

        const { start: todayStart, end: todayEnd } = getDateRange('today');
        const { start: monthStart } = getDateRange('monthly');
        const { start: weekStart } = getDateRange('weekly');

        // 1. Industry Managers (Kerala)
        const managers = await User.find({ state: req.user.state, role: 'industry_manager' });
        const managerIds = managers.map(m => m._id);

        // 2. Executives & Teams
        const allExecutives = await User.find({ state: req.user.state, role: 'executive' });
        const executiveIds = allExecutives.map(u => u._id);
        const allTeamIds = [...managerIds, ...executiveIds];

        // 3. Stats for Top Cards
        const totalRevenue = await LeadActivity.aggregate([
            { $match: { 
                action: 'converted', 
                createdAt: { $gte: monthStart }
            }},
            { $lookup: { from: 'leads', localField: 'lead', foreignField: '_id', as: 'lead_info' } },
            { $unwind: '$lead_info' },
            { $match: { 'lead_info.state': req.user.state } },
            { $group: { _id: null, total: { $sum: '$metadata.revenue' } } }
        ]).then(res => res[0]?.total || 0);

        const activeLeadsCount = await Lead.countDocuments({ 
            state: req.user.state, 
            status: { $nin: ['converted', 'lost', 'not_interested'] } 
        });

        const convertedThisMonth = await LeadActivity.countDocuments({ 
            action: 'converted', 
            createdAt: { $gte: monthStart },
            performedBy: { $in: allTeamIds }
        });

        const pendingLeavesCount = await Leave.countDocuments({
            user: { $in: managerIds },
            status: 'pending'
        });

        const callsThisWeek = await LeadActivity.countDocuments({
            action: 'called',
            createdAt: { $gte: weekStart },
            performedBy: { $in: executiveIds }
        });

        const { start: prevWeekStart, end: prevWeekEnd } = (() => {
            const s = new Date(weekStart); s.setDate(s.getDate() - 7);
            const e = new Date(weekStart); e.setMilliseconds(e.getMilliseconds() - 1);
            return { start: s, end: e };
        })();
        const prevWeekCalls = await LeadActivity.countDocuments({
            action: 'called',
            createdAt: { $gte: prevWeekStart, $lte: prevWeekEnd },
            performedBy: { $in: executiveIds }
        });
        const callsGrowthWeek = prevWeekCalls > 0
            ? Math.round(((callsThisWeek - prevWeekCalls) / prevWeekCalls) * 100)
            : (callsThisWeek > 0 ? 100 : 0);

        const [meetingsVirtual, meetingsDirect, meetingsScheduled, followupsToday, newManagersThisMonth] = await Promise.all([
            Lead.countDocuments({ state: req.user.state, status: 'meeting_virtual', meetingAt: { $gte: todayStart } }),
            Lead.countDocuments({ state: req.user.state, status: 'meeting_direct',  meetingAt: { $gte: todayStart } }),
            Lead.countDocuments({ state: req.user.state, status: { $in: ['meeting_virtual', 'meeting_direct', 'meeting_scheduled'] }, meetingAt: { $gte: todayStart } }),
            Lead.countDocuments({ state: req.user.state, status: 'followup', nextActionAt: { $gte: todayStart, $lte: todayEnd } }),
            User.countDocuments({ state: req.user.state, role: 'industry_manager', createdAt: { $gte: monthStart } }),
        ]);

        // 3a. District Executive Specific Stats
        const todayAttendance = await Attendance.find({
            user: { $in: executiveIds },
            date: { $gte: todayStart }
        });

        const avgWorkPct = todayAttendance.length > 0 
            ? Math.round(todayAttendance.reduce((sum, a) => sum + a.completionPct, 0) / todayAttendance.length) 
            : 0;

        const onLeaveToday = await Leave.countDocuments({
            user: { $in: executiveIds },
            status: 'approved',
            fromDate: { $lte: todayEnd },
            toDate: { $gte: todayStart }
        });

        const below30Work = todayAttendance.filter(a => a.completionPct < 30).length;

        // 3b. Attendance Presence Stats
        const presentToday = todayAttendance.filter(a => a.status === 'present' || a.status === 'half-day').length;
        
        const halfDaysThisWeek = await Attendance.countDocuments({
            user: { $in: executiveIds },
            date: { $gte: weekStart },
            status: 'half-day'
        });

        const totalWorkDays = (() => {
            const y = monthStart.getFullYear(), m = monthStart.getMonth();
            const daysInMonth = new Date(y, m + 1, 0).getDate();
            let count = 0;
            for (let d = 1; d <= daysInMonth; d++) {
                const day = new Date(y, m, d).getDay();
                if (day !== 0 && day !== 6) count++;
            }
            return count;
        })();
        const monthlyAttendanceRecords = await Attendance.countDocuments({
            user: { $in: executiveIds },
            date: { $gte: monthStart },
            status: { $in: ['present', 'half-day'] }
        });
        const avgAttendanceMonth = Math.round((monthlyAttendanceRecords / (executiveIds.length * totalWorkDays || 1)) * 100);

         // 10. Growth Metrics
    const prevMonthStart = new Date(monthStart);
    prevMonthStart.setMonth(prevMonthStart.getMonth() - 1);
    const prevMonthEnd = new Date(monthStart);

    const prevMonthRevenue = await LeadActivity.aggregate([
      { $match: { action: 'converted', createdAt: { $gte: prevMonthStart, $lt: prevMonthEnd } } },
      {
        $lookup: {
          from: 'leads',
          localField: 'lead',
          foreignField: '_id',
          as: 'lead'
        }
      },
      { $unwind: '$lead' },
      { $match: { 'lead.state': req.user.state } },
      { $group: { _id: null, total: { $sum: '$lead.expectedRevenue' } } }
    ]);

    const prevMonthLeads = await Lead.countDocuments({ state: req.user.state, createdAt: { $gte: prevMonthStart, $lt: prevMonthEnd } });
    const prevMonthConv = await Lead.countDocuments({ state: req.user.state, status: 'converted', convertedAt: { $gte: prevMonthStart, $lt: prevMonthEnd } });

    const currentRevenue = totalRevenue || 0;
    const oldRevenue = prevMonthRevenue[0]?.total || 0;
    const revGrowth = oldRevenue > 0 ? ((currentRevenue - oldRevenue) / oldRevenue) * 100 : 0;

    const currentConvRate = activeLeadsCount > 0 ? (convertedThisMonth / (activeLeadsCount + convertedThisMonth)) * 100 : 0;
    const prevConvRate = prevMonthLeads > 0 ? (prevMonthConv / prevMonthLeads) * 100 : 0;
    const convGrowth = currentConvRate - prevConvRate;

        const industriesCount = [...new Set(managers.map(m => m.industry).filter(Boolean))].length;

        const stats = {
            industryManagersCount: managers.length,
            newManagersThisMonth,
            industriesCount,
            totalRevenue,
            activeLeads: activeLeadsCount,
            convertedThisMonth,
            districtExecutivesCount: allExecutives.length,
            pendingLeaves: pendingLeavesCount,
            callsThisWeek,
            meetingsScheduled,
            meetingsScheduled,
            meetingsVirtual,
            meetingsDirect,
            followupsToday,
            callsGrowthWeek,
            revGrowth: Math.round(revGrowth * 10) / 10,
            convRate: Math.round(currentConvRate * 10) / 10,
            convGrowth: Math.round(convGrowth * 10) / 10,
            avgWorkPct,
            onLeaveToday,
            below30Work,
            presentToday,
            halfDaysThisWeek,
            avgAttendanceMonth
        };

        // 4. Industry Manager List — bulk queries, no N+1
        const [imLeadStats, imActivityStats, imAttendanceStats] = await Promise.all([
            Lead.aggregate([
                { $match: { state: req.user.state } },
                { $group: { _id: '$industry', count: { $sum: 1 } } }
            ]),
            LeadActivity.aggregate([
                {
                    $match: {
                        performedBy: { $in: executiveIds },
                        action: { $in: ['called', 'converted'] },
                        createdAt: { $gte: monthStart }
                    }
                },
                {
                    $lookup: {
                        from: 'users',
                        localField: 'performedBy',
                        foreignField: '_id',
                        as: 'performer'
                    }
                },
                { $unwind: '$performer' },
                {
                    $group: {
                        _id: '$performer.industry',
                        calls:    { $sum: { $cond: [{ $eq: ['$action', 'called'] },    1, 0] } },
                        convs:    { $sum: { $cond: [{ $eq: ['$action', 'converted'] }, 1, 0] } },
                        revenue:  { $sum: { $cond: [{ $eq: ['$action', 'converted'] }, { $ifNull: ['$metadata.revenue', 0] }, 0] } }
                    }
                }
            ]),
            Attendance.aggregate([
                { $match: { user: { $in: executiveIds }, date: { $gte: todayStart } } },
                {
                    $lookup: {
                        from: 'users',
                        localField: 'user',
                        foreignField: '_id',
                        as: 'user'
                    }
                },
                { $unwind: '$user' },
                {
                    $group: {
                        _id: '$user.industry',
                        avgWorkPct: { $avg: '$completionPct' }
                    }
                }
            ])
        ]);

        const industryManagerSummary = managers.map((m) => {
            const team      = allExecutives.filter(e => e.industry === m.industry);
            const leadStat  = imLeadStats.find(x => x._id === m.industry)     || { count: 0 };
            const actStat   = imActivityStats.find(x => x._id === m.industry) || { calls: 0, convs: 0, revenue: 0 };
            const attStat   = imAttendanceStats.find(x => x._id === m.industry) || { avgWorkPct: 0 };

            return {
                _id: m._id,
                name: m.name,
                industry: m.industry,
                leadsCount:  leadStat.count,
                efficiency:  Math.round(attStat.avgWorkPct),
                calls:       actStat.calls,
                conversions: actStat.convs,
                revenue:     actStat.revenue,
                districts:   [...new Set(team.map(e => e.district))].length
            };
        });

        // 4b. District Executive List — bulk queries, no N+1
        const [execActivityStats, execOnLeave] = await Promise.all([
            LeadActivity.aggregate([
                {
                    $match: {
                        performedBy: { $in: executiveIds },
                        action: { $in: ['called', 'converted'] },
                        createdAt: { $gte: monthStart }
                    }
                },
                {
                    $group: {
                        _id: '$performedBy',
                        calls:       { $sum: { $cond: [{ $eq: ['$action', 'called'] },    1, 0] } },
                        conversions: { $sum: { $cond: [{ $eq: ['$action', 'converted'] }, 1, 0] } }
                    }
                }
            ]),
            Leave.find({
                user: { $in: executiveIds },
                status: 'approved',
                fromDate: { $lte: todayEnd },
                toDate:   { $gte: todayStart }
            }).select('user').lean()
        ]);

        const onLeaveSet = new Set(execOnLeave.map(l => l.user.toString()));

        const executivePerformance = allExecutives.map((e) => {
            const att   = todayAttendance.find(a => a.user.toString() === e._id.toString());
            const stats = execActivityStats.find(s => s._id.toString() === e._id.toString()) || { calls: 0, conversions: 0 };
            const onLeave = onLeaveSet.has(e._id.toString());

            return {
                _id: e._id,
                name: e.name,
                industry: e.industry,
                district: e.district,
                calls: stats.calls,
                conversions: stats.conversions,
                completionPct: att ? att.completionPct : 0,
                status: onLeave ? 'On Leave' : (att ? 'Active' : 'Not Started')
            };
        });

        // 5. Upcoming Events
        // Meetings, Follow-ups
        const upcomingLeads = await Lead.find({
            state: req.user.state,
            $or: [
                { meetingAt: { $gte: todayStart } },
                { nextActionAt: { $gte: todayStart } }
            ]
        })
        .sort({ meetingAt: 1, nextActionAt: 1 })
        .limit(5)
        .populate('owner', 'name');

        const upcomingEvents = upcomingLeads.map(l => ({
            type: l.status.includes('meeting') ? 'meeting' : 'followup',
            title: l.status.includes('meeting') ? `Meeting - ${l.company}` : `Follow-up - ${l.company}`,
            subTitle: `${l.owner?.name} → ${l.name}`,
            time: l.meetingAt || l.nextActionAt,
            status: l.status
        }));

        // Approved Leaves for today/tomorrow
        const upcomingLeaves = await Leave.find({
            user: { $in: allTeamIds },
            status: 'approved',
            toDate: { $gte: todayStart }
        }).populate('user', 'name role');

        upcomingLeaves.forEach(l => {
            upcomingEvents.push({
                type: 'leave',
                title: `Leave - ${l.user.name} (${l.user.role.replace('_', ' ')})`,
                subTitle: `${l.reason} · ${l.days} days`,
                time: l.fromDate,
                status: 'upcoming'
            });
        });

        // 6. Pipeline Data
        const pipeline = [
            { label: 'Hot', status: 'hot', color: '#EF4444' },
            { label: 'Warm', status: 'warm', color: '#F59E0B' },
            { label: 'Follow-up', status: 'followup', color: '#8B5CF6' },
            { label: 'Meeting', status: 'meeting_scheduled', color: '#06B6D4' },
            { label: 'Escalated', status: 'escalated', color: '#7C3AED' },
            { label: 'Converted', status: 'converted', color: '#10B981' },
            { label: 'Lost', status: 'lost', color: '#6B7280' }
        ];

        const pipelineData = await Promise.all(pipeline.map(async (p) => {
            let count = 0;
            if (p.status === 'hot' || p.status === 'warm') {
                count = await Lead.countDocuments({ state: req.user.state, priority: p.status, status: { $nin: ['converted', 'lost'] } });
            } else if (p.status === 'meeting_scheduled') {
                count = await Lead.countDocuments({ state: req.user.state, status: { $regex: /meeting/i } });
            } else {
                count = await Lead.countDocuments({ state: req.user.state, status: p.status });
            }
            return { ...p, val: count };
        }));

        // 7. Expected Onboarding Leads
        const expectedLeads = await Lead.find({
            state: req.user.state,
            status: { $nin: ['converted', 'lost', 'not_interested'] }
        })
        .sort({ updatedAt: -1 })
        .limit(10)
        .populate('owner', 'name');

        const expectedOnboarding = expectedLeads.map(l => {
            const age = Math.floor((new Date() - new Date(l.createdAt)) / (1000 * 60 * 60 * 24));
            return {
                leadId: l.leadId || `RM-${l._id.toString().slice(-4).toUpperCase()}`,
                business: l.company || l.name,
                contact: l.name,
                industry: l.industry,
                district: l.district,
                manager: l.owner?.name || 'Unassigned',
                status: l.status,
                priority: l.priority,
                revenue: l.expectedRevenue || 0,
                age: `${age}d`
            };
        });

        // 8. Pending Leave Requests (IMs + DEs — SM cannot approve own leave)
        const leaveRequests = await Leave.find({
            user: { $in: [...managerIds, ...executiveIds] },
            status: 'pending'
        }).populate('user', 'name role industry');

        // 9. Escalated Leads
        const escalated = await Lead.find({
            state: req.user.state,
            escalatedTo: req.user._id,
            status: { $nin: ['converted', 'lost'] }
        }).populate('owner', 'name');

        res.json({
            user: { name: req.user.name, state: req.user.state },
            stats,
            industryManagers: industryManagerSummary,
            executivePerformance,
            upcomingEvents: upcomingEvents.sort((a,b) => new Date(a.time) - new Date(b.time)),
            pipelineData,
            leaveRequests,
            expectedOnboarding,
            escalated
        });

    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

/**
 * GET /api/dashboard/revenue - Detailed revenue metrics
 */
router.get('/revenue', verifyToken, async (req, res) => {
  try {
    const { period = 'month', value } = req.query;
    const { start, end } = getDateRange(period, value);
    
    const query = { 
      action: 'converted',
      createdAt: { $gte: start, $lte: end }
    };

    const revenueAggregation = [
      { $match: query },
      {
        $lookup: {
          from: 'leads',
          localField: 'lead',
          foreignField: '_id',
          as: 'leadDetails'
        }
      },
      { $unwind: '$leadDetails' }
    ];

    if (req.user.role === 'state_manager') {
      revenueAggregation.push({ $match: { 'leadDetails.state': req.user.state } });
    } else if (req.user.role === 'industry_manager') {
      revenueAggregation.push({ $match: { 'leadDetails.industry': req.user.industry } });
    }

    const revenueData = await LeadActivity.aggregate([
      ...revenueAggregation,
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: { $ifNull: ['$metadata.revenue', '$leadDetails.actualRevenue', 0] } },
          count: { $sum: 1 },
          avgDealValue: { $avg: { $ifNull: ['$metadata.revenue', '$leadDetails.actualRevenue', 0] } }
        }
      }
    ]);

    const byCategory = await LeadActivity.aggregate([
      ...revenueAggregation,
      {
        $group: {
          _id: { $ifNull: ['$metadata.category', '$leadDetails.revenueCategory', 'other'] },
          revenue: { $sum: { $ifNull: ['$metadata.revenue', '$leadDetails.actualRevenue', 0] } },
          count: { $sum: 1 }
        }
      }
    ]);

    const byState = await LeadActivity.aggregate([
      ...revenueAggregation,
      {
        $group: {
          _id: '$leadDetails.state',
          revenue: { $sum: { $ifNull: ['$metadata.revenue', '$leadDetails.actualRevenue', 0] } },
          count: { $sum: 1 }
        }
      },
      { $sort: { revenue: -1 } }
    ]);

    const byIndustry = await LeadActivity.aggregate([
      ...revenueAggregation,
      {
        $group: {
          _id: '$leadDetails.industry',
          revenue: { $sum: { $ifNull: ['$metadata.revenue', '$leadDetails.actualRevenue', 0] } },
          count: { $sum: 1 }
        }
      },
      { $sort: { revenue: -1 } }
    ]);

    const recentConversions = await LeadActivity.aggregate([
      ...revenueAggregation,
      { $sort: { createdAt: -1 } },
      { $limit: 10 },
      {
        $project: {
          _id: 1,
          leadName: '$leadDetails.name',
          company: '$leadDetails.company',
          revenue: { $ifNull: ['$metadata.revenue', '$leadDetails.actualRevenue', 0] },
          category: { $ifNull: ['$metadata.category', '$leadDetails.revenueCategory', 'other'] },
          createdAt: 1
        }
      }
    ]);

    // Previous period for growth calculation
    const periodMs = end - start;
    const prevStart = new Date(start.getTime() - periodMs);
    const prevEnd   = new Date(start);
    const prevQuery = { action: 'converted', createdAt: { $gte: prevStart, $lte: prevEnd } };
    const prevRevAgg = [...revenueAggregation];
    prevRevAgg[0] = { $match: prevQuery }; // replace the first $match
    const prevRevenueData = await LeadActivity.aggregate([
      ...prevRevAgg,
      { $group: { _id: null, totalRevenue: { $sum: { $ifNull: ['$metadata.revenue', '$leadDetails.actualRevenue', 0] } }, count: { $sum: 1 } } }
    ]);
    const prevSummary = prevRevenueData[0] || { totalRevenue: 0, count: 0 };
    const currentSummary = revenueData[0] || { totalRevenue: 0, count: 0, avgDealValue: 0 };
    const growthPct = prevSummary.totalRevenue > 0
      ? Math.round(((currentSummary.totalRevenue - prevSummary.totalRevenue) / prevSummary.totalRevenue) * 1000) / 10
      : (currentSummary.totalRevenue > 0 ? 100 : 0);
    const countGrowth = currentSummary.count - prevSummary.count;

    res.json({
      summary: { ...currentSummary, growthPct, countGrowth, previousCount: prevSummary.count },
      byCategory,
      byState,
      byIndustry,
      recentConversions
    });

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/**
 * GET /founder -> role: founder
 */
router.get('/founder', async (req, res) => {
    try {
        if (req.user.role !== 'founder') {
            return res.status(403).json({ message: 'Forbidden: Founder only' });
        }

        const period = req.query.period || 'weekly';
        const periodValue = req.query.value;
        const { start: periodStart, end: periodEnd } = getDateRange(period, periodValue);
        
        const { start: todayStart } = getDateRange('today');
        const { start: monthStart } = getDateRange('monthly');

        // Stats for the top cards — filtered by selected period
        const totalLeads = await Lead.countDocuments({ createdAt: { $gte: periodStart, $lte: periodEnd } });
        const leadsToday = await Lead.countDocuments({ createdAt: { $gte: todayStart } });

        const activeLeadFilter = { status: { $nin: ['converted', 'lost', 'not_interested'] } };
        const periodLeadFilter = { createdAt: { $gte: periodStart, $lte: periodEnd } };
        const onboardingFilter = { ...activeLeadFilter, ...periodLeadFilter };
        const expectedOnboarding = await Lead.countDocuments(onboardingFilter);

        const totalConversions = await LeadActivity.countDocuments({ action: 'converted', createdAt: { $gte: periodStart, $lte: periodEnd } });
        const convertedThisMonth = await LeadActivity.countDocuments({ action: 'converted', createdAt: { $gte: monthStart } });

        const totalRevenue = await LeadActivity.aggregate([
            { $match: { action: 'converted', createdAt: { $gte: periodStart, $lte: periodEnd } } },
            { $group: { _id: null, total: { $sum: '$metadata.revenue' } } }
        ]).then(res => res[0]?.total || 0);

        const totalCalls = await LeadActivity.countDocuments({ action: 'called', createdAt: { $gte: periodStart, $lte: periodEnd } });
        const reachRate = totalLeads ? (totalCalls / totalLeads) * 100 : 0;
        const conversionRate = totalLeads ? (totalConversions / totalLeads) * 100 : 0;
        
        // Optimized Staff Stats Batching
        const activeStaff = await User.find({
            isActive: true,
            role: { $in: ['state_manager', 'industry_manager', 'executive'] }
        }).select('_id role');
        const activeStaffIds = activeStaff.map(u => u._id);

        const onLeaveToday = await Leave.find({
            user: { $in: activeStaffIds },
            status: 'approved',
            fromDate: { $lte: new Date() },
            toDate: { $gte: todayStart }
        }).select('user');
        const onLeaveUserIds = new Set(onLeaveToday.map(l => l.user.toString()));

        const startedToday = await Attendance.find({
            user: { $in: activeStaffIds },
            date: { $gte: todayStart },
            workStartedAt: { $exists: true }
        }).select('user');
        const startedUserIds = new Set(startedToday.map(a => a.user.toString()));

        const staffStatsRaw = ['state_manager', 'industry_manager', 'executive'].map((role) => {
            const usersForRole = activeStaff.filter(u => u.role === role);
            const onLeave = usersForRole.filter(u => onLeaveUserIds.has(u._id.toString())).length;
            const working = usersForRole.filter(u => startedUserIds.has(u._id.toString()) && !onLeaveUserIds.has(u._id.toString())).length;
            return {
                _id: role,
                count: usersForRole.length,
                working,
                onLeave,
                notStarted: Math.max(0, usersForRole.length - working - onLeave)
            };
        });

        const workingTodayRaw = staffStatsRaw.map(s => ({ _id: s._id, count: s.working }));
        const onLeaveTodayRaw = staffStatsRaw.map(s => ({ _id: s._id, count: s.onLeave }));

        const getStaffObj = (role) => {
            const stat = staffStatsRaw.find(s => s._id === role) || {};
            return {
                total: stat.count || 0,
                working: stat.working || 0,
                onLeave: stat.onLeave || 0,
                notStarted: stat.notStarted || 0
            };
        };

        const stateManagers = getStaffObj('state_manager');
        const industryManagers = getStaffObj('industry_manager');
        const salesStaff = getStaffObj('executive');
        const pendingLeavesCount = await Leave.countDocuments({ status: 'pending' });

        // Revenue growth vs previous month
        const prevMonthStartF = new Date(monthStart);
        prevMonthStartF.setMonth(prevMonthStartF.getMonth() - 1);
        const prevMonthRevenueF = await LeadActivity.aggregate([
            { $match: { action: 'converted', createdAt: { $gte: prevMonthStartF, $lt: monthStart } } },
            { $group: { _id: null, total: { $sum: '$metadata.revenue' } } }
        ]).then(r => r[0]?.total || 0);
        const revGrowthF = prevMonthRevenueF > 0
            ? Math.round(((totalRevenue - prevMonthRevenueF) / prevMonthRevenueF) * 100 * 10) / 10
            : (totalRevenue > 0 ? 100 : 0);

        const stats = {
            totalLeads,
            leadsToday,
            expectedOnboarding,
            converted: totalConversions,
            convertedThisMonth,
            revenue: totalRevenue,
            revGrowth: revGrowthF,
            totalCalls,
            reachRate: Math.round(reachRate * 10) / 10,
            conversionRate: Math.round(conversionRate * 10) / 10,
            stateManagers,
            industryManagers,
            salesStaff,
            executivesThisMonth: await User.countDocuments({ role: 'executive', createdAt: { $gte: monthStart } }),
            pendingLeavesCount
        };

        // 1. Overall Summary
        const totalStaff = staffStatsRaw.reduce((sum, s) => sum + s.count, 0);
        const activeToday = workingTodayRaw.reduce((sum, w) => sum + w.count, 0);
        
        const overallSummary = {
            totalStaff,
            totalLeads,
            converted: totalConversions,
            revenue: totalRevenue,
            activeTodayPct: totalStaff ? (activeToday / totalStaff) * 100 : 0
        };

        // 2. Optimized By State Aggregation
        const [stateStaff, stateLeads, stateActivities, stateAttendance] = await Promise.all([
            User.aggregate([
                { $group: { 
                    _id: '$state', 
                    staffCount: { $sum: 1 }, 
                    managers: { 
                        $push: { 
                            $cond: [
                                { $eq: ['$role', 'state_manager'] }, 
                                { _id: '$_id', name: '$name', email: '$email', phone: '$phone', state: '$state', district: '$district', country: '$country', dateOfJoining: '$dateOfJoining', basicSalary: '$basicSalary', aadhaarNumber: '$aadhaarNumber', panNumber: '$panNumber', documents: '$documents' }, 
                                '$$REMOVE'
                            ] 
                        } 
                    } 
                } }
            ]),
            Lead.aggregate([
                { $group: { 
                    _id: '$state', 
                    leads: { $sum: 1 }, 
                    converted: { $sum: { $cond: [{ $eq: ['$status', 'converted'] }, 1, 0] } } 
                }}
            ]),
            LeadActivity.aggregate([
                { $match: { action: { $in: ['called', 'converted', 'meeting_scheduled', 'meeting_done', 'meeting_virtual', 'meeting_direct'] }, createdAt: { $gte: periodStart, $lte: periodEnd } } },
                { $lookup: { from: 'leads', localField: 'lead', foreignField: '_id', as: 'lead' } },
                { $unwind: '$lead' },
                { $group: {
                    _id: '$lead.state',
                    calls: { $sum: { $cond: [{ $eq: ['$action', 'called'] }, 1, 0] } },
                    meetings: { $sum: { $cond: [{ $in: ['$action', ['meeting_scheduled', 'meeting_done', 'meeting_virtual', 'meeting_direct']] }, 1, 0] } },
                    revenue: { $sum: { $cond: [{ $eq: ['$action', 'converted'] }, '$metadata.revenue', 0] } }
                }}
            ]),
            Attendance.aggregate([
                { $match: { date: { $gte: periodStart, $lte: periodEnd } } },
                { $lookup: { from: 'users', localField: 'user', foreignField: '_id', as: 'user' } },
                { $unwind: '$user' },
                { $group: { _id: '$user.state', avgWorkPct: { $avg: '$completionPct' } } }
            ])
        ]);

        const states = await User.distinct('state', { state: { $ne: null } });
        const byState = states.map(s => {
            const staff = stateStaff.find(x => x._id === s) || {};
            const leads = stateLeads.find(x => x._id === s) || {};
            const acts = stateActivities.find(x => x._id === s) || {};
            const att = stateAttendance.find(x => x._id === s) || {};

            return {
                state: s,
                stateManager: staff.managers?.[0]?.name || 'Unassigned',
                stateManagerId: staff.managers?.[0]?._id,
                managerData: staff.managers?.[0],
                totalStaff: staff.staffCount || 0,
                leads: leads.leads || 0,
                converted: leads.converted || 0,
                calls: acts.calls || 0,
                meetings: acts.meetings || 0,
                revenue: acts.revenue || 0,
                avgWorkPct: att.avgWorkPct || 0
            };
        });

        // 3. Optimized By Industry Aggregation
        const [indLeads, indRevenue] = await Promise.all([
            Lead.aggregate([
                { $group: { _id: '$industry', leads: { $sum: 1 }, converted: { $sum: { $cond: [{ $eq: ['$status', 'converted'] }, 1, 0] } } } }
            ]),
            LeadActivity.aggregate([
                { $match: { action: 'converted', createdAt: { $gte: periodStart, $lte: periodEnd } } },
                { $lookup: { from: 'leads', localField: 'lead', foreignField: '_id', as: 'lead' } },
                { $unwind: '$lead' },
                { $group: { _id: '$lead.industry', revenue: { $sum: '$metadata.revenue' } } }
            ])
        ]);

        const industries = await User.distinct('industry', { industry: { $ne: null } });
        const byIndustry = industries.map(ind => {
            const leads = indLeads.find(x => x._id === ind) || {};
            const rev = indRevenue.find(x => x._id === ind) || {};
            return {
                industry: ind,
                leads: leads.leads || 0,
                converted: leads.converted || 0,
                revenue: rev.revenue || 0
            };
        });

        // 4. Pending Leave
        const pendingLeaveRequests = await Leave.find({ status: 'pending' })
            .populate('user', 'name role state industry')
            .then(leaves => leaves.filter(l => l.user));

        // 5. Recent Activity
        const recentActivity = await LeadActivity.find()
            .sort({ createdAt: -1 })
            .limit(20)
            .populate('performedBy', 'name role')
            .populate('lead', 'name');

        const upcomingMeetings = await Lead.find({
            meetingAt: { $gte: new Date() },
            status: { $in: ['meeting_virtual', 'meeting_direct'] }
        })
            .sort({ meetingAt: 1 })
            .limit(5)
            .populate('owner', 'name role state industry')
            .populate('meetingInvitees', 'name role');

        const formattedUpcomingMeetings = upcomingMeetings.map((meeting) => {
            const inviteeNames = (meeting.meetingInvitees || [])
                .map((invitee) => invitee?.name)
                .filter(Boolean);

            return {
                _id: meeting._id,
                leadName: meeting.name,
                company: meeting.company || '',
                meetingAt: meeting.meetingAt,
                meetingLink: meeting.meetingLink || '',
                type: meeting.status === 'meeting_virtual' ? 'Virtual' : 'Direct',
                owner: meeting.owner ? {
                    _id: meeting.owner._id,
                    name: meeting.owner.name,
                    role: meeting.owner.role,
                    state: meeting.owner.state,
                    industry: meeting.owner.industry
                } : null,
                inviteeSummary: inviteeNames.length > 0
                    ? inviteeNames.slice(0, 2).join(', ') + (inviteeNames.length > 2 ? ` +${inviteeNames.length - 2}` : '')
                    : ''
            };
        });

        // 6. Performance Summary
        const topExecutive = await LeadActivity.aggregate([
            { $match: { action: 'converted', createdAt: { $gte: periodStart, $lte: periodEnd } } },
            { $group: { _id: '$performedBy', count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 1 },
            { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'user' } },
            { $unwind: '$user' }
        ]).then(res => res[0] ? { name: res[0].user.name, count: res[0].count } : null);

        // Optimized Pipeline Stats (Single Aggregation)
        const pipelineStatsRaw = await Lead.aggregate([
            { $group: { _id: '$status', count: { $sum: 1 } } }
        ]);

        const getPipelineCount = (statusArr) => {
            if (typeof statusArr === 'string') return pipelineStatsRaw.find(p => p._id === statusArr)?.count || 0;
            return pipelineStatsRaw.filter(p => statusArr.includes(p._id)).reduce((sum, p) => sum + p.count, 0);
        };

        const allPipelineTotal = pipelineStatsRaw.reduce((sum, p) => sum + p.count, 0);
        const pipelineStats = [
            { label: 'All', count: allPipelineTotal, color: 'blue' },
            { label: 'New', count: getPipelineCount('new'), color: 'blue' },
            { label: 'Follow-up', count: getPipelineCount(['called', 'followup']), color: 'purple' },
            { label: 'Meeting', count: getPipelineCount(['meeting_virtual', 'meeting_direct']), color: 'teal' },
            { label: 'Converted', count: getPipelineCount('converted'), color: 'green' },
            { label: 'Lost', count: getPipelineCount(['lost', 'not_interested']), color: 'red' },
            { label: 'RNR', count: getPipelineCount('rnr'), color: 'gray' }
        ];

        // Optimized Performance Lists (Bulk Data Fetching)
        const allPerformanceUsers = await User.find({ role: { $in: ['industry_manager', 'executive'] }, isActive: true });
        const allPerfUserIds = allPerformanceUsers.map(u => u._id);

        const [perfAttendance, perfActivities, perfLeadsCount] = await Promise.all([
            Attendance.aggregate([
                { $match: { user: { $in: allPerfUserIds }, date: { $gte: periodStart, $lte: periodEnd } } },
                { $group: { _id: '$user', avgWorkPct: { $avg: '$completionPct' } } }
            ]),
            LeadActivity.aggregate([
                { $match: { performedBy: { $in: allPerfUserIds }, createdAt: { $gte: periodStart, $lte: periodEnd } } },
                { $group: {
                    _id: '$performedBy',
                    calls: { $sum: { $cond: [{ $eq: ['$action', 'called'] }, 1, 0] } },
                    meetings: { $sum: { $cond: [{ $in: ['$action', ['meeting_scheduled', 'meeting_done', 'meeting_virtual', 'meeting_direct']] }, 1, 0] } },
                    followups: { $sum: { $cond: [{ $eq: ['$action', 'followup_set'] }, 1, 0] } },
                    conversions: { $sum: { $cond: [{ $eq: ['$action', 'converted'] }, 1, 0] } },
                    revenue: { $sum: '$metadata.revenue' }
                }}
            ]),
            Lead.aggregate([
                { $group: { _id: '$owner', count: { $sum: 1 } } }
            ])
        ]);

        const getPerformanceData = (role) => {
            return allPerformanceUsers.filter(u => u.role === role).map(u => {
                const att = perfAttendance.find(a => a._id.toString() === u._id.toString());
                const acts = perfActivities.find(a => a._id.toString() === u._id.toString()) || {};
                const leads = perfLeadsCount.find(l => l._id?.toString() === u._id.toString()) || {};

                return {
                    _id: u._id,
                    name: u.name,
                    state: u.state,
                    industry: u.industry,
                    workPct: Math.round(att?.avgWorkPct || 0),
                    leads: leads.count || 0,
                    calls: acts.calls || 0,
                    meetings: acts.meetings || 0,
                    followups: acts.followups || 0,
                    converted: acts.conversions || 0,
                    revenue: acts.revenue || 0,
                    leaves: 0 // Simplified for performance, can be batched if critical
                };
            });
        };

        const industryManagersPerformance = getPerformanceData('industry_manager');
        const executivesPerformance = getPerformanceData('executive');

        const expectedOnboardingListLeads = await Lead.find(onboardingFilter)
        .sort({ updatedAt: -1 })
        .limit(10)
        .populate('owner', 'name');

        const expectedOnboardingList = expectedOnboardingListLeads.map(l => {
            const age = Math.floor((new Date() - new Date(l.createdAt)) / (1000 * 60 * 60 * 24));
            return {
                leadId: l.leadId || `RM-${l._id.toString().slice(-4).toUpperCase()}`,
                name: l.name,
                company: l.company || l.name,
                state: l.state,
                assignedTo: l.owner?.name || 'Unassigned',
                priority: l.priority,
                expectedDate: l.nextActionAt ? new Date(l.nextActionAt).toLocaleDateString() : 'TBD',
                age: `${age}d`,
                _id: l._id
            };
        });

        res.json({
            stats,
            pipelineStats,
            expectedOnboardingList,
            industryManagersPerformance,
            executivesPerformance,
            overallSummary,
            byState,
            byIndustry,
            pendingLeaves: pendingLeaveRequests,
            expectedOnboardingLeads: expectedOnboarding,
            recentActivity,
            upcomingMeetings: formattedUpcomingMeetings,
            performanceSummary: {
                topExecutive,
                topState: [...byState].sort((a,b) => b.revenue - a.revenue)[0]?.state,
                topIndustry: [...byIndustry].sort((a,b) => b.revenue - a.revenue)[0]?.industry
            }
        });

    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

/**
 * REPORTS ROUTES
 */

// Scope Helper for Reports
const applyScope = (req, query) => {
    if (req.user.role === 'executive') query.owner = req.user._id;
    else if (req.user.role === 'industry_manager') query.industry = req.user.industry;
    else if (req.user.role === 'state_manager') query.state = req.user.state;
};

// GET /api/dashboard/reports/leads
router.get('/reports/leads', async (req, res) => {
    try {
        const { from, to, state, industry, status, owner, page = 1, limit = 20 } = req.query;
        const query = {};
        applyScope(req, query);

        if (from || to) {
            query.createdAt = {};
            if (from) query.createdAt.$gte = new Date(from);
            if (to) query.createdAt.$lte = new Date(to);
        }

        if (state) query.state = state;
        if (industry) query.industry = industry;
        if (status) query.status = status;
        if (owner) query.owner = owner;

        const leads = await Lead.find(query)
            .populate('owner', 'name')
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(Number(limit));

        const total = await Lead.countDocuments(query);
        const summary = await Lead.aggregate([
            { $match: query },
            { $group: { _id: '$status', count: { $sum: 1 } } }
        ]);

        res.json({
            data: leads,
            pagination: { total, page: Number(page), pages: Math.ceil(total / limit) },
            summary
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// GET /api/dashboard/reports/performance
router.get('/reports/performance', async (req, res) => {
    try {
        const { from, to, state, industry, page = 1, limit = 20 } = req.query;
        const query = {};
        if (state) query.state = state;
        if (industry) query.industry = industry;
        applyScope(req, query);

        const users = await User.find({ ...query, role: 'executive' });
        const userIds = users.map(u => u._id);

        const dateFilter = {};
        if (from) dateFilter.$gte = new Date(from);
        if (to) dateFilter.$lte = new Date(to);

        const pipeline = [
            { $match: { 
                performedBy: { $in: userIds },
                ...(Object.keys(dateFilter).length > 0 ? { createdAt: dateFilter } : {})
            }},
            { $group: {
                _id: '$performedBy',
                calls: { $sum: { $cond: [{ $eq: ['$action', 'called'] }, 1, 0] } },
                meetings: { $sum: { $cond: [{ $regexMatch: { input: '$action', regex: /meeting/i } }, 1, 0] } },
                conversions: { $sum: { $cond: [{ $eq: ['$action', 'converted'] }, 1, 0] } },
                revenue: { $sum: '$metadata.revenue' }
            }},
            { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'user' } },
            { $unwind: '$user' },
            { $sort: { conversions: -1 } }
        ];

        const allResults = await LeadActivity.aggregate(pipeline);
        const total = allResults.length;
        const data = allResults.slice((page - 1) * limit, page * limit);

        const summary = {
            totalCalls: allResults.reduce((sum, r) => sum + r.calls, 0),
            totalMeetings: allResults.reduce((sum, r) => sum + r.meetings, 0),
            totalConversions: allResults.reduce((sum, r) => sum + r.conversions, 0),
            totalRevenue: allResults.reduce((sum, r) => sum + r.revenue, 0)
        };

        res.json({
            data,
            pagination: { total, page: Number(page), pages: Math.ceil(total / limit) },
            summary
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// GET /api/dashboard/reports/attendance-summary
router.get('/reports/attendance-summary', async (req, res) => {
    try {
        const { month, year, role } = req.query;
        if (!month || !year) return res.status(400).json({ message: 'Month and year required' });

        const start = new Date(Number(year), Number(month) - 1, 1);
        const end = new Date(Number(year), Number(month), 0, 23, 59, 59, 999);

        const usersQuery = { isActive: { $ne: false }, role: { $ne: 'founder' } };
        if (role && role !== 'all') usersQuery.role = role;

        const users = await User.find(usersQuery).select('name role');
        const userIds = users.map(u => u._id);

        const summary = await Attendance.aggregate([
            { $match: {
                user: { $in: userIds },
                date: { $gte: start, $lte: end }
            }},
            { $group: {
                _id: '$user',
                present: { $sum: { $cond: [{ $eq: ['$status', 'present'] }, 1, 0] } },
                absent: { $sum: { $cond: [{ $eq: ['$status', 'absent'] }, 1, 0] } },
                halfDay: { $sum: { $cond: [{ $eq: ['$status', 'half_day'] }, 1, 0] } },
                leave: { $sum: { $cond: [{ $eq: ['$status', 'leave'] }, 1, 0] } },
                avgWorkPct: { $avg: '$completionPct' },
                wfhDays: { $sum: { $cond: ['$isWFH', 1, 0] } },
                avgLateMinutes: { $avg: '$lateLoginMinutes' },
                avgEarlyExitMinutes: { $avg: '$earlyExitMinutes' }
            }}
        ]);

        const data = users.map(u => {
            const stats = summary.find(s => s._id.toString() === u._id.toString()) || {
                present: 0, absent: 0, halfDay: 0, leave: 0, avgWorkPct: 0,
                wfhDays: 0, avgLateMinutes: 0, avgEarlyExitMinutes: 0
            };
            return {
                user: u,
                present: stats.present,
                absent: stats.absent,
                halfDay: stats.halfDay,
                leave: stats.leave,
                avgWorkPct: Math.round(stats.avgWorkPct || 0),
                wfhDays: stats.wfhDays || 0,
                avgLateMinutes: Math.round(stats.avgLateMinutes || 0),
                avgEarlyExitMinutes: Math.round(stats.avgEarlyExitMinutes || 0)
            };
        });

        res.json(data);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// GET /api/dashboard/reports/attendance
router.get('/reports/attendance', async (req, res) => {
    try {
        const { month, year, userId, page = 1, limit = 20 } = req.query;
        const query = {};
        if (userId) query.user = new mongoose.Types.ObjectId(userId);
        applyScope(req, query);

        if (month && year) {
            const start = new Date(year, month - 1, 1);
            const end = new Date(year, month, 0, 23, 59, 59, 999);
            query.date = { $gte: start, $lte: end };
        }

        const data = await Attendance.find(query)
            .populate('user', 'name role')
            .sort({ date: -1 })
            .skip((page - 1) * limit)
            .limit(Number(limit));

        const total = await Attendance.countDocuments(query);
        const summary = await Attendance.aggregate([
            { $match: query },
            { $group: { _id: '$status', count: { $sum: 1 } } }
        ]);

        res.json({
            data,
            pagination: { total, page: Number(page), pages: Math.ceil(total / limit) },
            summary
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// GET /api/dashboard/reports/salary
router.get('/reports/salary', async (req, res) => {
    try {
        const { month, year, userId, page = 1, limit = 20 } = req.query;
        const query = {};
        if (userId) query.user = new mongoose.Types.ObjectId(userId);
        if (month) query.month = Number(month);
        if (year) query.year = Number(year);
        applyScope(req, query);

        const data = await Salary.find(query)
            .populate('user', 'name role')
            .sort({ year: -1, month: -1 })
            .skip((page - 1) * limit)
            .limit(Number(limit));

        const total = await Salary.countDocuments(query);
        const summaryRes = await Salary.aggregate([
            { $match: query },
            { $group: { 
                _id: null, 
                totalNetSalary: { $sum: '$netSalary' },
                totalIncentives: { $sum: '$incentives' },
                count: { $sum: 1 }
            }}
        ]);

        res.json({
            data,
            pagination: { total, page: Number(page), pages: Math.ceil(total / limit) },
            summary: summaryRes[0] || { totalNetSalary: 0, totalIncentives: 0, count: 0 }
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// GET /api/dashboard/reports/revenue
router.get('/reports/revenue', async (req, res) => {
    try {
        const { from, to, state, industry, page = 1, limit = 20 } = req.query;
        const query = { action: 'converted' };
        
        const dateFilter = {};
        if (from) dateFilter.$gte = new Date(from);
        if (to) dateFilter.$lte = new Date(to);
        if (Object.keys(dateFilter).length > 0) query.createdAt = dateFilter;

        const matchLeads = {};
        if (state) matchLeads.state = state;
        if (industry) matchLeads.industry = industry;
        applyScope(req, matchLeads);

        const pipeline = [
            { $match: query },
            { $lookup: { from: 'leads', localField: 'lead', foreignField: '_id', as: 'lead_info' } },
            { $unwind: '$lead_info' },
            { $match: {
                'lead_info.state': matchLeads.state || { $exists: true },
                'lead_info.industry': matchLeads.industry || { $exists: true },
                ...(matchLeads.owner ? { 'lead_info.owner': matchLeads.owner } : {})
            }},
            { $group: {
                _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
                totalRevenue: { $sum: '$metadata.revenue' },
                count: { $sum: 1 }
            }},
            { $sort: { _id: -1 } }
        ];

        const allResults = await LeadActivity.aggregate(pipeline);
        const total = allResults.length;
        const data = allResults.slice((page - 1) * limit, page * limit);

        res.json({
            data,
            pagination: { total, page: Number(page), pages: Math.ceil(total / limit) },
            summary: {
                totalRevenue: allResults.reduce((sum, r) => sum + r.totalRevenue, 0),
                totalConversions: allResults.reduce((sum, r) => sum + r.totalConversions, 0)
            }
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// GET /api/dashboard/reports/leaves
router.get('/reports/leaves', async (req, res) => {
    try {
        const { state, industry, page = 1, limit = 20 } = req.query;
        const query = {};
        if (state) query.state = state;
        if (industry) query.industry = industry;
        applyScope(req, query);

        const users = await User.find(query).select('name role state industry');
        const userIds = users.map(u => u._id);

        const leaves = await Leave.find({ user: { $in: userIds } })
            .populate('user', 'name role')
            .sort({ fromDate: -1 })
            .skip((page - 1) * limit)
            .limit(Number(limit));

        const total = await Leave.countDocuments({ user: { $in: userIds } });

        res.json({
            data: leaves,
            pagination: { total, page: Number(page), pages: Math.ceil(total / limit) }
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});


// GET /api/dashboard/reports/activities?type=calls|meetings&page=1&limit=30
router.get('/reports/activities', async (req, res) => {
    try {
        const { type = 'calls', page = 1, limit = 30 } = req.query;

        // Scope to IM's team
        const userScope = {};
        applyScope(req, userScope);
        const teamUsers = await User.find({ ...userScope, role: 'executive' }).select('_id name district');
        const teamIds = teamUsers.map(u => u._id);

        // Action filter
        let actionMatch;
        if (type === 'calls') {
            actionMatch = { action: 'called' };
        } else {
            actionMatch = { action: { $regex: /meeting/i } };
        }

        const skip = (Number(page) - 1) * Number(limit);

        const [activities, total] = await Promise.all([
            LeadActivity.find({ performedBy: { $in: teamIds }, ...actionMatch })
                .populate('lead', 'name company phone district priority status')
                .populate('performedBy', 'name district')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(Number(limit)),
            LeadActivity.countDocuments({ performedBy: { $in: teamIds }, ...actionMatch })
        ]);

        res.json({
            data: activities,
            pagination: { total, page: Number(page), pages: Math.ceil(total / Number(limit)) }
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

/**
 * PUT /api/salary/:id
 * Founder only: Update incentives
 */
router.put('/salary/:id', async (req, res) => {
    try {
        if (req.user.role !== 'founder') {
            return res.status(403).json({ message: 'Forbidden: Founder only' });
        }
        const { incentives, incentiveNote } = req.body;
        const salary = await Salary.findById(req.params.id);
        if (!salary) return res.status(404).json({ message: 'Salary record not found' });

        salary.incentives = Number(incentives);
        salary.incentiveNote = incentiveNote;
        // Recalculate net salary: grossSalary (based on attendance) + incentives - deductions
        salary.netSalary = Math.round((salary.grossSalary || 0) + salary.incentives - (salary.deductions || 0));

        await salary.save();
        res.json(salary);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

/**
 * POST /api/dashboard/salary/generate
 * Founder only: Manually trigger salary generation
 */
/**
 * GET /performance - Comprehensive performance summary for executives
 */
router.get('/performance', async (req, res) => {
  try {
    const userId = req.user._id;
    const { month, year, period, value } = req.query;

    const { start, end } = getDateRange(period || 'month', value);

    const now = new Date();
    const targetMonth = month ? parseInt(month) : now.getMonth() + 1;
    const targetYear = year ? parseInt(year) : now.getFullYear();
    const prevStart = new Date(targetYear, targetMonth - 2, 1);
    const prevEnd = new Date(targetYear, targetMonth - 1, 0, 23, 59, 59, 999);

    // 1. Current Month Aggregates
    const currentActivities = await LeadActivity.find({
      performedBy: userId,
      createdAt: { $gte: start, $lte: end }
    });

    const currentLeads = await Lead.find({
      owner: userId,
      $or: [
        { createdAt: { $gte: start, $lte: end } },
        { updatedAt: { $gte: start, $lte: end } }
      ]
    });

    // 2. Previous Month Aggregates (for comparison)
    const prevActivitiesCount = await LeadActivity.countDocuments({
      performedBy: userId,
      action: 'called',
      createdAt: { $gte: prevStart, $lte: prevEnd }
    });

    const prevConversionsCount = await LeadActivity.countDocuments({
      performedBy: userId,
      action: 'converted',
      createdAt: { $gte: prevStart, $lte: prevEnd }
    });

    const prevRevenueData = await Lead.aggregate([
      { $match: { owner: userId, status: 'converted', updatedAt: { $gte: prevStart, $lte: prevEnd } } },
      { $group: { _id: null, total: { $sum: "$expectedRevenue" } } }
    ]);
    const prevRevenue = prevRevenueData[0]?.total || 0;

    // 3. Process Metrics
    const totalCalls = currentActivities.filter(a => a.action === 'called').length;
    const conversions = currentActivities.filter(a => a.action === 'converted').length;
    const meetings = currentActivities.filter(a => a.action === 'meeting_done' || a.action === 'meeting_scheduled').length;
    
    const revenue = currentLeads
      .filter(l => l.status === 'converted')
      .reduce((sum, l) => sum + (l.expectedRevenue || 0), 0);

    const rnrLeads = currentActivities.filter(a => a.action === 'rnr').length;
    const freshLeads = currentLeads.filter(l => l.status === 'new').length;
    
    const conversionRate = totalCalls > 0 ? ((conversions / totalCalls) * 100).toFixed(1) : 0;
    const prevConversionRate = prevActivitiesCount > 0 ? ((prevConversionsCount / prevActivitiesCount) * 100).toFixed(1) : 0;

    // 4. Status Breakdown (Lifetime/Current context)
    const allLeads = await Lead.find({ owner: userId });
    const statusBreakdown = {
      fresh: allLeads.filter(l => l.status === 'new').length,
      hot: allLeads.filter(l => l.status === 'followup' || l.priority === 'Hot 🔥').length,
      converted: allLeads.filter(l => l.status === 'converted').length,
      rnr: allLeads.filter(l => l.status === 'rnr').length,
      notInterested: allLeads.filter(l => l.status === 'not_interested').length
    };

    // 5. Weekly Conversion Trends (for Bar Chart)
    const weeklyTrends = [];
    for (let i = 0; i < 4; i++) {
      const wStart = new Date(start);
      wStart.setDate(start.getDate() + (i * 7));
      const wEnd = new Date(wStart);
      wEnd.setDate(wStart.getDate() + 6);
      
      const wCount = currentActivities.filter(a => 
        a.action === 'converted' && a.createdAt >= wStart && a.createdAt <= wEnd
      ).length;
      
      weeklyTrends.push({ name: `W${i+1}`, conversions: wCount });
    }

    res.json({
      metrics: {
        totalCalls: { value: totalCalls, growth: prevActivitiesCount > 0 ? Math.round(((totalCalls - prevActivitiesCount) / prevActivitiesCount) * 100) : 0 },
        conversions: { value: conversions, growth: prevConversionsCount > 0 ? Math.round(((conversions - prevConversionsCount) / prevConversionsCount) * 100) : 0 },
        revenue: { value: (revenue / 100000).toFixed(1), growth: prevRevenue > 0 ? ((revenue - prevRevenue) / 100000).toFixed(1) : 0 },
        meetings: { value: meetings, growth: 0 }, // Simplified growth for meetings
        freshLeads: { value: freshLeads, growth: 0 },
        rnrLeads: { value: rnrLeads, growth: 0 },
        conversionRate: { value: conversionRate, growth: (conversionRate - prevConversionRate).toFixed(1) },
        points: { value: (conversions * 100 + meetings * 20), tier: 'Gold Tier' }
      },
      statusBreakdown,
      weeklyTrends
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/salary/generate', async (req, res) => {
    try {
        if (req.user.role !== 'founder') {
            return res.status(403).json({ message: 'Forbidden: Founder only' });
        }
        const { month, year } = req.body;
        if (!month || !year) return res.status(400).json({ message: 'Month and year required' });

        const salaryService = require('../services/salaryService');
        const results = await salaryService.generateMonthlySalary(Number(month), Number(year));
        
        res.json({ message: 'Salary generation completed', count: results.length });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;
