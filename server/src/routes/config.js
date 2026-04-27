const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/auth');
const Config = require('../models/Config');

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
      config = {
        key: 'working-hours',
        value: {
          normalStart: '09:30',
          normalEnd: '18:30',
          ramadanStart: '09:00',
          ramadanEnd: '17:30',
          ramadanFrom: null,
          ramadanTo: null,
          rules: {
            leaveThreshold: 30,
            halfDayThreshold: 70,
            delayedLoginHalfDay: true
          }
        }
      };
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
