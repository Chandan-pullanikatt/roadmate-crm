/**
 * One definition of "a staff member's numbers for a period", used by every
 * manager/staff performance table in the CRM (Founder, State Manager and
 * Industry Manager dashboards).
 *
 * Keeping this in one place is what makes the Founder's Industry Managers table
 * and the State Manager's Industry Managers table report the same figures for
 * the same person and period — they used to aggregate separately and drift.
 */
const Lead = require('../models/Lead');
const LeadActivity = require('../models/LeadActivity');
const Attendance = require('../models/Attendance');
const Leave = require('../models/Leave');
const { REVENUE_EXPR } = require('./revenueService');

/** Activity actions that count as a meeting, whatever stage they were logged at. */
const MEETING_ACTIONS = ['meeting_scheduled', 'meeting_done', 'meeting_virtual', 'meeting_direct'];

/**
 * Two ways to count the same thing, kept side by side.
 *
 * The figures the tables render — meetings, blocking, converted, revenue —
 * count the LEADS, by the status they are standing on, across leads created in
 * the period. That is exactly what the Lead Pipeline cards show, and the staff
 * tables are read as a summary of that pipeline: counting logged activity
 * instead made a CSV-imported lead look like missing data, which the client
 * reported as a bug (2026-09-23 — Direct Meeting read 9 on the pipeline and 0
 * in the table for the same person).
 *
 * The `*Logged` figures count what staff actually DID in the period, from
 * LeadActivity. That is the honest performance measure and it stays in the
 * payload, unrendered, for phase two — when these become columns of their own.
 * Two caveats to settle then: a meeting counts twice if it is both scheduled
 * and marked done, and a lead that advances past a stage stops being counted at
 * it, so these numbers can go down.
 */

/** The zero row, so a user with no activity still renders every column. */
const EMPTY_METRICS = {
  workPct: 0,
  leads: 0,
  periodLeads: 0,
  calls: 0,
  meetings: 0,
  directMeetings: 0,
  virtualMeetings: 0,
  followups: 0,
  blocking: 0,
  converted: 0,
  revenue: 0,
  meetingsLogged: 0,
  meetingsLoggedDirect: 0,
  meetingsLoggedVirtual: 0,
  blockingLogged: 0,
  convertedLogged: 0,
  revenueBooked: 0,
  leaves: 0
};

/**
 * Per-user metrics for the given period.
 *
 * @param {Array} userIds       users to report on
 * @param {Date}  periodStart   inclusive
 * @param {Date}  periodEnd     inclusive
 * @returns {Promise<Map<string, object>>} keyed by String(userId)
 */
const getPerformanceMetrics = async (userIds, periodStart, periodEnd) => {
  const ids = (userIds || []).filter(Boolean);
  if (ids.length === 0) return new Map();

  const periodWindow = { $gte: periodStart, $lte: periodEnd };

  const [attendance, activities, meetingTypes, totalLeads, periodLeads, leaves] = await Promise.all([
    Attendance.aggregate([
      { $match: { user: { $in: ids }, date: periodWindow } },
      { $group: { _id: '$user', avgWorkPct: { $avg: '$completionPct' } } }
    ]),
    LeadActivity.aggregate([
      { $match: { performedBy: { $in: ids }, createdAt: periodWindow } },
      { $group: {
        _id: '$performedBy',
        calls:     { $sum: { $cond: [{ $eq: ['$action', 'called'] }, 1, 0] } },
        meetings:  { $sum: { $cond: [{ $in: ['$action', MEETING_ACTIONS] }, 1, 0] } },
        followups: { $sum: { $cond: [{ $eq: ['$action', 'followup_set'] }, 1, 0] } },
        blocking:  { $sum: { $cond: [{ $eq: ['$action', 'blocking_amount_received'] }, 1, 0] } },
        converted: { $sum: { $cond: [{ $eq: ['$action', 'converted'] }, 1, 0] } },
        revenue:   { $sum: REVENUE_EXPR }
      } }
    ]),
    // Direct vs virtual split of the meetings counted above. Meetings logged
    // before meetingType was recorded fall back to the lead's status.
    LeadActivity.aggregate([
      { $match: { performedBy: { $in: ids }, action: { $in: MEETING_ACTIONS }, createdAt: periodWindow } },
      { $lookup: { from: 'leads', localField: 'lead', foreignField: '_id', as: 'leadDoc', pipeline: [{ $project: { status: 1 } }] } },
      { $addFields: {
        isVirtual: { $or: [
          { $eq: ['$action', 'meeting_virtual'] },
          { $eq: ['$metadata.meetingType', 'virtual'] },
          { $and: [
            { $ne: ['$action', 'meeting_direct'] },
            { $eq: [{ $ifNull: ['$metadata.meetingType', null] }, null] },
            { $eq: [{ $arrayElemAt: ['$leadDoc.status', 0] }, 'meeting_virtual'] }
          ] }
        ] }
      } },
      { $group: {
        _id: '$performedBy',
        virtual: { $sum: { $cond: ['$isVirtual', 1, 0] } },
        direct:  { $sum: { $cond: ['$isVirtual', 0, 1] } }
      } }
    ]),
    // Everything the user owns right now — a live figure, not period-filtered.
    Lead.aggregate([
      { $match: { owner: { $in: ids } } },
      { $group: { _id: '$owner', count: { $sum: 1 } } }
    ]),
    // Leads the user owns that were created inside the period, bucketed by the
    // status they are standing on — the same buckets as the pipeline cards, so
    // the table and the pipeline always agree. Status names mirror
    // constants/leadStatusGroups.js; change them together.
    Lead.aggregate([
      { $match: { owner: { $in: ids }, createdAt: periodWindow } },
      { $group: {
        _id: '$owner',
        count:           { $sum: 1 },
        directMeetings:  { $sum: { $cond: [{ $eq: ['$status', 'meeting_direct'] }, 1, 0] } },
        virtualMeetings: { $sum: { $cond: [{ $eq: ['$status', 'meeting_virtual'] }, 1, 0] } },
        blocking:        { $sum: { $cond: [{ $eq: ['$status', 'blocking_amount_received'] }, 1, 0] } },
        converted:       { $sum: { $cond: [{ $in: ['$status', ['converted', 'agreement_signed']] }, 1, 0] } },
        // Money received on the lead: blocking + full amount, which is the
        // client's definition of revenue. Leads converted before amounts were
        // captured carry the deal value on actualRevenue instead.
        revenue: { $sum: { $let: {
          vars: { paid: { $add: [{ $ifNull: ['$blockingAmount', 0] }, { $ifNull: ['$fullAmount', 0] }] } },
          in: { $cond: [{ $gt: ['$$paid', 0] }, '$$paid', { $ifNull: ['$actualRevenue', 0] }] }
        } } }
      } }
    ]),
    // Approved leave days for leaves overlapping the period.
    Leave.aggregate([
      { $match: {
        user: { $in: ids },
        status: 'approved',
        fromDate: { $lte: periodEnd },
        toDate: { $gte: periodStart }
      } },
      { $group: { _id: '$user', days: { $sum: '$days' } } }
    ])
  ]);

  const byId = (rows) => new Map(rows.map(r => [String(r._id), r]));
  const att = byId(attendance);
  const act = byId(activities);
  const mt = byId(meetingTypes);
  const owned = byId(totalLeads);
  const fresh = byId(periodLeads);
  const lv = byId(leaves);

  return new Map(ids.map(id => {
    const key = String(id);
    const a = act.get(key) || {};
    const m = mt.get(key) || {};
    const p = fresh.get(key) || {};
    return [key, {
      workPct: Math.round(att.get(key)?.avgWorkPct || 0),
      leads: owned.get(key)?.count || 0,
      periodLeads: p.count || 0,
      calls: a.calls || 0,
      // Where the period's leads are standing — matches the pipeline cards.
      meetings: (p.directMeetings || 0) + (p.virtualMeetings || 0),
      directMeetings: p.directMeetings || 0,
      virtualMeetings: p.virtualMeetings || 0,
      blocking: p.blocking || 0,
      converted: p.converted || 0,
      revenue: p.revenue || 0,
      followups: a.followups || 0,
      // What staff logged in the period. Unrendered; see the note above.
      meetingsLogged: a.meetings || 0,
      meetingsLoggedDirect: m.direct || 0,
      meetingsLoggedVirtual: m.virtual || 0,
      blockingLogged: a.blocking || 0,
      convertedLogged: a.converted || 0,
      revenueBooked: a.revenue || 0,
      leaves: lv.get(key)?.days || 0
    }];
  }));
};

/**
 * Roll a set of users' metrics into one row — used where a manager's line is
 * "this manager plus the team reporting to them".
 *
 * Work % stays the manager's own (an average of averages across a team is not
 * a meaningful completion figure); every count and the revenue are summed.
 */
const rollupMetrics = (metricsById, ownId, teamIds = []) => {
  const own = metricsById.get(String(ownId)) || EMPTY_METRICS;
  const subtree = [ownId, ...teamIds];
  const sum = (field) => subtree.reduce((total, id) => {
    const rec = metricsById.get(String(id));
    return total + (rec?.[field] || 0);
  }, 0);

  return {
    ...own,
    leads: sum('leads'),
    periodLeads: sum('periodLeads'),
    calls: sum('calls'),
    meetings: sum('meetings'),
    directMeetings: sum('directMeetings'),
    virtualMeetings: sum('virtualMeetings'),
    followups: sum('followups'),
    blocking: sum('blocking'),
    converted: sum('converted'),
    revenue: sum('revenue'),
    meetingsLogged: sum('meetingsLogged'),
    meetingsLoggedDirect: sum('meetingsLoggedDirect'),
    meetingsLoggedVirtual: sum('meetingsLoggedVirtual'),
    blockingLogged: sum('blockingLogged'),
    convertedLogged: sum('convertedLogged'),
    revenueBooked: sum('revenueBooked')
  };
};

module.exports = { getPerformanceMetrics, rollupMetrics, EMPTY_METRICS, MEETING_ACTIONS };
