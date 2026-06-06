/**
 * End-to-end verification of the lead-import / counts fixes.
 * Mounts ONLY the leads router (no cron, no sockets), stubs notifications,
 * uploads 3 throwaway leads to a test owner, checks results, then DELETES them.
 * Safe to run against the live DB: all writes are tagged ZZTEST_ and removed.
 */
require('dotenv').config();
const express = require('express');
const http = require('http');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');

// Stub notifications BEFORE the router is required (shared cached instance).
const notificationService = require('../services/notificationService');
notificationService.onLeadAdded = async () => {};
notificationService.onLeadAllocated = async () => {};
notificationService.onLeadAutoReallocated = async () => {};

const Lead = require('../models/Lead');
const LeadActivity = require('../models/LeadActivity');
const User = require('../models/User');
const leadsRouter = require('../routes/leads');

const MARK = 'ZZTEST_VERIFY_';
const PORT = 5599;

const mintToken = (u) => jwt.sign(
  { _id: u._id, role: u.role, name: u.name, state: u.state, industry: u.industry, district: u.district, reportingTo: u.reportingTo },
  process.env.JWT_SECRET, { expiresIn: '10m' }
);

(async () => {
  await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 8000 });

  // Uploader = a state_manager / founder (reproduces "SM uploads, assigns to IM").
  const uploader = await User.findOne({ role: { $in: ['founder', 'state_manager'] } }).lean();
  // Owner = a test industry manager.
  const owner = await User.findOne({ role: 'industry_manager', name: 'testim1' }).lean()
             || await User.findOne({ role: 'industry_manager' }).lean();
  console.log(`Uploader: ${uploader.name} (${uploader.role})  ->  Owner: ${owner.name} (industry=${owner.industry}, state=${owner.state})`);

  // Pick fake phones that DON'T already exist (avoid hijacking real leads via phone-dedupe).
  const phones = [];
  for (let n = 9999000001; phones.length < 3; n++) {
    const exists = await Lead.findOne({ phone: String(n) }).select('_id').lean();
    if (!exists) phones.push(String(n));
  }

  const app = express();
  app.use(express.json());
  app.set('io', { to: () => ({ emit: () => {} }) });
  app.use('/api/leads', leadsRouter);
  const srv = http.createServer(app).listen(PORT);

  const uploaderTok = mintToken(uploader);
  const ownerTok = mintToken(owner);
  const base = `http://127.0.0.1:${PORT}/api/leads`;

  // 3 rows mimicking the client's CSV AFTER the frontend getVal fix:
  // real Status values, blank/foreign industry (must be overridden to owner's).
  const rows = [
    { name: `${MARK}A`, phone: phones[0], status: 'rnr',           priority: 'hot',  industry: 'Real Estate', ownerId: String(owner._id) },
    { name: `${MARK}B`, phone: phones[1], status: 'meeting_direct', priority: 'warm', industry: '',            ownerId: String(owner._id) },
    { name: `${MARK}C`, phone: phones[2], status: 'followup',       priority: 'cold',                          ownerId: String(owner._id) },
  ];

  const post = await fetch(`${base}/bulk`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${uploaderTok}` },
    body: JSON.stringify(rows),
  }).then(r => r.json());
  console.log('\nBulk response:', post);

  // Verify what actually landed in the DB.
  const created = await Lead.find({ name: { $regex: `^${MARK}` } }).select('name status priority industry state').lean();
  console.log('\nCreated leads in DB:');
  created.forEach(l => console.log(`  ${l.name}: status=${l.status} priority=${l.priority} industry=${l.industry} state=${l.state}`));

  // Counts as the OWNER (owner=self) — should reflect the real statuses + priorities.
  const counts = await fetch(`${base}/counts?owner=self`, { headers: { Authorization: `Bearer ${ownerTok}` } }).then(r => r.json());
  console.log('\n/counts (owner=self) for owner — relevant keys:',
    JSON.stringify({ total: counts.total, rnr: counts.rnr, meeting_direct: counts.meeting_direct, followup: counts.followup, hot: counts.hot, warm: counts.warm, cold: counts.cold }));

  // ── ASSERTIONS ─────────────────────────────────────────────
  const byName = Object.fromEntries(created.map(l => [l.name, l]));
  const checks = [
    ['Status RNR imported',            byName[`${MARK}A`]?.status === 'rnr'],
    ['Status Meeting imported',        byName[`${MARK}B`]?.status === 'meeting_direct'],
    ['Status Follow-up imported',      byName[`${MARK}C`]?.status === 'followup'],
    ['Industry overridden to owner (foreign CSV value)', byName[`${MARK}A`]?.industry === owner.industry],
    ['Industry filled from owner (blank CSV value)',     byName[`${MARK}B`]?.industry === owner.industry],
    ['State scoped to owner',          byName[`${MARK}C`]?.state === owner.state],
    ['counts.hot present (>=1)',       (counts.hot || 0) >= 1],
    ['counts.warm present (>=1)',      (counts.warm || 0) >= 1],
  ];
  console.log('\nRESULTS:');
  let allPass = true;
  for (const [label, ok] of checks) { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}`); if (!ok) allPass = false; }

  // ── CLEANUP ────────────────────────────────────────────────
  const ids = created.map(l => l._id);
  await LeadActivity.deleteMany({ lead: { $in: ids } });
  const del = await Lead.deleteMany({ name: { $regex: `^${MARK}` } });
  console.log(`\nCleanup: deleted ${del.deletedCount} test leads + their activities.`);

  srv.close();
  await mongoose.disconnect();
  console.log(allPass ? '\nALL CHECKS PASSED ✅' : '\nSOME CHECKS FAILED ❌');
  process.exit(allPass ? 0 : 1);
})().catch(e => { console.error('VERIFY ERROR:', e); process.exit(1); });
