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

module.exports = { STATUS_RANK, LOCK_EXEMPT, rankOf, peakOf, resolveStatus, applyStatus };
