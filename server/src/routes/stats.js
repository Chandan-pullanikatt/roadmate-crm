const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/auth');
const User = require('../models/User');
const Lead = require('../models/Lead');
const LeadActivity = require('../models/LeadActivity');
const Attendance = require('../models/Attendance');

// Protect all routes
router.use(verifyToken);

/**
 * GET /api/stats/user/:id
 * Get performance stats for a specific user
 */
router.get('/user/:id', async (req, res) => {
  try {
    const userId = req.params.id;
    const { month, year } = req.query;

    const now = new Date();
    const currentMonth = month ? parseInt(month) : now.getMonth();
    const currentYear = year ? parseInt(year) : now.getFullYear();

    const startOfMonth = new Date(currentYear, currentMonth, 1);
    const endOfMonth = new Date(currentYear, currentMonth + 1, 0, 23, 59, 59, 999);

    // 1. Basic User Info
    const user = await User.findById(userId).select('-password');
    if (!user) return res.status(404).json({ message: 'User not found' });

    // 2. Lead Stats
    const totalLeads = await Lead.countDocuments({ owner: userId });
    const activeLeads = await Lead.countDocuments({ 
      owner: userId, 
      status: { $nin: ['converted', 'lost', 'not_interested'] } 
    });
    const convertedLeads = await Lead.countDocuments({ 
      owner: userId, 
      status: 'converted',
      updatedAt: { $gte: startOfMonth, $lte: endOfMonth }
    });

    // 3. Activity Stats (Monthly)
    const activities = await LeadActivity.find({
      performedBy: userId,
      createdAt: { $gte: startOfMonth, $lte: endOfMonth }
    });

    const stats = {
      calls: activities.filter(a => a.action === 'called').length,
      meetings: activities.filter(a => ['meeting_scheduled', 'meeting_done'].includes(a.action)).length,
      followups: activities.filter(a => a.action === 'followup_set').length,
      conversions: activities.filter(a => a.action === 'converted').length,
      revenue: activities
        .filter(a => a.action === 'converted' && a.metadata?.revenue)
        .reduce((sum, a) => sum + (Number(a.metadata.revenue) || 0), 0)
    };

    // 4. Attendance Stats (Monthly)
    const attendanceRecords = await Attendance.find({
      user: userId,
      date: { $gte: startOfMonth, $lte: endOfMonth }
    });

    const avgWorkPct = attendanceRecords.length > 0
      ? Math.round(attendanceRecords.reduce((sum, a) => sum + (a.completionPct || 0), 0) / attendanceRecords.length)
      : 0;

    const presentDays = attendanceRecords.filter(a => ['present', 'half_day'].includes(a.status)).length;

    res.json({
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        state: user.state,
        district: user.district,
        industry: user.industry,
        employeeId: user.employeeId,
        basicSalary: user.basicSalary,
        dateOfJoining: user.dateOfJoining,
        documents: user.documents
      },
      performance: {
        totalLeads,
        activeLeads,
        convertedLeads,
        monthly: stats,
        avgWorkPct,
        presentDays
      }
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
