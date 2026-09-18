const webpush = require('web-push');
const PushSubscription = require('../models/PushSubscription');

/**
 * Browser push notifications (Web Push / VAPID).
 * Reaches users even when the CRM tab is closed. Push is optional: without
 * VAPID keys in the environment every call here is a no-op, so in-app
 * notifications keep working exactly as before.
 */
const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT } = process.env;
const enabled = Boolean(VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY);

if (enabled) {
  webpush.setVapidDetails(VAPID_SUBJECT || 'mailto:admin@roadmate.team', VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
} else {
  console.warn('[PushService] VAPID keys not set — push notifications are disabled.');
}

const pushService = {
  isEnabled: () => enabled,
  getPublicKey: () => (enabled ? VAPID_PUBLIC_KEY : null),

  /**
   * Save a browser's subscription for this user. Upserting on the endpoint
   * means a shared browser follows whoever subscribed from it last.
   */
  async subscribe(userId, subscription, userAgent) {
    const { endpoint, keys } = subscription || {};
    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      throw new Error('Invalid push subscription');
    }
    return PushSubscription.findOneAndUpdate(
      { endpoint },
      { userId, endpoint, keys: { p256dh: keys.p256dh, auth: keys.auth }, userAgent },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  },

  async unsubscribe(userId, endpoint) {
    return PushSubscription.deleteOne({ userId, endpoint });
  },

  /**
   * Send one payload to every browser the given users have subscribed.
   * Never throws — a push failure must not break the action that caused it.
   * @param {Array<string|ObjectId>} userIds
   * @param {Object} payload - { title, body, url?, tag?, requireInteraction? }
   */
  async sendToUsers(userIds, payload) {
    if (!enabled || !userIds || !userIds.length) return;

    try {
      const subs = await PushSubscription.find({ userId: { $in: userIds } }).lean();
      if (!subs.length) return;

      const body = JSON.stringify(payload);
      const expired = [];

      await Promise.all(subs.map(async (sub) => {
        try {
          await webpush.sendNotification({ endpoint: sub.endpoint, keys: sub.keys }, body, { TTL: 60 * 60 });
        } catch (err) {
          // 404/410: the browser dropped this subscription — stop sending to it.
          if (err.statusCode === 404 || err.statusCode === 410) expired.push(sub._id);
          else console.error('[PushService] Send failed:', err.statusCode || '', err.message);
        }
      }));

      if (expired.length) await PushSubscription.deleteMany({ _id: { $in: expired } });
    } catch (err) {
      console.error('[PushService] Failed to send push:', err.message);
    }
  },

  async sendToUser(userId, payload) {
    return this.sendToUsers([userId], payload);
  },
};

module.exports = pushService;
