/**
 * One-off migration: move targets to monthly/weekly periods.
 *
 * Targets used to be monthly only, keyed by month + year, with calls / leads /
 * conversions / revenue. They are now keyed by period + periodKey and track
 * direct meetings, blocking and conversions. This converts every old target to
 * a monthly one (conversions carry over; calls, leads and revenue are dropped),
 * and swaps the old unique index on { user, month, year } — which would block a
 * second weekly target for the same user — for one on { user, period, periodKey }.
 *
 * Run once per environment after deploying:  node src/scripts/migrateTargets.js
 * Safe to re-run: it only touches targets that still have no period.
 */
require('dotenv').config();
const mongoose = require('mongoose');

const run = async () => {
  const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGO_URI is not set — cannot connect.');
    process.exit(1);
  }
  await mongoose.connect(uri);
  const targets = mongoose.connection.db.collection('targets');

  const old = await targets.find({ period: { $exists: false } }).toArray();
  for (const t of old) {
    await targets.updateOne({ _id: t._id }, {
      $set: {
        period: 'monthly',
        periodKey: `${t.year}-${String(t.month).padStart(2, '0')}`,
        directMeetings: 0,
        blocking: 0,
        conversions: t.conversions || 0,
      },
      $unset: { month: '', year: '', calls: '', leads: '', revenue: '' },
    });
  }
  console.log(`Converted ${old.length} target(s) to monthly periods.`);

  const indexes = await targets.indexes();
  if (indexes.some(i => i.name === 'user_1_month_1_year_1')) {
    await targets.dropIndex('user_1_month_1_year_1');
    console.log('Dropped the old { user, month, year } index.');
  }
  await targets.createIndex({ user: 1, period: 1, periodKey: 1 }, { unique: true });
  console.log('Unique index on { user, period, periodKey } is in place.');

  await mongoose.disconnect();
};

run().catch(err => {
  console.error(err);
  process.exit(1);
});
