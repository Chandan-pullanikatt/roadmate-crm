/**
 * One definition of revenue for every dashboard, report and revenue page.
 *
 * Revenue is money actually received, booked on the day it was received. Each
 * Blocking Amount / Full Amount Received entry carries the amount collected at
 * that step in metadata.revenue, so a lead's revenue is the sum of its payments.
 *
 * 'converted' stays in the list for leads converted before payment amounts were
 * captured — those activities still hold the deal value. A conversion triggered by
 * the payment stages writes no revenue of its own, so nothing is counted twice.
 */
const REVENUE_ACTIONS = ['converted', 'blocking_amount_received', 'full_amount_received'];

/** $match clause selecting only activities that carry revenue. */
const REVENUE_MATCH = { action: { $in: REVENUE_ACTIONS }, 'metadata.revenue': { $gt: 0 } };

/** Aggregation expression: the revenue one activity contributes (0 if none). */
const REVENUE_EXPR = {
  $cond: [{ $in: ['$action', REVENUE_ACTIONS] }, { $ifNull: ['$metadata.revenue', 0] }, 0]
};

/** Revenue one activity document contributes. */
const activityRevenue = (a) =>
  REVENUE_ACTIONS.includes(a.action) ? (Number(a.metadata?.revenue) || 0) : 0;

/** Total revenue across a list of activity documents. */
const sumRevenue = (activities) =>
  activities.reduce((sum, a) => sum + activityRevenue(a), 0);

module.exports = { REVENUE_ACTIONS, REVENUE_MATCH, REVENUE_EXPR, activityRevenue, sumRevenue };
