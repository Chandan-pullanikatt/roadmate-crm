const Lead = require('../models/Lead');
const LeadActivity = require('../models/LeadActivity');
const User = require('../models/User');
const { loadCalendar, startOfDay, addDays } = require('../utils/workingDays');
const mongoose = require('mongoose');
const notificationService = require('./notificationService');
const { applyStatus } = require('../constants/leadStatusRank');

/**
 * The next N days the user can work: working days (Sundays and the 2nd/4th
 * Saturday off, state holidays off) that are not on their approved leave.
 */
async function getNextWorkingDays(count, user) {
  const calendar = await loadCalendar(user);
  const workingDays = [];
  let current = startOfDay(new Date());

  // We start looking from tomorrow
  for (let i = 0; workingDays.length < count && i < 60; i++) {
    current = addDays(current, 1);
    if (calendar.isAvailable(current)) workingDays.push(current);
  }

  return workingDays.map(d => ({
    label: d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
    // Local calendar date; toISOString() would give the previous day east of UTC
    value: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }));
}

/**
 * A lead is Converted only once BOTH the full amount is received and the
 * agreement is signed (client decision, Sep 2026). Whichever of the two lands
 * second promotes the lead and logs the 'converted' activity that every
 * conversion count, revenue figure and incentive is derived from.
 *
 * Returns the extra activity to write, or null if the lead is not there yet.
 */
const maybeConvert = (lead, performedBy) => {
  if (!lead.fullAmountReceivedDate || !lead.agreementSignedAt) return null;
  // Guard on convertedAt, not status: the caller has already overwritten status
  // with the stage it just recorded, so re-recording a stage on an
  // already-converted lead would otherwise log a second conversion.
  if (lead.convertedAt) return null;

  applyStatus(lead, 'converted');
  lead.convertedAt = new Date();

  return {
    lead: lead._id,
    performedBy: performedBy?._id ?? null,
    action: 'converted',
    note: 'Full amount received and agreement signed.',
    // The money was already booked as revenue on the payment entries themselves;
    // only a lead whose payments predate amount capture carries its deal value here.
    metadata: paymentsReceived(lead) > 0
      ? { category: lead.revenueCategory, totalReceived: paymentsReceived(lead) }
      : { revenue: lead.actualRevenue || lead.expectedRevenue || 0, category: lead.revenueCategory },
  };
};

const paymentsReceived = (lead) => (lead.blockingAmount || 0) + (lead.fullAmount || 0);

/**
 * Parses the amount entered with a Blocking / Full Amount entry. It is required:
 * that amount is what every revenue figure in the CRM adds up.
 */
const paymentAmountOf = (data) => {
  const amount = Number(String(data.amount ?? '').replace(/[^\d.]/g, ''));
  if (!(amount > 0)) throw new Error('Enter the amount received (₹).');
  return amount;
};

/**
 * Books a payment against the lead: adds it to the stage's running total, keeps
 * actualRevenue as the sum of all payments, and returns the activity metadata
 * that the revenue figures read.
 */
const recordPayment = (lead, amountField, data) => {
  const amount = paymentAmountOf(data);
  lead[amountField] = (lead[amountField] || 0) + amount;
  lead.actualRevenue = paymentsReceived(lead);
  if (data.revenueCategory) lead.revenueCategory = data.revenueCategory;
  return { revenue: amount, category: lead.revenueCategory };
};

/** Unanswered calls an owner makes on a never-reached lead before it moves on. */
const RNR_LIMIT = 5;

/**
 * A lead is engaged once it has got past the first call — connected, follow-up,
 * meeting, payment, or any closing outcome. Engaged leads take unlimited RNRs
 * without their status changing.
 */
const isEngaged = (lead) =>
  !!lead.hasBeenEngaged || !!lead.peakStatus || !['new', 'rnr'].includes(lead.status);

/** When to retry a never-reached lead after its nth RNR (n < RNR_LIMIT). */
const nextRnrRetryAt = (n) => {
  const at = new Date();
  if (n === 1) {
    // Same afternoon at 1:30 PM
    at.setHours(13, 30, 0, 0);
  } else if (n === 3) {
    // Two days later, random hour 9 AM–4 PM
    at.setDate(at.getDate() + 2);
    at.setHours(9 + Math.floor(Math.random() * 8), 0, 0, 0);
  } else {
    // Next day, random time 10 AM–2 PM
    at.setDate(at.getDate() + 1);
    at.setHours(10 + Math.floor(Math.random() * 5), Math.floor(Math.random() * 60), 0, 0);
  }
  return at;
};

/**
 * A same-level teammate of the lead's owner: same role, same reporting manager,
 * active. Picks whoever has the fewest open leads. Null if there is none.
 */
const findRnrPeer = async (lead) => {
  if (!lead.owner) return null;
  const owner = await User.findById(lead.owner).select('role reportingTo');
  if (!owner?.reportingTo) return null;

  const peers = await User.find({
    role: owner.role,
    reportingTo: owner.reportingTo,
    isActive: true,
    _id: { $ne: owner._id },
  }).select('name');
  if (!peers.length) return null;

  const loads = await Lead.aggregate([
    { $match: { owner: { $in: peers.map(p => p._id) }, status: { $nin: ['converted', 'lost', 'not_interested'] } } },
    { $group: { _id: '$owner', count: { $sum: 1 } } },
  ]);
  const loadOf = (id) => loads.find(l => String(l._id) === String(id))?.count || 0;
  return peers.reduce((best, p) => (loadOf(p._id) < loadOf(best._id) ? p : best));
};

const leadService = {
  /**
   * Transition lead state.
   * @param {string} leadId
   * @param {string} action
   * @param {Object} data
   * @param {Object|null} performedBy - user object, or null for system-triggered transitions
   * @param {Object|null} io - Socket.io instance for real-time notifications
   */
  async transition(leadId, action, data, performedBy = null, io = null) {
    const lead = await Lead.findById(leadId);
    if (!lead) throw new Error('Lead not found');

    const activityData = {
      lead: lead._id,
      performedBy: performedBy?._id ?? null,
      action: '',
      note: data.note || '',
      metadata: {}
    };

    // Set when a payment stage completes the pair that makes a lead Converted.
    let extraActivity = null;

    switch (action) {
      case 'mark_called':
        applyStatus(lead, 'called');
        lead.hasBeenEngaged = true; // Mark as engaged once called
        lead.lastCallAt = new Date();
        activityData.action = 'called';
        if (data.priority) lead.priority = data.priority;
        break;

      case 'set_feedback': {
        const { nextAction, note } = data;
        lead.feedback.push({ note, createdBy: performedBy._id });
        if (data.priority) lead.priority = data.priority;
        
        // Mark as engaged for all feedback actions (these represent actual engagement)
        lead.hasBeenEngaged = true;
        
        if (nextAction === 'followup') {
          applyStatus(lead, 'followup');
          activityData.action = 'followup_set';
        } else if (nextAction === 'converted') {
          applyStatus(lead, 'converted');
          lead.convertedAt = new Date();
          lead.strategyNote = data.strategyNote;
          if (data.revenueCategory) lead.revenueCategory = data.revenueCategory;
          if (data.actualRevenue) lead.actualRevenue = data.actualRevenue;
          
          activityData.action = 'converted';
          // Payments already recorded were booked as revenue when they came in.
          activityData.metadata = paymentsReceived(lead) > 0
            ? { category: lead.revenueCategory, totalReceived: paymentsReceived(lead) }
            : { revenue: lead.actualRevenue || lead.expectedRevenue || 0, category: lead.revenueCategory };
        } else if (nextAction === 'not_interested') {
          applyStatus(lead, 'not_interested');
          lead.strategyNote = data.strategyNote;
          activityData.action = 'not_interested';
        } else if (nextAction === 'schedule_virtual') {
          applyStatus(lead, 'meeting_virtual');
          lead.meetingAt = new Date(data.meetingAt);
          lead.meetingLink = data.meetingLink;
          if (data.meetingInvitees) lead.meetingInvitees = data.meetingInvitees;
          activityData.action = 'meeting_scheduled';
          activityData.metadata = { meetingType: 'virtual' };

          // Schedule initial confirmation task: 2 hours before the meeting
          // (or immediately if the meeting is within 2 hours)
          const vmConfirmAt = new Date(lead.meetingAt.getTime() - 2 * 60 * 60 * 1000);
          lead.nextActionAt = vmConfirmAt > new Date() ? vmConfirmAt : new Date();
          lead.subStatus = 'pre_meeting_confirm';

        } else if (nextAction === 'direct_meeting') {
          applyStatus(lead, 'meeting_direct');
          lead.meetingAt = new Date(data.meetingAt);
          if (data.meetingInvitees) lead.meetingInvitees = data.meetingInvitees;
          activityData.action = 'meeting_scheduled';
          activityData.metadata = { meetingType: 'direct' }; // counted by direct-meeting targets

          // Schedule confirmation task based on how far away the meeting is
          const tomorrowEnd = new Date();
          tomorrowEnd.setDate(tomorrowEnd.getDate() + 1);
          tomorrowEnd.setHours(23, 59, 59, 999);

          if (lead.meetingAt > tomorrowEnd) {
            // Meeting is day-after-tomorrow or later → confirm the day before at 10 AM
            const dayBeforeAt10 = new Date(lead.meetingAt);
            dayBeforeAt10.setDate(dayBeforeAt10.getDate() - 1);
            dayBeforeAt10.setHours(10, 0, 0, 0);
            lead.nextActionAt = dayBeforeAt10;
            lead.subStatus = 'day_before_confirm';
          } else {
            // Meeting is today or tomorrow → confirm immediately
            lead.nextActionAt = new Date();
            lead.subStatus = 'pre_meeting_confirm';
          }
        } else if (nextAction === 'blocking_amount_received') {
          // "Blocking" is the advance. It is a stage on the way, never a close.
          // Each stage keeps the date it first happened, and the status rank
          // stops a re-recorded stage from knocking an already-converted lead
          // back out of Converted and into a payment bucket.
          activityData.metadata = recordPayment(lead, 'blockingAmount', data);
          lead.blockingDate = lead.blockingDate || new Date();
          applyStatus(lead, 'blocking_amount_received');
          activityData.action = 'blocking_amount_received';
        } else if (nextAction === 'full_amount_received') {
          activityData.metadata = recordPayment(lead, 'fullAmount', data);
          lead.fullAmountReceivedDate = lead.fullAmountReceivedDate || new Date();
          applyStatus(lead, 'full_amount_received');
          activityData.action = 'full_amount_received';
          extraActivity = maybeConvert(lead, performedBy);
        } else if (nextAction === 'agreement_signed') {
          // Client rule: Blocking -> Full Amount Received -> signed -> Converted.
          // Signing is the last act, so it cannot be recorded before the money is
          // in — that would leave the lead resting on a stage no pipeline card
          // represents, and would count it as Converted while the revenue and
          // incentive figures (driven by the 'converted' activity) ignored it.
          if (!lead.fullAmountReceivedDate) {
            throw new Error('Record the full amount received before the agreement is signed.');
          }
          lead.agreementSignedAt = lead.agreementSignedAt || new Date();
          applyStatus(lead, 'agreement_signed');
          activityData.action = 'agreement_signed';
          extraActivity = maybeConvert(lead, performedBy);
        }
        break;
      }

      case 'mark_rnr': {
        lead.rnrCount = (lead.rnrCount || 0) + 1;
        if (data.priority) lead.priority = data.priority;
        activityData.action = 'rnr';

        // ── Engaged lead: unlimited RNRs, status untouched ───────────────────
        // Once a lead has reached any status past the first call (called,
        // follow-up, meeting, payment...), an RNR is only logged. The status
        // stays where it is and the lead is never handed on or lost for it.
        if (isEngaged(lead)) {
          // A Direct Meeting lead on the day of the meeting: retry hourly until
          // the meeting time — the meeting is still on.
          const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
          const todayEnd   = new Date(); todayEnd.setHours(23, 59, 59, 999);
          const meetingAt  = lead.meetingAt ? new Date(lead.meetingAt) : null;
          const isDMDay    = lead.status === 'meeting_direct' &&
                             meetingAt && meetingAt >= todayStart && meetingAt <= todayEnd;

          if (isDMDay) {
            const oneHourFromNow = new Date(Date.now() + 60 * 60 * 1000);
            lead.nextActionAt = oneHourFromNow < meetingAt ? oneHourFromNow : meetingAt;
            activityData.note = `Pre-meeting retry #${lead.rnrCount}. Next attempt: ${lead.nextActionAt.toLocaleTimeString()}. Meeting at: ${meetingAt.toLocaleTimeString()}`;
          } else {
            const nextDay = new Date();
            nextDay.setDate(nextDay.getDate() + 1);
            nextDay.setHours(10, 0, 0, 0);
            lead.nextActionAt = nextDay;
            activityData.note = data.note || `RNR #${lead.rnrCount}. Status kept; re-queued for next day.`;
          }
          break;
        }

        // ── New lead that has never been reached ─────────────────────────────
        lead.status = 'rnr';

        if (lead.rnrCount < RNR_LIMIT) {
          lead.nextActionAt = nextRnrRetryAt(lead.rnrCount);
          break;
        }

        // RNR_LIMIT reached. First time: hand the lead to a peer on the same
        // team. If that peer also reaches RNR_LIMIT, the lead is lost.
        const previousOwnerId = lead.owner;
        const peer = lead.rnrTransferredAt ? null : await findRnrPeer(lead);

        if (peer) {
          lead.owner = peer._id;
          lead.rnrCount = 0;
          lead.rnrTransferredAt = new Date();
          lead.rnrTransferredFrom = previousOwnerId;
          lead.nextActionAt = new Date(); // Queue immediately for the new owner
          extraActivity = {
            lead: lead._id,
            performedBy: null,
            action: 'reallocated',
            note: `Auto-transferred to ${peer.name} after ${RNR_LIMIT} RNR attempts.`,
            metadata: { from: previousOwnerId, to: peer._id, reason: 'rnr_limit' },
          };

          await notificationService.onLeadAutoReallocated({
            executiveId: peer._id,
            leadName: lead.company || lead.name || 'Lead',
            rnrCount: RNR_LIMIT,
            io,
          });
        } else {
          const reason = lead.rnrTransferredAt
            ? `No response after ${RNR_LIMIT} RNR attempts by each of two owners.`
            : `No response after ${RNR_LIMIT} RNR attempts; no teammate available to transfer to.`;
          applyStatus(lead, 'lost');
          lead.lostAt = new Date();
          lead.reasonForLost = reason;
          lead.nextActionAt = null;
          extraActivity = {
            lead: lead._id,
            performedBy: null,
            action: 'lost',
            note: `Auto-lost: ${reason}`,
          };
        }
        break;
      }

      case 'set_followup_date':
        lead.followUpDate = new Date(data.followUpDate);
        lead.followUpTime = data.followUpTime;
        lead.nextActionAt = new Date(data.followUpDate);
        lead.followUpFixed = !!data.isFixed;
        if (data.isCustom) {
          lead.notes = data.customReason; // Store in notes if isCustom
        }
        activityData.action = 'followup_set';
        break;

      case 'meeting_done':
        lead.strategyNote = data.strategyNote;
        activityData.action = 'meeting_done';
        // For now stays converted or stays meeting (based on prompt)
        // prompt says "status = 'converted' or stays 'meeting_direct'/'meeting_virtual' (just log for now)"
        break;

      case 'escalate':
        lead.status = 'escalated';
        lead.escalatedTo = data.escalateTo;
        lead.escalationNote = data.note;
        activityData.action = 'escalated';
        break;

      case 'reallocate':
        lead.owner = data.newOwner;
        activityData.action = 'reallocated';
        break;

      case 'confirm_meeting': {
        // Executive called and confirmed the meeting is happening.
        // Clear the confirmation task subStatus.
        lead.subStatus = null;
        activityData.action = 'meeting_confirmed';
        activityData.note = data.note || 'Meeting confirmed by executive';

        // For virtual meetings: if the meeting is still > 30 min away,
        // push nextActionAt to 30 min before so the 30-min cron can
        // detect it and create the final confirmation task.
        if (lead.status === 'meeting_virtual' && lead.meetingAt) {
          const thirtyMinBefore = new Date(lead.meetingAt.getTime() - 30 * 60 * 1000);
          if (thirtyMinBefore > new Date()) {
            lead.nextActionAt = thirtyMinBefore;
          }
        }
        break;
      }

      default:
        throw new Error('Invalid transition action');
    }

    await lead.save();
    // Skip activity log for system-triggered transitions that have no real performer
    if (activityData.action) {
      await LeadActivity.create(activityData);
    }
    if (extraActivity) {
      await LeadActivity.create(extraActivity);
    }
    return lead;
  },

  /**
   * Get sorted lead queue for executive
   */
  async getQueue(userId) {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const CLOSED_STATUSES = ['converted', 'lost', 'not_interested', 'blocking_amount_received', 'full_amount_received', 'agreement_signed'];
    const leads = await Lead.find({ owner: userId, status: { $nin: CLOSED_STATUSES } });

    // SORT ORDER:
    // 1. Direct meetings scheduled for today
    // 2. Virtual meetings scheduled for today
    // 3. New leads
    // 4. Follow-ups due today (hot, then warm, then cold)
    // 5. RNR retries due today
    // 6. Everything else
    const PRIORITY_RANK = { hot: 0, warm: 1, cold: 2 };

    const getBucket = (lead) => {
      const isTodayMeeting = lead.meetingAt && lead.meetingAt >= todayStart && lead.meetingAt <= todayEnd;
      if (isTodayMeeting && lead.status === 'meeting_direct') return 1;
      if (isTodayMeeting && lead.status === 'meeting_virtual') return 2;
      if (lead.status === 'new') return 3;

      const isDueToday = lead.nextActionAt && lead.nextActionAt <= todayEnd;
      if (isDueToday) return lead.status === 'rnr' ? 5 : 4;
      return 6;
    };

    return leads.sort((a, b) => {
      const bucketA = getBucket(a);
      const bucketB = getBucket(b);
      if (bucketA !== bucketB) return bucketA - bucketB;

      if (bucketA === 4) {
        const rankA = PRIORITY_RANK[a.priority] ?? 3;
        const rankB = PRIORITY_RANK[b.priority] ?? 3;
        if (rankA !== rankB) return rankA - rankB;
      }

      // Secondary sort by date
      const dateA = a.meetingAt || a.nextActionAt || a.createdAt;
      const dateB = b.meetingAt || b.nextActionAt || b.createdAt;
      return dateA - dateB;
    });
  },

  /**
   * Suggested follow-up dates for a user
   */
  async getSuggestedDates(user) {
    return await getNextWorkingDays(4, user);
  },
  
  /**
   * Comprehensive workflow data for "Start My Work"
   */
  async getWorkflowData(userId) {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const fullQueue = await this.getQueue(userId);
    
    // 1. Current Lead
    const currentLead = fullQueue[0] || null;

    // 2. Task Sequence (Next 5)
    const taskSequence = fullQueue.slice(0, 8).map((l, i) => ({
      id: l._id,
      index: i + 1,
      name: l.company || l.name,
      type: l.status.includes('meeting') ? 'Meeting' : l.status === 'new' ? 'New Lead' : l.status === 'rnr' ? 'RNR' : 'Follow-up',
      time: l.meetingAt || l.nextActionAt,
      priority: l.priority
    }));

    // 3. Today's Meetings
    const todayMeetings = await Lead.find({
      owner: userId,
      meetingAt: { $gte: todayStart, $lte: todayEnd }
    }).sort({ meetingAt: 1 });

    const meetingsFormatted = todayMeetings.map(m => ({
      id: m._id,
      name: m.company || m.name,
      time: m.meetingAt,
      type: m.status === 'meeting_virtual' ? 'Virtual' : 'Direct',
      status: m.status === 'meeting_done' ? 'DONE' : (new Date(m.meetingAt) < new Date() ? 'NOW' : 'CONFIRM'),
      location: m.city || m.address || 'Online'
    }));

    // 4. Live Activity Feed
    const activityFeed = await LeadActivity.find({ performedBy: userId })
      .populate('lead', 'name company')
      .sort({ createdAt: -1 })
      .limit(10);

    const feedFormatted = activityFeed.map(a => ({
      id: a._id,
      action: a.action,
      leadName: a.lead?.company || a.lead?.name || 'Unknown',
      time: a.createdAt,
      note: a.note
    }));

    return {
      queue: fullQueue,
      currentLead,
      taskSequence,
      todayMeetings: meetingsFormatted,
      activityFeed: feedFormatted,
      queueLength: fullQueue.length
    };
  }
};

module.exports = leadService;
