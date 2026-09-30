const Attendance = require('../models/Attendance');
const LeavePolicy = require('../models/LeavePolicy');
const Leave = require('../models/Leave');
const Lead = require('../models/Lead');
const LeadActivity = require('../models/LeadActivity');
const User = require('../models/User');
const scheduleService = require('./scheduleService');
const { isWeeklyOff, loadCalendar, attendanceDay, istCivilDay, istTimeOn } = require('../utils/workingDays');
const { resolveAttendanceRules } = require('../constants/attendanceRules');
const { getWorkPct, getDayWorkPct } = require('./workPercentService');
const { WORK_ACTIONS } = require('../constants/workActions');

const ATTENDANCE_LABELS = { present: 'Present', half_day: 'Half Day', leave: 'Leave', holiday: 'Holiday' };
const HALF_DAY_SESSION_LABELS = { first_half: 'first half', second_half: 'second half' };

/** "HH:MM" halfway between two "HH:MM" times -- where a half-day leave splits the shift. */
const midShift = (startStr, endStr) => {
  const toMin = (t) => { const [h, m] = String(t).split(':').map(Number); return (h || 0) * 60 + (m || 0); };
  const mid = Math.round((toMin(startStr) + toMin(endStr)) / 2);
  return `${String(Math.floor(mid / 60)).padStart(2, '0')}:${String(mid % 60).padStart(2, '0')}`;
};

/** The approved half-day leave on civil day `day` (as istCivilDay gives it), if any. */
const halfDayLeaveOn = (userId, day) => Leave.findOne({
  user: userId,
  status: 'approved',
  isHalfDay: true,
  fromDate: { $lte: day },
  toDate: { $gte: day },
});

const attendanceService = {
  /**
   * Start work day. Every manager role starts its day here, and each may opt for
   * work from home on the way in -- which is only recorded with a reason against
   * it, so the register says why the day was worked remotely.
   */
  async startWork(userId, wfhData = null) {
    const now = new Date();
    // The IST calendar day, as a server-local Date: drives the day arithmetic
    // below (day of week, holiday match, Ramadan window), which reads local date
    // parts. Midnight in the server's own zone would be the UTC date on Render,
    // which is still yesterday for anyone starting before 05:30 IST.
    const today = istCivilDay(now);

    // Where the row is FILED -- see attendanceDay.
    const dateKey = attendanceDay(now);

    const isWFH = !!wfhData?.isWFH;
    const wfh = {
      isWFH,
      location: isWFH ? (wfhData.location || '').trim() : undefined,
      reason:   isWFH ? (wfhData.reason   || '').trim() : undefined,
    };
    if (isWFH && !wfh.reason) throw new Error('A reason is required to work from home');

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
    let attendance = await Attendance.findOne({ user: userId, date: dateKey });
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
    let workEndTimeStr = whConfig.normalEnd || '18:30';

    if (isWithinRamadanConfig()) {
      workStartTimeStr = whConfig.ramadanStart || '09:00';
      workEndTimeStr = whConfig.ramadanEnd || '17:30';
    } else if (policy && policy.ramadanStart && policy.ramadanEnd) {
      if (today >= policy.ramadanStart && today <= policy.ramadanEnd) {
        workStartTimeStr = policy.ramadanWorkStart || '09:00';
      }
    }

    // 4. Late login, measured from the start time: Late Coming from
    //    lateMarkMinutes, Half Day (decided at completeWork) from lateHalfDayMinutes.
    //    The start time is IST office hours, so it is placed on the IST day.
    const rules = resolveAttendanceRules(whConfig.rules);
    // With the first half on approved leave, the day starts at mid-shift.
    const halfDayLeave = await halfDayLeaveOn(userId, today);
    const lateFromStr = halfDayLeave?.halfDaySession === 'first_half'
      ? midShift(workStartTimeStr, workEndTimeStr)
      : workStartTimeStr;
    const expectedStart = istTimeOn(now, lateFromStr);

    const lateLoginMinutes = Math.max(0, Math.floor((now - expectedStart) / 60000));
    const isLateLogin = lateLoginMinutes >= rules.lateMarkMinutes;
    const isLateHalfDay = lateLoginMinutes >= rules.lateHalfDayMinutes;
    let note = isLateHalfDay
      ? `Late login: ${lateLoginMinutes} min (Half Day)`
      : isLateLogin ? `Late Coming: ${lateLoginMinutes} min` : '';

    // 5. The day's work: due today plus pending from earlier days
    const plannedLeads = await scheduleService.getDayPlan(userId, now);
    const todayLeadsCount = plannedLeads.length;

    // 6. Create or update Attendance doc
    if (!attendance) {
      attendance = new Attendance({
        user: userId,
        date: dateKey,
        workStartedAt: now,
        totalLeads: todayLeadsCount,
        plannedLeads,
        isLateLogin,
        lateLoginMinutes,
        note,
        status: isHoliday ? 'holiday' : 'absent', // Resolved to final status at completeWork time
        isWFH: wfh.isWFH,
        location: wfh.location,
        wfhReason: wfh.reason
      });
    } else {
      attendance.workStartedAt = now;
      attendance.totalLeads = todayLeadsCount;
      attendance.plannedLeads = plannedLeads;
      attendance.isLateLogin = isLateLogin;
      attendance.lateLoginMinutes = lateLoginMinutes;
      if (note) attendance.note = note;
      attendance.isWFH = wfh.isWFH;
      attendance.location = wfh.location;
      attendance.wfhReason = wfh.reason;
      attendance.wfhDescription = undefined;
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
      isWFH: wfh.isWFH,
      wfhReason: wfh.reason,
    };
  },

  /**
   * Complete work day
   */
  async completeWork(userId, attendanceId) {
    const now = new Date();

    const attendance = await Attendance.findById(attendanceId);
    if (!attendance) throw new Error('Attendance record not found');
    if (attendance.workCompletedAt) throw new Error('Work already completed for today');

    // 1. Score the day: leads completed in today's queue over the size of that
    //    queue. One definition, in workPercentService, shared with My Work's
    //    live figure and with every performance table -- scoring against the
    //    start-of-day snapshot instead is what recorded a 44-lead day as 0%.
    //    Scored on the row's own day, not "now": the auto-complete cron can run
    //    after midnight IST, and scoring `now` then reads the next day's empty
    //    book and records the day just worked as 0%.
    const { workPct: completionPct, queueCount, completedCount: completedLeadsCount } =
      await getDayWorkPct(userId, attendance.date);

    attendance.workCompletedAt = now;
    attendance.completedLeads = completedLeadsCount;
    attendance.completionPct = completionPct;
    // The queue is re-read at completion, so the day is scored against the book
    // as it finally stood rather than as it looked at login.
    attendance.totalLeads = queueCount;

    // 3. Rules and working-hours config
    const Config = require('../models/Config');
    const configDoc = await Config.findOne({ key: 'working-hours' });
    const whConfig = configDoc?.value || {};
    const rules = resolveAttendanceRules(whConfig.rules);

    // 4. Early exit, measured from the end time (Ramadan-aware): Early Exit
    //    from earlyMarkMinutes, Half Day from earlyHalfDayMinutes. The end time
    //    is IST office hours on the row's own day, so an auto-complete that runs
    //    late cannot measure against the wrong day.
    const workDay = istCivilDay(attendance.date);
    let expectedStartStr = whConfig.normalStart || '09:30';
    let expectedEndStr = whConfig.normalEnd || '18:30';
    if (whConfig.ramadanFrom && whConfig.ramadanTo) {
      const ramFrom = new Date(whConfig.ramadanFrom);
      const ramTo   = new Date(whConfig.ramadanTo);
      ramFrom.setHours(0, 0, 0, 0);
      ramTo.setHours(23, 59, 59, 999);
      if (workDay >= ramFrom && workDay <= ramTo) {
        expectedStartStr = whConfig.ramadanStart || '09:00';
        expectedEndStr = whConfig.ramadanEnd || '17:30';
      }
    }

    // An approved half-day leave on this day. With the second half off, the
    // day ends at mid-shift (the first half's late login was already measured
    // from mid-shift at startWork), and the day is scored in step 5.
    const halfDayLeave = await halfDayLeaveOn(attendance.user, workDay);
    if (halfDayLeave?.halfDaySession === 'second_half') {
      expectedEndStr = midShift(expectedStartStr, expectedEndStr);
    }
    const expectedEnd = istTimeOn(attendance.date, expectedEndStr);

    const earlyExitMinutes = Math.max(0, Math.floor((expectedEnd - now) / 60000));
    attendance.earlyExitMinutes = earlyExitMinutes;
    attendance.isEarlyExit = earlyExitMinutes >= rules.earlyMarkMinutes;
    if (attendance.isEarlyExit) {
      const exitNote = earlyExitMinutes >= rules.earlyHalfDayMinutes
        ? `Early exit: ${earlyExitMinutes} min (Half Day)`
        : `Early Exit: ${earlyExitMinutes} min`;
      attendance.note = [attendance.note, exitNote].filter(Boolean).join(' · ');
    }

    // 5. Final status: work completion first, then late login / early exit.
    //    On a half-day leave the best a day can be is Half Day, and it is
    //    judged on half the queue: doing that half keeps it from being Leave.
    if (halfDayLeave) {
      const halfNote = `Half-day leave (${HALF_DAY_SESSION_LABELS[halfDayLeave.halfDaySession] || 'half day'})`;
      if (!(attendance.note || '').includes(halfNote)) {
        attendance.note = [halfNote, attendance.note].filter(Boolean).join(' · ');
      }
      attendance.status = Math.min(100, completionPct * 2) < rules.leaveBelowPct ? 'leave' : 'half_day';
    } else if (completionPct < rules.leaveBelowPct) {
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
    // Two different things: `date` is where the row is filed (machine
    // independent -- see attendanceDay), `civil` is the calendar day the
    // holiday and weekly-off calendar reads. Filing on startOfDay is what made
    // this job unable to see a Start Work row written by a server in another
    // zone, so it marked people absent on days they had worked.
    const date = attendanceDay(day);
    const civil = istCivilDay(day);
    const users = await User.find({
      isActive: true,
      role: { $in: ['executive', 'industry_manager', 'state_manager'] },
    }).select('state');
    const recorded = new Set((await Attendance.distinct('user', { date })).map(String));

    let marked = 0;
    for (const user of users) {
      if (recorded.has(String(user._id))) continue;
      const calendar = await loadCalendar(user, civil);
      if (!calendar.isAvailable(civil)) continue;
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
      // A half-day leave still leaves half the day to work.
      result.isOnLeave = !leave.isHalfDay;
      result.leaveType = leave.type;
      result.halfDaySession = leave.isHalfDay ? leave.halfDaySession : null;
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
        label: l.isHalfDay
          ? `Half Day Leave (${HALF_DAY_SESSION_LABELS[l.halfDaySession] || 'half day'})`
          : l.leaveType || 'Leave',
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

    attendances.forEach(a => {
      if (a.status === 'present') summary.totalPresent++;
      else if (a.status === 'half_day') summary.totalHalfDays++;
      else if (a.status === 'leave' || a.status === 'absent') summary.totalLeaves++;
    });

    // The month's work %: the average of its daily work percentages, from the
    // one definition in workPercentService. It used to divide only by the days
    // that were started, which quietly left absences out of the average.
    const workPctById = await getWorkPct([userId], startOfMonth, endOfMonth);
    summary.avgCompletionPct = workPctById.get(String(userId))?.workPct || 0;
    return summary;
  }
};

module.exports = attendanceService;
