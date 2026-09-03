const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  role: { type: String },
  message: { type: String, required: true },
  type: { 
    type: String, 
    enum: ['lead_allocated', 'leave_approved', 'leave_rejected', 'lead_added', 'staff_created', 'document_uploaded', 'broadcast', 'general'],
    default: 'general'
  },
  read: { type: Boolean, default: false },
  meta: { type: mongoose.Schema.Types.Mixed },
}, { timestamps: true });

notificationSchema.index({ userId: 1, read: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);
