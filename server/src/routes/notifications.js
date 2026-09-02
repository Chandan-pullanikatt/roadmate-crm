const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/auth');
const Notification = require('../models/Notification');
const teamService = require('../services/teamService');
const notificationService = require('../services/notificationService');

// Protect all routes
router.use(verifyToken);

/**
 * GET /api/notifications
 * Returns the current user's notifications (most recent first, limit 20)
 */
router.get('/', async (req, res) => {
  try {
    // Notifications are kept after they are read — dismissing one marks it read,
    // it is never deleted — so allow a larger page for a full history view.
    const limit = Math.min(Number(req.query.limit) || 20, 100);

    const notifications = await Notification.find({ userId: req.user._id })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    const unreadCount = await Notification.countDocuments({ 
      userId: req.user._id, 
      read: false 
    });

    res.json({ notifications, unreadCount });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/**
 * PATCH /api/notifications/:id/read
 * Mark a single notification as read
 */
router.patch('/:id/read', async (req, res) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      { read: true },
      { new: true }
    );
    if (!notification) return res.status(404).json({ message: 'Notification not found' });
    res.json(notification);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

/**
 * PATCH /api/notifications/read-all
 * Mark all of the current user's notifications as read
 */
router.patch('/read-all', async (req, res) => {
  try {
    await Notification.updateMany(
      { userId: req.user._id, read: false },
      { read: true }
    );
    res.json({ message: 'All notifications marked as read' });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

/**
 * POST /api/notifications/broadcast
 * Founder or a manager sends a message to their own team.
 * A manager reaches only their downline — never a peer manager's staff.
 * Body: { message, role? }  — role narrows it to one role within the team.
 */
router.post('/broadcast', async (req, res) => {
  try {
    const SENDER_ROLES = ['founder', 'state_manager', 'industry_manager'];
    if (!SENDER_ROLES.includes(req.user.role)) {
      return res.status(403).json({ message: 'You are not allowed to send notifications' });
    }

    const message = String(req.body.message || '').trim();
    if (!message) return res.status(400).json({ message: 'Message is required' });
    if (message.length > 500) {
      return res.status(400).json({ message: 'Message must be 500 characters or fewer' });
    }

    const { role } = req.body;
    if (role && !['state_manager', 'industry_manager', 'executive'].includes(role)) {
      return res.status(400).json({ message: 'Invalid role filter' });
    }

    const recipientIds = await teamService.getTeamRecipientIds(req.user, { role: role || null });
    if (!recipientIds.length) {
      return res.status(404).json({ message: 'No one in your team to notify' });
    }

    await notificationService.onBroadcast({
      userIds: recipientIds,
      message,
      senderName: req.user.name,
      senderRole: req.user.role,
      io: req.app.get('io'),
    });

    res.status(201).json({ message: `Notification sent to ${recipientIds.length} team member(s)`, sent: recipientIds.length });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
