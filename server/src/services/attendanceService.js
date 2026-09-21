const Attendance = require('../models/Attendance');
const LeavePolicy = require('../models/LeavePolicy');
const Leave = require('../models/Leave');
const Lead = require('../models/Lead');
const LeadActivity = require('../models/LeadActivity');
const User = require('../models/User');
const scheduleService = require('./scheduleService');
const { isWeeklyOff, loadCalendar, startOfDay } = require('../utils/workingDays');
const { resolveAttendanceRules } = require('../constants/attendanceRules');
const { WORK_ACTIONS } = require('../constants/workActions');

const ATTENDANCE_LABELS = { present: 'Present', half_day: 'Half Day', leave: 'Leave', holiday: 'Holiday' };

const attendanceService = {
  /**
   * Start work day for an executive
   */
  async startWork(userId, wfhData = null) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const user = await User.findById(userId);
    if (!user) throw new Error('User not found');

    // 1. Find today's LeavePolicy and check holiday
    const policy = await LeavePolicy.findOne({ state: user.state, year: today.getFullYear() });
    let isHoliday = false;
    let holidayName = '';
    
    if (policy && policy.holidays) {
      const holiday = policy.holidays.find(h => 
        h.date.toDateString() === today.toDateString()
      );
      if (holiday) {
        isHoliday = true;
        holidayName = holiday.name;
      }
    }
    if (!isHoliday && isWeeklyOff(today)) {
      isHoliday = true;
      holidayName = 'Weekly off';
    }

    // 2. Check if already started
    let attendance = await Attendance.findOne({ user: userId, date: today });
    if (attendance && attendance.workStartedAt) {
      throw new Error('Work already started for today');
    }

    const Config = require('../models/Config');
    const configDoc = await Config.findOne({ key: 'working-hours' });
    const whConfig = configDoc?.value || {};

    const isWithinRamadanConfig = () => {
      if (!whConfig.ramadanFrom || !whConfig.ramadanTo) return false;
      const ramadanFrom = new Date(whConfig.ramadanFrom);
      const ramadanTo = new Date(whConfig.ramadanTo);
      ramadanFrom.setHours(0, 0, 0, 0);
      ramadanTo.setHours(23, 59, 59, 999);
      return today >= ramadanFrom && today <= ramadanTo;
    };

    // 3. Get working hours start. Global config is the source of truth;
    // user-specific hours remain a fallback for legacy profiles.
    let workStartTimeStr = whConfig.normalStart || user.workingHours?.start || '09:30';

    if (isWithinRamadanConfig()) {
      workStartTimeStr = whConfig.ramadanStart || '09:00';
    } else if (policy && policy.ramadanStart && policy.ramadanEnd) {
      if (today >= policy.ramadanStart && today <= policy.ramadanEnd) {
        workStartTimeStr = policy.ramadanWorkStart || '09:00';
      }
    }

    // 4. Late login, measured from the start time: Late Coming from
    //    lateMarkMinutes, Half Day (decided at completeWork) from lateHalfDayMinutes.
    const rules = resolveAttendanceRules(whConfig.rules);
    const now = new Date();
    const [startHour, startMin] = workStartTimeStr.split(':').map(Number);
    const expectedStart = new Date(today);
    expectedStart.setHours(startHour, startMin, 0, 0);

    const lateLoginMinutes = Math.max(0, Math.floor((now - expectedStart) / 60000));
    const isLateLogin = lateLoginMinutes >= rules.lateMarkMinutes;
    const isLateHalfDay = lateLoginMinutes >= rules.lateHalfDayMinutes;
    let note = isLateHalfDay
      ? `Late login: ${lateLoginMinutes} min (Half Day)`
      : isLateLogin ? `Late Coming: ${lateLoginMinutes} min` : '';

    // 5. The day's work: due today plus pending from earlier days
    const plannedLeads = await scheduleService.getDayPlan(userId, today);
    const todayLeadsCount = plannedLeads.length;

    // 6. Create or update Attendance doc
    if (!attendance) {
      attendance = new Attendance({
        user: userId,
        date: today,
        workStartedAt: now,
        totalLeads: todayLeadsCount,
        plannedLeads,
        isLateLogin,
        lateLoginMinutes,
        note,
        status: isHoliday ? 'holiday' : 'absent', // Resolved to final status at completeWork time
        isWFH: wfhData?.isWFH || false,
        location: wfhData?.location,
        wfhReason: wfhData?.reason,
        wfhDescription: wfhData?.description
      });
    } else {
      attendance.workStartedAt = now;
      attendance.totalLeads = todayLeadsCount;
      attendance.plannedLeads = plannedLeads;
      attendance.isLateLogin = isLateLogin;
      attendance.lateLoginMinutes = lateLoginMinutes;
      if (note) attendance.note = note;
      if (wfhData) {
        attendance.isWFH = wfhData.isWFH || false;
        attendance.location = wfhData.location;
        attendance.wfhReason = wfhData.reason;
        attendance.wfhDescription = wfhData.description;
      }
    }

    await attendance.save();

    return {
      attendanceId: attendance._id,
      workStartTime: workStartTimeStr,
      todayLeads: todayLeadsCount,
      isHoliday,
      holidayName,
      isLateLogin,
      isLateHalfDay,
      lateLoginMinutes,
    };
  },

  /**
   * Complete work day
   */
  async completeWork(userId, attendanceId) {
    const now = new Date();
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const attendance = await Attendance.findById(attendanceId);
    if (!attendance) throw new Error('Attendance record not found');
    if (attendance.workCompletedAt) throw new Error('Work already completed for today');

    // 1. Leads worked today (several activities on one lead count once)
    const workedLeadIds = await LeadActivity.distinct('lead', {
      performedBy: userId,
      createdAt: { $gte: todayStart, $lte: todayEnd },
      action: { $in: WORK_ACTIONS }
    });

    // 2. Completion % = share of the day's planned work that was done
    const planned = new Set((attendance.plannedLeads || []).map(String));
    let completedLeadsCount;
    let completionPct;
    if (planned.size) {
      completedLeadsCount = workedLeadIds.filter(id => planned.has(String(id))).length;
      completionPct = (completedLeadsCount / planned.size) * 100;
    } else if (attendance.totalLeads > 0) {
      // Started before plans were recorded: the old whole-queue count
      completedLeadsCount = workedLeadIds.length;
      completionPct = Math.min(100, (completedLeadsCount / attendance.totalLeads) * 100);
    } else {
      // Nothing was due: any work done counts as a full day's work
      completedLeadsCount = workedLeadIds.length;
      completionPct = completedLeadsCount > 0 ? 100 : 0;
    }
    attendance.workCompletedAt = now;
    attendance.completedLeads = completedLeadsCount;
    attendance.completionPct = completionPct;

    // 3. Rules and working-hours config
    const Config = require('../models/Config');
    const configDoc = await Config.findOne({ key: 'working-hours' });
    const whConfig = configDoc?.value || {};
    const rules = resolveAttendanceRules(whConfig.rules);

    // 4. Early exit, measured from the end time (Ramadan-aware): Early Exit
    //    from earlyMarkMinutes, Half Day from earlyHalfDayMinutes.
    let expectedEndStr = whConfig.normalEnd || '18:30';
    if (whConfig.ramadanFrom && whConfig.ramadanTo) {
      const ramFrom = new Date(whConfig.ramadanFrom);
      const ramTo   = new Date(whConfig.ramadanTo);
      if (todayStart >= ramFrom && todayStart <= ramTo) {
        expectedEndStr = whConfig.ramadanEnd || '17:30';
      }
    }
    const [endHour, endMin] = expectedEndStr.split(':').map(Number);
    const expectedEnd = new Date(todayStart);
    expectedEnd.setHours(endHour, endMin, 0, 0);

    const earlyExitMinutes = Math.max(0, Math.floor((expectedEnd - now) / 60000));
    attendance.earlyExitMinutes = earlyExitMinutes;
    attendance.isEarlyExit = earlyExitMinutes >= rules.earlyMarkMinutes;
    if (attendance.isEarlyExit) {
      const exitNote = earlyExitMinutes >= rules.earlyHalfDayMinutes
        ? `Early exit: ${earlyExitMinutes} min (Half Day)`
        : `Early Exit: ${earlyExitMinutes} min`;
      attendance.note = [attendance.note, exitNote].filter(Boolean).join(' · ');
    }

    // 5. Final status: work completion first, then late login / early exit
    if (completionPct < rules.leaveBelowPct) {
      attendance.status = 'leave';
    } else if (completionPct < rules.halfDayBelowPct) {
      attendance.status = 'half_day';
    } else if (
      (attendance.lateLoginMinutes || 0) >= rules.lateHalfDayMinutes ||
      earlyExitMinutes >= rules.earlyHalfDayMinutes
    ) {
      attendance.status = 'half_day';
    } else {
      attendance.status = 'present';
    }

    await attendance.save();
    return attendance;
  },

  /**
   * Nightly: a working day with no login and no approved leave is an
   * unapproved leave, recorded as Absent. (Its work was never done, so the
   * pending-work sweep stacks it on the next working day.)
   */
  async markAbsentees(day = new Date()) {
    const date = startOfDay(day);
    const users = await User.find({
      isActive: true,
      role: { $in: ['executive', 'industry_manager', 'state_manager'] },
    }).select('state');
    const recorded = new Set((await Attendance.distinct('user', { date })).map(String));

    let marked = 0;
    for (const user of users) {
      if (recorded.has(String(user._id))) continue;
      const calendar = await loadCalendar(user, date);
      if (!calendar.isAvailable(date)) continue;
      await Attendance.updateOne(
        { user: user._id, date },
        { $setOnInsert: { status: 'absent', note: 'No login (unapproved leave)' } },
        { upsert: true }
      );
      marked++;
    }
    return marked;
  },

  /**
   * Check today's status (holiday or leave)
   */
  async checkTodayStatus(userId) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const user = await User.findById(userId);
    if (!user) throw new Error('User not found');

    const result = {
      isHoliday: false,
      holidayName: '',
      holidayType: '',
      isOnLeave: false,
      leaveType: ''
    };

    // 1. Check Holiday
    const policy = await LeavePolicy.findOne({ state: user.state, year: today.getFullYear() });
    if (policy && policy.holidays) {
      const holiday = policy.holidays.find(h => 
        h.date.toDateString() === today.toDateString()
      );
      if (holiday) {
        result.isHoliday = true;
        result.holidayName = holiday.name;
        result.holidayType = holiday.type;
      }
    }

    // 2. Check Approved Leave
    const leave = await Leave.findOne({
      user: userId,
      status: 'approved',
      fromDate: { $lte: today },
      toDate: { $gte: today }
    });
    
    if (leave) {
      result.isOnLeave = true;
      result.leaveType = leave.type;
    }

    return result;
  },

  /**
   * List attendance, leaves and holidays for a monthly matrix view
   */
  async listAttendance(filters) {
    const { userId, month, year } = filters;
    const now = new Date();
    const targetMonth = month || now.getMonth() + 1;
    const targetYear = year || now.getFullYear();
    const startOfMonth = new Date(targetYear, targetMonth - 1, 1);
    const endOfMonth = new Date(targetYear, targetMonth, 0, 23, 59, 59, 999);

    if (!userId) {
      const err = new Error('A user is required to list attendance');
      err.status = 400;
      throw err;
    }

    const user = await User.findById(userId);
    if (!user) {
      const err = new Error('User not found');
      err.status = 404;
      throw err;
    }

    // 1. Fetch Attendance Records
    const attendance = await Attendance.find({
      user: userId,
      date: { $gte: startOfMonth, $lte: endOfMonth }
    }).lean();

    // 2. Fetch Approved Leaves
    const leaves = await Leave.find({
      user: userId,
      status: 'approved',
      $or: [
        { fromDate: { $gte: startOfMonth, $lte: endOfMonth } },
        { toDate: { $gte: startOfMonth, $lte: endOfMonth } },
        { $and: [{ fromDate: { $lte: startOfMonth } }, { toDate: { $gte: endOfMonth } }] }
      ]
    }).lean();

    // 3. Fetch Holidays from Policy
    const policy = await LeavePolicy.findOne({ state: user.state, year: targetYear });
    const holidays = policy ? policy.holidays.filter(h => 
      h.date >= startOfMonth && h.date <= endOfMonth
    ) : [];

    // 4. Unified Event List
    const events = [];
    
    // Add Attendance
    attendance.forEach(a => {
      events.push({
        date: a.date,
        type: 'attendance',
        status: a.status,
        label: ATTENDANCE_LABELS[a.status] || 'Absent',
        details: a.note,
        isLateComing: !!a.isLateLogin,
        isEarlyExit: !!a.isEarlyExit
      });
    });

    // Add Leaves
    leaves.forEach(l => {
      // For multi-day leaves, we could split them here or handle in frontend
      // For now, let's just pass the leave object and let frontend iterate
      events.push({
        date: l.fromDate,
        toDate: l.toDate,
        type: 'leave',
        status: 'on_leave',
        label: l.leaveType || 'Leave',
        details: l.reason
      });
    });

    // Add Holidays
    holidays.forEach(h => {
      events.push({
        date: h.date,
        type: 'holiday',
        status: 'holiday',
        label: h.name,
        details: h.type
      });
    });

    return events;
  },

  /**
   * Monthly summary
   */
  async getMonthlySummary(userId, month, year) {
    const startOfMonth = new Date(year, month - 1, 1);
    const endOfMonth = new Date(year, month, 0, 23, 59, 59, 999);

    const attendances = await Attendance.find({
      user: userId,
      date: { $gte: startOfMonth, $lte: endOfMonth }
    });

    const summary = {
      totalPresent: 0,
      totalHalfDays: 0,
      totalLeaves: 0,
      avgCompletionPct: 0
    };

    let totalPct = 0;
    let daysWithWork = 0;

    attendances.forEach(a => {
      if (a.status === 'present') summary.totalPresent++;
      else if (a.status === 'half_day') summary.totalHalfDays++;
      else if (a.status === 'leave' || a.status === 'absent') summary.totalLeaves++;

      if (a.workStartedAt) {
        totalPct += a.completionPct || 0;
        daysWithWork++;
      }
    });

    summary.avgCompletionPct = daysWithWork > 0 ? (totalPct / daysWithWork) : 0;
    return summary;
  }
};

module.exports = attendanceService;
