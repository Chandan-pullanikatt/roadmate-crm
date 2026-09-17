/**
 * Target periods — mirror of server/src/utils/targetPeriod.js.
 *
 *   monthly  periodKey 'YYYY-MM'
 *   weekly   periodKey 'YYYY-MM-DD' — the Monday the week starts on
 */

const pad = (n) => String(n).padStart(2, '0');
const toDateKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fromDateKey = (key) => {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
};

export const TARGET_METRICS = [
  { key: 'directMeetings', label: 'Direct Meetings', color: '#3B82F6' },
  { key: 'blocking',       label: 'Blocking',        color: '#D97706' },
  { key: 'conversions',    label: 'Conversions',     color: '#059669' },
];

export const monthKey = (year, month) => `${year}-${pad(month)}`;

export const mondayKeyOf = (date = new Date()) => {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return toDateKey(d);
};

export const shiftWeek = (key, weeks) => {
  const d = fromDateKey(key);
  d.setDate(d.getDate() + weeks * 7);
  return toDateKey(d);
};

export const currentPeriodKey = (period) => {
  const now = new Date();
  return period === 'weekly' ? mondayKeyOf(now) : monthKey(now.getFullYear(), now.getMonth() + 1);
};

/** "Sep 2026" or "14 Sep – 20 Sep 2026" */
export const periodLabel = (period, key) => {
  if (period === 'monthly') {
    const [y, m] = key.split('-').map(Number);
    return new Date(y, m - 1, 1).toLocaleString('en-IN', { month: 'short', year: 'numeric' });
  }
  const start = fromDateKey(key);
  const end = fromDateKey(shiftWeek(key, 1));
  end.setDate(end.getDate() - 1);
  const short = { day: 'numeric', month: 'short' };
  return `${start.toLocaleDateString('en-IN', short)} – ${end.toLocaleDateString('en-IN', { ...short, year: 'numeric' })}`;
};
