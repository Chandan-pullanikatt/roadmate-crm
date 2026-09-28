/**
 * The one definition of "work %", used by every screen that shows one.
 *
 * A DAY's work % is the day's queue, scored:
 *
 *     leads completed in today's queue / total leads in today's queue
 *
 * "Today's queue" is leadService.getQueue -- the same day's book the staff
 * member is handed on My Work. There is no second definition: attendance used
 * to score against scheduleService.getDayPlan, which only saw leads carrying a
 * nextActionAt, so a manager who worked 44 leads against a 1-lead plan was
 * recorded at 0% while My Work showed her 86%. Both now read getQueue.
 *
 * A PERIOD's work % -- a week, a month, a quarter, a year -- is the average of
 * those daily figures over THE DAYS THAT WERE WORKED:
 *
 *     sum(work % of each day worked) / number of days worked
 *
 * A day worked is a day the person started work on (workStartedAt is set).
 * Days they did not start -- the placeholder 'absent' rows the cron writes, and
 * days nobody was expected to work (holidays, optional holidays, approved
 * leave) -- are not days worked, so they neither raise nor lower the average.
 * They used to be averaged in at 0%, which is how a manager with one 33% day
 * and seventeen untouched rows was reported at 2% for the month.
 *
 * The day in progress is scored live from the same queue, so the figure on the
 * Performance page matches the one on My Work before the day is completed.
 * Completed days read the percentage stored on their attendance row.
 *
 * This lives in one file on purpose. These figures used to be averaged inline at
 * seven call sites with three different rules. Add a new screen by calling
 * getWorkPct or getDayWorkPct, never by averaging completionPct yourself.
 */
const Attendance = require('../models/Attendance');
const Leave = require('../models/Leave');
const LeadActivity = require('../models/LeadActivity');
const leadService = require('./leadService');
const { WORK_ACTIONS } = require('../constants/workActions');
const { startOfDay, istDayRange } = require('../utils/workingDays');

/** Attendance statuses for days nobody was expected to work. */
const NON_WORKING_STATUSES = ['holiday', 'optional_holiday'];

/** The zero row, so a user with no recorded day still renders a figure. */
const EMPTY_WORK_PCT = { workPct: 0, sum: 0, days: 0 };

const dayKey = (userId, date) => `${String(userId)}|${startOfDay(date).toDateString()}`;

/**
 * Every user-day covered by an approved leave overlapping the period, as a set
 * of keys — so the day loop below is a lookup rather than a query per day.
 */
const approvedLeaveDays = async (ids, periodStart, periodEnd) => {
  const leaves = await Leave.find({
    user: { $in: ids },
    status: 'approved',
    fromDate: { $lte: periodEnd },
    toDate: { $gte: periodStart },
  }).select('user fromDate toDate').lean();

  const keys = new Set();
  for (const leave of leaves) {
    // Clamp to the period: a leave running across the month boundary only
    // excludes the days that fall inside the window being reported on.
    const from = startOfDay(leave.fromDate < periodStart ? periodStart : leave.fromDate);
    const to = startOfDay(leave.toDate > periodEnd ? periodEnd : leave.toDate);
    for (const day = new Date(from); day <= to; day.setDate(day.getDate() + 1)) {
      keys.add(dayKey(leave.user, day));
    }
  }
  return keys;
};

/**
 * One day's work % for one user:
 *
 *     leads completed in today's queue / total leads in today's queue
 *
 * THE BOOK (the denominator) is the day's queue as it was handed out, frozen on
 * the attendance row at Start Work (`plannedLeads`, built by
 * scheduleService.getDayPlan -> leadService.getQueue). It has to be the frozen
 * copy, not a live re-read: working a lead takes it OUT of the live queue -- set
 * a follow-up for tomorrow and the lead is no longer due today -- so scoring
 * against a live queue drains the numerator as the day is worked and the
 * percentage falls the more you do.
 *
 * Leads worked today are added to the book. That covers the lead picked up
 * outside the day's list, and it repairs the days recorded while getDayPlan was
 * still reading nextActionAt alone and handing back a book of one.
 *
 * COMPLETED (the numerator) is the leads in that book the user logged a work
 * action against today.
 *
 * A day with nothing in the book scores 100% if any work was done and 0% if
 * none was: there was no book to get through, so getting through it is the
 * honest answer.
 *
 * @returns {Promise<{workPct, queueCount, completedCount, completedIds: string[]}>}
 *          `completedIds` are the book's leads that were worked, so a caller can
 *          list exactly the leads the percentage counted.
 */
const getDayWorkPct = async (userId, day = new Date()) => {
  const { start, end } = istDayRange(day);

  const [attendance, workedIds] = await Promise.all([
    Attendance.findOne({ user: userId, date: { $gte: start, $lte: end } })
      .select('plannedLeads')
      .lean(),
    LeadActivity.distinct('lead', {
      performedBy: userId,
      createdAt: { $gte: start, $lte: end },
      action: { $in: WORK_ACTIONS },
    }),
  ]);

  // No attendance row means the day was never started, so there is no frozen
  // book -- read the queue live to say what the day would hold.
  const planned = attendance
    ? (attendance.plannedLeads || []).map(String)
    : (await leadService.getQueue(userId, day)).map(l => String(l._id));

  const worked = workedIds.map(String);
  const book = new Set([...planned, ...worked]);

  const workedSet = new Set(worked);
  const completedIds = [...book].filter(id => workedSet.has(id));

  const queueCount = book.size;
  const completedCount = completedIds.length;
  const workPct = queueCount > 0
    ? (completedCount / queueCount) * 100
    : 0;

  return { workPct, queueCount, completedCount, completedIds };
};

/**
 * Work % per user for the given period: the average over the days worked.
 *
 * @param {Array}  userIds      users to report on
 * @param {Date}   periodStart  inclusive
 * @param {Date}   periodEnd    inclusive
 * @returns {Promise<Map<string, {workPct: number, sum: number, days: number}>>}
 *          keyed by String(userId); every id asked for is present. `days` is the
 *          number of days worked, which is what the average divides by.
 */
const getWorkPct = async (userIds, periodStart, periodEnd) => {
  const ids = (userIds || []).filter(Boolean);
  if (ids.length === 0) return new Map();

  const [records, leaveDays] = await Promise.all([
    Attendance.find({
      user: { $in: ids },
      date: { $gte: periodStart, $lte: periodEnd },
      status: { $nin: NON_WORKING_STATUSES },
      // A day worked is a day that was started. The nightly cron writes a
      // placeholder row for everyone who did not turn up; those rows carry no
      // workStartedAt and are not days worked, so they stay out of the average
      // rather than being averaged in at 0%.
      workStartedAt: { $ne: null },
    }).select('user date completionPct workCompletedAt').lean(),
    approvedLeaveDays(ids, periodStart, periodEnd),
  ]);

  // The day in progress has no stored percentage yet — it is only written when
  // the day is completed — so it is scored live off the same queue. Without
  // this, today reads 0% for everyone still working.
  const todayKeyOf = startOfDay(new Date()).toDateString();
  const liveDays = records.filter(r => !r.workCompletedAt && startOfDay(r.date).toDateString() === todayKeyOf);
  const livePct = new Map(await Promise.all(liveDays.map(async (r) => {
    const { workPct } = await getDayWorkPct(r.user, r.date);
    return [dayKey(r.user, r.date), workPct];
  })));

  const totals = new Map();
  for (const record of records) {
    const key = dayKey(record.user, record.date);
    if (leaveDays.has(key)) continue;
    const userKey = String(record.user);
    const total = totals.get(userKey) || { sum: 0, days: 0 };
    total.sum += livePct.has(key) ? livePct.get(key) : (record.completionPct || 0);
    total.days += 1;
    totals.set(userKey, total);
  }

  return new Map(ids.map((id) => {
    const total = totals.get(String(id));
    if (!total || total.days === 0) return [String(id), { ...EMPTY_WORK_PCT }];
    return [String(id), { workPct: total.sum / total.days, sum: total.sum, days: total.days }];
  }));
};

/**
 * One group's work %: a single average over every day the group recorded, not
 * an average of its members' averages.
 */
const rollupWorkPct = (workPctById, userIds = []) => {
  let sum = 0;
  let days = 0;
  for (const id of userIds) {
    const total = workPctById.get(String(id));
    if (!total) continue;
    sum += total.sum;
    days += total.days;
  }
  return days > 0 ? sum / days : 0;
};

module.exports = { getWorkPct, getDayWorkPct, rollupWorkPct, EMPTY_WORK_PCT, NON_WORKING_STATUSES };
