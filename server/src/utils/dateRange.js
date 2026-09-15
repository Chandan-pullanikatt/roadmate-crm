/**
 * The single source of truth for turning a (period, value) pair — as sent by the
 * Founder Summary time filter and carried through to every drill-down — into a
 * concrete date window.
 *
 * This used to be copy-pasted into dashboard.js and leads.js. The two copies had
 * drifted, which is how a stat card counting September could link to a list
 * counting all time. Both now import this.
 */

const MONTHS = {
  January: 0, February: 1, March: 2, April: 3, May: 4, June: 5,
  July: 6, August: 7, September: 8, October: 9, November: 10, December: 11
};

const QUARTERS = { Q1: 0, Q2: 3, Q3: 6, Q4: 9 };

const normalizeType = (t) => {
  if (t === 'day' || t === 'daily' || t === 'today') return 'today';
  if (t === 'week' || t === 'weekly') return 'weekly';
  if (t === 'month' || t === 'monthly') return 'monthly';
  if (t === 'quarter' || t === 'quarterly') return 'quarter';
  if (t === 'year' || t === 'yearly') return 'yearly';
  return t;
};

const getDateRange = (type, value) => {
  const now = new Date();
  let start = new Date(now);
  let end = new Date(now);

  const period = normalizeType(type);

  if (period === 'today') {
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
  } else if (period === 'weekly') {
    if (value && String(value).startsWith('Week ')) {
      const weekNum = parseInt(String(value).split(' ')[1]);
      // Approximate week start by day of month (1, 8, 15, 22, 29)
      start.setDate(1 + (weekNum - 1) * 7);
      start.setHours(0, 0, 0, 0);
      end = new Date(start);
      if (weekNum === 4 || weekNum === 5) {
        // Last week goes to end of month
        end = new Date(start.getFullYear(), start.getMonth() + 1, 0, 23, 59, 59, 999);
      } else {
        end.setDate(start.getDate() + 6);
        end.setHours(23, 59, 59, 999);
      }
    } else {
      const day = now.getDay();
      const diff = now.getDate() - day + (day === 0 ? -6 : 1);
      start.setDate(diff);
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
    }
  } else if (period === 'monthly') {
    // setDate(1) MUST come first. setMonth() on a date still sitting on the 29th-31st
    // overflows into the following month whenever the target month is shorter --
    // picking February on Oct 31 landed you in March.
    start.setDate(1);
    if (value) {
      const monthIdx = MONTHS[value];
      if (monthIdx !== undefined) start.setMonth(monthIdx);
    }
    start.setHours(0, 0, 0, 0);
    end = new Date(start.getFullYear(), start.getMonth() + 1, 0, 23, 59, 59, 999);
  } else if (period === 'quarter') {
    const qMonth = QUARTERS[value] !== undefined ? QUARTERS[value] : Math.floor(now.getMonth() / 3) * 3;
    start.setMonth(qMonth, 1);
    start.setHours(0, 0, 0, 0);
    end = new Date(start.getFullYear(), qMonth + 3, 0, 23, 59, 59, 999);
  } else if (period === 'yearly') {
    if (value) {
      const yr = parseInt(value);
      if (!isNaN(yr)) start.setFullYear(yr);
    }
    start.setMonth(0, 1);
    start.setHours(0, 0, 0, 0);
    end = new Date(start.getFullYear(), 11, 31, 23, 59, 59, 999);
  }

  return { start, end };
};

/**
 * Builds the `createdAt` clause for a (period, value) pair, or undefined when no
 * period was requested — so callers can spread it into a query unconditionally.
 */
const createdAtRange = (period, value) => {
  if (!period) return undefined;
  const { start, end } = getDateRange(period, value);
  return { $gte: start, $lte: end };
};

module.exports = { getDateRange, createdAtRange, MONTHS };
