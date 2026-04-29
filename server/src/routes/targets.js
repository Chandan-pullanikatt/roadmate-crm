const express = require('express');
const router = express.Router();
const Target = require('../models/Target');
const { verifyToken } = require('../middleware/auth');

// Protect all routes
router.use(verifyToken);

/**
 * GET /api/targets/my-targets - Get targets for the current user
 */
router.get('/my-targets', async (req, res) => {
  try {
    const month = parseInt(req.query.month) || new Date().getMonth() + 1;
    const year = parseInt(req.query.year) || new Date().getFullYear();
    
    const target = await Target.findOne({ user: req.user._id, month, year });
    res.json(target || {});
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/**
 * GET /api/targets/team - Get targets for direct reports
 */
router.get('/team', async (req, res) => {
  try {
    if (req.user.role === 'executive') return res.status(403).json({ message: 'Forbidden' });
    
    const month = parseInt(req.query.month) || new Date().getMonth() + 1;
    const year = parseInt(req.query.year) || new Date().getFullYear();
    
    const targets = await Target.find({ assignedBy: req.user._id, month, year }).populate('user', 'name role');
    res.json(targets);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/**
 * POST /api/targets/assign - Assign or update target
 */
router.post('/assign', async (req, res) => {
  try {
    if (req.user.role === 'executive') return res.status(403).json({ message: 'Forbidden' });
    
    const { userId, month, year, calls, leads, conversions, revenue } = req.body;
    
    const target = await Target.findOneAndUpdate(
      { user: userId, month, year },
      { 
        calls, leads, conversions, revenue, 
        assignedBy: req.user._id 
      },
      { upsert: true, new: true }
    );
    
    res.json(target);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

module.exports = router;
