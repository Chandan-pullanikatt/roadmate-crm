/**
 * Lead status ranking (client rule, Sep 2026).
 *
 * Statuses are ranked by number — lower is further along. Once a lead reaches a
 * rank it never displays a worse one: selecting a higher-numbered status later
 * keeps showing the best rank already reached (tracked on lead.peakStatus).
 *
 *   1 Agreement Signed · 2 Full Amount Received · 3 Blocking Amount Received
 *   5 Direct Meeting Scheduled · 7 Virtual Meeting Scheduled · 8 Follow up
 *
 * Converted sits above Agreement Signed: it is only reached once both the full
 * amount and the signature are in.
 *
 * Direct and Virtual are ranked against each other only so a meeting that is
 * upgraded to in-person reads as progress. They are still one stage, so moving
 * between the two is always allowed — see SAME_STAGE below.
 *
 * Not Interested (rank 0) is the exception: it can be chosen at any time and
 * left at any time. Lost is a closing outcome and behaves the same way. Leaving
 * either returns the lead to its peak if the new choice ranks lower.
 *
 * RNR (rank 9 in the client's table) is deliberately not on this ladder: it is
 * only ever a status for a lead that has never been engaged. Once engaged, an
 * RNR is logged but never changes the status (see leadService mark_rnr).
 * 'new', 'called', 'rnr' and 'escalated' are unranked — any ranked status beats them.
 */

const STATUS_RANK = {
  converted:                0.5,
  agreement_signed:         1,
  full_amount_received:     2,
  blocking_amount_received: 3,
  meeting_direct:           5,
  meeting_virtual:          7,
  followup:                 8,
};

/** Statuses that ignore the lock in both directions. */
const LOCK_EXEMPT = new Set(['not_interested', 'lost']);

/**
 * Groups of statuses that are the same step in different forms. Virtual and
 * Direct are a *kind* of meeting, not a step forward: a meeting gets moved
 * online or in person all the time, so re-scheduling one as the other is a
 * sideways move the lock must allow in both directions.
 *
 * Without this the ranks alone decided it, and since Direct (5) outranks
 * Virtual (7) the lock silently kept a Direct lead on Direct — the update
 * saved and reported success, but the lead never left the Direct Meeting card.
 */
const SAME_STAGE = [new Set(['meeting_virtual', 'meeting_direct'])];

/** True if `a` and `b` are two forms of the same pipeline stage. */
const isSameStage = (a, b) => !!a && !!b && SAME_STAGE.some(g => g.has(a) && g.has(b));

const rankOf = (status) => STATUS_RANK[status] ?? Infinity;

/** The best-ranked status this lead has ever reached, or null. */
const peakOf = (lead) => {
  const candidates = [lead.peakStatus, lead.status].filter(s => s in STATUS_RANK);
  if (!candidates.length) return null;
  return candidates.reduce((best, s) => (rankOf(s) < rankOf(best) ? s : best));
};

/**
 * Resolves what a lead's status becomes when `next` is selected.
 * Returns { status, peakStatus } — callers write both onto the lead.
 */
const resolveStatus = (lead, next) => {
  const peak = peakOf(lead);
  if (LOCK_EXEMPT.has(next)) return { status: next, peakStatus: peak };
  // Swapping between two forms of the same stage is never a step back, so it
  // moves the peak with it — otherwise the lock would refuse the way back.
  if (isSameStage(peak, next)) return { status: next, peakStatus: next };
  if (peak && rankOf(peak) <= rankOf(next)) return { status: peak, peakStatus: peak };
  return { status: next, peakStatus: next in STATUS_RANK ? next : peak };
};

/** Applies resolveStatus to a lead document in place. */
const applyStatus = (lead, next) => {
  const { status, peakStatus } = resolveStatus(lead, next);
  lead.status = status;
  lead.peakStatus = peakStatus;
  return lead;
};

module.exports = { STATUS_RANK, LOCK_EXEMPT, SAME_STAGE, isSameStage, rankOf, peakOf, resolveStatus, applyStatus };
