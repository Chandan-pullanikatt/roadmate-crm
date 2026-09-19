const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/auth');
const Config = require('../models/Config');
const { DEFAULT_WORKING_HOURS, resolveAttendanceRules } = require('../constants/attendanceRules');

// Protect all routes - Founder only for writing
router.use(verifyToken);

/**
 * GET /api/config/:key
 */
router.get('/:key', async (req, res) => {
  try {
    let config = await Config.findOne({ key: req.params.key });
    
    // Default values if not found
    if (!config && req.params.key === 'working-hours') {
      config = { key: 'working-hours', value: DEFAULT_WORKING_HOURS };
    } else if (config && req.params.key === 'working-hours') {
      // Rules saved before the Sep 2026 spec used other keys; fill in the new ones.
      config = config.toObject();
      config.value = { ...config.value, rules: resolveAttendanceRules(config.value?.rules) };
    }

    res.json(config);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/**
 * POST /api/config
 */
router.post('/', async (req, res) => {
  try {
    if (req.user.role !== 'founder') {
      return res.status(403).json({ message: 'Forbidden: Founder only' });
    }

    const { key, value } = req.body;
    const config = await Config.findOneAndUpdate(
      { key },
      { key, value },
      { upsert: true, new: true }
    );

    res.json(config);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

module.exports = router;
