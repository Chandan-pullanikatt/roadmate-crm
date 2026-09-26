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
const { getScopeOwnerIds } = require('../utils/hierarchy');
const { pendingEscalationFilter } = require('../utils/escalation');
const { LEAD_STATUS_GROUPS, GROUP_ORDER } = require('../constants/leadStatusGroups');
const { getDateRange } = require('../utils/dateRange');
const { REVENUE_ACTIONS, REVENUE_MATCH, REVENUE_EXPR, sumRevenue } = require('../services/revenueService');
const { countWeekdayWorkingDays } = require('../utils/workingDays');
const { getPerformanceMetrics, rollupMetrics, EMPTY_METRICS } = require('../services/performanceService');

// Protect all routes
router.use(verifyToken);


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

    const formatLeadSummary = (lead) => lead ? ({
      _id: lead._id,
      leadId: lead.leadId,
      name: lead.name,
      company: lead.company || '',
      phone: lead.phone,
      district: lead.district,
      status: lead.status,
      priority: lead.priority,
      updatedAt: lead.updatedAt,
      createdAt: lead.createdAt
    }) : null;

    const formatActivitySummary = (activity) => ({
      _id: activity._id,
      action: activity.action,
      note: activity.note,
      createdAt: activity.createdAt,
      lead: formatLeadSummary(activity.lead)
    });

    const completedTodayActivities = await LeadActivity.find({
      performedBy: req.user._id,
      createdAt: { $gte: todayStart, $lte: todayEnd },
      action: { $in: ['called', 'rnr', 'followup_set', 'meeting_scheduled', 'meeting_done', 'converted', 'blocking_amount_received', 'lost', 'not_interested'] }
    })
      .populate('lead', 'leadId name company phone district status priority updatedAt createdAt')
      .sort({ createdAt: -1 });

    const completedTodayMap = new Map();
    completedTodayActivities.forEach(activity => {
      if (activity.lead && !completedTodayMap.has(activity.lead._id.toString())) {
        completedTodayMap.set(activity.lead._id.toString(), formatLeadSummary(activity.lead));
      }
    });
    const completedTodayLeads = Array.from(completedTodayMap.values());

    const weeklyCallActivities = await LeadActivity.find({
      performedBy: req.user._id,
      action: 'called',
      createdAt: { $gte: weekStart }
    })
      .populate('lead', 'leadId name company phone district status priority updatedAt createdAt')
      .sort({ createdAt: -1 });

    const monthlyConversionActivityDocs = await LeadActivity.find({
      performedBy: req.user._id,
      action: 'converted',
      createdAt: { $gte: monthStart }
    })
      .populate('lead', 'leadId name company phone district status priority updatedAt createdAt')
      .sort({ createdAt: -1 });

    const todayStats = {
      totalLeads: attendance ? attendance.totalLeads : await Lead.countDocuments({ 
        owner: req.user._id, 
        status: { $nin: ['converted', 'lost', 'not_interested'] } 
      }),
      completedLeads: completedTodayLeads.length,
      calls: todayActivities.filter(a => a.action === 'called').length,
      followups: todayActivities.filter(a => a.action === 'followup_set').length,
      meetings: todayActivities.filter(a => ['meeting_scheduled', 'meeting_done'].includes(a.action)).length,
      converted: todayActivities.filter(a => a.action === 'converted').length,
      revenueToday: sumRevenue(todayActivities),
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
      converted: monthlyConversionActivityDocs.length,
      revenue: sumRevenue(monthlyActivities),
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

    // Monthly lead review progress: of the IM's OWN leads created this month,
    // how many has he worked (any genuine interaction). Numerator is constrained
    // to the denominator set so the bar can never exceed 100%.
    const monthLeadIds = await Lead.find({
      owner: req.user._id,
      createdAt: { $gte: monthStart }
    }).distinct('_id');

    const monthlyReviewedLeadIds = await LeadActivity.distinct('lead', {
      performedBy: req.user._id,
      createdAt: { $gte: monthStart },
      action: { $in: ['called', 'rnr', 'followup_set', 'meeting_scheduled', 'meeting_done', 'converted', 'blocking_amount_received', 'lost', 'not_interested'] },
      lead: { $in: monthLeadIds }
    });
    const monthlyTotalLeads = monthLeadIds.length;
    const monthlyReviewedCount = monthlyReviewedLeadIds.length;
    monthlyStats.reviewedLeads = monthlyReviewedCount;
    monthlyStats.totalAllLeads = monthlyTotalLeads;
    monthlyStats.completionPct = monthlyTotalLeads > 0
      ? Math.round((monthlyReviewedCount / monthlyTotalLeads) * 100)
      : 0;

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

    const blockingLeads = myLeads
      .filter(lead => lead.status === 'blocking_amount_received')
      .map(formatLeadSummary);

    const summaryDrilldowns = {
      myLeads: {
        count: myLeads.length,
        leads: myLeads.map(formatLeadSummary)
      },
      completed: {
        count: completedTodayLeads.length,
        leads: completedTodayLeads
      },
      calls: {
        count: weeklyCallActivities.length,
        rows: weeklyCallActivities.map(formatActivitySummary)
      },
      conversions: {
        count: monthlyConversionActivityDocs.length,
        leads: monthlyConversionActivityDocs.map(a => formatLeadSummary(a.lead)).filter(Boolean)
      },
      blocking: {
        count: blockingLeads.length,
        leads: blockingLeads
      }
    };

    res.json({
      user: { name: req.user.name, state: req.user.state, industry: req.user.industry },
      todayStats,
      weeklyStats: {
        calls: weeklyCalls,
        callGrowth
      },
      monthlyStats,
      summaryDrilldowns,
      workStarted: !!attendance?.workStartedAt && !attendance?.workCompletedAt,
      attendance: {
        _id: attendance?._id,
        status: attendance?.status || 'absent',
        workStartedAt: attendance?.workStartedAt,
        workCompletedAt: attendance?.workCompletedAt,
        completionPct: attendance?.completionPct || 0,
        // The work page shows a "Working From Home" badge once the day is
        // started, so the flag has to travel with the rest of the attendance.
        isWFH: !!attendance?.isWFH
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
/**
 * GET /team-performance
 *
 * The canonical staff performance rows for an arbitrary slice of the org, so
 * drill-in pages (e.g. a State Manager's profile) can show the same table the
 * dashboards do without duplicating the aggregation.
 *
 * Query: reportingTo (manager whose direct reports to list), role, period, value.
 */
router.get('/team-performance', async (req, res) => {
  try {
    const { reportingTo, role, period = 'monthly', value } = req.query;
    if (!reportingTo) return res.status(400).json({ message: 'reportingTo is required' });

    // Only people inside the caller's own reporting subtree are visible.
    // getScopeOwnerIds returns null for the founder, who is unrestricted.
    const scopeIds = await getScopeOwnerIds(req.user);
    const visible = scopeIds && new Set([...scopeIds.map(String), String(req.user._id)]);

    const query = { reportingTo };
    if (role) query.role = role;
    const users = await User.find(query).select('_id name role state industry district isActive reportingTo');
    const allowed = visible ? users.filter(u => visible.has(String(u._id))) : users;

    // A manager's row covers their whole subtree, the way the dashboards report it;
    // executives are leaves and stand alone.
    const subtreeIds = new Map();
    for (const u of allowed) {
      const below = u.role === 'executive' ? [] : (await getScopeOwnerIds(u)).filter(id => String(id) !== String(u._id));
      subtreeIds.set(String(u._id), below);
    }

    const { start: periodStart, end: periodEnd } = getDateRange(period, value);
    const everyone = [...allowed.map(u => u._id), ...[...subtreeIds.values()].flat()];
    const metrics = await getPerformanceMetrics(everyone, periodStart, periodEnd);

    res.json(allowed.map(u => ({
      ...(u.role === 'executive'
        ? (metrics.get(String(u._id)) || EMPTY_METRICS)
        : rollupMetrics(metrics, u._id, subtreeIds.get(String(u._id)) || [])),
      _id: u._id,
      name: u.name,
      role: u.role,
      state: u.state,
      industry: u.industry,
      district: u.district,
      user: u
    })));
  } catch (error) {
    console.error('Team performance error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

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
    const teamUsers = await User.find({
      role: 'executive',
      reportingTo: req.user._id,
      isActive: { $ne: false }
    }).select('_id name district state industry');
    const teamIds = teamUsers.map(u => u._id);
    const callActorIds = [req.user._id, ...teamIds];

    // Hierarchy-based lead visibility: own leads + everyone in the reporting subtree.
    // Replaces the old { industry: req.user.industry } scoping so two IMs sharing an
    // industry value no longer see each other's leads.
    const scopeIds = await getScopeOwnerIds(req.user);
    const ownerScope = { owner: { $in: scopeIds } };

    const activeAttendances = await Attendance.find({
      user: { $in: teamIds },
      date: { $gte: todayStart },
      workStartedAt: { $exists: true }
    });

    // 2. Revenue & Growth
    const revenueStats = await LeadActivity.aggregate([
      { 
        $match: { 
          ...REVENUE_MATCH,
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
          performedBy: { $in: callActorIds },
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
          owner: { $in: scopeIds },
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
    // Scoped to the reporting subtree (own + descendants), not the industry field.
    const baseLeadQuery = { ...ownerScope };
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
      meetings: allLeads.filter(l => ['meeting_virtual', 'meeting_direct'].includes(l.status)).length,
      converted: allLeads.filter(l => l.status === 'converted').length,
      lost: allLeads.filter(l => l.status === 'lost').length,
      rnr: allLeads.filter(l => l.status === 'rnr').length,
      escalated: allLeads.filter(l => l.status === 'escalated').length,
    };

    // Founder-style pipeline buckets for the Overview, scoped to this subtree and the
    // selected window. Buckets come from the canonical grouping so the cards always
    // sum to 'All' -- see constants/leadStatusGroups.js.
    const imGroupCount = (statuses) => periodLeads.filter(l => statuses.includes(l.status)).length;
    const IM_GROUP_COLORS = {
        New: 'blue', 'Follow-up': 'purple', 'Virtual Meeting': 'teal',
        'Direct Meeting': 'teal', Converted: 'green',
        Blocking: 'amber', 'Full Amount Received': 'cyan',
        Lost: 'red', RNR: 'gray', Escalated: 'orange'
    };
    const pipelineStats = [
      { label: 'All', count: periodLeads.length, color: 'blue' },
      ...GROUP_ORDER.map(label => ({
        label,
        count: imGroupCount(LEAD_STATUS_GROUPS[label]),
        color: IM_GROUP_COLORS[label] || 'gray'
      }))
    ];

    // Hot/Warm/Cold is a different axis from status, so it is returned separately --
    // the status buckets above have to keep summing to 'All'.
    const IM_PRIORITY_COLORS = { hot: 'red', warm: 'amber', cold: 'blue' };
    const priorityStats = ['hot', 'warm', 'cold'].map(pr => ({
      label: pr.charAt(0).toUpperCase() + pr.slice(1),
      priority: pr,
      count: periodLeads.filter(l => l.priority === pr).length,
      color: IM_PRIORITY_COLORS[pr]
    }));

    // Period-filtered activity stats (calls, revenue) + live meeting count (status-based, not date-based)
    const [periodActivities, periodMeetingLeads, activeLeadsCount] = await Promise.all([
      LeadActivity.find({
        performedBy: { $in: callActorIds },
        createdAt: { $gte: periodStart, $lte: periodEnd }
      }),
      // Count leads currently in meeting stage — matches the Lead Management meeting tab exactly
      Lead.countDocuments({
        ...ownerScope,
        status: { $in: ['meeting_virtual', 'meeting_direct'] }
      }),
      // Active leads — live snapshot, not period-filtered
      Lead.countDocuments({
        ...ownerScope,
        status: { $nin: ['converted', 'lost', 'not_interested'] }
      })
    ]);

    // "Expected onboarding" = open leads the team is actually forecasting, i.e. tagged
    // Hot or Warm. Same definition the Founder and State Manager dashboards use.
    const OPEN_FOR_ONBOARDING = (l) => !['converted', 'lost', 'not_interested'].includes(l.status);
    const expectedOnboardingHot  = periodLeads.filter(l => l.priority === 'hot'  && OPEN_FOR_ONBOARDING(l)).length;
    const expectedOnboardingWarm = periodLeads.filter(l => l.priority === 'warm' && OPEN_FOR_ONBOARDING(l)).length;

    const periodStats = {
      totalLeads: periodLeads.length,
      converted: periodLeads.filter(l => l.status === 'converted').length,
      new: periodLeads.filter(l => l.status === 'new').length,
      expectedOnboarding: expectedOnboardingHot + expectedOnboardingWarm,
      expectedOnboardingHot,
      expectedOnboardingWarm,
      hot: periodLeads.filter(l => l.priority === 'hot' && !['converted', 'lost'].includes(l.status)).length,
      calls: periodActivities.filter(a => a.action === 'called').length,
      meetings: periodMeetingLeads,
      revenue: sumRevenue(periodActivities),
    };

    const formatSummaryLead = (l, idx = 0) => {
      if (!l) return null;
      return {
        _id: l._id,
        leadId: l.leadId || `RM-A${String(idx + 1).padStart(3, '0')}`,
        company: l.company || '',
        name: l.name,
        district: l.district,
        owner: l.owner?.name || 'Unassigned',
        status: String(l.status || 'new').toUpperCase(),
        priority: l.priority,
        revenue: l.expectedRevenue || l.actualRevenue || 0,
        createdAt: l.createdAt,
        updatedAt: l.updatedAt
      };
    };

    const formatActivityRow = (a) => ({
      _id: a._id,
      createdAt: a.createdAt,
      note: a.note,
      action: a.action,
      performedBy: a.performedBy ? {
        _id: a.performedBy._id,
        name: a.performedBy.name,
        district: a.performedBy.district
      } : null,
      lead: a.lead ? formatSummaryLead(a.lead) : null
    });

    // 6. Optimized Executive Performance (Bulk queries)
    const [teamAttendance, teamActivities, teamLeads] = await Promise.all([
        Attendance.find({ user: { $in: teamIds }, date: { $gte: prevWeekStart } }),
        LeadActivity.find({ performedBy: { $in: teamIds }, createdAt: { $gte: monthStart } })
          .populate('lead', 'leadId name company phone district priority status createdAt updatedAt')
          .populate('performedBy', 'name district'),
        Lead.find({ owner: { $in: teamIds } }).populate('owner', 'name')
    ]);

    // Canonical per-person numbers for the selected period, from the same service
    // the Founder and State Manager dashboards use.
    const imMetrics = await getPerformanceMetrics(teamIds, periodStart, periodEnd);

    const executivePerformance = teamUsers.map((u) => {
      const att = teamAttendance.find(a => a.user.toString() === u._id.toString() && new Date(a.date) >= todayStart);
      const prevWeekAtt = teamAttendance.filter(a => a.user.toString() === u._id.toString() && new Date(a.date) < monthStart);
      
      const userActs = teamActivities.filter(a => (a.performedBy?._id || a.performedBy)?.toString() === u._id.toString());
      const userLeads = teamLeads.filter(l => l.owner.toString() === u._id.toString());
      const activeLeads = userLeads.filter(l => !['converted', 'lost'].includes(l.status));
      const callRows = userActs.filter(a => a.action === 'called').map(formatActivityRow);
      const convertedRows = userActs
        .filter(a => a.action === 'converted' && a.lead)
        .map(a => formatSummaryLead(a.lead));
      const hotRows = activeLeads
        .filter(l => l.priority === 'hot')
        .map(formatSummaryLead);

      const avgWorkPrevWeek = prevWeekAtt.length > 0 
        ? prevWeekAtt.reduce((sum, a) => sum + a.completionPct, 0) / prevWeekAtt.length 
        : 0;
      
      const workGrowth = (att?.completionPct || 0) - avgWorkPrevWeek;

      return {
        ...(imMetrics.get(String(u._id)) || EMPTY_METRICS),
        _id: u._id,
        name: u.name,
        state: u.state,
        industry: u.industry,
        district: u.district,
        completionPct: att?.completionPct || 0,
        workGrowth: Math.round(workGrowth),
        hotCount: hotRows.length,
        drilldowns: {
          calls: callRows,
          converted: convertedRows,
          hot: hotRows
        },
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

    // 7. Escalated Leads — only the ones still waiting on this manager's approval.
    // Once approved the lead becomes theirs and stops being an escalation, so the
    // banner must not keep counting it (escalatedTo is kept for history).
    const escalatedLeads = await Lead.find(pendingEscalationFilter(req.user._id))
      .populate('owner', 'name')
      .populate('escalatedFrom', 'name role');

    // 8. Upcoming Events
    const upcomingLeads = await Lead.find({
      ...ownerScope,
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
      name: l.status === 'meeting_virtual' ? `Virtual Meeting - ${l.company || l.name}`
        : l.status === 'meeting_direct' ? `Direct Meeting - ${l.company || l.name}`
        : `Follow-up - ${l.company || l.name}`,
      ownerName: l.owner?.name,
      ownerId: l.owner?._id,
      company: l.company || '',
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
      ...ownerScope
    })
    .populate('owner', 'name')
    .sort({ createdAt: -1 });

    const leadsFormatted = allLeadsPopulated.map((l, idx) => ({
      _id: l._id,
      leadId: l.leadId || `RM-A${String(idx + 1).padStart(3, '0')}`,
      company: l.company || '',
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

    const uniqueActivityLeads = (activities) => {
      const seen = new Set();
      return activities
        .map(a => a.lead)
        .filter(Boolean)
        .filter(l => {
          const id = l._id.toString();
          if (seen.has(id)) return false;
          seen.add(id);
          return true;
        })
        .map(formatSummaryLead);
    };

    const [
      periodTotalLeadDocs,
      periodHotLeadDocs,
      meetingLeadDocs,
      periodConvertedActivities,
      monthConvertedActivities,
      weekCallActivities,
    ] = await Promise.all([
      Lead.find(periodLeadQuery).populate('owner', 'name').sort({ createdAt: -1 }),
      Lead.find({
        ...periodLeadQuery,
        priority: 'hot',
        status: { $nin: ['converted', 'lost'] }
      }).populate('owner', 'name').sort({ createdAt: -1 }),
      Lead.find({
        ...ownerScope,
        status: { $in: ['meeting_virtual', 'meeting_direct'] }
      }).populate('owner', 'name').sort({ updatedAt: -1 }),
      LeadActivity.find({
        action: 'converted',
        performedBy: { $in: teamIds },
        createdAt: { $gte: periodStart, $lte: periodEnd }
      }).populate({ path: 'lead', populate: { path: 'owner', select: 'name' } }).sort({ createdAt: -1 }),
      LeadActivity.find({
        action: 'converted',
        performedBy: { $in: teamIds },
        createdAt: { $gte: monthStart, $lte: todayEnd }
      }).populate({ path: 'lead', populate: { path: 'owner', select: 'name' } }).sort({ createdAt: -1 }),
      LeadActivity.find({
        action: 'called',
        performedBy: { $in: callActorIds },
        createdAt: { $gte: weekStart, $lte: todayEnd }
      })
        .populate('lead', 'leadId name company phone district priority status createdAt updatedAt')
        .populate('performedBy', 'name district')
        .sort({ createdAt: -1 })
    ]);

    const periodConvertedLeadDocs = uniqueActivityLeads(periodConvertedActivities);
    const monthConvertedLeadDocs = uniqueActivityLeads(monthConvertedActivities);
    const weekCallRows = weekCallActivities.map(formatActivityRow);

    const summaryDrilldowns = {
      executives: {
        count: teamUsers.length,
        rows: executivePerformance
      },
      revenue: {
        count: periodConvertedLeadDocs.length,
        value: periodStats.revenue,
        leads: periodConvertedLeadDocs
      },
      totalLeads: {
        count: periodTotalLeadDocs.length,
        leads: periodTotalLeadDocs.map(formatSummaryLead)
      },
      converted: {
        count: monthConvertedLeadDocs.length,
        leads: monthConvertedLeadDocs
      },
      calls: {
        count: weekCallRows.length,
        rows: weekCallRows
      },
      meetings: {
        count: meetingLeadDocs.length,
        leads: meetingLeadDocs.map(formatSummaryLead)
      },
      hot: {
        count: periodHotLeadDocs.length,
        leads: periodHotLeadDocs.map(formatSummaryLead)
      },
      leaves: {
        count: leaveRequests.length,
        rows: leaveRequests
      }
    };

    // Get Industry Manager's own stats for MyPerformance (monthly)
    // Calculate directly from lead activities (not from attendance records which may have stale data)
    const imMonthlyActivities = await LeadActivity.find({
      performedBy: req.user._id,
      createdAt: { $gte: monthStart, $lte: todayEnd }
    }).populate('lead', '_id');

    // Count unique leads completed this month (same logic as MyWork)
    const imCompletedLeadsSet = new Set();
    imMonthlyActivities.forEach(activity => {
      if (['called', 'rnr', 'followup_set', 'meeting_scheduled', 'meeting_done', 'converted', 'blocking_amount_received', 'lost', 'not_interested'].includes(activity.action) && activity.lead) {
        imCompletedLeadsSet.add(activity.lead._id.toString());
      }
    });
    const imCompletedLeadsCount = imCompletedLeadsSet.size;

    // Get IM's currently active leads (denominator - current active leads owned by IM)
    const imCurrentActiveLeads = await Lead.countDocuments({
      owner: req.user._id,
      status: { $nin: ['converted', 'lost', 'not_interested'] }
    });

    // If IM has no active leads, show monthly completed as percentage of all-time leads
    const imTotalLeadsForDenom = imCurrentActiveLeads > 0 
      ? imCurrentActiveLeads 
      : await Lead.countDocuments({ owner: req.user._id });

    // Calculate completion % from actual unique completed leads (same as MyWork)
    const imCompletionPct = imTotalLeadsForDenom > 0 
      ? Math.round((imCompletedLeadsCount / imTotalLeadsForDenom) * 100) 
      : 0;

    // Rows behind the Expected Onboarding table, newest activity first.
    const expectedOnboardingLeads = await Lead.find({
      ...ownerScope,
      status: { $nin: ['converted', 'lost', 'not_interested'] },
      priority: { $in: ['hot', 'warm'] }
    })
      .sort({ updatedAt: -1 })
      .limit(20)
      .populate('owner', 'name');

    const expectedOnboardingList = expectedOnboardingLeads.map(l => ({
      _id: l._id,
      leadId: l.leadId,
      name: l.company || l.name,
      phone: l.phone,
      district: l.district,
      assignedTo: l.owner?.name || 'Unassigned',
      priority: l.priority || 'warm',
      status: l.status,
      expectedDate: l.nextActionAt
        ? new Date(l.nextActionAt).toLocaleDateString()
        : (l.meetingAt ? new Date(l.meetingAt).toLocaleDateString() : 'Not set')
    }));

    res.json({
      user: { name: req.user.name, state: req.user.state, industry: req.user.industry },
      stats: {
        completionPct: imCompletionPct,
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
        convertedThisMonth: summaryDrilldowns.converted.count,
        callsThisWeek: summaryDrilldowns.calls.count,
        callGrowth: Math.round(callGrowth),
        meetings: meetings,
        rnrLeads: leadStats.rnr,
        convertedLastMonth
      },
      periodStats,
      pipelineStats,
      priorityStats,
      expectedOnboardingList,
      activeLeads: activeLeadsCount,
      activePeriod: { period, value: value || null },
      summaryDrilldowns,
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

        // Headline-card time filter (today / week / month / quarter / year), same
        // (period, value) pair the Founder Summary sends. Defaults to this week.
        const period = req.query.period || 'weekly';
        const periodValue = req.query.value;
        const { start: periodStart, end: periodEnd } = getDateRange(period, periodValue);

        // 1. Industry Managers reporting to this state manager
        const managers = await User.find({ reportingTo: req.user._id, role: 'industry_manager' });
        const managerIds = managers.map(m => m._id);

        // 2. Executives & Teams — scoped to the reporting subtree (this SM's IMs and
        // the executives under those IMs), not everyone who merely shares the state.
        const scopeIds = await getScopeOwnerIds(req.user);
        const ownerScope = { owner: { $in: scopeIds } };
        const allExecutives = await User.find({ _id: { $in: scopeIds }, role: 'executive' });
        const executiveIds = allExecutives.map(u => u._id);
        const allTeamIds = [...managerIds, ...executiveIds];

        // 3. Stats for Top Cards
        const totalRevenue = await LeadActivity.aggregate([
            { $match: {
                ...REVENUE_MATCH,
                createdAt: { $gte: monthStart },
                performedBy: { $in: scopeIds }
            }},
            { $group: { _id: null, total: { $sum: '$metadata.revenue' } } }
        ]).then(res => res[0]?.total || 0);

        const activeLeadsCount = await Lead.countDocuments({
            ...ownerScope,
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
            Lead.countDocuments({ ...ownerScope, status: 'meeting_virtual', meetingAt: { $gte: todayStart } }),
            Lead.countDocuments({ ...ownerScope, status: 'meeting_direct',  meetingAt: { $gte: todayStart } }),
            Lead.countDocuments({ ...ownerScope, status: { $in: ['meeting_virtual', 'meeting_direct', 'meeting_scheduled'] }, meetingAt: { $gte: todayStart } }),
            Lead.countDocuments({ ...ownerScope, status: 'followup', nextActionAt: { $gte: todayStart, $lte: todayEnd } }),
            User.countDocuments({ reportingTo: req.user._id, role: 'industry_manager', createdAt: { $gte: monthStart } }),
        ]);

        // 3a. District Manager Specific Stats
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
        const presentToday = todayAttendance.filter(a => a.status === 'present' || a.status === 'half_day').length;
        
        const halfDaysThisWeek = await Attendance.countDocuments({
            user: { $in: executiveIds },
            date: { $gte: weekStart },
            status: 'half_day'
        });

        const totalWorkDays = countWeekdayWorkingDays(monthStart.getFullYear(), monthStart.getMonth() + 1);
        const monthlyAttendanceRecords = await Attendance.countDocuments({
            user: { $in: executiveIds },
            date: { $gte: monthStart },
            status: { $in: ['present', 'half_day'] }
        });
        const avgAttendanceMonth = Math.round((monthlyAttendanceRecords / (executiveIds.length * totalWorkDays || 1)) * 100);

         // 10. Growth Metrics
    const prevMonthStart = new Date(monthStart);
    prevMonthStart.setMonth(prevMonthStart.getMonth() - 1);
    const prevMonthEnd = new Date(monthStart);

    const prevMonthRevenue = await LeadActivity.aggregate([
      { $match: { ...REVENUE_MATCH, createdAt: { $gte: prevMonthStart, $lt: prevMonthEnd }, performedBy: { $in: scopeIds } } },
      { $group: { _id: null, total: { $sum: '$metadata.revenue' } } }
    ]);

    const prevMonthLeads = await Lead.countDocuments({ ...ownerScope, createdAt: { $gte: prevMonthStart, $lt: prevMonthEnd } });
    const prevMonthConv = await Lead.countDocuments({ ...ownerScope, status: 'converted', convertedAt: { $gte: prevMonthStart, $lt: prevMonthEnd } });

    const currentRevenue = totalRevenue || 0;
    const oldRevenue = prevMonthRevenue[0]?.total || 0;
    const revGrowth = oldRevenue > 0 ? ((currentRevenue - oldRevenue) / oldRevenue) * 100 : 0;

    const currentConvRate = activeLeadsCount > 0 ? (convertedThisMonth / (activeLeadsCount + convertedThisMonth)) * 100 : 0;
    const prevConvRate = prevMonthLeads > 0 ? (prevMonthConv / prevMonthLeads) * 100 : 0;
    const convGrowth = currentConvRate - prevConvRate;

        // Headline cards — same set the Founder overview shows, scoped to this State
        // Manager's reporting subtree (the State Managers card is founder-only).
        // Revenue = the payments recorded in the window (see revenueService).
        const sumScopedRevenue = (createdAt) => LeadActivity.aggregate([
            { $match: { ...REVENUE_MATCH, performedBy: { $in: scopeIds }, ...(createdAt ? { createdAt } : {}) } },
            { $group: { _id: null, total: { $sum: '$metadata.revenue' } } }
        ]).then(r => r[0]?.total || 0);

        // Growth compares the selected window against the window of the same length
        // immediately before it, so the delta stays meaningful on every tab.
        const periodWindow = { $gte: periodStart, $lte: periodEnd };
        const prevPeriodEnd = new Date(periodStart.getTime() - 1);
        const prevPeriodStart = new Date(periodStart.getTime() - (periodEnd.getTime() - periodStart.getTime()) - 1);
        const prevPeriodWindow = { $gte: prevPeriodStart, $lte: prevPeriodEnd };

        // "Expected onboarding" = open leads the team is actually forecasting, i.e.
        // tagged Hot or Warm. Cold/untagged leads are open pipeline nobody is counting on.
        const onboardingScope = {
            ...ownerScope,
            status: { $nin: ['converted', 'lost', 'not_interested'] },
            createdAt: periodWindow
        };

        const [
            totalLeadsScoped,
            leadsTodayScoped,
            expectedOnboardingHot,
            expectedOnboardingWarm,
            totalConversionsScoped,
            revenueScoped,
            prevPeriodRevenueScoped
        ] = await Promise.all([
            Lead.countDocuments({ ...ownerScope, createdAt: periodWindow }),
            Lead.countDocuments({ ...ownerScope, createdAt: { $gte: todayStart, $lte: todayEnd } }),
            Lead.countDocuments({ ...onboardingScope, priority: 'hot' }),
            Lead.countDocuments({ ...onboardingScope, priority: 'warm' }),
            Lead.countDocuments({ ...ownerScope, status: 'converted', convertedAt: periodWindow }),
            sumScopedRevenue(periodWindow),
            sumScopedRevenue(prevPeriodWindow)
        ]);

        const revenueGrowth = prevPeriodRevenueScoped > 0
            ? Math.round(((revenueScoped - prevPeriodRevenueScoped) / prevPeriodRevenueScoped) * 100 * 10) / 10
            : (revenueScoped > 0 ? 100 : 0);

        // Working / on leave / not started, for the staff cards.
        const subtreeStaff = [...managers, ...allExecutives].filter(u => u.isActive !== false);
        const subtreeStaffIds = subtreeStaff.map(u => u._id);

        const [staffOnLeaveToday, staffStartedToday] = await Promise.all([
            Leave.find({
                user: { $in: subtreeStaffIds },
                status: 'approved',
                fromDate: { $lte: todayEnd },
                toDate: { $gte: todayStart }
            }).select('user'),
            Attendance.find({
                user: { $in: subtreeStaffIds },
                date: { $gte: todayStart },
                workStartedAt: { $exists: true }
            }).select('user')
        ]);
        const onLeaveIds = new Set(staffOnLeaveToday.map(l => String(l.user)));
        const startedIds = new Set(staffStartedToday.map(a => String(a.user)));

        const staffBreakdown = (role) => {
            const list = subtreeStaff.filter(u => u.role === role);
            const onLeave = list.filter(u => onLeaveIds.has(String(u._id))).length;
            const working = list.filter(u => startedIds.has(String(u._id)) && !onLeaveIds.has(String(u._id))).length;
            return {
                total: list.length,
                working,
                onLeave,
                notStarted: Math.max(0, list.length - working - onLeave)
            };
        };

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
            avgAttendanceMonth,
            // Founder-style headline cards
            totalLeads: totalLeadsScoped,
            leadsToday: leadsTodayScoped,
            expectedOnboarding: expectedOnboardingHot + expectedOnboardingWarm,
            expectedOnboardingHot,
            expectedOnboardingWarm,
            converted: totalConversionsScoped,
            revenue: revenueScoped,
            revenueGrowth,
            period,
            periodValue: periodValue || null,
            industryManagersBreakdown: staffBreakdown('industry_manager'),
            districtManagersBreakdown: staffBreakdown('executive')
        };

        // 4. Industry Manager List — per-manager rollups keyed by OWNER/PERFORMER id
        // (not by industry, which can collide when two IMs share an industry value).
        // Each manager's numbers = that manager + the executives reporting to them.
        const execsByManager = new Map(managerIds.map(id => [String(id), []]));
        allExecutives.forEach(e => {
            const key = String(e.reportingTo);
            if (execsByManager.has(key)) execsByManager.get(key).push(e._id);
        });

        // One metrics pass over every manager and executive in scope. Same service
        // the Founder dashboard uses, so both sides report identical figures.
        const smMetrics = await getPerformanceMetrics([...managerIds, ...executiveIds], periodStart, periodEnd);

        const industryManagerSummary = managers.map((m) => {
            const execIds = execsByManager.get(String(m._id)) || [];
            const team    = allExecutives.filter(e => String(e.reportingTo) === String(m._id));

            // `efficiency` is the team's average attendance, shown on the Overview.
            // `workPct` (from the rollup) is the manager's own, which is what the
            // performance table reports.
            const attVals = execIds.map(id => smMetrics.get(String(id))?.workPct).filter(v => v != null);
            const efficiency = attVals.length ? Math.round(attVals.reduce((a, b) => a + b, 0) / attVals.length) : 0;

            const rolled = rollupMetrics(smMetrics, m._id, execIds);

            return {
                ...rolled,
                _id: m._id,
                name: m.name,
                state: m.state,
                industry: m.industry,
                leadsCount: rolled.leads,
                conversions: rolled.converted,
                efficiency,
                districts: [...new Set(team.map(e => e.district))].length,
                user: m
            };
        });

        // 4b. District Manager List — metrics come from the same service; only the
        // live Active / On Leave / Not Started badge is a today-only question.
        const execOnLeave = await Leave.find({
            user: { $in: executiveIds },
            status: 'approved',
            fromDate: { $lte: todayEnd },
            toDate:   { $gte: todayStart }
        }).select('user').lean();
        const onLeaveSet = new Set(execOnLeave.map(l => l.user.toString()));

        const executivePerformance = allExecutives.map((e) => {
            const att = todayAttendance.find(a => a.user.toString() === e._id.toString());
            const onLeave = onLeaveSet.has(e._id.toString());

            return {
                ...(smMetrics.get(String(e._id)) || EMPTY_METRICS),
                _id: e._id,
                name: e.name,
                state: e.state,
                industry: e.industry,
                district: e.district,
                conversions: smMetrics.get(String(e._id))?.converted || 0,
                completionPct: att ? att.completionPct : 0,
                status: onLeave ? 'On Leave' : (att ? 'Active' : 'Not Started'),
                user: e
            };
        });

        // 5. Upcoming Events
        // Meetings, Follow-ups
        const upcomingLeads = await Lead.find({
            ...ownerScope,
            $or: [
                { meetingAt: { $gte: todayStart } },
                { nextActionAt: { $gte: todayStart } }
            ]
        })
        .sort({ meetingAt: 1, nextActionAt: 1 })
        // Covers today and tomorrow in the Overview schedule toggle, so this
        // needs headroom beyond the handful shown for a single day.
        .limit(20)
        .populate('owner', 'name');

        const upcomingEvents = upcomingLeads.map(l => ({
            _id: l._id,
            type: l.status.includes('meeting') ? 'meeting' : 'followup',
            title: l.status === 'meeting_virtual' ? `Virtual Meeting - ${l.company}`
                : l.status === 'meeting_direct' ? `Direct Meeting - ${l.company}`
                : `Follow-up - ${l.company}`,
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
            { label: 'Virtual Meeting', status: 'meeting_virtual', color: '#06B6D4' },
            { label: 'Direct Meeting', status: 'meeting_direct', color: '#0EA5E9' },
            { label: 'Escalated', status: 'escalated', color: '#7C3AED' },
            { label: 'Converted', status: 'converted', color: '#10B981' },
            { label: 'Lost', status: 'lost', color: '#6B7280' }
        ];

        const pipelineData = await Promise.all(pipeline.map(async (p) => {
            let count = 0;
            if (p.status === 'hot' || p.status === 'warm') {
                count = await Lead.countDocuments({ ...ownerScope, priority: p.status, status: { $nin: ['converted', 'lost'] } });
            } else {
                count = await Lead.countDocuments({ ...ownerScope, status: p.status });
            }
            return { ...p, val: count };
        }));

        // 6a. Founder-style pipeline buckets, scoped to this subtree and the selected
        // window. Buckets come from the canonical grouping so the cards always sum to
        // 'All' -- see constants/leadStatusGroups.js.
        const pipelineStatsRaw = await Lead.aggregate([
            { $match: { ...ownerScope, createdAt: periodWindow } },
            { $group: { _id: '$status', count: { $sum: 1 } } }
        ]);

        const getPipelineCount = (statusArr) => {
            if (typeof statusArr === 'string') return pipelineStatsRaw.find(p => p._id === statusArr)?.count || 0;
            return pipelineStatsRaw.filter(p => statusArr.includes(p._id)).reduce((sum, p) => sum + p.count, 0);
        };

        const GROUP_COLORS = {
            New: 'blue', 'Follow-up': 'purple', 'Virtual Meeting': 'teal',
            'Direct Meeting': 'teal', Converted: 'green',
            Blocking: 'amber', 'Full Amount Received': 'cyan',
            Lost: 'red', RNR: 'gray', Escalated: 'orange'
        };
        const pipelineStats = [
            { label: 'All', count: pipelineStatsRaw.reduce((sum, p) => sum + p.count, 0), color: 'blue' },
            ...GROUP_ORDER.map(label => ({
                label,
                count: getPipelineCount(LEAD_STATUS_GROUPS[label]),
                color: GROUP_COLORS[label] || 'gray'
            }))
        ];

        // Hot/Warm/Cold is a different axis from status, so it is returned separately --
        // the status buckets above have to keep summing to 'All'.
        const priorityStatsRaw = await Lead.aggregate([
            { $match: { ...ownerScope, createdAt: periodWindow } },
            { $group: { _id: '$priority', count: { $sum: 1 } } }
        ]);
        const PRIORITY_COLORS = { hot: 'red', warm: 'amber', cold: 'blue' };
        const priorityStats = ['hot', 'warm', 'cold'].map(pr => ({
            label: pr.charAt(0).toUpperCase() + pr.slice(1),
            priority: pr,
            count: priorityStatsRaw.find(r => r._id === pr)?.count || 0,
            color: PRIORITY_COLORS[pr]
        }));

        // 7. Expected Onboarding Leads
        const expectedLeads = await Lead.find({
            ...ownerScope,
            status: { $nin: ['converted', 'lost', 'not_interested'] }
        })
        .sort({ updatedAt: -1 })
        .limit(10)
        .populate('owner', 'name');

        const expectedOnboarding = expectedLeads.map(l => {
            const age = Math.floor((new Date() - new Date(l.createdAt)) / (1000 * 60 * 60 * 24));
            return {
                _id: l._id,
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

        // 9. Escalated Leads — only the ones still waiting on this State Manager's
        // approval (see the Industry Manager dashboard above).
        const escalated = await Lead.find(pendingEscalationFilter(req.user._id))
            .populate('owner', 'name')
            .populate('escalatedFrom', 'name role');

        res.json({
            user: { name: req.user.name, state: req.user.state },
            stats,
            industryManagers: industryManagerSummary,
            executivePerformance,
            upcomingEvents: upcomingEvents.sort((a,b) => new Date(a.time) - new Date(b.time)),
            pipelineData,
            pipelineStats,
            priorityStats,
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
    
    // Revenue = the payments recorded in the window (see revenueService). A lead
    // that paid a blocking amount and then the balance contributes both payments
    // but counts once in the lead counts.
    const buildAggregation = (from, to) => {
      const pipeline = [
        { $match: { ...REVENUE_MATCH, createdAt: { $gte: from, $lte: to } } },
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
        pipeline.push({ $match: { 'leadDetails.state': req.user.state } });
      } else if (req.user.role === 'industry_manager') {
        pipeline.push({ $match: { 'leadDetails.industry': req.user.industry } });
      }
      return pipeline;
    };
    const revenueAggregation = buildAggregation(start, end);

    const summarise = async (pipeline) => {
      const [row] = await LeadActivity.aggregate([
        ...pipeline,
        { $group: { _id: null, totalRevenue: { $sum: '$metadata.revenue' }, payments: { $sum: 1 }, leads: { $addToSet: '$lead' } } }
      ]);
      const count = row?.leads.length || 0;
      return {
        totalRevenue: row?.totalRevenue || 0,
        payments: row?.payments || 0,
        count,
        avgDealValue: count ? Math.round(row.totalRevenue / count) : 0
      };
    };

    const groupBy = (key) => LeadActivity.aggregate([
      ...revenueAggregation,
      { $group: { _id: key, revenue: { $sum: '$metadata.revenue' }, leads: { $addToSet: '$lead' } } },
      { $project: { revenue: 1, count: { $size: '$leads' } } },
      { $sort: { revenue: -1 } }
    ]);

    const [currentSummary, byCategory, byState, byIndustry, recentConversions] = await Promise.all([
      summarise(revenueAggregation),
      groupBy({ $ifNull: ['$metadata.category', '$leadDetails.revenueCategory', 'other'] }),
      groupBy('$leadDetails.state'),
      groupBy('$leadDetails.industry'),
      LeadActivity.aggregate([
        ...revenueAggregation,
        { $sort: { createdAt: -1 } },
        { $limit: 10 },
        {
          $project: {
            _id: 1,
            lead: 1,
            leadName: '$leadDetails.name',
            company: '$leadDetails.company',
            stage: '$action',
            revenue: '$metadata.revenue',
            category: { $ifNull: ['$metadata.category', '$leadDetails.revenueCategory', 'other'] },
            createdAt: 1
          }
        }
      ])
    ]);

    // Previous period for growth calculation
    const periodMs = end - start;
    const prevStart = new Date(start.getTime() - periodMs);
    const prevEnd   = new Date(start);
    const prevSummary = await summarise(buildAggregation(prevStart, prevEnd));
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
/**
 * GET /district-manager - Overview page for a District Manager (role 'executive').
 * Same shape as /founder, but every number is scoped to the DM's own leads and
 * activities.
 */
router.get('/district-manager', async (req, res) => {
    try {
        if (req.user.role !== 'executive') {
            return res.status(403).json({ message: 'Forbidden: District Manager only' });
        }

        const userId = req.user._id;
        const { start: periodStart, end: periodEnd } = getDateRange(req.query.period || 'weekly', req.query.value);
        const { start: todayStart } = getDateRange('today');
        const { start: monthStart } = getDateRange('monthly');
        const prevMonthStart = new Date(monthStart);
        prevMonthStart.setMonth(prevMonthStart.getMonth() - 1);

        const ownLeads = { owner: userId };
        const periodRange = { $gte: periodStart, $lte: periodEnd };
        const onboardingFilter = {
            ...ownLeads,
            status: { $nin: ['converted', 'lost', 'not_interested'] },
            createdAt: periodRange,
            priority: { $in: ['hot', 'warm'] }
        };

        const sumOwnRevenue = (createdAt) => LeadActivity.aggregate([
            { $match: { ...REVENUE_MATCH, performedBy: userId, createdAt } },
            { $group: { _id: null, total: { $sum: '$metadata.revenue' } } }
        ]).then(r => r[0]?.total || 0);

        const [
            totalLeads, leadsToday, expectedOnboardingHot, expectedOnboardingWarm,
            converted, convertedThisMonth, revenue, prevMonthRevenue,
            statusRaw, priorityRaw, onboardingLeads, meetings, pendingLeaves
        ] = await Promise.all([
            Lead.countDocuments({ ...ownLeads, createdAt: periodRange }),
            Lead.countDocuments({ ...ownLeads, createdAt: { $gte: todayStart } }),
            Lead.countDocuments({ ...onboardingFilter, priority: 'hot' }),
            Lead.countDocuments({ ...onboardingFilter, priority: 'warm' }),
            LeadActivity.countDocuments({ action: 'converted', performedBy: userId, createdAt: periodRange }),
            LeadActivity.countDocuments({ action: 'converted', performedBy: userId, createdAt: { $gte: monthStart } }),
            sumOwnRevenue(periodRange),
            sumOwnRevenue({ $gte: prevMonthStart, $lt: monthStart }),
            Lead.aggregate([{ $match: ownLeads }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
            Lead.aggregate([{ $match: ownLeads }, { $group: { _id: '$priority', count: { $sum: 1 } } }]),
            Lead.find(onboardingFilter).sort({ updatedAt: -1 }).limit(10).populate('owner', 'name'),
            Lead.find({ ...ownLeads, meetingAt: { $gte: new Date() }, status: { $in: ['meeting_virtual', 'meeting_direct'] } })
                .sort({ meetingAt: 1 })
                .limit(5)
                .populate('owner', 'name role state industry')
                .populate('meetingInvitees', 'name role'),
            Leave.find({ user: userId, status: 'pending' }).sort({ fromDate: 1 }).populate('user', 'name role state industry')
        ]);

        const countFor = (statuses) => statusRaw.filter(s => statuses.includes(s._id)).reduce((sum, s) => sum + s.count, 0);
        const GROUP_COLORS = {
            New: 'blue', 'Follow-up': 'purple', 'Virtual Meeting': 'teal',
            'Direct Meeting': 'teal', Converted: 'green',
            Blocking: 'amber', 'Full Amount Received': 'cyan',
            Lost: 'red', RNR: 'gray', Escalated: 'orange'
        };
        const pipelineStats = [
            { label: 'All', count: statusRaw.reduce((sum, s) => sum + s.count, 0), color: 'blue' },
            ...GROUP_ORDER.map(label => ({ label, count: countFor(LEAD_STATUS_GROUPS[label]), color: GROUP_COLORS[label] || 'gray' }))
        ];

        const PRIORITY_COLORS = { hot: 'red', warm: 'amber', cold: 'blue' };
        const priorityStats = ['hot', 'warm', 'cold'].map(p => ({
            label: p.charAt(0).toUpperCase() + p.slice(1),
            priority: p,
            count: priorityRaw.find(r => r._id === p)?.count || 0,
            color: PRIORITY_COLORS[p]
        }));

        const expectedOnboardingList = onboardingLeads.map(l => ({
            _id: l._id,
            leadId: l.leadId || `RM-${l._id.toString().slice(-4).toUpperCase()}`,
            name: l.name,
            company: l.company || l.name,
            phone: l.phone,
            state: l.state,
            district: l.district,
            assignedTo: l.owner?.name || 'Unassigned',
            priority: l.priority,
            expectedDate: l.nextActionAt ? new Date(l.nextActionAt).toLocaleDateString() : 'TBD'
        }));

        const upcomingMeetings = meetings.map((m) => {
            const inviteeNames = (m.meetingInvitees || []).map(i => i?.name).filter(Boolean);
            return {
                _id: m._id,
                leadName: m.name,
                company: m.company || '',
                meetingAt: m.meetingAt,
                meetingLink: m.meetingLink || '',
                type: m.status === 'meeting_virtual' ? 'Virtual' : 'Direct',
                owner: m.owner ? { _id: m.owner._id, name: m.owner.name, role: m.owner.role } : null,
                inviteeSummary: inviteeNames.length > 0
                    ? inviteeNames.slice(0, 2).join(', ') + (inviteeNames.length > 2 ? ` +${inviteeNames.length - 2}` : '')
                    : ''
            };
        });

        const revGrowth = prevMonthRevenue > 0
            ? Math.round(((revenue - prevMonthRevenue) / prevMonthRevenue) * 100 * 10) / 10
            : (revenue > 0 ? 100 : 0);

        res.json({
            stats: {
                totalLeads,
                leadsToday,
                expectedOnboarding: expectedOnboardingHot + expectedOnboardingWarm,
                expectedOnboardingHot,
                expectedOnboardingWarm,
                converted,
                convertedThisMonth,
                revenue,
                revGrowth,
                pendingLeavesCount: pendingLeaves.length
            },
            pipelineStats,
            priorityStats,
            expectedOnboardingList,
            upcomingMeetings,
            pendingLeaves
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

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

        // "Expected onboarding" = leads the team actually expects to close, i.e. open
        // leads the executive has tagged Hot or Warm. Cold/untagged leads are still open
        // pipeline but nobody is forecasting them, so counting them here overstated the
        // number badly (it used to be every open lead created in the period).
        const activeLeadFilter = { status: { $nin: ['converted', 'lost', 'not_interested'] } };
        const periodLeadFilter = { createdAt: { $gte: periodStart, $lte: periodEnd } };
        const onboardingFilter = {
            ...activeLeadFilter,
            ...periodLeadFilter,
            priority: { $in: ['hot', 'warm'] }
        };
        const [expectedOnboardingHot, expectedOnboardingWarm] = await Promise.all([
            Lead.countDocuments({ ...onboardingFilter, priority: 'hot' }),
            Lead.countDocuments({ ...onboardingFilter, priority: 'warm' })
        ]);
        const expectedOnboarding = expectedOnboardingHot + expectedOnboardingWarm;

        const totalConversions = await LeadActivity.countDocuments({ action: 'converted', createdAt: { $gte: periodStart, $lte: periodEnd } });
        const convertedThisMonth = await LeadActivity.countDocuments({ action: 'converted', createdAt: { $gte: monthStart } });

        // Revenue = the payments recorded in the window (see revenueService).
        const sumPeriodRevenue = (createdAt) => LeadActivity.aggregate([
            { $match: { ...REVENUE_MATCH, createdAt } },
            { $group: { _id: null, total: { $sum: '$metadata.revenue' } } }
        ]).then(r => r[0]?.total || 0);

        const totalRevenue = await sumPeriodRevenue({ $gte: periodStart, $lte: periodEnd });

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
        const prevMonthRevenueF = await sumPeriodRevenue({ $gte: prevMonthStartF, $lt: monthStart });
        const revGrowthF = prevMonthRevenueF > 0
            ? Math.round(((totalRevenue - prevMonthRevenueF) / prevMonthRevenueF) * 100 * 10) / 10
            : (totalRevenue > 0 ? 100 : 0);

        const stats = {
            totalLeads,
            leadsToday,
            expectedOnboarding,
            expectedOnboardingHot,
            expectedOnboardingWarm,
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
                { $match: { action: { $in: ['called', 'meeting_scheduled', 'meeting_done', 'meeting_virtual', 'meeting_direct', ...REVENUE_ACTIONS] }, createdAt: { $gte: periodStart, $lte: periodEnd } } },
                { $lookup: { from: 'leads', localField: 'lead', foreignField: '_id', as: 'lead' } },
                { $unwind: '$lead' },
                { $group: {
                    _id: '$lead.state',
                    calls: { $sum: { $cond: [{ $eq: ['$action', 'called'] }, 1, 0] } },
                    meetings: { $sum: { $cond: [{ $in: ['$action', ['meeting_scheduled', 'meeting_done', 'meeting_virtual', 'meeting_direct']] }, 1, 0] } },
                    revenue: { $sum: REVENUE_EXPR }
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
                { $match: { ...REVENUE_MATCH, createdAt: { $gte: periodStart, $lte: periodEnd } } },
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

        // Buckets come from the canonical grouping so that the sum of the
        // buckets always equals 'All' — see constants/leadStatusGroups.js.
        const GROUP_COLORS = {
            New: 'blue', 'Follow-up': 'purple', 'Virtual Meeting': 'teal',
            'Direct Meeting': 'teal', Converted: 'green',
            Blocking: 'amber', 'Full Amount Received': 'cyan',
            Lost: 'red', RNR: 'gray', Escalated: 'orange'
        };
        const pipelineStats = [
            { label: 'All', count: allPipelineTotal, color: 'blue' },
            ...GROUP_ORDER.map(label => ({
                label,
                count: getPipelineCount(LEAD_STATUS_GROUPS[label]),
                color: GROUP_COLORS[label] || 'gray'
            }))
        ];

        // Hot/Warm/Cold split shown beside the pipeline. Priority is a different axis
        // from status, so it is returned separately — the status buckets above must keep
        // summing to 'All', and mixing priorities in would break that.
        const priorityStatsRaw = await Lead.aggregate([
            { $group: { _id: '$priority', count: { $sum: 1 } } }
        ]);
        const PRIORITY_COLORS = { hot: 'red', warm: 'amber', cold: 'blue' };
        const priorityStats = ['hot', 'warm', 'cold'].map(p => ({
            label: p.charAt(0).toUpperCase() + p.slice(1),
            priority: p,
            count: priorityStatsRaw.find(r => r._id === p)?.count || 0,
            color: PRIORITY_COLORS[p]
        }));

        // Performance lists — every column comes from the shared performance
        // service, so the Founder, State Manager and Industry Manager tables all
        // report the same numbers for the same person and period.
        const allPerformanceUsers = await User.find({ role: { $in: ['state_manager', 'industry_manager', 'executive'] }, isActive: true });
        const allPerfUserIds = allPerformanceUsers.map(u => u._id);
        const perfMetrics = await getPerformanceMetrics(allPerfUserIds, periodStart, periodEnd);

        // A manager's row covers that manager plus everyone reporting below them —
        // leads and payments sit with the district managers, so a per-person row
        // would read zero for every State and Industry Manager. District Managers
        // are leaves, so their rows are unaffected.
        const childrenByManager = new Map();
        allPerformanceUsers.forEach(u => {
            const parent = String(u.reportingTo || '');
            if (!parent) return;
            if (!childrenByManager.has(parent)) childrenByManager.set(parent, []);
            childrenByManager.get(parent).push(u._id);
        });
        const descendantsOf = (id) => {
            const out = [];
            const queue = [...(childrenByManager.get(String(id)) || [])];
            const seen = new Set();
            while (queue.length) {
                const next = queue.shift();
                const key = String(next);
                if (seen.has(key)) continue;
                seen.add(key);
                out.push(next);
                queue.push(...(childrenByManager.get(key) || []));
            }
            return out;
        };

        const getPerformanceData = (role) => allPerformanceUsers
            .filter(u => u.role === role)
            .map(u => ({
                ...(role === 'executive'
                    ? (perfMetrics.get(String(u._id)) || EMPTY_METRICS)
                    : rollupMetrics(perfMetrics, u._id, descendantsOf(u._id))),
                _id: u._id,
                name: u.name,
                state: u.state,
                industry: u.industry,
                district: u.district,
                user: u
            }));

        const industryManagersPerformance = getPerformanceData('industry_manager');
        const executivesPerformance = getPerformanceData('executive');
        const stateManagersPerformance = getPerformanceData('state_manager');

        // Founder Performance cards: average work % of everyone who logged attendance
        // in the period, and the share of the period's leads that reached a meeting.
        const loggedWorkPcts = [...perfMetrics.values()].map(m => m.workPct).filter(v => v > 0);
        stats.attendancePct = loggedWorkPcts.length
            ? Math.round(loggedWorkPcts.reduce((sum, v) => sum + v, 0) / loggedWorkPcts.length)
            : 0;
        const meetingLeadIds = await LeadActivity.distinct('lead', {
            action: { $in: ['meeting_scheduled', 'meeting_done', 'meeting_virtual', 'meeting_direct'] },
            createdAt: { $gte: periodStart, $lte: periodEnd }
        });
        const periodMeetingLeads = meetingLeadIds.length
            ? await Lead.countDocuments({ _id: { $in: meetingLeadIds }, createdAt: { $gte: periodStart, $lte: periodEnd } })
            : 0;
        stats.meetingRate = totalLeads > 0 ? Math.round((periodMeetingLeads / totalLeads) * 1000) / 10 : 0;

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
                phone: l.phone,
                state: l.state,
                assignedTo: l.owner?.name || 'Unassigned',
                priority: l.priority,
                expectedDate: l.nextActionAt ? new Date(l.nextActionAt).toLocaleDateString() : 'TBD',
                age: `${age}d`,
                _id: l._id
            };
        });

        // Escalations from State Managers waiting on the founder's approval.
        const escalated = await Lead.find(pendingEscalationFilter(req.user._id))
            .populate('owner', 'name')
            .populate('escalatedFrom', 'name role');

        res.json({
            stats,
            escalated,
            pipelineStats,
            priorityStats,
            expectedOnboardingList,
            industryManagersPerformance,
            executivesPerformance,
            stateManagersPerformance,
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

/** Executives reporting to an industry manager */
const getIndustryManagerExecutiveIds = async (managerId) => {
    const teamUsers = await User.find({
        role: 'executive',
        reportingTo: managerId,
        isActive: { $ne: false }
    }).select('_id');
    return teamUsers.map(u => u._id);
};

/** IM personal calls + team executive calls (used for weekly call summary & activity log) */
const getIndustryManagerCallActorIds = async (managerId) => {
    const teamIds = await getIndustryManagerExecutiveIds(managerId);
    return [managerId, ...teamIds];
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

        // Everyone below the viewer, not just executives — and listed even with no
        // activity yet, so the report shows the whole team rather than only the busy ones.
        const REPORT_ROLES = {
            founder: ['state_manager', 'industry_manager', 'executive'],
            state_manager: ['industry_manager', 'executive'],
            industry_manager: ['executive'],
            executive: ['executive']
        };
        const userQuery = { isActive: { $ne: false }, role: { $in: REPORT_ROLES[req.user.role] || ['executive'] } };
        if (query.state) userQuery.state = query.state;
        if (query.industry) userQuery.industry = query.industry;
        if (query.owner) userQuery._id = query.owner;

        const users = await User.find(userQuery).select('name role industry state');
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
                revenue: { $sum: REVENUE_EXPR }
            }}
        ];

        const activityByUser = new Map((await LeadActivity.aggregate(pipeline)).map(a => [String(a._id), a]));
        const ROLE_ORDER = { state_manager: 0, industry_manager: 1, executive: 2 };
        const allResults = users
            .map(u => {
                const a = activityByUser.get(String(u._id)) || {};
                return {
                    _id: u._id,
                    user: u,
                    calls: a.calls || 0,
                    meetings: a.meetings || 0,
                    conversions: a.conversions || 0,
                    revenue: a.revenue || 0
                };
            })
            .sort((x, y) => (ROLE_ORDER[x.user.role] - ROLE_ORDER[y.user.role]) || (y.conversions - x.conversions) || x.user.name.localeCompare(y.user.name));
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
                // Work % is only meaningful once the day has been completed —
                // a day that was started and never completed sits at 0 and
                // would otherwise drag the average down. $avg skips nulls.
                avgWorkPct: { $avg: { $cond: [{ $ifNull: ['$workCompletedAt', false] }, '$completionPct', null] } },
                completedDays: { $sum: { $cond: [{ $ifNull: ['$workCompletedAt', false] }, 1, 0] } },
                wfhDays: { $sum: { $cond: ['$isWFH', 1, 0] } },
                avgLateMinutes: { $avg: '$lateLoginMinutes' },
                avgEarlyExitMinutes: { $avg: '$earlyExitMinutes' }
            }}
        ]);

        // Who is on leave right now. Read from approved leave requests, not from
        // the attendance register: a register row reads 'leave' when the day's
        // work came in under the threshold, which is not the same as being away.
        const today = new Date();
        const todayStart = new Date(today); todayStart.setHours(0, 0, 0, 0);
        const todayEnd = new Date(today); todayEnd.setHours(23, 59, 59, 999);
        const onLeaveIds = new Set((await Leave.find({
            user: { $in: userIds },
            status: 'approved',
            fromDate: { $lte: todayEnd },
            toDate: { $gte: todayStart }
        }).select('user').lean()).map(l => String(l.user)));

        const data = users.map(u => {
            const stats = summary.find(s => s._id.toString() === u._id.toString()) || {
                present: 0, absent: 0, halfDay: 0, leave: 0, avgWorkPct: 0,
                wfhDays: 0, avgLateMinutes: 0, avgEarlyExitMinutes: 0, completedDays: 0
            };
            return {
                user: u,
                present: stats.present,
                absent: stats.absent,
                halfDay: stats.halfDay,
                leave: stats.leave,
                avgWorkPct: Math.round(stats.avgWorkPct || 0),
                // Days the work was actually completed, so the client can tell
                // "0%" apart from "no completed day to score yet".
                completedDays: stats.completedDays || 0,
                onLeave: onLeaveIds.has(String(u._id)),
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
        const query = { ...REVENUE_MATCH };
        
        const dateFilter = {};
        if (from) dateFilter.$gte = new Date(from);
        if (to) dateFilter.$lte = new Date(to);
        if (Object.keys(dateFilter).length > 0) query.createdAt = dateFilter;

        const matchLeads = {};
        if (state) matchLeads.state = state;
        if (industry) matchLeads.industry = industry;
        applyScope(req, matchLeads);

        const leadMatch = {};
        if (matchLeads.state) leadMatch['lead_info.state'] = matchLeads.state;
        if (matchLeads.industry) leadMatch['lead_info.industry'] = matchLeads.industry;
        if (matchLeads.owner) leadMatch['lead_info.owner'] = matchLeads.owner;

        // One row per payment: which lead paid, whether it was the blocking amount or
        // the full amount, who logged it, and whose lead it is (owner + their manager).
        const pipeline = [
            { $match: query },
            { $lookup: { from: 'leads', localField: 'lead', foreignField: '_id', as: 'lead_info' } },
            { $unwind: '$lead_info' },
            ...(Object.keys(leadMatch).length ? [{ $match: leadMatch }] : []),
            { $lookup: { from: 'users', localField: 'performedBy', foreignField: '_id', as: 'collector', pipeline: [{ $project: { name: 1 } }] } },
            { $lookup: { from: 'users', localField: 'lead_info.owner', foreignField: '_id', as: 'owner', pipeline: [{ $project: { name: 1, role: 1, reportingTo: 1 } }] } },
            { $lookup: { from: 'users', localField: 'owner.reportingTo', foreignField: '_id', as: 'ownerManager', pipeline: [{ $project: { name: 1, role: 1 } }] } },
            { $sort: { createdAt: -1 } },
            { $project: {
                _id: 1,
                createdAt: 1,
                action: 1,
                amount: '$metadata.revenue',
                lead: {
                    _id: '$lead_info._id',
                    leadId: '$lead_info.leadId',
                    name: '$lead_info.name',
                    company: '$lead_info.company',
                    status: '$lead_info.status',
                    state: '$lead_info.state',
                    district: '$lead_info.district',
                    industry: '$lead_info.industry'
                },
                collectedBy: { $arrayElemAt: ['$collector', 0] },
                owner: { $arrayElemAt: ['$owner', 0] },
                ownerManager: { $arrayElemAt: ['$ownerManager', 0] }
            }}
        ];

        const allResults = await LeadActivity.aggregate(pipeline);
        const total = allResults.length;
        const data = allResults.slice((page - 1) * limit, page * limit);
        const sumFor = (action) => allResults.filter(r => r.action === action).reduce((sum, r) => sum + (r.amount || 0), 0);

        res.json({
            data,
            pagination: { total, page: Number(page), pages: Math.ceil(total / limit) },
            summary: {
                totalRevenue: allResults.reduce((sum, r) => sum + (r.amount || 0), 0),
                blockingRevenue: sumFor('blocking_amount_received'),
                fullAmountRevenue: sumFor('full_amount_received'),
                payments: total,
                leads: new Set(allResults.map(r => String(r.lead._id))).size
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
        const { type = 'calls', page = 1, limit = 30, userId, period, value } = req.query;

        let scopedIds = [];
        if (req.user.role === 'executive') {
            scopedIds = [req.user._id];
        } else if (req.user.role === 'industry_manager') {
            const callActorIds = await getIndustryManagerCallActorIds(req.user._id);
            const teamIds = callActorIds.slice(1);
            if (userId) {
                const allowed =
                    req.user._id.toString() === String(userId) ||
                    teamIds.some(id => id.toString() === String(userId));
                scopedIds = allowed ? [userId] : [];
            } else {
                scopedIds = callActorIds;
            }
        } else {
            const userScope = {};
            applyScope(req, userScope);
            const teamUsers = await User.find({ ...userScope, role: 'executive' }).select('_id name district');
            const teamIds = teamUsers.map(u => u._id);
            scopedIds = teamIds;
            if (userId) {
                const allowed = teamIds.some(id => id.toString() === String(userId));
                scopedIds = allowed ? [userId] : [];
            }
        }

        // Action filter
        let actionMatch;
        if (type === 'calls') {
            actionMatch = { action: 'called' };
        } else {
            actionMatch = { action: { $regex: /meeting/i } };
        }

        const dateMatch = {};
        if (period) {
            const { start, end } = getDateRange(period, value);
            dateMatch.createdAt = { $gte: start, $lte: end };
        }

        const skip = (Number(page) - 1) * Number(limit);

        const [activities, total] = await Promise.all([
            LeadActivity.find({ performedBy: { $in: scopedIds }, ...actionMatch, ...dateMatch })
                .populate('lead', 'name company phone district priority status')
                .populate('performedBy', 'name district')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(Number(limit)),
            LeadActivity.countDocuments({ performedBy: { $in: scopedIds }, ...actionMatch, ...dateMatch })
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

    const prevRevenueData = await LeadActivity.aggregate([
      { $match: { ...REVENUE_MATCH, performedBy: userId, createdAt: { $gte: prevStart, $lte: prevEnd } } },
      { $group: { _id: null, total: { $sum: '$metadata.revenue' } } }
    ]);
    const prevRevenue = prevRevenueData[0]?.total || 0;

    // 3. Process Metrics
    const totalCalls = currentActivities.filter(a => a.action === 'called').length;
    const conversions = currentActivities.filter(a => a.action === 'converted').length;
    const meetings = currentActivities.filter(a => a.action === 'meeting_done' || a.action === 'meeting_scheduled').length;
    
    const revenue = sumRevenue(currentActivities);

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
