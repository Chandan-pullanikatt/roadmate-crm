/**
 * One-time repair: rescore every started attendance day with the current
 * definition of work % (workPercentService.getDayWorkPct).
 *
 * Why it is needed
 * ----------------
 * Days were scored against scheduleService.getDayPlan, which selected leads on
 * nextActionAt alone. It missed new leads, RNRs and every lead whose date lives
 * on followUpDate, so a staff member handed 45 leads was scored against a book
 * of one: a full day's work was recorded as 0%, and the attendance rules then
 * demoted the day to "leave". getDayPlan now delegates to leadService.getQueue,
 * the same day's book My Work hands out, so days recorded from here on are
 * right — but the rows already written still hold the old figure, and the week,
 * month and year averages read them.
 *
 * Some days will drop to 0%. Those are days whose leads and activities were
 * removed in a test-data purge: the attendance row outlived the work it was
 * scoring, and 0% is the honest reading of what is left.
 *
 * Usage (from server/):
 *   node src/scripts/backfillWorkPct.js            # dry run, prints the diff
 *   node src/scripts/backfillWorkPct.js --write    # apply
 */
require('dotenv').config();
const mongoose = require('mongoose');
const Attendance = require('../models/Attendance');
const User = require('../models/User');
const { getDayWorkPct } = require('../services/workPercentService');

const WRITE = process.argv.includes('--write');

(async () => {
  await mongoose.connect(process.env.MONGO_URI);

  const rows = await Attendance.find({ workStartedAt: { $ne: null } })
    .select('user date completionPct completedLeads totalLeads')
    .sort({ date: 1 })
    .lean();

  const names = new Map((await User.find().select('name').lean()).map(u => [String(u._id), u.name]));

  console.log(`${rows.length} started attendance day(s) — ${WRITE ? 'WRITING' : 'dry run'}\n`);

  let changed = 0;
  const perUser = new Map();

  for (const row of rows) {
    const day = await getDayWorkPct(row.user, row.date);
    const before = Math.round(row.completionPct || 0);
    const after = Math.round(day.workPct);
    const name = names.get(String(row.user)) || String(row.user);

    const agg = perUser.get(name) || { days: 0, before: 0, after: 0 };
    agg.days += 1;
    agg.before += before;
    agg.after += after;
    perUser.set(name, agg);

    if (before === after) continue;
    changed += 1;
    console.log(
      `${row.date.toISOString().slice(0, 10)}  ${name.padEnd(22)}` +
      `${`${before}%`.padStart(5)} -> ${`${after}%`.padStart(5)}  (${day.completedCount}/${day.queueCount})`
    );

    if (WRITE) {
      await Attendance.updateOne(
        { _id: row._id },
        { $set: {
          completionPct: day.workPct,
          completedLeads: day.completedCount,
          totalLeads: day.queueCount,
        } }
      );
    }
  }

  console.log(`\n${changed} of ${rows.length} day(s) change.\n`);
  console.log('Average over days worked, per person:');
  for (const [name, a] of perUser) {
    console.log(`  ${name.padEnd(22)} ${Math.round(a.before / a.days)}% -> ${Math.round(a.after / a.days)}%  (${a.days} days)`);
  }

  await mongoose.disconnect();
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
