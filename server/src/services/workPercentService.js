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
const { Types } = require('mongoose');
const Attendance = require('../models/Attendance');
const Leave = require('../models/Leave');
const LeadActivity = require('../models/LeadActivity');
const leadService = require('./leadService');
const { WORK_ACTIONS } = require('../constants/workActions');
const { startOfDay, istDayRange, istDayKey, IST_TZ } = require('../utils/workingDays');

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

  // A day that was started but never completed has no stored percentage -- it
  // is only written at Complete Work -- so it is scored live off the same book.
  // That is today for everyone still working, and any past day the auto-complete
  // missed. Reading the stored 0 instead showed a worked day as 0%.
  const liveDays = records.filter(r => !r.workCompletedAt);
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
 * Leads per user for a period: the SUM of each day's queue.
 *
 * This is the Leads column on every staff performance table. Client rule
 * (2026-09-29): Leads means the work that was handed out, not the leads that
 * happened to be created in the window -- which is what it used to count, and
 * why a district manager who owned 196 leads read 49 for September.
 *
 * A day contributes the size of its book, the same book work % is scored
 * against, so Leads is the sum of the denominators that produced the percentage
 * printed beside it. A lead that sits in the queue for five days is five days of
 * work and counts five times: deliberately NOT deduplicated (client decision --
 * the column measures daily load, not distinct leads).
 *
 * Only days that were actually worked count, exactly as getWorkPct counts them:
 * a day nobody started has no book, and approved leave is skipped. That is what
 * keeps the two columns describing the same set of days.
 *
 * Past days can only come from the frozen `plannedLeads`, never from
 * leadService.getQueue -- that queue is built from each lead's CURRENT status
 * and due date, so re-reading it for last Tuesday returns today's book rather
 * than that day's. Days recorded before Start Work began freezing the book
 * carry none, and contribute only what was worked on them.
 *
 * @returns {Promise<Map<string, {leads: number, days: number}>>} keyed by String(userId);
 *          every id asked for is present.
 */
const getQueueTotals = async (userIds, periodStart, periodEnd) => {
  const ids = (userIds || []).filter(Boolean);
  if (ids.length === 0) return new Map();

  // Cast before the aggregation. Mongoose does not cast inside a pipeline, so a
  // user id arriving as a string matches nothing and the person reads 0 -- the
  // same trap documented in performanceService.
  const objectIds = ids
    .filter(id => Types.ObjectId.isValid(id))
    .map(id => (id instanceof Types.ObjectId ? id : new Types.ObjectId(String(id))));

  const [records, workedByDay, leaveDays] = await Promise.all([
    Attendance.find({
      user: { $in: ids },
      date: { $gte: periodStart, $lte: periodEnd },
      status: { $nin: NON_WORKING_STATUSES },
      workStartedAt: { $ne: null },
    }).select('user date plannedLeads').lean(),
    // Leads worked, per user per IST day. Bucketed in Mongo rather than day by
    // day in JS: a founder looking at a year covers every user times 365 days,
    // which is one query here and tens of thousands in a loop.
    LeadActivity.aggregate([
      { $match: {
        performedBy: { $in: objectIds },
        createdAt: { $gte: periodStart, $lte: periodEnd },
        action: { $in: WORK_ACTIONS },
      } },
      { $group: {
        _id: {
          user: '$performedBy',
          day: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: IST_TZ } },
        },
        leads: { $addToSet: '$lead' },
      } },
    ]),
    approvedLeaveDays(ids, periodStart, periodEnd),
  ]);

  const workedKey = (user, day) => `${String(user)}|${day}`;
  const worked = new Map(workedByDay.map(row => [
    workedKey(row._id.user, row._id.day),
    (row.leads || []).map(String),
  ]));

  // Group the rows by the DAY they belong to before counting anything. The live
  // data holds more than one attendance row for the same user-day -- startWork
  // looks a row up by the exact instant rather than the day, so a second Start
  // Work inserts another row (33 duplicated user-days across 12 users, measured
  // 2026-09-29). Counting per row would charge those days twice, so it is one
  // book per day, merged across whatever rows describe it. Fixing the duplicates
  // at the source does not change this figure; it just makes the merge a no-op.
  const byDay = new Map();
  for (const record of records) {
    if (leaveDays.has(dayKey(record.user, record.date))) continue;
    const key = workedKey(record.user, istDayKey(record.date));
    let book = byDay.get(key);
    if (!book) {
      book = { user: String(record.user), leads: new Set() };
      byDay.set(key, book);
    }
    for (const leadId of (record.plannedLeads || [])) book.leads.add(String(leadId));
  }

  // The same book getDayWorkPct scores: the frozen queue plus anything worked
  // that day, so a lead picked up outside the day's list still counts as load.
  for (const [key, book] of byDay) {
    for (const leadId of worked.get(key) || []) book.leads.add(leadId);
  }

  const totals = new Map();
  for (const book of byDay.values()) {
    const total = totals.get(book.user) || { leads: 0, days: 0 };
    total.leads += book.leads.size;
    total.days += 1;
    totals.set(book.user, total);
  }

  return new Map(ids.map(id => [String(id), totals.get(String(id)) || { leads: 0, days: 0 }]));
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

module.exports = { getWorkPct, getDayWorkPct, getQueueTotals, rollupWorkPct, EMPTY_WORK_PCT, NON_WORKING_STATUSES };
