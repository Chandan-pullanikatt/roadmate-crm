const Notification = require('../models/Notification');

/**
 * Centralized notification service.
 * Extracted from route handlers to avoid inline notification logic.
 */
const notificationService = {
  /**
   * Create a notification and optionally emit via socket
   * @param {Object} params
   * @param {string} params.userId - Target user ID
   * @param {string} params.message - Notification message
   * @param {string} params.type - Notification type enum
   * @param {Object} [params.meta] - Additional metadata
   * @param {Object} [params.io] - Socket.io instance for real-time push
   */
  async create({ userId, message, type = 'general', meta = {}, io = null }) {
    try {
      const notification = await Notification.create({
        userId,
        message,
        type,
        meta,
      });

      // Push real-time notification via socket if available
      if (io) {
        io.to(userId.toString()).emit('notification', {
          _id: notification._id,
          message: notification.message,
          type: notification.type,
          read: false,
          createdAt: notification.createdAt,
          meta,
        });
      }

      return notification;
    } catch (err) {
      console.error('[NotificationService] Failed to create notification:', err.message);
      return null;
    }
  },

  /**
   * Notify when a lead is allocated to an executive
   */
  async onLeadAllocated({ executiveId, leadName, allocatedByName, io }) {
    return this.create({
      userId: executiveId,
      message: `Lead "${leadName}" has been allocated to you by ${allocatedByName}.`,
      type: 'lead_allocated',
      meta: { leadName, allocatedByName },
      io,
    });
  },

  /**
   * Notify when leave is approved or rejected
   */
  async onLeaveDecision({ userId, decision, managerName, io }) {
    return this.create({
      userId,
      message: `Your leave request has been ${decision} by ${managerName}.`,
      type: decision === 'approved' ? 'leave_approved' : 'leave_rejected',
      meta: { decision, managerName },
      io,
    });
  },

  /**
   * Notify when a new lead is added under a manager's territory
   */
  async onLeadAdded({ managerId, leadName, createdByName, io }) {
    return this.create({
      userId: managerId,
      message: `New lead "${leadName}" added to your territory by ${createdByName}.`,
      type: 'lead_added',
      meta: { leadName, createdByName },
      io,
    });
  },

  /**
   * Notify when new staff is created under a manager
   */
  async onStaffCreated({ managerId, staffName, staffRole, io }) {
    return this.create({
      userId: managerId,
      message: `New ${staffRole.replace('_', ' ')} "${staffName}" has been added to your team.`,
      type: 'staff_created',
      meta: { staffName, staffRole },
      io,
    });
  },
};

module.exports = notificationService;
