const express = require('express');
const router = express.Router();
const Target = require('../models/Target');
const LeadActivity = require('../models/LeadActivity');
const { verifyToken } = require('../middleware/auth');
const { currentKey, normalizeKey, rangeFor } = require('../utils/targetPeriod');

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

    const target = await Target.findOne({ user: req.user._id, ...period }).lean();
    if (!target) return res.json({});
    const achieved = await achievedFor([req.user._id], period);
    res.json({ ...target, achieved: achieved.get(String(req.user._id)) || EMPTY });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/**
 * GET /api/targets/team - Targets this user assigned for a period, with progress
 */
router.get('/team', async (req, res) => {
  try {
    if (req.user.role === 'executive') return res.status(403).json({ message: 'Forbidden' });
    const period = readPeriod(req.query);
    if (!period) return res.status(400).json({ message: 'Invalid target period.' });

    const targets = await Target.find({ assignedBy: req.user._id, ...period }).populate('user', 'name role').lean();
    const achieved = await achievedFor(targets.map(t => t.user?._id).filter(Boolean), period);
    res.json(targets.map(t => ({ ...t, achieved: achieved.get(String(t.user?._id)) || EMPTY })));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/**
 * POST /api/targets/assign - Assign or update a monthly or weekly target
 */
router.post('/assign', async (req, res) => {
  try {
    if (req.user.role === 'executive') return res.status(403).json({ message: 'Forbidden' });
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ message: 'Select a staff member.' });
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
    res.status(400).json({ message: err.message });
  }
});

module.exports = router;
