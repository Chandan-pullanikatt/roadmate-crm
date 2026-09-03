/**
 * One-off migration: drop the unique index on Sop.role.
 *
 * The Documents tab used to hold a single file per role, enforced by
 * `role: { unique: true }`. It now holds many, but removing the option from the
 * schema does not remove the index from an existing database — Mongo keeps it,
 * and the second upload for a role fails with E11000 duplicate key.
 *
 * Run once per environment after deploying:  node src/scripts/dropSopRoleIndex.js
 * Safe to re-run: it reports and exits if the index is already gone.
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
  const collection = mongoose.connection.db.collection('sops');

  const indexes = await collection.indexes();
  const unique = indexes.find(i => i.unique && i.key && i.key.role === 1);

  if (!unique) {
    console.log('No unique index on sops.role — nothing to do.');
  } else {
    await collection.dropIndex(unique.name);
    console.log(`Dropped unique index "${unique.name}" on sops.role.`);
  }

  await mongoose.disconnect();
};

run().catch((err) => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});
