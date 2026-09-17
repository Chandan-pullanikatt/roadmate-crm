/**
 * One-off migration: give every lead a unique Lead ID.
 *
 * Lead IDs are now required and unique, but leads created before that have no
 * ID (or share one), and Mongo won't build the unique index until that's fixed.
 * This assigns an ID from each lead's source to every lead without one, renumbers
 * all but the oldest lead sharing an ID, then builds the index. Leads whose source
 * has no ID pattern are numbered as Direct (RMDL).
 *
 * Run once per environment after deploying:  node src/scripts/backfillLeadIds.js
 * Safe to re-run: it only touches leads that still need an ID.
 */
require('dotenv').config();
const mongoose = require('mongoose');
const { generateLeadId, syncCountersWithIds } = require('../services/leadIdService');
const { prefixForSource } = require('../constants/leadSources');

const run = async () => {
  const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGO_URI is not set — cannot connect.');
    process.exit(1);
  }
  await mongoose.connect(uri);
  const leads = mongoose.connection.db.collection('leads');

  // Counters must start past every existing ID before anything is generated
  await syncCountersWithIds(await leads.distinct('leadId'));

  const duplicates = await leads.aggregate([
    { $match: { leadId: { $nin: [null, ''] } } },
    { $sort: { createdAt: 1 } },
    { $group: { _id: '$leadId', ids: { $push: '$_id' }, n: { $sum: 1 } } },
    { $match: { n: { $gt: 1 } } },
  ]).toArray();
  const toRenumber = duplicates.flatMap(d => d.ids.slice(1));
  // Clear them first so the generator doesn't see their old ID as taken forever
  if (toRenumber.length) await leads.updateMany({ _id: { $in: toRenumber } }, { $unset: { leadId: '' } });

  const missing = await leads
    .find({ $or: [{ leadId: { $exists: false } }, { leadId: null }, { leadId: '' }] })
    .sort({ createdAt: 1 })
    .project({ leadSource: 1 })
    .toArray();

  for (const lead of missing) {
    const source = prefixForSource(lead.leadSource) ? lead.leadSource : 'Direct';
    const leadId = await generateLeadId(source);
    await leads.updateOne({ _id: lead._id }, { $set: { leadId } });
  }
  console.log(`Assigned IDs to ${missing.length} lead(s) (${toRenumber.length} were duplicates).`);

  // The previous build created a non-unique index with the same name — replace it
  const existing = (await leads.indexes()).find(i => i.name === 'leadId_1');
  if (existing && !existing.unique) await leads.dropIndex('leadId_1');
  await leads.createIndex({ leadId: 1 }, { unique: true, name: 'leadId_1' });
  console.log('Unique index on leads.leadId is in place.');
  await mongoose.disconnect();
};

run().catch(err => {
  console.error(err);
  process.exit(1);
});
