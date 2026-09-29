/**
 * One-time repair: merge attendance rows that recorded the same day twice, and
 * re-stamp every row onto the canonical attendance day.
 *
 * Why it is needed
 * ----------------
 * An attendance row used to be filed under `startOfDay()` -- midnight in the
 * *server's* zone. A server running UTC filed 28 Sep under 28 Sep 00:00Z; a box
 * running IST filed the same day under 27 Sep 18:30Z. Neither could see the
 * other's row, so Start Work wrote one and the absentee cron wrote another, and
 * the `{user, date}` unique index could not merge them because the two instants
 * genuinely differ.
 *
 * The result was one day recorded twice with contradictory answers -- AJAN's
 * 28 September existed as "half day, 91.7%" and as "absent, 0%" at the same
 * time -- and every count that reads these rows adding up both copies: the
 * Founder's Attendance page showed Mekha B 23 days in a 20-day month, and the
 * work % average divided by rows instead of days.
 *
 * `attendanceDay` (utils/workingDays) is now the one stamp every read and write
 * uses, so no new duplicates can appear. This repairs the rows already written.
 *
 * What it does
 * ------------
 * Groups every row by user and IST calendar day. Where a day has more than one
 * row it keeps the one that actually holds the day's work -- a row that was
 * started beats one that was not, then the higher completion, then the larger
 * planned queue, then the better status -- fills any gaps in it from the rows
 * being dropped (earliest start, latest completion, the planned queue if the
 * keeper has none), and deletes the rest. Every surviving row is then re-stamped
 * onto `attendanceDay`, including days that were never duplicated.
 *
 * Usage (from server/):
 *   node src/scripts/mergeDuplicateAttendance.js            # dry run, prints every change
 *   node src/scripts/mergeDuplicateAttendance.js --write    # apply
 */
require('dotenv').config();
const mongoose = require('mongoose');
const Attendance = require('../models/Attendance');
const User = require('../models/User');
const { attendanceDay, istDayKey } = require('../utils/workingDays');

const WRITE = process.argv.includes('--write');

/** Worst to best. Used only to break a tie between rows that are otherwise equal. */
const STATUS_RANK = ['absent', 'optional_holiday', 'holiday', 'leave', 'half_day', 'present'];
const rankOf = (status) => {
  const i = STATUS_RANK.indexOf(status);
  return i === -1 ? 0 : i;
};

/**
 * The row that holds the day's real work, first in the list.
 *
 * A started row always beats an unstarted one: the unstarted copy is the
 * placeholder the absentee cron wrote against the other zone's midnight, and it
 * is the one carrying "absent, 0%" for a day that was worked.
 */
const bestFirst = (rows) => [...rows].sort((a, b) =>
  (b.workStartedAt ? 1 : 0) - (a.workStartedAt ? 1 : 0)
  || (b.completionPct || 0) - (a.completionPct || 0)
  || (b.plannedLeads || []).length - (a.plannedLeads || []).length
  || rankOf(b.status) - rankOf(a.status)
  || String(a._id).localeCompare(String(b._id))
);

const earliest = (...dates) => {
  const set = dates.filter(Boolean).map(d => new Date(d));
  return set.length ? new Date(Math.min(...set)) : null;
};
const latest = (...dates) => {
  const set = dates.filter(Boolean).map(d => new Date(d));
  return set.length ? new Date(Math.max(...set)) : null;
};

const fmt = (row) =>
  `${String(row.status || '-').padEnd(16)} ${`${Math.round(row.completionPct || 0)}%`.padStart(4)}` +
  ` planned=${String((row.plannedLeads || []).length).padStart(2)}` +
  ` ${row.workStartedAt ? 'started' : '-------'}`;

(async () => {
  await mongoose.connect(process.env.MONGO_URI);

  const rows = await Attendance.find().sort({ date: 1 }).lean();
  const names = new Map((await User.find().select('name').lean()).map(u => [String(u._id), u.name]));

  // Group by the day each row BELONGS to, which is what the two zones disagreed
  // about -- not by the stamp it happens to carry.
  const groups = new Map();
  for (const row of rows) {
    const key = `${String(row.user)}|${istDayKey(row.date)}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }

  let merged = 0;
  let deleted = 0;
  let restamped = 0;

  for (const [key, group] of groups) {
    const [day] = key.split('|').slice(1);
    const name = names.get(String(group[0].user)) || '(unknown user)';
    const [keeper, ...losers] = bestFirst(group);
    const target = attendanceDay(keeper.date);

    if (losers.length > 0) {
      merged += 1;
      deleted += losers.length;
      console.log(`\n${day}  ${name}`);
      console.log(`   KEEP  ${fmt(keeper)}`);
      for (const l of losers) console.log(`   DROP  ${fmt(l)}`);
    }

    // Anything the keeper is missing that a dropped row knew about.
    const patch = {};
    const start = earliest(keeper.workStartedAt, ...losers.map(l => l.workStartedAt));
    const end = latest(keeper.workCompletedAt, ...losers.map(l => l.workCompletedAt));
    if (start && String(start) !== String(keeper.workStartedAt)) patch.workStartedAt = start;
    if (end && String(end) !== String(keeper.workCompletedAt)) patch.workCompletedAt = end;
    if (!(keeper.plannedLeads || []).length) {
      const donor = losers.find(l => (l.plannedLeads || []).length);
      if (donor) patch.plannedLeads = donor.plannedLeads;
    }
    if (String(keeper.date) !== String(target)) {
      patch.date = target;
      restamped += 1;
    }

    if (Object.keys(patch).length && losers.length > 0) {
      console.log(`   PATCH ${Object.keys(patch).join(', ')}`);
    }

    if (WRITE) {
      // Delete first: the keeper's new stamp may be the one a dropped row holds,
      // and {user, date} is a unique index.
      if (losers.length) await Attendance.deleteMany({ _id: { $in: losers.map(l => l._id) } });
      if (Object.keys(patch).length) await Attendance.updateOne({ _id: keeper._id }, { $set: patch });
    }
  }

  console.log(`\n${rows.length} row(s) over ${groups.size} user-day(s).`);
  console.log(`${merged} day(s) had more than one row; ${deleted} row(s) to delete.`);
  console.log(`${restamped} row(s) to re-stamp onto the canonical attendance day.`);
  console.log(WRITE ? '\nApplied.' : '\nDry run — nothing written. Re-run with --write to apply.');

  await mongoose.disconnect();
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
