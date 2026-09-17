/**
 * Target periods are calendar months or Monday–Sunday weeks, in IST.
 *
 *   monthly  periodKey 'YYYY-MM'
 *   weekly   periodKey 'YYYY-MM-DD' — the Monday the week starts on
 *
 * Mirrored on the client in client/src/utils/targetPeriod.js.
 */

const IST = '+05:30';
const DAY_MS = 24 * 60 * 60 * 1000;

const pad = (n) => String(n).padStart(2, '0');

// Calendar date in IST for an instant: { y, m (1-12), d, weekday (0 = Sunday) }
const istParts = (date) => {
  const shifted = new Date(date.getTime() + 330 * 60 * 1000);
  return { y: shifted.getUTCFullYear(), m: shifted.getUTCMonth() + 1, d: shifted.getUTCDate(), weekday: shifted.getUTCDay() };
};

const currentKey = (period, now = new Date()) => {
  const { y, m, d, weekday } = istParts(now);
  if (period === 'monthly') return `${y}-${pad(m)}`;
  const monday = new Date(Date.UTC(y, m - 1, d) - ((weekday + 6) % 7) * DAY_MS);
  return monday.toISOString().slice(0, 10);
};

/**
 * Validates a key and returns it in canonical form (a weekly key is moved back
 * to its Monday), or null if it isn't a valid key for the period.
 */
const normalizeKey = (period, key) => {
  const value = String(key || '');
  if (period === 'monthly') {
    const match = /^(\d{4})-(\d{2})$/.exec(value);
    return match && Number(match[2]) >= 1 && Number(match[2]) <= 12 ? value : null;
  }
  if (period === 'weekly') {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
    const date = new Date(`${value}T00:00:00Z`);
    if (isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) return null;
    return new Date(date.getTime() - ((date.getUTCDay() + 6) % 7) * DAY_MS).toISOString().slice(0, 10);
  }
  return null;
};

/** The [start, end) instants a canonical key covers. */
const rangeFor = (period, key) => {
  if (period === 'monthly') {
    const [y, m] = key.split('-').map(Number);
    const next = m === 12 ? `${y + 1}-01` : `${y}-${pad(m + 1)}`;
    return { start: new Date(`${key}-01T00:00:00${IST}`), end: new Date(`${next}-01T00:00:00${IST}`) };
  }
  const start = new Date(`${key}T00:00:00${IST}`);
  return { start, end: new Date(start.getTime() + 7 * DAY_MS) };
};

module.exports = { currentKey, normalizeKey, rangeFor };
