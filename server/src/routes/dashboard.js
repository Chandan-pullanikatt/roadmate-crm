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
const getDateRange = (type) => {
  const now = new Date();
  const start = new Date(now);
  const end = new Date(now);

  if (type === 'today') {
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
  } else if (type === 'monthly') {
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
  } else if (type === 'weekly') {
    const day = now.getDay();
    const diff = now.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
    start.setDate(diff);
    start.setHours(0, 0, 0, 0);
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
    fromDate: { $gte: new Date(year, 0, 1) }
  });

  const paidUsed = approvedLeaves
    .filter(l => l.type === 'paid')
    .reduce((sum, l) => sum + l.days, 0);

  const optionalUsed = approvedLeaves
    .filter(l => l.type === 'optional_holiday')
    .reduce((sum, l) => sum + l.days, 0);

  // Simple formula: quota - used
  // paidLeavesPerMonth is 1, so 12 per year
  const totalPaidQuota = (policy.paidLeavesPerMonth || 1) * 12;
  const optionalQuota = policy.optionalHolidayQuota || 0.5;

  return {
    paid: Math.max(0, totalPaidQuota - paidUsed),
    optionalHoliday: Math.max(0, optionalQuota - optionalUsed)
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
      completedLeads: [...new Set(todayActivities.map(a => a.lead.toString()))].length,
      completionPct: attendance ? attendance.completionPct : 0
    };


    // 2. Monthly Stats
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

    // 3. Upcoming Meetings
    const upcomingMeetings = await Lead.find({
      owner: req.user._id,
      meetingAt: { $gte: new Date() }
    })
    .sort({ meetingAt: 1 })
    .limit(3)
    .select('name meetingAt status meetingLink');

    const meetingsFormatted = upcomingMeetings.map(m => ({
      lead: m.name,
      meetingAt: m.meetingAt,
      type: m.status.includes('virtual') ? 'Virtual' : 'Direct',
      meetingLink: m.meetingLink
    }));

    // 4. Leave Balance
    const leaveBalance = await getLeaveBalance(req.user);

    // 5. Performance Score
    const performanceScore = (monthlyStats.totalLeads > 0 ? (monthlyStats.converted / monthlyStats.totalLeads) : 0) * 100;

    // 6. Lead Sources Breakdown
    const myLeads = await Lead.find({ owner: userId });
    const leadSources = myLeads.reduce((acc, lead) => {
      const source = lead.source || 'Other';
      acc[source] = (acc[source] || 0) + 1;
      return acc;
    }, {});

    const sourcesFormatted = Object.entries(leadSources).map(([label, count]) => ({
      label,
      count,
      icon: label === 'Industry Partner' ? '🏢' : label === 'Corporate Account' ? '🤝' : '🔗'
    }));

    // 7. Strategy Logs (Converted leads with notes)
    const strategyLogs = await LeadActivity.find({
      performedBy: userId,
      action: 'converted'
    })
    .sort({ createdAt: -1 })
    .limit(5)
    .populate('lead', 'company name');

    res.json({
      user: { name: req.user.name, state: req.user.state },
      todayStats,
      monthlyStats,
      workStarted: !!attendance?.workStartedAt,
      attendance: {
        status: attendance?.status || 'absent',
        workStartedAt: attendance?.workStartedAt,
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
 * GET /industry-manager -> role: industry_manager
 */
router.get('/industry-manager', async (req, res) => {
  try {
    if (req.user.role !== 'industry_manager') {
      return res.status(403).json({ message: 'Forbidden: Industry Manager only' });
    }

    const { start: todayStart } = getDateRange('today');
    const { start: weekStart } = getDateRange('weekly');

    // 1. Team Summary
    const teamUsers = await User.find({ industry: req.user.industry, role: 'executive' });
    const teamIds = teamUsers.map(u => u._id);

    const activeAttendances = await Attendance.find({
      user: { $in: teamIds },
      date: { $gte: todayStart },
      workStartedAt: { $exists: true }
    });

    const teamSummary = {
      totalExecutives: teamUsers.length,
      activeToday: activeAttendances.length,
      avgWorkPct: activeAttendances.length > 0 
        ? activeAttendances.reduce((sum, a) => sum + a.completionPct, 0) / activeAttendances.length 
        : 0,
      totalLeadsToday: await Lead.countDocuments({ industry: req.user.industry, createdAt: { $gte: todayStart } })
    };

    // 2. Executive Performance
    const executivePerformance = await Promise.all(teamUsers.map(async (u) => {
      const att = await Attendance.findOne({ user: u._id, date: { $gte: todayStart } });
      const monthActs = await LeadActivity.find({ performedBy: u._id, createdAt: { $gte: getDateRange('monthly').start } });
      
      return {
        user: { name: u.name, _id: u._id },
        completionPct: att?.completionPct || 0,
        calls: monthActs.filter(a => a.action === 'called').length,
        meetings: monthActs.filter(a => a.action.startsWith('meeting')).length,
        converted: monthActs.filter(a => a.action === 'converted').length,
        revenue: monthActs.filter(a => a.action === 'converted').reduce((sum, a) => sum + (a.metadata?.revenue || 0), 0),
        leaveDays: await Leave.countDocuments({ user: u._id, status: 'approved', fromDate: { $gte: getDateRange('monthly').start } })
      };
    }));

    // 3. Pending Leave Requests
    const pendingLeaveRequests = await Leave.find({
      user: { $in: teamIds },
      status: 'pending'
    }).populate('user', 'name role');

    // 4. Lead Stats
    const leads = await Lead.find({ industry: req.user.industry });
    const leadStats = {
      total: leads.length,
      new: leads.filter(l => l.status === 'new').length,
      followup: leads.filter(l => l.status === 'followup').length,
      converted: leads.filter(l => l.status === 'converted').length,
      lost: leads.filter(l => l.status === 'lost').length,
      rnr: leads.filter(l => l.status === 'rnr').length,
    };

    // 5. Upcoming Meetings
    const upcomingMeetings = await Lead.find({
      industry: req.user.industry,
      meetingAt: { $gte: new Date() }
    })
    .sort({ meetingAt: 1 })
    .limit(10)
    .populate('owner', 'name');

    const staffDocsMissing = teamUsers
      .filter(u => !u.documents || u.documents.length === 0)
      .map(u => ({ user: { name: u.name, _id: u._id }, missingDocs: true }));

    // 6. Weekly Report
    // This requires aggregation over days
    const weeklyReport = { dailyWorkPct: [], conversions: [] };
    for (let i = 0; i < 7; i++) {
        const d = new Date(weekStart);
        d.setDate(d.getDate() + i);
        const nextD = new Date(d);
        nextD.setHours(23, 59, 59, 999);

        const atts = await Attendance.find({ user: { $in: teamIds }, date: { $gte: d, $lte: nextD } });
        const convs = await LeadActivity.countDocuments({ 
            performedBy: { $in: teamIds }, 
            action: 'converted', 
            createdAt: { $gte: d, $lte: nextD } 
        });

        weeklyReport.dailyWorkPct.push(atts.length > 0 ? (atts.reduce((sum, a) => sum + a.completionPct, 0) / atts.length) : 0);
        weeklyReport.conversions.push(convs);
    }

    res.json({
      teamSummary,
      executivePerformance,
      pendingLeaveRequests,
      leadStats,
      upcomingMeetings: upcomingMeetings.map(m => ({
        lead: m.name,
        executive: m.owner?.name,
        meetingAt: m.meetingAt,
        type: m.status
      })),
      staffDocsMissing,
      weeklyReport
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

        const meetingsScheduled = await Lead.countDocuments({
            state: req.user.state,
            status: 'meeting_scheduled',
            meetingAt: { $gte: todayStart }
        });

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

        const totalWorkDays = 25; // standard
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

        const stats = {
            industryManagersCount: managers.length,
            totalRevenue,
            activeLeads: activeLeadsCount,
            convertedThisMonth,
            districtExecutivesCount: allExecutives.length,
            pendingLeaves: pendingLeavesCount,
            callsThisWeek,
            meetingsScheduled,
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

        // 4. Industry Manager List (Drill-in)
        const industryManagerSummary = await Promise.all(managers.map(async (m) => {
            const team = allExecutives.filter(e => e.industry === m.industry);
            const teamIds = team.map(u => u._id);
            
            const leads = await Lead.find({ industry: m.industry, state: req.user.state });
            const leadIds = leads.map(l => l._id);

            const calls = await LeadActivity.countDocuments({ 
                performedBy: { $in: teamIds }, 
                action: 'called',
                createdAt: { $gte: monthStart }
            });

            const monthConvs = await LeadActivity.find({ 
                performedBy: { $in: teamIds }, 
                action: 'converted',
                createdAt: { $gte: monthStart }
            });

            const rev = monthConvs.reduce((sum, a) => sum + (a.metadata?.revenue || 0), 0);
            
            // Efficiency based on work completion of team
            const atts = await Attendance.find({ user: { $in: teamIds }, date: { $gte: todayStart } });
            const avgWorkPctTeam = atts.length > 0 ? (atts.reduce((sum, a) => sum + a.completionPct, 0) / atts.length) : 0;

            return {
                _id: m._id,
                name: m.name,
                industry: m.industry,
                leadsCount: leads.length,
                efficiency: Math.round(avgWorkPctTeam),
                calls,
                conversions: monthConvs.length,
                revenue: rev,
                districts: [...new Set(team.map(e => e.district))].length
            };
        }));

        // 4b. District Executive List
        const executivePerformance = await Promise.all(allExecutives.map(async (e) => {
            const att = todayAttendance.find(a => a.user.toString() === e._id.toString());
            const calls = await LeadActivity.countDocuments({ performedBy: e._id, action: 'called', createdAt: { $gte: monthStart } });
            const conversions = await LeadActivity.countDocuments({ performedBy: e._id, action: 'converted', createdAt: { $gte: monthStart } });
            const leave = await Leave.findOne({ user: e._id, status: 'approved', fromDate: { $lte: todayEnd }, toDate: { $gte: todayStart } });

            return {
                _id: e._id,
                name: e.name,
                industry: e.industry,
                district: e.district,
                calls,
                conversions,
                completionPct: att ? att.completionPct : 0,
                status: leave ? 'On Leave' : (att ? 'Active' : 'Not Started')
            };
        }));

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

        // 8. Pending Leave Requests (Industry Managers)
        const leaveRequests = await Leave.find({
            user: { $in: managerIds },
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
 * GET /founder -> role: founder
 */
router.get('/founder', async (req, res) => {
    try {
        if (req.user.role !== 'founder') {
            return res.status(403).json({ message: 'Forbidden: Founder only' });
        }

        const period = req.query.period || 'monthly';
        const getEffectivePeriod = (p) => p === 'daily' ? 'today' : p;
        const { start: periodStart } = getDateRange(getEffectivePeriod(period));
        const { start: todayStart } = getDateRange('today');
        const { start: monthStart } = getDateRange('monthly');

        // Stats for the top cards
        const totalLeads = await Lead.countDocuments();
        const leadsToday = await Lead.countDocuments({ createdAt: { $gte: todayStart } });
        
        // Expected Onboarding (active pipeline)
        const expectedOnboarding = await Lead.countDocuments({ status: { $in: ['new', 'followup', 'meeting_scheduled', 'meeting_done'] } });

        const totalConversions = await Lead.countDocuments({ status: 'converted' });
        const convertedThisMonth = await LeadActivity.countDocuments({ action: 'converted', createdAt: { $gte: monthStart } });
        
        const totalRevenue = await LeadActivity.aggregate([
            { $match: { action: 'converted' } },
            { $group: { _id: null, total: { $sum: '$metadata.revenue' } } }
        ]).then(res => res[0]?.total || 0);

        const totalCalls = await LeadActivity.countDocuments({ action: 'called' });
        const reachRate = totalLeads ? (totalCalls / totalLeads) * 100 : 0;
        const conversionRate = totalLeads ? (totalConversions / totalLeads) * 100 : 0;
        
        const getStaffStats = async (role) => {
            const users = await User.find({ role, isActive: true });
            const userIds = users.map(u => u._id);
            const total = users.length;
            
            const working = await Attendance.countDocuments({
                user: { $in: userIds },
                date: { $gte: todayStart },
                workStartedAt: { $exists: true }
            });
            
            const onLeave = await Leave.countDocuments({
                user: { $in: userIds },
                status: 'approved',
                fromDate: { $lte: new Date() },
                toDate: { $gte: todayStart }
            });
            
            return { total, working, onLeave };
        };

        const stateManagers = await getStaffStats('state_manager');
        const industryManagers = await getStaffStats('industry_manager');
        const salesStaff = await getStaffStats('executive');
        const pendingLeavesCount = await Leave.countDocuments({ status: 'pending' });

        const executivesThisMonth = await User.countDocuments({ 
            role: 'executive', 
            createdAt: { $gte: monthStart } 
        });

        const stats = {
            totalLeads,
            leadsToday,
            expectedOnboarding,
            totalConversions,
            convertedThisMonth,
            totalRevenue,
            totalCalls,
            reachRate: Math.round(reachRate * 10) / 10,
            conversionRate: Math.round(conversionRate * 10) / 10,
            stateManagers,
            industryManagers,
            salesStaff,
            executivesThisMonth,
            pendingLeavesCount
        };

        // 1. Overall Summary
        const totalStaff = await User.countDocuments({ isActive: true });
        const activeToday = await Attendance.countDocuments({ date: { $gte: todayStart }, workStartedAt: { $exists: true } });
        
        const overallSummary = {
            totalStaff,
            totalLeads,
            converted: totalConversions,
            revenue: totalRevenue,
            activeTodayPct: totalStaff ? (activeToday / totalStaff) * 100 : 0
        };

        // 2. By State
        const states = await User.distinct('state', { state: { $ne: null } });
        const byState = await Promise.all(states.map(async (s) => {
            const manager = await User.findOne({ state: s, role: 'state_manager' });
            const leads = await Lead.find({ state: s });
            const leadIds = leads.map(l => l._id);
            const staffCount = await User.countDocuments({ state: s });
            
            return {
                state: s,
                stateManager: manager?.name || 'Unassigned',
                stateManagerId: manager?._id || null,
                totalStaff: staffCount,
                leads: leads.length,
                converted: leads.filter(l => l.status === 'converted').length,
                calls: await LeadActivity.countDocuments({ lead: { $in: leadIds }, action: 'called' }),
                meetings: await LeadActivity.countDocuments({ lead: { $in: leadIds }, action: { $in: ['meeting_scheduled', 'meeting_done'] } }),
                revenue: await LeadActivity.aggregate([
                    { $match: { action: 'converted', createdAt: { $gte: monthStart } } },
                    { $lookup: { from: 'leads', localField: 'lead', foreignField: '_id', as: 'lead_info' } },
                    { $unwind: '$lead_info' },
                    { $match: { 'lead_info.state': s } },
                    { $group: { _id: null, total: { $sum: '$metadata.revenue' } } }
                ]).then(res => res[0]?.total || 0),
                avgWorkPct: await Attendance.aggregate([
                    { $match: { date: { $gte: todayStart } } },
                    { $lookup: { from: 'users', localField: 'user', foreignField: '_id', as: 'user_info' } },
                    { $unwind: '$user_info' },
                    { $match: { 'user_info.state': s } },
                    { $group: { _id: null, avg: { $avg: '$completionPct' } } }
                ]).then(res => res[0]?.avg || 0)
            };
        }));

        // 3. By Industry
        const industries = await User.distinct('industry', { industry: { $ne: null } });
        const byIndustry = await Promise.all(industries.map(async (ind) => {
            const leads = await Lead.find({ industry: ind });
            return {
                industry: ind,
                leads: leads.length,
                converted: leads.filter(l => l.status === 'converted').length,
                revenue: await LeadActivity.aggregate([
                    { $match: { action: 'converted', createdAt: { $gte: monthStart } } },
                    { $lookup: { from: 'leads', localField: 'lead', foreignField: '_id', as: 'lead_info' } },
                    { $unwind: '$lead_info' },
                    { $match: { 'lead_info.industry': ind } },
                    { $group: { _id: null, total: { $sum: '$metadata.revenue' } } }
                ]).then(res => res[0]?.total || 0)
            };
        }));

        // 4. Pending Leave
        const pendingLeaveRequests = await Leave.find({
            status: 'pending'
        }).populate('user', 'name role state industry');

        // 5. Recent Activity
        const recentActivity = await LeadActivity.find()
            .sort({ createdAt: -1 })
            .limit(20)
            .populate('performedBy', 'name role')
            .populate('lead', 'name');

        // 6. Performance Summary
        const topExecutive = await LeadActivity.aggregate([
            { $match: { action: 'converted', createdAt: { $gte: monthStart } } },
            { $group: { _id: '$performedBy', count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 1 },
            { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'user' } },
            { $unwind: '$user' }
        ]).then(res => res[0] ? { name: res[0].user.name, count: res[0].count } : null);

        // Detailed Lead Pipeline Stats for Tabs
        const pipelineStats = [
            { label: 'All', count: totalLeads, color: 'blue' },
            { label: 'New', count: await Lead.countDocuments({ status: 'new' }), color: 'blue' },
            { label: 'Follow-up', count: await Lead.countDocuments({ status: { $in: ['called', 'followup'] } }), color: 'purple' },
            { label: 'Meeting', count: await Lead.countDocuments({ status: { $regex: /meeting/i } }), color: 'teal' },
            { label: 'Hot', count: await Lead.countDocuments({ priority: 'hot', status: { $nin: ['converted', 'lost', 'not_interested'] } }), color: 'red' },
            { label: 'Warm', count: await Lead.countDocuments({ priority: 'warm', status: { $nin: ['converted', 'lost', 'not_interested'] } }), color: 'orange' },
            { label: 'RNR', count: await Lead.countDocuments({ status: 'rnr' }), color: 'gray' },
            { label: 'Converted', count: await Lead.countDocuments({ status: 'converted' }), color: 'green' },
            { label: 'Lost', count: await Lead.countDocuments({ status: { $in: ['lost', 'not_interested'] } }), color: 'red' }
        ];

        // Expected Onboarding Leads (Detailed list)
        const expectedOnboardingListRaw = await Lead.find({ 
            status: { $nin: ['converted', 'lost', 'not_interested'] },
            priority: { $in: ['hot', 'warm'] }
        })
        .sort({ updatedAt: -1 })
        .limit(10)
        .populate('owner', 'name');

        const expectedOnboardingList = expectedOnboardingListRaw.map(l => ({
            _id: l._id,
            name: l.name,
            company: l.company || l.name,
            state: l.state || 'N/A',
            assignedTo: l.owner?.name || 'Unassigned',
            priority: l.priority,
            expectedDate: (l.nextActionAt || l.followUpDate || l.updatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        }));

        // Detailed Industry Managers Performance
        const industryManagersList = await User.find({ role: 'industry_manager', isActive: true });
        const industryManagersPerformance = await Promise.all(industryManagersList.map(async (m) => {
             const leads = await Lead.find({ industry: m.industry, state: m.state });
             const leadIds = leads.map(l => l._id);
             
             return {
                 _id: m._id,
                 name: m.name,
                 state: m.state,
                 industry: m.industry,
                 workPct: await Attendance.findOne({ user: m._id, date: { $gte: todayStart } }).then(a => a?.completionPct || 0),
                 calls: await LeadActivity.countDocuments({ performedBy: m._id, action: 'called', createdAt: { $gte: periodStart } }),
                 meetings: await LeadActivity.countDocuments({ performedBy: m._id, action: { $in: ['meeting_scheduled', 'meeting_done'] }, createdAt: { $gte: periodStart } }),
                 followups: await LeadActivity.countDocuments({ performedBy: m._id, action: 'followup_set', createdAt: { $gte: periodStart } }),
                 revenue: await LeadActivity.aggregate([
                      { $match: { performedBy: m._id, action: 'converted', createdAt: { $gte: periodStart } } },
                      { $group: { _id: null, total: { $sum: '$metadata.revenue' } } }
                 ]).then(res => res[0]?.total || 0),
                 leaves: await Leave.countDocuments({ user: m._id, status: 'approved', fromDate: { $gte: periodStart } })
             };
        }));

        // Detailed Executives Performance (This is what DistrictExecutives.jsx uses)
        const executives = await User.find({ role: 'executive', isActive: true });
        const executivesPerformance = await Promise.all(executives.map(async (m) => {
             const leadsCount = await Lead.countDocuments({ owner: m._id });
             
             return {
                 _id: m._id,
                 name: m.name,
                 state: m.state,
                 industry: m.industry,
                 workPct: await Attendance.findOne({ user: m._id, date: { $gte: todayStart } }).then(a => a?.completionPct || 0),
                 leads: leadsCount,
                 calls: await LeadActivity.countDocuments({ performedBy: m._id, action: 'called', createdAt: { $gte: periodStart } }),
                 followups: await LeadActivity.countDocuments({ performedBy: m._id, action: 'followup_set', createdAt: { $gte: periodStart } }),
                 converted: await LeadActivity.countDocuments({ performedBy: m._id, action: 'converted', createdAt: { $gte: periodStart } }),
                 revenue: await LeadActivity.aggregate([
                      { $match: { performedBy: m._id, action: 'converted', createdAt: { $gte: periodStart } } },
                      { $group: { _id: null, total: { $sum: '$metadata.revenue' } } }
                 ]).then(res => res[0]?.total || 0),
                 leaves: await Leave.countDocuments({ user: m._id, status: 'approved', fromDate: { $gte: periodStart } })
             };
        }));

        res.json({
            stats,
            pipelineStats,
            expectedOnboardingList,
            industryManagersPerformance,
            executivesPerformance,
            overallSummary,
            byState,
            byIndustry,
            pendingLeaveRequests,
            expectedOnboardingLeads: expectedOnboarding,
            recentActivity,
            upcomingMeetings: [],
            performanceSummary: {
                topExecutive,
                topState: byState.sort((a,b) => b.revenue - a.revenue)[0]?.state,
                topIndustry: byIndustry.sort((a,b) => b.revenue - a.revenue)[0]?.industry
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

        const start = new Date(year, month - 1, 1);
        const end = new Date(year, month, 0, 23, 59, 59, 999);

        const usersQuery = { isActive: true };
        if (role) usersQuery.role = role;

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
                avgWorkPct: { $avg: '$completionPct' }
            }}
        ]);

        const data = users.map(u => {
            const stats = summary.find(s => s._id.toString() === u._id.toString()) || {
                present: 0, absent: 0, halfDay: 0, leave: 0, avgWorkPct: 0
            };
            return {
                user: u,
                ...stats
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
        // Recalculate net salary if needed, assuming netSalary includes incentives
        // Simple logic: netSalary = base + incentives - deductions
        // Since we don't have the full model here, we'll just update the field.
        salary.netSalary = (salary.baseSalary || 0) + salary.incentives - (salary.deductions || 0);

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
