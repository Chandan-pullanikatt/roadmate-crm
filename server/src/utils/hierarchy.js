const mongoose = require('mongoose');
const User = require('../models/User');

const toObjectId = (v) => {
  if (v instanceof mongoose.Types.ObjectId) return v;
  try { return new mongoose.Types.ObjectId(v); } catch { return v; }
};

/**
 * Returns the set of user _ids whose leads `user` is allowed to see, based on the
 * reporting tree (reportingTo) — NOT on the lead's industry/state field.
 *
 *   founder     -> null   (no restriction: sees every lead)
 *   executive   -> [self]
 *   IM / SM     -> [self, ...all descendants reached via reportingTo]
 *
 * Returned ids are ObjectIds (safe for both find() and aggregation $match).
 */
async function getScopeOwnerIds(user) {
  if (user.role === 'founder') return null; // no restriction

  const rootId = toObjectId(user._id);
  const ids = [rootId];
  if (user.role === 'executive') return ids;

  const seen = new Set([String(rootId)]);
  let frontier = [rootId];

  // Walk down the tree level by level (SM -> IM -> Exec, or IM -> Exec).
  // Guarded by `seen` so a bad reportingTo cycle can never loop forever.
  while (frontier.length) {
    const children = await User.find({ reportingTo: { $in: frontier } })
      .select('_id')
      .lean();
    const next = [];
    for (const c of children) {
      const key = String(c._id);
      if (!seen.has(key)) {
        seen.add(key);
        ids.push(c._id);
        next.push(c._id);
      }
    }
    frontier = next;
  }
  return ids;
}

/**
 * Mutates `query` to enforce hierarchy-based lead visibility for the leads
 * list/counts endpoints. `scopeIds` comes from getScopeOwnerIds (null = founder).
 *
 * Visibility rule:
 *   - Leads owned by anyone in your reporting subtree, PLUS
 *   - Unassigned leads you imported yourself (allocatedBy = you).
 *   - Founder: unrestricted.
 *
 * `ownerParam` is the optional ?owner= filter: 'self' | 'team' | 'unassigned' |
 * 'none' | '<userId>'.
 */
function applyLeadScope(query, scopeIds, userId, ownerParam) {
  const isFounder = scopeIds === null;
  const selfId = toObjectId(userId);
  const andClauses = query.$and || [];

  // Explicit "unassigned" request: show unallocated leads the user may act on.
  // Founder sees all unassigned; everyone else sees only leads they imported.
  if (ownerParam === 'unassigned' || ownerParam === 'none') {
    andClauses.push({ $or: [{ owner: null }, { owner: { $exists: false } }] });
    if (!isFounder) andClauses.push({ allocatedBy: selfId });
    query.$and = andClauses;
    return query;
  }

  // Base visibility scope (subtree owners + your own imported-unassigned leads).
  if (!isFounder) {
    andClauses.push({
      $or: [
        { owner: { $in: scopeIds } },
        { owner: null, allocatedBy: selfId },
        { owner: { $exists: false }, allocatedBy: selfId }
      ]
    });
  }

  // Additional explicit owner filter, intersected with the base scope above so a
  // manager can never pull a specific owner outside their subtree.
  if (ownerParam === 'self') {
    query.owner = selfId;
  } else if (ownerParam === 'team') {
    andClauses.push({ owner: { $ne: selfId } });
  } else if (ownerParam && ownerParam !== 'all') {
    query.owner = toObjectId(ownerParam);
  }

  if (andClauses.length) query.$and = andClauses;
  return query;
}

module.exports = { getScopeOwnerIds, applyLeadScope, toObjectId };
