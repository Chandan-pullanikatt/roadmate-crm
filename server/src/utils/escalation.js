const { toObjectId } = require('./hierarchy');
const User = require('../models/User');

/**
 * Who a lead is allowed to escalate to, one step up the reporting tree.
 * The approval page only ever shows a manager the escalations aimed at them, so
 * this is enforced on the way up rather than on the decision.
 */
const ESCALATION_ROLES = ['industry_manager', 'state_manager', 'founder'];

/**
 * Whose escalations land in this user's approval inbox. Founders share one
 * inbox: a State Manager escalates to a named founder, but any founder may
 * decide it, so every founder sees the same Lead Approvals page. Everyone else
 * decides only what was sent to them.
 */
async function escalationInboxIds(user) {
  if (user.role !== 'founder') return [user._id];
  const founders = await User.find({ role: 'founder' }).select('_id').lean();
  return founders.map(f => f._id);
}

/**
 * The escalations waiting on a decision from `userId` — or from any of the ids,
 * when given the array escalationInboxIds returns.
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
    escalatedTo: Array.isArray(userId)
      ? { $in: userId.map(toObjectId) }
      : toObjectId(userId),
    status: 'escalated',
    $or: [
      { escalationStatus: 'pending' },
      { escalationStatus: null },
      { escalationStatus: { $exists: false } },
    ],
  };
}

/** True if this lead is still waiting on `userId` (or any of the ids) to approve or reject it. */
function isPendingFor(lead, userId) {
  const ids = (Array.isArray(userId) ? userId : [userId]).map(String);
  return (
    ids.includes(String(lead.escalatedTo?._id || lead.escalatedTo || '')) &&
    lead.status === 'escalated' &&
    (!lead.escalationStatus || lead.escalationStatus === 'pending')
  );
}

module.exports = { ESCALATION_ROLES, escalationInboxIds, pendingEscalationFilter, isPendingFor };
