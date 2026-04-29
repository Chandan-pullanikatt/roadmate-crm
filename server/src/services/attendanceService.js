const Attendance = require('../models/Attendance');
const LeavePolicy = require('../models/LeavePolicy');
const Leave = require('../models/Leave');
const Lead = require('../models/Lead');
const LeadActivity = require('../models/LeadActivity');
const User = require('../models/User');
const leadService = require('./leadService');

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

    // 2. Check if already started
    let attendance = await Attendance.findOne({ user: userId, date: today });
    if (attendance && attendance.workStartedAt) {
      throw new Error('Work already started for today');
    }

    // 3. Get working hours start
    let workStartTimeStr = user.workingHours?.start || '09:30';
    
    // Ramadan check
    if (policy && policy.ramadanStart && policy.ramadanEnd) {
      if (today >= policy.ramadanStart && today <= policy.ramadanEnd) {
        workStartTimeStr = policy.ramadanWorkStart || '09:00';
      }
    }

    // 4. Calculate if late
    const now = new Date();
    const [startHour, startMin] = workStartTimeStr.split(':').map(Number);
    const expectedStart = new Date(today);
    expectedStart.setHours(startHour, startMin, 0, 0);
    
    // 30 min grace period
    const lateThreshold = new Date(expectedStart.getTime() + 30 * 60000);
    let note = '';
    if (now > lateThreshold) {
      note = 'Late start (> 30 mins)';
      // The user mentioned marking a half_day warning but not auto-marking yet.
      // We'll store it in the note or a dedicated flag if needed.
    }

    // 5. Count leads in queue
    const queue = await leadService.getQueue(userId);
    const todayLeadsCount = queue.length;

    // 6. Create or update Attendance doc
    if (!attendance) {
      attendance = new Attendance({
        user: userId,
        date: today,
        workStartedAt: now,
        totalLeads: todayLeadsCount,
        note: note,
        status: isHoliday ? 'holiday' : 'absent', // Default to absent until completed
        isWFH: wfhData?.isWFH || false,
        location: wfhData?.location,
        wfhReason: wfhData?.reason,
        wfhDescription: wfhData?.description
      });
    } else {
      attendance.workStartedAt = now;
      attendance.totalLeads = todayLeadsCount;
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
      holidayName
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

    // 1. Count completed leads (activity logs created today by user)
    // We group by lead to avoid counting multiple activities on the same lead as multiple completions
    const completedLeadsIds = await LeadActivity.distinct('lead', {
      performedBy: userId,
      createdAt: { $gte: todayStart, $lte: todayEnd }
    });
    
    const completedLeadsCount = completedLeadsIds.length;
    attendance.workCompletedAt = now;
    attendance.completedLeads = completedLeadsCount;

    // 2. Calculate completion %
    const totalLeads = attendance.totalLeads || 1; // Avoid div by zero
    const completionPct = (completedLeadsCount / totalLeads) * 100;
    attendance.completionPct = completionPct;

    // Fetch dynamic rules from Config
    const Config = require('../models/Config');
    const configDoc = await Config.findOne({ key: 'working-hours' });
    const rules = configDoc?.value?.rules || { leaveThreshold: 30, halfDayThreshold: 70, delayedLoginHalfDay: true };

    // 3. Determine status based on dynamic thresholds
    if (completionPct < rules.leaveThreshold) {
      attendance.status = 'leave'; // Counts as absent per prompt
    } else if (completionPct < rules.halfDayThreshold) {
      attendance.status = 'half_day';
    } else {
      // Check if delayed login should force a half day
      if (rules.delayedLoginHalfDay && attendance.note && attendance.note.includes('Late start')) {
        attendance.status = 'half_day';
      } else {
        attendance.status = 'present';
      }
    }

    await attendance.save();
    return attendance;
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
    const startOfMonth = new Date(year, month - 1, 1);
    const endOfMonth = new Date(year, month, 0, 23, 59, 59, 999);

    const user = await User.findById(userId);
    if (!user) throw new Error('User not found');

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
    const policy = await LeavePolicy.findOne({ state: user.state, year: year });
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
        label: a.status === 'present' ? 'Present' : a.status === 'half_day' ? 'Half Day' : 'Absent',
        details: a.note
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
