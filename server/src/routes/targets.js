const express = require('express');
const router = express.Router();
const Target = require('../models/Target');
const LeadActivity = require('../models/LeadActivity');
const { verifyToken } = require('../middleware/auth');
const { currentKey, normalizeKey, rangeFor } = require('../utils/targetPeriod');
const { getScopeOwnerIds } = require('../utils/hierarchy');

// Protect all routes
router.use(verifyToken);

const METRICS = ['directMeetings', 'blocking', 'conversions'];
const EMPTY = { directMeetings: 0, blocking: 0, conversions: 0 };

/**
 * Reads period=monthly|weekly & periodKey (defaulting to the current period),
 * or the older month & year form. Returns null if the key is invalid.
 */
const readPeriod = (source) => {
  const period = source.period === 'weekly' ? 'weekly' : 'monthly';
  let key = source.periodKey;
  if (!key && period === 'monthly' && source.month && source.year) {
    key = `${source.year}-${String(source.month).padStart(2, '0')}`;
  }
  const periodKey = key ? normalizeKey(period, key) : currentKey(period);
  return periodKey ? { period, periodKey } : null;
};

/**
 * What each user achieved in the period, from their own lead activity:
 * direct meetings scheduled, blocking amounts recorded and conversions.
 */
const achievedFor = async (userIds, { period, periodKey }) => {
  if (userIds.length === 0) return new Map();
  const { start, end } = rangeFor(period, periodKey);
  const rows = await LeadActivity.aggregate([
    { $match: {
      performedBy: { $in: userIds },
      action: { $in: ['meeting_scheduled', 'blocking_amount_received', 'converted'] },
      createdAt: { $gte: start, $lt: end }
    } },
    // Meetings logged before meetingType was recorded fall back to the lead's status
    { $lookup: { from: 'leads', localField: 'lead', foreignField: '_id', as: 'leadDoc', pipeline: [{ $project: { status: 1 } }] } },
    { $addFields: {
      isDirectMeeting: { $and: [
        { $eq: ['$action', 'meeting_scheduled'] },
        { $or: [
          { $eq: ['$metadata.meetingType', 'direct'] },
          { $and: [
            { $eq: [{ $ifNull: ['$metadata.meetingType', null] }, null] },
            { $eq: [{ $arrayElemAt: ['$leadDoc.status', 0] }, 'meeting_direct'] }
          ] }
        ] }
      ] }
    } },
    { $group: {
      _id: '$performedBy',
      directMeetings: { $sum: { $cond: ['$isDirectMeeting', 1, 0] } },
      blocking: { $sum: { $cond: [{ $eq: ['$action', 'blocking_amount_received'] }, 1, 0] } },
      conversions: { $sum: { $cond: [{ $eq: ['$action', 'converted'] }, 1, 0] } }
    } }
  ]);
  return new Map(rows.map(({ _id, ...counts }) => [String(_id), counts]));
};

/**
 * GET /api/targets/my-targets - The current user's target and progress for a period
 */
router.get('/my-targets', async (req, res) => {
  try {
    const period = readPeriod(req.query);
    if (!period) return res.status(400).json({ message: 'Invalid target period.' });

    const target = await Target.findOne({ user: req.user._id, ...period })
      .populate('assignedBy', 'name role')
      .lean();
    if (!target) return res.json({});
    const achieved = await achievedFor([req.user._id], period);
    res.json({ ...target, achieved: achieved.get(String(req.user._id)) || EMPTY });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

const ROLE_ORDER = { founder: 0, state_manager: 1, industry_manager: 2, executive: 3 };

/**
 * GET /api/targets/team - Targets for everyone in this user's reporting tree
 *
 * Scoped by the hierarchy (getScopeOwnerIds), NOT by who assigned the target, so
 * a founder sees the targets their state and industry managers set for their own
 * teams, and a manager still sees a target a founder set for one of their staff.
 */
router.get('/team', async (req, res) => {
  try {
    if (req.user.role === 'executive') return res.status(403).json({ message: 'Forbidden' });
    const period = readPeriod(req.query);
    if (!period) return res.status(400).json({ message: 'Invalid target period.' });

    const scopeIds = await getScopeOwnerIds(req.user); // null = founder, no restriction
    const query = { ...period };
    if (scopeIds) query.user = { $in: scopeIds };

    const targets = await Target.find(query)
      .populate('user', 'name role')
      .populate('assignedBy', 'name role')
      .lean();

    // A target whose staff member has since been deleted has nothing to show
    const visible = targets.filter(t => t.user);
    visible.sort((a, b) =>
      (ROLE_ORDER[a.user.role] ?? 9) - (ROLE_ORDER[b.user.role] ?? 9) ||
      String(a.user.name || '').localeCompare(String(b.user.name || '')));

    const achieved = await achievedFor(visible.map(t => t.user._id), period);
    res.json(visible.map(t => ({ ...t, achieved: achieved.get(String(t.user._id)) || EMPTY })));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/**
 * POST /api/targets/assign - Assign or update a monthly or weekly target
 */
router.post('/assign', async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ message: 'Select a staff member.' });
    // District Managers set their own target and nobody else's; every other
    // role assigns within its team.
    if (req.user.role === 'executive' && String(userId) !== String(req.user._id)) {
      return res.status(403).json({ message: 'You can only set your own target.' });
    }
    const period = readPeriod(req.body);
    if (!period) return res.status(400).json({ message: 'Invalid target period.' });

    const values = {};
    for (const key of METRICS) values[key] = Math.max(0, parseInt(req.body[key], 10) || 0);

    const target = await Target.findOneAndUpdate(
      { user: userId, ...period },
      { ...values, assignedBy: req.user._id },
      { upsert: true, returnDocument: 'after' }
    );
    res.json(target);
  } catch (err) {
    // A stale unique index on the collection surfaces here as a raw driver error
    if (err.code === 11000) {
      return res.status(409).json({ message: 'A target for this person and period already exists. Reload the page and try again.' });
    }
    res.status(400).json({ message: err.message });
  }
});

/**
 * DELETE /api/targets/:id - Remove a target for a period
 *
 * Scoped like GET /team: a founder can clear anyone's target, a manager only
 * one belonging to their own reporting subtree. Nothing else is deleted — the
 * achievement figures are read from lead activity, so removing a target only
 * takes the goal away.
 */
router.delete('/:id', async (req, res) => {
  try {
    if (req.user.role === 'executive') return res.status(403).json({ message: 'Forbidden' });

    const target = await Target.findById(req.params.id);
    if (!target) return res.status(404).json({ message: 'That target no longer exists.' });

    const scopeIds = await getScopeOwnerIds(req.user); // null = founder, no restriction
    if (scopeIds && !scopeIds.some(id => String(id) === String(target.user))) {
      return res.status(403).json({ message: 'That target belongs to someone outside your team.' });
    }

    await target.deleteOne();
    res.json({ message: 'Target removed.' });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

module.exports = router;
