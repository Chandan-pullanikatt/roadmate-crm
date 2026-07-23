const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/auth');
const Lead = require('../models/Lead');
const User = require('../models/User');
const { getScopeOwnerIds } = require('../utils/hierarchy');

router.use(verifyToken);

/**
 * GET /api/search?q=
 * Global search across leads and staff with role-based scoping
 */
router.get('/', async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || q.length < 2) {
      return res.json({ leads: [], staff: [] });
    }

    const leadQuery = {
      $or: [
        { name: { $regex: q, $options: 'i' } },
        { company: { $regex: q, $options: 'i' } }
      ]
    };

    const userQuery = {
      $or: [
        { name: { $regex: q, $options: 'i' } },
        { email: { $regex: q, $options: 'i' } }
      ]
    };

    // Lead visibility follows the reporting tree (same rule as leads.js/dashboard.js),
    // so peers can't surface each other's leads via search. Founder = unrestricted.
    const scopeIds = await getScopeOwnerIds(req.user);
    if (scopeIds !== null) {
      leadQuery.owner = { $in: scopeIds };
    }

    // Staff search scoping is unchanged (directory lookup, not lead data).
    if (req.user.role === 'executive') {
      userQuery.state = req.user.state;
      userQuery.industry = req.user.industry;
    } else if (req.user.role === 'state_manager') {
      userQuery.state = req.user.state;
    } else if (req.user.role === 'industry_manager') {
      userQuery.reportingTo = req.user._id;
    }

    const [leads, staff] = await Promise.all([
      Lead.find(leadQuery)
        .select('name company status')
        .limit(5)
        .sort({ createdAt: -1 }),
      User.find(userQuery)
        .select('name role email')
        .limit(5)
        .sort({ name: 1 })
    ]);

    res.json({ leads, staff });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
