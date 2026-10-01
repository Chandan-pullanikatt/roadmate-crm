const Lead = require('../models/Lead');
const LeadActivity = require('../models/LeadActivity');
const User = require('../models/User');
const { loadCalendar, startOfDay, addDays, istDayRange } = require('../utils/workingDays');
const mongoose = require('mongoose');
const notificationService = require('./notificationService');
const { applyStatus } = require('../constants/leadStatusRank');
const { WORK_ACTIONS } = require('../constants/workActions');
const { isPendingFor } = require('../utils/escalation');

const MEETING_STATUSES = ['meeting_virtual', 'meeting_direct'];

// How much of the work queue ships with its timeline already attached. The page
// only ever shows the active lead's history and the user works down the queue in
// order, so seeding the head covers every lead they are about to open without
// dragging the whole book's activity through the response.
const TIMELINE_SEED_LEADS = 12;
const TIMELINE_SEED_ACTIVITIES = 5;

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
    // Set by 'escalate' to the manager who now has an approval waiting on them.
    let escalationTarget = null;

    switch (action) {
      case 'mark_called':
        applyStatus(lead, 'called');
        lead.hasBeenEngaged = true; // Mark as engaged once called
        lead.lastCallAt = new Date();
        activityData.action = 'called';
        // A connected call with no further outcome still carries the caller's
        // remark. It used to live only on the activity note, so the lead's
        // Remarks block skipped it -- every other outcome goes through
        // set_feedback, which files the same remark here.
        if (data.note) lead.feedback.push({ note: data.note, createdBy: performedBy?._id ?? null });
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
        } else if (nextAction === 'business_lead') {
          // Chased like a follow-up: the modal books the next call straight after
          // with set_followup_date. The rank lock keeps a lead that is already
          // further along (Follow-up and up) where it is.
          applyStatus(lead, 'business_lead');
          activityData.action = 'business_lead';
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

          // Client rule: booking a meeting *is* the confirmation. There is no
          // second confirmation call on another day, so the lead is due on the
          // meeting date and nowhere else -- the owner and the invited managers
          // are reminded by the meeting-reminder cron instead.
          lead.nextActionAt = null;
          lead.subStatus = null;

        } else if (nextAction === 'direct_meeting') {
          applyStatus(lead, 'meeting_direct');
          lead.meetingAt = new Date(data.meetingAt);
          if (data.meetingInvitees) lead.meetingInvitees = data.meetingInvitees;
          activityData.action = 'meeting_scheduled';
          activityData.metadata = { meetingType: 'direct' };

          // As above: no day-before confirmation task. This used to set
          // nextActionAt to the day before at 10 AM -- or to *now* for a meeting
          // booked for tomorrow, which put tomorrow's meeting into today's queue.
          lead.nextActionAt = null;
          lead.subStatus = null;
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
            // The caller's own remark leads; the retry detail is appended rather
            // than written over it, which used to drop what they typed.
            const retryNote = `Pre-meeting retry #${lead.rnrCount}. Next attempt: ${lead.nextActionAt.toLocaleTimeString()}. Meeting at: ${meetingAt.toLocaleTimeString()}`;
            activityData.note = data.note ? `${data.note} — ${retryNote}` : retryNote;
          } else {
            const nextDay = new Date();
            nextDay.setDate(nextDay.getDate() + 1);
            nextDay.setHours(10, 0, 0, 0);
            lead.nextActionAt = nextDay;
            const rnrNote = `RNR #${lead.rnrCount}. Status kept; re-queued for next day.`;
            activityData.note = data.note ? `${data.note} — ${rnrNote}` : rnrNote;
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
        // No activity logged here on purpose. Both call modals fire this
        // immediately after set_feedback/'followup', which has already written
        // the 'followup_set' record carrying the call's remarks -- logging a
        // second one counted one follow-up call twice, in the Follow-ups column
        // and (now that every outcome counts as a call) in Calls as well. The
        // date itself lives on the lead, so nothing is lost by staying quiet.
        break;

      case 'meeting_done': {
        // A meeting actually took place. The status is left to whatever outcome
        // the caller records straight after (follow-up, payment, not interested
        // ...) — this only logs that the meeting happened and which kind it was.
        const conductedType = data.meetingType === 'virtual' ? 'virtual' : 'direct';
        if (data.strategyNote) lead.strategyNote = data.strategyNote;
        if (data.priority) lead.priority = data.priority;
        lead.hasBeenEngaged = true;
        lead.meetingDoneAt = new Date();
        lead.subStatus = null; // the pre-meeting confirmation task is over
        activityData.action = 'meeting_done';
        activityData.metadata = { meetingType: conductedType }; // direct ones count towards targets
        break;
      }

      case 'escalate': {
        // Escalating does NOT hand the lead over. It stays with its current owner
        // and waits for the manager above to approve it (decideEscalation below);
        // only then does the owner move up a level.
        //
        // Re-escalating an already-escalated lead must not lose the stage it was
        // at, so statusBeforeEscalation is only written from a real status.
        //
        // A State Manager escalates to one founder they pick by name; only that
        // founder sees it on their Lead Approvals page, so it must be a real,
        // active founder account.
        if (performedBy?.role === 'state_manager') {
          const target = data.escalateTo
            ? await User.findById(data.escalateTo).select('role isActive').lean()
            : null;
          if (!target || target.role !== 'founder' || target.isActive === false) {
            throw new Error('Select which founder to escalate this lead to');
          }
        }
        if (lead.status !== 'escalated') lead.statusBeforeEscalation = lead.status;
        lead.status = 'escalated';
        lead.escalatedTo = data.escalateTo;
        lead.escalationNote = data.note;
        lead.escalatedFrom = lead.owner || performedBy?._id || null;
        lead.escalatedAt = new Date();
        lead.escalationStatus = 'pending';
        lead.escalationDecisionBy = null;
        lead.escalationDecisionAt = null;
        lead.escalationDecisionNote = null;
        // The approver has to see it in their queue; nothing else sets this, and
        // anything gated on nextActionAt silently skips a lead without it.
        lead.nextActionAt = new Date();
        activityData.action = 'escalated';
        // The bulk route suppresses this and sends one message for the batch.
        if (!data.suppressNotification) escalationTarget = data.escalateTo;
        break;
      }

      case 'reallocate':
        lead.owner = data.newOwner;
        activityData.action = 'reallocated';
        break;

      default:
        throw new Error('Invalid transition action');
    }

    // Stamp how the call itself went, so the interaction history can show the
    // connection and the outcome together rather than the outcome alone. Only
    // the call feedback modals send viaCall, so a payment or status recorded
    // from a desk screen is never dressed up as a call.
    if (data.viaCall) {
      activityData.metadata = {
        ...(activityData.metadata || {}),
        call: action === 'mark_rnr' ? 'no_answer' : 'connected',
      };
      // The Converted record maybeConvert() writes alongside a payment belongs
      // to the same connected call. The RNR follow-ons (auto-transfer,
      // auto-lost) are system work on a call nobody answered, so they stay bare.
      if (extraActivity && action !== 'mark_rnr') {
        extraActivity.metadata = { ...(extraActivity.metadata || {}), call: 'connected' };
      }
    }

    await lead.save();
    // Skip activity log for system-triggered transitions that have no real performer
    if (activityData.action) {
      await LeadActivity.create(activityData);
    }
    if (extraActivity) {
      await LeadActivity.create(extraActivity);
    }
    if (escalationTarget) {
      await notificationService.onLeadEscalated({
        managerId: escalationTarget,
        leadName: lead.company || lead.name || 'Lead',
        escalatedByName: performedBy?.name || 'A team member',
        note: data.note,
        io,
      });
    }
    return lead;
  },

  /**
   * Approve or reject an escalation waiting on `approver`.
   *
   * Approve: the lead becomes the approver's own — that is the whole point of the
   * approval step, since an escalated lead is invisible in the manager's book
   * until they own it. Reject: the owner never changes and the lead drops back
   * into the escalator's queue with the manager's note.
   *
   * Either way the lead leaves the 'escalated' status and goes back to the stage
   * it was at, so it reads as a real pipeline lead again. applyStatus keeps the
   * rank lock honest: a lead that had already reached a better stage never falls
   * back to a worse one.
   *
   * @param {string} leadId
   * @param {'approved'|'rejected'} decision
   * @param {Object} approver - the logged-in manager
   * @param {Object} [data] - { note }
   * @param {Object|null} [io]
   */
  async decideEscalation(leadId, decision, approver, data = {}, io = null) {
    if (!['approved', 'rejected'].includes(decision)) {
      throw new Error('Decision must be approved or rejected');
    }
    const lead = await Lead.findById(leadId);
    if (!lead) throw new Error('Lead not found');
    if (!isPendingFor(lead, approver._id)) {
      throw new Error('This lead is not waiting on your approval');
    }

    const escalatedFrom = lead.escalatedFrom || lead.owner || null;

    applyStatus(lead, lead.statusBeforeEscalation || 'new');
    lead.escalationStatus = decision;
    lead.escalationDecisionBy = approver._id;
    lead.escalationDecisionAt = new Date();
    lead.escalationDecisionNote = data.note || '';
    lead.statusBeforeEscalation = null;
    // Whoever owns it next has to be able to find it in their work queue.
    lead.nextActionAt = new Date();

    if (decision === 'approved') {
      lead.owner = approver._id;
      // Who handed it over, which is what every lead list reads as "allocated by".
      lead.allocatedBy = escalatedFrom;
      // rnrCount is per-owner, so the new owner starts clean.
      lead.rnrCount = 0;
    } else {
      // Sent back down: the escalation is closed, so it stops showing as one.
      lead.escalatedTo = null;
    }

    await lead.save();

    await LeadActivity.create({
      lead: lead._id,
      performedBy: approver._id,
      action: decision === 'approved' ? 'escalation_approved' : 'escalation_rejected',
      note: data.note || (decision === 'approved'
        ? 'Escalation approved; lead taken over.'
        : 'Escalation rejected; lead returned to its owner.'),
      metadata: { escalatedFrom, decidedBy: approver._id },
    });

    if (escalatedFrom && String(escalatedFrom) !== String(approver._id)) {
      await notificationService.onEscalationDecision({
        userId: escalatedFrom,
        decision,
        leadName: lead.company || lead.name || 'Lead',
        managerName: approver.name || 'Your manager',
        note: data.note,
        io,
      });
    }

    return lead;
  },

  /**
   * Get sorted lead queue for executive
   */
  async getQueue(userId, day = new Date()) {
    const CLOSED_STATUSES = ['converted', 'lost', 'not_interested', 'blocking_amount_received', 'full_amount_received', 'agreement_signed'];
    const { start: dayStart, end: dayEnd } = istDayRange(day);

    // The day's book, not the whole open book. Every status carries its due date
    // in a different field, so each bucket is selected on its own terms:
    //
    //   new, rnr        no due date exists. 'new' is work the moment it lands;
    //                   an RNR is chased until it resolves (the 5+5 rule ends it),
    //                   so a retry date would only hide active chasing.
    //   called          the calls made today, which read as done in the queue.
    //                   Also any call left without an outcome -- scheduleService's
    //                   nightly backstop dates those so they come back.
    //   meetings        due today or earlier. Past ones are missed meetings: they
    //                   are never carried forward (isFixed) and the rank lock
    //                   forbids demoting them to a follow-up, so this is the only
    //                   thing that keeps them visible.
    //   followup        due today or earlier. The 00:30 carry-forward normally
    //                   moves a missed one, so '<=' is the safety net for fixed
    //                   follow-ups, which never move.
    //   escalated       by nextActionAt, set to now on escalation.
    //
    // "Due" is a fallback chain, not one field. meetingAt is only ever written by
    // the scheduling wizard: a CSV import maps a sheet's "Direct Meeting" straight
    // onto the status and fills followUpDate instead, and a meeting lead worked as
    // an ordinary follow-up keeps the meeting status (the rank lock) while its real
    // date goes to nextActionAt. On the client's data 29 of 30 open direct meetings
    // have no meetingAt at all, so reading that field alone would hide almost every
    // meeting they have.
    const dueBy = (statuses, cutoff) => [
      { status: { $in: statuses }, meetingAt: { $ne: null, $lte: cutoff } },
      { status: { $in: statuses }, meetingAt: null, nextActionAt: { $ne: null, $lte: cutoff } },
      { status: { $in: statuses }, meetingAt: null, nextActionAt: null, followUpDate: { $ne: null, $lte: cutoff } },
    ];

    const leads = await Lead.find({
      owner: userId,
      status: { $nin: CLOSED_STATUSES },
      $or: [
        { status: { $in: ['new', 'rnr'] } },
        { status: 'called', lastCallAt: { $gte: dayStart, $lte: dayEnd } },
        { status: 'called', nextActionAt: { $ne: null, $lte: dayEnd } },
        ...dueBy(MEETING_STATUSES, dayEnd),
        ...dueBy(['followup', 'business_lead', 'escalated'], dayEnd),
        // An imported Business Lead can arrive with no date at all. Like 'new',
        // it stays in the book until a call books its next date.
        { status: 'business_lead', meetingAt: null, nextActionAt: null, followUpDate: null },
      ],
    });

    // SORT ORDER -- by status, which is the only key every lead actually carries:
    // 1. Direct meetings
    // 2. Virtual meetings
    // 3. New leads
    // 4. Follow-ups and Business Leads (hot, then warm, then cold)
    // 5. Called -- worked once, no follow-up booked yet
    // 6. RNR retries
    // 7. Everything else (escalated)
    //
    // Sorting is by status alone. Dates decide *whether* a lead is in the day's
    // book -- that is the $or above -- and then only order leads within a bucket.
    // Sorting on a date across buckets is what an earlier version did, and any
    // lead without one (every 'new' lead, every RNR) sank below the rest.
    const STATUS_RANK = {
      meeting_direct:  1,
      meeting_virtual: 2,
      new:             3,
      followup:        4,
      business_lead:   4,
      called:          5,
      rnr:             6,
    };
    const PRIORITY_RANK = { hot: 0, warm: 1, cold: 2 };

    const getBucket = (lead) => STATUS_RANK[lead.status] ?? 7;

    return leads.sort((a, b) => {
      const bucketA = getBucket(a);
      const bucketB = getBucket(b);
      if (bucketA !== bucketB) return bucketA - bucketB;

      // Within the follow-up bucket, hot leads get called before cold ones.
      if (bucketA === STATUS_RANK.followup) {
        const rankA = PRIORITY_RANK[a.priority] ?? 3;
        const rankB = PRIORITY_RANK[b.priority] ?? 3;
        if (rankA !== rankB) return rankA - rankB;
      }

      // Secondary sort by date: the soonest due lead first. A lead with no date
      // of its own falls back to createdAt, so the oldest untouched leads surface
      // ahead of the ones just imported.
      const dateA = a.meetingAt || a.nextActionAt || a.followUpDate || a.createdAt;
      const dateB = b.meetingAt || b.nextActionAt || b.followUpDate || b.createdAt;
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
    const { start: todayStart, end: todayEnd } = istDayRange();

    const fullQueue = await this.getQueue(userId);

    // The work page opens on the head of the queue and its Interaction History
    // panel used to fetch that lead's timeline only after the queue had painted,
    // so it flashed "No activity yet for this lead" for as long as that second
    // request took. Each lead near the front of the queue now carries its last
    // few activities, in the same shape GET /leads/:id/activity returns, so the
    // panel renders filled and the full log loads behind it.
    const seedIds = fullQueue.slice(0, TIMELINE_SEED_LEADS).map(l => l._id);

    // Four independent reads -- in series they added their latencies together.
    const [workedTodayIds, seedRows, todayMeetings, activityFeed] = await Promise.all([
      // getQueue() lists every open lead, and a lead stays open after it has been
      // called -- so the queue does not shrink as the day is worked. Tag the ones
      // already worked today, otherwise the work page counts them as still
      // pending and (once its cursor runs past the last row) declares the day
      // done with dozens of leads untouched.
      LeadActivity.distinct('lead', {
        performedBy: userId,
        createdAt: { $gte: todayStart, $lte: todayEnd },
        action: { $in: WORK_ACTIONS }
      }),
      seedIds.length ? Lead.aggregate([
        { $match: { _id: { $in: seedIds } } },
        {
          $lookup: {
            from: 'leadactivities',
            let: { leadId: '$_id' },
            pipeline: [
              { $match: { $expr: { $eq: ['$lead', '$$leadId'] } } },
              { $sort: { createdAt: -1 } },
              { $limit: TIMELINE_SEED_ACTIVITIES },
              {
                $lookup: {
                  from: 'users',
                  let: { performerId: '$performedBy' },
                  pipeline: [
                    { $match: { $expr: { $eq: ['$_id', '$$performerId'] } } },
                    { $project: { name: 1, role: 1 } }
                  ],
                  as: 'performer'
                }
              },
              {
                $project: {
                  action: 1,
                  note: 1,
                  createdAt: 1,
                  performedBy: { $arrayElemAt: ['$performer', 0] }
                }
              }
            ],
            as: 'recentActivity'
          }
        },
        { $project: { recentActivity: 1 } }
      ]) : [],
      Lead.find({
        owner: userId,
        meetingAt: { $gte: todayStart, $lte: todayEnd }
      }).sort({ meetingAt: 1 }),
      LeadActivity.find({ performedBy: userId })
        .populate('lead', 'name company')
        .sort({ createdAt: -1 })
        .limit(10)
    ]);
    const workedToday = new Set(workedTodayIds.map(String));
    const seededActivity = new Map(seedRows.map(r => [String(r._id), r.recentActivity || []]));

    const queue = fullQueue.map(l => {
      const plain = typeof l.toObject === 'function' ? l.toObject() : l;
      const seeded = seededActivity.get(String(l._id));
      // The date the queue selected this lead on. A meeting whose date has passed
      // keeps riding in the day's queue -- nothing carries these forward and the
      // rank lock will not let them become follow-ups -- and it reads as an
      // ordinary Direct Meeting row, which is how the client wants it.
      const dueAt = plain.meetingAt || plain.nextActionAt || plain.followUpDate;
      return {
        ...plain,
        workedToday: workedToday.has(String(l._id)),
        // The date the queue actually selected on, so the row shows the same one.
        dueAt: dueAt || null,
        // Left off entirely past the seeded head of the queue, so the client can
        // tell "nothing happened yet" from "not loaded".
        ...(seeded ? { recentActivity: seeded } : {})
      };
    });
    const pendingQueue = queue.filter(l => !l.workedToday);

    // 1. Current Lead -- the first one still to be worked today
    const currentLead = pendingQueue[0] || null;

    // 2. Task Sequence (Next 5)
    const taskSequence = pendingQueue.slice(0, 8).map((l, i) => ({
      id: l._id,
      index: i + 1,
      name: l.company || l.name,
      type: l.status === 'meeting_virtual' ? 'Virtual Meeting'
        : l.status === 'meeting_direct' ? 'Direct Meeting'
        : l.status === 'new' ? 'New Lead' : l.status === 'rnr' ? 'RNR'
        : l.status === 'business_lead' ? 'Business Lead' : 'Follow-up',
      time: l.meetingAt || l.nextActionAt,
      priority: l.priority
    }));

    // 3. Today's Meetings
    const meetingsFormatted = todayMeetings.map(m => ({
      id: m._id,
      name: m.company || m.name,
      time: m.meetingAt,
      type: m.status === 'meeting_virtual' ? 'Virtual' : 'Direct',
      status: m.status === 'meeting_done' ? 'DONE' : (new Date(m.meetingAt) < new Date() ? 'NOW' : 'CONFIRM'),
      location: m.city || m.address || 'Online'
    }));

    // 4. Live Activity Feed
    const feedFormatted = activityFeed.map(a => ({
      id: a._id,
      action: a.action,
      leadName: a.lead?.company || a.lead?.name || 'Unknown',
      time: a.createdAt,
      note: a.note
    }));

    return {
      queue,
      currentLead,
      taskSequence,
      todayMeetings: meetingsFormatted,
      activityFeed: feedFormatted,
      // queueLength is the day's book; pendingCount is what is left of it and
      // completedToday the leads in it already worked.
      queueLength: queue.length,
      pendingCount: pendingQueue.length,
      completedToday: workedToday.size
    };
  }
};

module.exports = leadService;
