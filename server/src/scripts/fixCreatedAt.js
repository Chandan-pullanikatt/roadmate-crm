/**
 * One-time fix: reset createdAt for all of Nayana's leads.
 * Uses native MongoDB driver to bypass Mongoose's immutable timestamps.
 * Run: node src/scripts/fixCreatedAt.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');

const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI;

async function run() {
  await mongoose.connect(MONGO_URI);
  console.log('Connected to MongoDB\n');

  const nayana = await User.findOne({ name: /nayana/i }).select('_id name');
  if (!nayana) { console.error('User Nayana not found.'); process.exit(1); }
  console.log(`Fixing leads for: ${nayana.name} (${nayana._id})\n`);

  const now = new Date();

  // Use native collection directly — Mongoose blocks createdAt updates via timestamps:true
  const result = await mongoose.connection.collection('leads').updateMany(
    { owner: nayana._id },
    { $set: { createdAt: now } }
  );

  console.log(`Fixed ${result.modifiedCount} leads — createdAt reset to ${now.toISOString()}`);
  await mongoose.disconnect();
  console.log('Done.');
}

run().catch(err => { console.error(err); process.exit(1); });
