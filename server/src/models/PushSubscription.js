const mongoose = require('mongoose');

/**
 * One row per browser a user has enabled push notifications on.
 * The endpoint is unique to that browser, so a user can have several
 * (laptop + phone) and a shared device moves to whoever enabled it last.
 */
const pushSubscriptionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  endpoint: { type: String, required: true, unique: true },
  keys: {
    p256dh: { type: String, required: true },
    auth: { type: String, required: true },
  },
  userAgent: { type: String },
}, { timestamps: true });

module.exports = mongoose.model('PushSubscription', pushSubscriptionSchema);
