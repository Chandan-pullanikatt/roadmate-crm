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
   * Fan a single message out to many users at once.
   * insertMany writes the batch in one round trip, then each recipient gets
   * their own socket push so anyone online sees it without a refresh.
   */
  async createMany({ userIds, message, type = 'general', meta = {}, io = null }) {
    if (!userIds || !userIds.length) return [];

    try {
      const docs = await Notification.insertMany(
        userIds.map(userId => ({ userId, message, type, meta }))
      );

      if (io) {
        docs.forEach(doc => {
          io.to(doc.userId.toString()).emit('notification', {
            _id: doc._id,
            message: doc.message,
            type: doc.type,
            read: false,
            createdAt: doc.createdAt,
            meta,
          });
        });
      }

      return docs;
    } catch (err) {
      console.error('[NotificationService] Failed to create notifications:', err.message);
      return [];
    }
  },

  /**
   * Notify a team that a document was published to their Documents tab.
   * Message names the uploader, e.g. "Founder added a new document".
   */
  async onDocumentUploaded({ userIds, uploaderName, uploaderRole, documentTitle, documentId, io }) {
    const who = uploaderRole === 'founder' ? 'Founder' : uploaderName;
    return this.createMany({
      userIds,
      message: `${who} added a new document: "${documentTitle}".`,
      type: 'document_uploaded',
      meta: { documentId, documentTitle, uploaderName, uploaderRole },
      io,
    });
  },

  /**
   * A message the founder or a manager sends to their own team.
   */
  async onBroadcast({ userIds, message, senderName, senderRole, io }) {
    return this.createMany({
      userIds,
      message,
      type: 'broadcast',
      meta: { senderName, senderRole },
      io,
    });
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
   * Notify executive when a lead is auto-reallocated to them by the system
   */
  async onLeadAutoReallocated({ executiveId, leadName, rnrCount, io }) {
    return this.create({
      userId: executiveId,
      message: `Lead "${leadName}" was auto-assigned to you after ${rnrCount} missed calls by the previous executive.`,
      type: 'lead_allocated',
      meta: { leadName, rnrCount, autoAssigned: true },
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
