/**
 * READ-ONLY. Proves the hierarchy-scoping fix: for each key user, prints the OLD
 * field-based visible-lead count vs the NEW reporting-tree count. No writes.
 */
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const Lead = require('../models/Lead');
const { getScopeOwnerIds, applyLeadScope } = require('../utils/hierarchy');

const oldCount = async (u) => {
  if (u.role === 'founder') return Lead.countDocuments({});
  if (u.role === 'executive') return Lead.countDocuments({ owner: u._id });
  if (u.role === 'state_manager') return Lead.countDocuments({ state: u.state });
  if (u.role === 'industry_manager') return Lead.countDocuments({ industry: u.industry });
  return 0;
};

const newCount = async (u) => {
  const scopeIds = await getScopeOwnerIds(u);
  const q = {};
  applyLeadScope(q, scopeIds, u._id, undefined);
  return Lead.countDocuments(q);
};

(async () => {
  await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 8000 });

  const pickNames = ['Suganth', 'Saliha', 'Rejina', 'Nayana'];
  const ims = await User.find({ name: { $in: pickNames } }).lean();
  const sm = await User.findOne({ name: 'Kerala', role: 'state_manager' }).lean();
  const exec = await User.findOne({ role: 'executive' }).lean();
  const founder = await User.findOne({ role: 'founder' }).lean();

  const rows = [...ims, sm, exec, founder].filter(Boolean);
  console.log('user                | role             | OLD(field) | NEW(tree)');
  console.log('--------------------|------------------|------------|----------');
  for (const u of rows) {
    const [o, n] = await Promise.all([oldCount(u), newCount(u)]);
    console.log(`${String(u.name).padEnd(19)} | ${String(u.role).padEnd(16)} | ${String(o).padStart(10)} | ${String(n).padStart(8)}`);
  }

  // Cross-peer proof: does Suganth's NEW scope include any lead OWNED by Saliha?
  const suganth = ims.find(x => x.name === 'Suganth');
  const saliha = ims.find(x => x.name === 'Saliha');
  if (suganth && saliha) {
    const scope = await getScopeOwnerIds(suganth);
    const q = {}; applyLeadScope(q, scope, suganth._id, undefined);
    const leaks = await Lead.countDocuments({ ...q, owner: saliha._id });
    console.log(`\nCross-peer check: leads owned by Saliha that are visible to Suganth (NEW): ${leaks}  ${leaks === 0 ? '✅ isolated' : '❌ STILL LEAKING'}`);
  }
  process.exit(0);
})().catch(e => { console.error(e.message); process.exit(1); });
