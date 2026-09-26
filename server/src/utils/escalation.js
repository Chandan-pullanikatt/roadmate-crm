const { toObjectId } = require('./hierarchy');

/**
 * Who a lead is allowed to escalate to, one step up the reporting tree.
 * The approval page only ever shows a manager the escalations aimed at them, so
 * this is enforced on the way up rather than on the decision.
 */
const ESCALATION_ROLES = ['industry_manager', 'state_manager', 'founder'];

/**
 * The escalations waiting on `userId`'s decision.
 *
 * Leads escalated before the approval flow existed have no escalationStatus at
 * all, so a missing/null value counts as pending — otherwise every escalation
 * already sitting in the client's data would never show up for approval.
 *
 * NOTE: this returns a top-level `$or`, so merge it into a larger query with
 * `$and: [pendingEscalationFilter(id), ...]` rather than spreading it.
 */
function pendingEscalationFilter(userId) {
  return {
    escalatedTo: toObjectId(userId),
    status: 'escalated',
    $or: [
      { escalationStatus: 'pending' },
      { escalationStatus: null },
      { escalationStatus: { $exists: false } },
    ],
  };
}

/** True if this lead is still waiting on `userId` to approve or reject it. */
function isPendingFor(lead, userId) {
  return (
    String(lead.escalatedTo?._id || lead.escalatedTo || '') === String(userId) &&
    lead.status === 'escalated' &&
    (!lead.escalationStatus || lead.escalationStatus === 'pending')
  );
}

module.exports = { ESCALATION_ROLES, pendingEscalationFilter, isPendingFor };
