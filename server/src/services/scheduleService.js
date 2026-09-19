/**
 * When a lead's next piece of work falls due, and how leave moves it
 * (client spec, Sep 2026).
 *
 * A lead's work is scheduled on the day of its nextActionAt.
 *
 *   Pending work     Anything left undone moves to the owner's next available
 *                    working day (nightly, escalatePending).
 *   Approved leave   Work on the leave days moves to the next available day, and
 *                    everything after it moves along one slot per leave day, so
 *                    the whole schedule shifts forward (cascadeForLeave).
 *   Unapproved leave A missed working day is just pending work: it stacks on
 *                    the next working day without pushing that day's work on.
 *   Fixed            Meetings and fixed follow-ups keep their date, always.
 *
 * Leads in RNR status are left to the 09:05 RNR sweep when missed, so a missed
 * retry still counts as an attempt; approved leave does move them.
 */
const Lead = require('../models/Lead');
const User = require('../models/User');
const { startOfDay, addDays, loadCalendar, onDay } = require('../utils/workingDays');

const CLOSED_STATUSES = ['converted', 'lost', 'not_interested', 'blocking_amount_received', 'full_amount_received', 'agreement_signed'];
const MEETING_STATUSES = ['meeting_virtual', 'meeting_direct'];

/** Meetings and fixed follow-ups never move. */
const isFixed = (lead) => {
  if (MEETING_STATUSES.includes(lead.status)) return true;
  // A fixed follow-up stays fixed only while nextActionAt is still the date
  // that was fixed; once another action reschedules the lead, it moves again.
  return !!(lead.followUpFixed && lead.followUpDate && lead.nextActionAt &&
    new Date(lead.followUpDate).getTime() === new Date(lead.nextActionAt).getTime());
};

/** Moves a lead's scheduled work to `day`, keeping its time of day. */
const moveLead = (lead, day) => {
  const from = lead.nextActionAt;
  lead.nextActionAt = onDay(from, day);
  if (lead.followUpDate && new Date(lead.followUpDate).getTime() === new Date(from).getTime()) {
    lead.followUpDate = lead.nextActionAt;
  }
};

const movableQuery = (extra) => ({
  status: { $nin: [...CLOSED_STATUSES, ...MEETING_STATUSES] },
  nextActionAt: { $ne: null },
  ...extra,
});

const scheduleService = {
  CLOSED_STATUSES,
  isFixed,

  /**
   * The day's work for a user: leads due that day or pending from earlier, and
   * meetings (or their confirmation calls) that day. Returns lead ids.
   */
  async getDayPlan(userId, day = new Date()) {
    const dayStart = startOfDay(day);
    const dayEnd = new Date(dayStart); dayEnd.setHours(23, 59, 59, 999);

    const leads = await Lead.find({
      owner: userId,
      $or: [
        { status: { $nin: [...CLOSED_STATUSES, ...MEETING_STATUSES] }, nextActionAt: { $lte: dayEnd } },
        {
          status: { $in: MEETING_STATUSES },
          meetingAt: { $gte: dayStart },
          $or: [{ meetingAt: { $lte: dayEnd } }, { nextActionAt: { $lte: dayEnd } }],
        },
      ],
    }).select('_id').lean();

    return leads.map(l => l._id);
  },

  /**
   * Nightly: every movable lead whose work day has passed is moved to its
   * owner's next available working day, stacked on top of what is there.
   */
  async escalatePending(now = new Date()) {
    const today = startOfDay(now);
    const leads = await Lead.find(movableQuery({
      status: { $nin: [...CLOSED_STATUSES, ...MEETING_STATUSES, 'rnr'] },
      owner: { $ne: null },
      nextActionAt: { $lt: today },
    }));

    const byOwner = new Map();
    for (const lead of leads) {
      if (isFixed(lead)) continue;
      const key = String(lead.owner);
      if (!byOwner.has(key)) byOwner.set(key, []);
      byOwner.get(key).push(lead);
    }

    let moved = 0;
    for (const [ownerId, ownerLeads] of byOwner) {
      const owner = await User.findById(ownerId).select('state');
      if (!owner) continue;
      const calendar = await loadCalendar(owner, today);
      const target = calendar.nextAvailable(today);
      for (const lead of ownerLeads) {
        moveLead(lead, target);
        await lead.save();
        moved++;
      }
    }
    return moved;
  },

  /**
   * Call once, right after a leave is approved. Work on the leave days moves to
   * the next available day, and each later day's work moves forward by as many
   * working days as the leave takes out, so nothing is stacked.
   */
  async cascadeForLeave(leave, now = new Date()) {
    const user = await User.findById(leave.user).select('state');
    if (!user) return 0;

    const leaveStart = startOfDay(leave.fromDate);
    const leaveEnd = startOfDay(leave.toDate);
    const from = leaveStart > startOfDay(now) ? leaveStart : startOfDay(now);
    if (leaveEnd < from) return 0; // leave already over — its work went through escalation

    const leads = (await Lead.find(movableQuery({
      owner: leave.user,
      nextActionAt: { $gte: from },
    }))).filter(l => !isFixed(l));
    if (!leads.length) return 0;

    // Calendar includes this leave, so isAvailable is the schedule after it.
    // Before it, the leave's own working days were available too.
    const calendar = await loadCalendar(user, from);
    const inThisLeave = (d) => d >= leaveStart && d <= leaveEnd;
    const wasAvailable = (d) => calendar.isAvailable(d) || (inThisLeave(d) && calendar.isWorkingDay(d));

    // Slot n of the old schedule becomes slot n of the new one.
    const lastDay = startOfDay(Math.max(...leads.map(l => new Date(l.nextActionAt).getTime())));
    const oldSlots = [];
    const newSlots = [];
    for (let d = from, i = 0; i < 2000; d = addDays(d, 1), i++) {
      if (d <= lastDay && wasAvailable(d)) oldSlots.push(d.getTime());
      if (calendar.isAvailable(d)) newSlots.push(d);
      if (d > lastDay && newSlots.length > oldSlots.length) break;
    }

    let moved = 0;
    for (const lead of leads) {
      const day = startOfDay(lead.nextActionAt).getTime();
      let slot = oldSlots.findIndex(t => t >= day);
      if (slot === -1) slot = oldSlots.length;
      const target = newSlots[slot];
      if (!target || target.getTime() === day) continue;
      moveLead(lead, target);
      await lead.save();
      moved++;
    }
    return moved;
  },
};

module.exports = scheduleService;
