import { notificationsApi } from '../api/notificationsApi';

/**
 * Browser push notifications. The service worker (public/sw.js) displays
 * them; this module registers it and keeps the server's copy of this
 * browser's subscription in step with the logged-in user.
 */

export const isPushSupported = () =>
  typeof window !== 'undefined' &&
  'serviceWorker' in navigator &&
  'PushManager' in window &&
  'Notification' in window;

export const registerServiceWorker = () => {
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.register('/sw.js').catch((err) => {
    console.error('Service worker registration failed:', err);
  });
};

// VAPID keys arrive base64url-encoded; PushManager wants raw bytes.
const urlBase64ToUint8Array = (base64String) => {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(base64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
};

const getRegistration = async () => {
  const existing = await navigator.serviceWorker.getRegistration();
  if (existing) return existing;
  await navigator.serviceWorker.register('/sw.js');
  return navigator.serviceWorker.ready;
};

/** 'unsupported' | 'denied' | 'enabled' | 'disabled' */
export const getPushStatus = async () => {
  if (!isPushSupported()) return 'unsupported';
  if (Notification.permission === 'denied') return 'denied';
  if (Notification.permission !== 'granted') return 'disabled';
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = reg && (await reg.pushManager.getSubscription());
  return sub ? 'enabled' : 'disabled';
};

/**
 * Ask permission (if needed), subscribe this browser and tell the server.
 * Must be called from a click — browsers block the permission prompt otherwise.
 */
export const enablePush = async () => {
  if (!isPushSupported()) throw new Error('This browser does not support push notifications');

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    throw new Error(permission === 'denied'
      ? 'Notifications are blocked. Allow them in your browser site settings.'
      : 'Notification permission was not granted');
  }

  const { data } = await notificationsApi.getPushPublicKey();
  if (!data.enabled || !data.publicKey) throw new Error('Push notifications are not configured on the server');

  const reg = await getRegistration();
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(data.publicKey),
    });
  }
  await notificationsApi.pushSubscribe(sub.toJSON());
};

export const disablePush = async () => {
  if (!isPushSupported()) return;
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = reg && (await reg.pushManager.getSubscription());
  if (!sub) return;
  try {
    await notificationsApi.pushUnsubscribe(sub.endpoint);
  } finally {
    await sub.unsubscribe();
  }
};

/**
 * After login: if this browser already has permission and a subscription,
 * re-register it so pushes go to whoever is logged in now.
 */
export const syncPushSubscription = async () => {
  try {
    if (!isPushSupported() || Notification.permission !== 'granted') return;
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = reg && (await reg.pushManager.getSubscription());
    if (sub) await notificationsApi.pushSubscribe(sub.toJSON());
  } catch (err) {
    console.error('Push subscription sync failed:', err);
  }
};
