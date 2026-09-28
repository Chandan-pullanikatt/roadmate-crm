/**
 * One-off cleanup: remove the redundant second 'followup_set' activity.
 *
 * Both call-feedback modals used to record a follow-up with two transitions --
 * set_feedback/'followup' (which carries the caller's remark) and then
 * set_followup_date (which carried only the date). Both wrote a 'followup_set'
 * activity, so every dated follow-up left two rows one or two seconds apart,
 * the second one with an empty note.
 *
 * That double-counted the Follow-ups column, showed "Follow-up set" twice in
 * every lead timeline, and -- once Calls started counting each logged outcome
 * as one call (2026-09-28) -- inflated Calls too. leadService no longer writes
 * the second row; this removes the ones already in the database.
 *
 * Deliberately strict. A row is deleted only when it is the LATER of exactly
 * two 'followup_set' rows on the same lead, by the same person, in the same
 * minute, and its own note is empty. Anything that does not match that shape
 * is left alone and reported.
 *
 *   node src/scripts/dedupeFollowupActivities.js           # dry run, changes nothing
 *   node src/scripts/dedupeFollowupActivities.js --apply   # delete
 */
require('dotenv').config();
const mongoose = require('mongoose');

const APPLY = process.argv.includes('--apply');

(async () => {
  if (!process.env.MONGO_URI) {
    console.error('MONGO_URI is not set. Run this from the server/ directory.');
    process.exit(1);
  }
  await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 10000 });
  console.log(`DB: ${mongoose.connection.name}  |  mode: ${APPLY ? 'APPLY (will delete)' : 'DRY RUN'}`);

  const acts = mongoose.connection.db.collection('leadactivities');

  const groups = await acts.aggregate([
    { $match: { action: 'followup_set' } },
    { $group: {
      _id: {
        lead: '$lead',
        performedBy: '$performedBy',
        minute: { $dateToString: { format: '%Y-%m-%d %H:%M', date: '$createdAt' } }
      },
      n: { $sum: 1 },
      rows: { $push: { id: '$_id', at: '$createdAt', note: '$note' } }
    } },
    { $match: { n: { $gt: 1 } } }
  ]).toArray();

  const doomed = [];
  const skipped = [];

  for (const g of groups) {
    const rows = [...g.rows].sort((a, b) => a.at - b.at);
    const later = rows[rows.length - 1];
    const earlierHasRemark = rows.slice(0, -1).some(r => (r.note || '').trim().length > 0);

    if (rows.length !== 2) {
      skipped.push({ lead: g._id.lead, why: `group of ${rows.length}, expected 2` });
      continue;
    }
    if ((later.note || '').trim().length > 0) {
      skipped.push({ lead: g._id.lead, why: 'later row carries a remark' });
      continue;
    }
    if (!earlierHasRemark) {
      skipped.push({ lead: g._id.lead, why: 'neither row carries a remark' });
      continue;
    }
    doomed.push(later.id);
  }

  const totalBefore = await acts.countDocuments({ action: 'followup_set' });
  console.log(`\nfollowup_set rows          : ${totalBefore}`);
  console.log(`duplicate groups found     : ${groups.length}`);
  console.log(`rows to delete             : ${doomed.length}`);
  console.log(`groups left alone          : ${skipped.length}`);
  skipped.forEach(s => console.log(`   lead ${String(s.lead).slice(-6)} - ${s.why}`));
  console.log(`followup_set rows after    : ${totalBefore - doomed.length}`);

  if (!APPLY) {
    console.log('\nDry run. Nothing was changed. Re-run with --apply to delete.');
  } else if (doomed.length) {
    const res = await acts.deleteMany({ _id: { $in: doomed } });
    console.log(`\nDeleted ${res.deletedCount} rows.`);
  } else {
    console.log('\nNothing to delete.');
  }

  await mongoose.disconnect();
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
