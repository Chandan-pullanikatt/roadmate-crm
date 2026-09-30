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

/**
 * The IST calendar day an instant falls in, as [start, end] instants.
 *
 * `startOfDay` above uses setHours, which is the *server's* zone -- fine for the
 * working-day arithmetic it was written for, wrong for deciding which leads are
 * due "today" when the server is not on IST. targetPeriod.js already pins IST for
 * the same reason; this is the day-sized version of it.
 */
const IST_OFFSET_MS = 330 * 60 * 1000;
const istDayRange = (date = new Date()) => {
  const shifted = new Date(date.getTime() + IST_OFFSET_MS);
  const start = new Date(Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate()) - IST_OFFSET_MS);
  return { start, end: new Date(start.getTime() + 24 * 60 * 60 * 1000 - 1) };
};

/**
 * The IST calendar day an instant falls in, as 'YYYY-MM-DD'.
 *
 * The key form of `istDayRange`, for bucketing records by day in JS. `IST_TZ`
 * is the same day boundary for a Mongo aggregation, so a `$dateToString` bucket
 * and a key built here line up -- they must, or an activity lands on a
 * different day from the attendance row it belongs to.
 */
const IST_TZ = '+05:30';
const istDayKey = (date) => new Date(new Date(date).getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);

/**
 * THE canonical date stamp for an attendance row: UTC midnight of the IST
 * calendar day the instant falls in.
 *
 * Attendance rows used to be filed under `startOfDay()`, which is midnight in
 * the *server's* zone -- so the same calendar day became a different instant
 * depending on which machine wrote it. A UTC server filed 28 Sep under
 * 28 Sep 00:00Z; a box running IST filed it under 27 Sep 18:30Z. Neither could
 * see the other's row, so Start Work wrote one and the absentee cron wrote
 * another, and the `{user, date}` unique index could not merge them because the
 * two instants genuinely differ. The result was one day recorded twice, as
 * "half day, 91%" and "absent, 0%" at once, and every attendance count adding up
 * both copies (33 duplicated user-days across 12 users, found 2026-09-29).
 *
 * UTC midnight, not IST midnight, for two reasons: it is what the production
 * server (UTC) has always written, so the rows already on disk stay valid; and
 * every range query over attendance.date is built from server-local month
 * bounds, which on that UTC server land exactly on these stamps. Moving the
 * stamp to IST midnight would shift every row 5h30m out of its own month.
 *
 * The IST part still matters: it decides WHICH day an instant belongs to, so
 * work logged at 1am IST is filed under that day rather than the one before.
 *
 * Every read and write of `Attendance.date` goes through this. Anything using
 * `startOfDay` for an attendance stamp is the bug above, waiting to happen.
 */
const attendanceDay = (date = new Date()) => {
  const shifted = new Date(new Date(date).getTime() + IST_OFFSET_MS);
  return new Date(Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate()));
};

/**
 * The same IST calendar day as a server-local Date, for the day arithmetic that
 * reads local parts -- isWeeklyOff, holiday matching, getFullYear. Pair it with
 * `attendanceDay`: that one says where the row is filed, this one says what day
 * of the week it is.
 */
const istCivilDay = (date = new Date()) => {
  const shifted = new Date(new Date(date).getTime() + IST_OFFSET_MS);
  return new Date(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate());
};

/**
 * The instant an IST wall-clock time ('HH:MM') falls at, on the IST calendar day
 * of `date`. For shift times -- start 09:30, end 18:30 -- which are Indian
 * office hours, not server hours. `setHours` on a UTC server put 18:30 at
 * midnight IST, so everyone finishing at 18:00 IST read as ~6 hours early.
 */
const istTimeOn = (date, hhmm) => {
  const [h, m] = String(hhmm).split(':').map(Number);
  return new Date(istDayRange(date).start.getTime() + ((h || 0) * 60 + (m || 0)) * 60000);
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
  istDayRange,
  istDayKey,
  attendanceDay,
  istCivilDay,
  istTimeOn,
  IST_TZ,
  addDays,
  isWeeklyOff,
  countWeekdayWorkingDays,
  loadCalendar,
  onDay,
};
