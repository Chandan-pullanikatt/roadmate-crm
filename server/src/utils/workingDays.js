/**
 * Working-day calendar (client rule, Sep 2026): every day is a working day
 * except Sundays, the 2nd and 4th Saturday of the month, and the holidays in
 * the user's state LeavePolicy. Dates are server-local, like attendance.
 */
const LeavePolicy = require('../models/LeavePolicy');
const Leave = require('../models/Leave');

const startOfDay = (date) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

const addDays = (date, n) => {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
};

const dayKey = (date) => startOfDay(date).toDateString();

/** Sunday, or the 2nd / 4th Saturday of the month. */
const isWeeklyOff = (date) => {
  const day = date.getDay();
  if (day === 0) return true;
  if (day !== 6) return false;
  const nth = Math.ceil(date.getDate() / 7);
  return nth === 2 || nth === 4;
};

/** Working days in a calendar month, before state holidays (month is 1-12). */
const countWeekdayWorkingDays = (year, month) => {
  const daysInMonth = new Date(year, month, 0).getDate();
  let count = 0;
  for (let d = 1; d <= daysInMonth; d++) {
    if (!isWeeklyOff(new Date(year, month - 1, d))) count++;
  }
  return count;
};

/**
 * Loads what is needed to answer "can this user work on day X?" without a query
 * per day: the state's holidays and the user's approved leave from `from` on.
 *
 *   isWorkingDay(d)    — not a weekly off or state holiday
 *   isOnLeave(d)       — covered by an approved leave
 *   isAvailable(d)     — a working day the user is not on approved leave
 *   nextAvailable(d)   — first available day on or after d
 */
const loadCalendar = async (user, from = new Date()) => {
  const fromDay = startOfDay(from);

  const holidayKeys = new Set();
  const policies = await LeavePolicy.find({
    state: user.state,
    year: { $in: [fromDay.getFullYear(), fromDay.getFullYear() + 1] },
  }).lean();
  policies.forEach(p => (p.holidays || []).forEach(h => holidayKeys.add(dayKey(h.date))));

  const leaves = await Leave.find({
    user: user._id,
    status: 'approved',
    toDate: { $gte: fromDay },
  }).select('fromDate toDate').lean();

  const isWorkingDay = (date) => !isWeeklyOff(date) && !holidayKeys.has(dayKey(date));
  const isOnLeave = (date) => {
    const t = startOfDay(date).getTime();
    return leaves.some(l => t >= startOfDay(l.fromDate).getTime() && t <= startOfDay(l.toDate).getTime());
  };
  const isAvailable = (date) => isWorkingDay(date) && !isOnLeave(date);

  const nextAvailable = (date) => {
    let d = startOfDay(date);
    for (let i = 0; i < 366 && !isAvailable(d); i++) d = addDays(d, 1);
    return d;
  };

  return { isWorkingDay, isOnLeave, isAvailable, nextAvailable };
};

/** Same wall-clock time as `original`, on calendar day `day`. */
const onDay = (original, day) => {
  const d = new Date(day);
  const o = new Date(original);
  d.setHours(o.getHours(), o.getMinutes(), o.getSeconds(), 0);
  return d;
};

module.exports = {
  startOfDay,
  addDays,
  isWeeklyOff,
  countWeekdayWorkingDays,
  loadCalendar,
  onDay,
};
