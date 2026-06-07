/**
 * Verifies the State-Manager view of an IM's lead count AND the IM Overview boxes
 * actually reflect uploaded leads (post-fix). Measures before/after a tagged insert,
 * then deletes the test leads. Safe against live DB.
 */
require('dotenv').config();
const express = require('express');
const http = require('http');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');

const notificationService = require('../services/notificationService');
notificationService.onLeadAdded = async () => {};
notificationService.onLeadAllocated = async () => {};

const Lead = require('../models/Lead');
const LeadActivity = require('../models/LeadActivity');
const User = require('../models/User');
const leadsRouter = require('../routes/leads');
const dashboardRouter = require('../routes/dashboard');

const MARK = 'ZZTEST_VIEW_';
const PORT = 5601;
const mint = (u) => jwt.sign(
  { _id: u._id, role: u.role, name: u.name, state: u.state, industry: u.industry, district: u.district, reportingTo: u.reportingTo },
  process.env.JWT_SECRET, { expiresIn: '10m' });

(async () => {
  await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 8000 });

  const im = await User.findOne({ role: 'industry_manager', name: 'testim1' }).lean();
  const sm = await User.findOne({ role: 'state_manager', name: 'Kerala State Manager' }).lean();
  const uploader = await User.findOne({ role: 'founder' }).lean();
  console.log(`IM: ${im.name} (industry=${im.industry}, state=${im.state}) | SM: ${sm.name} (state=${sm.state})`);

  const app = express();
  app.use(express.json());
  app.set('io', { to: () => ({ emit: () => {} }) });
  app.use('/api/leads', leadsRouter);
  app.use('/api/dashboard', dashboardRouter);
  const srv = http.createServer(app).listen(PORT);
  const B = `http://127.0.0.1:${PORT}/api`;

  const imTok = mint(im), smTok = mint(sm), upTok = mint(uploader);
  const getIM = () => fetch(`${B}/dashboard/industry-manager`, { headers: { Authorization: `Bearer ${imTok}` } }).then(r => r.json());
  const getSM = () => fetch(`${B}/dashboard/state-manager`, { headers: { Authorization: `Bearer ${smTok}` } }).then(r => r.json());
  const smLeadCountForIM = (smData) => {
    const row = (smData.industryManagers || []).find(m => String(m._id) === String(im._id));
    return row ? row.leadsCount : '(IM not listed)';
  };

  // Baseline
  const imBefore = await getIM();
  const smBefore = await getSM();
  console.log(`\nBEFORE  | IM Overview totalLeads=${imBefore.stats?.totalLeads} hot=${imBefore.stats?.hotLeads} | SM sees IM leadsCount=${smLeadCountForIM(smBefore)}`);

  // Insert 3 tagged leads owned by the IM (1 hot)
  const phones = [];
  for (let n = 9998000001; phones.length < 3; n++) {
    if (!(await Lead.findOne({ phone: String(n) }).select('_id').lean())) phones.push(String(n));
  }
  const rows = [
    { name: `${MARK}A`, phone: phones[0], status: 'new', priority: 'hot',  ownerId: String(im._id) },
    { name: `${MARK}B`, phone: phones[1], status: 'rnr', priority: 'warm', ownerId: String(im._id) },
    { name: `${MARK}C`, phone: phones[2], status: 'followup', priority: 'cold', ownerId: String(im._id) },
  ];
  const post = await fetch(`${B}/leads/bulk`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${upTok}` }, body: JSON.stringify(rows) }).then(r => r.json());
  console.log('Inserted:', post.imported, 'leads');

  const imAfter = await getIM();
  const smAfter = await getSM();
  console.log(`AFTER   | IM Overview totalLeads=${imAfter.stats?.totalLeads} hot=${imAfter.stats?.hotLeads} | SM sees IM leadsCount=${smLeadCountForIM(smAfter)}`);

  const checks = [
    ['IM Overview totalLeads grew by 3', (imAfter.stats?.totalLeads || 0) - (imBefore.stats?.totalLeads || 0) === 3],
    ['IM Overview hot grew by 1',        (imAfter.stats?.hotLeads || 0) - (imBefore.stats?.hotLeads || 0) === 1],
    ['SM view of IM leadsCount grew by 3', Number(smLeadCountForIM(smAfter)) - Number(smLeadCountForIM(smBefore)) === 3],
  ];
  console.log('\nRESULTS:');
  let pass = true;
  for (const [l, ok] of checks) { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${l}`); if (!ok) pass = false; }

  const created = await Lead.find({ name: { $regex: `^${MARK}` } }).select('_id').lean();
  await LeadActivity.deleteMany({ lead: { $in: created.map(l => l._id) } });
  const del = await Lead.deleteMany({ name: { $regex: `^${MARK}` } });
  console.log(`\nCleanup: deleted ${del.deletedCount} test leads.`);

  srv.close();
  await mongoose.disconnect();
  console.log(pass ? '\nALL VIEW CHECKS PASSED ✅' : '\nSOME VIEW CHECKS FAILED ❌');
  process.exit(pass ? 0 : 1);
})().catch(e => { console.error('ERR:', e); process.exit(1); });
