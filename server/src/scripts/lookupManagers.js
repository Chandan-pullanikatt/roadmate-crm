/**
 * READ-ONLY lookup. Prints the two managers' account fields + their reporting subtree.
 * Confirms whether lead visibility overlap is caused by a shared industry/state value.
 * No writes. Safe against live DB.
 */
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');

const NAMES = /saleeh|saliha|sugandh/i;

(async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 8000 });

    const managers = await User.find({ name: { $regex: NAMES } })
      .select('name email role state industry district reportingTo isActive')
      .lean();

    if (!managers.length) {
      console.log('No users matched. Listing all industry_managers instead:');
      const ims = await User.find({ role: 'industry_manager' })
        .select('name email role state industry district reportingTo').lean();
      ims.forEach(m => console.log(`  ${m.name} | ${m.email} | ${m.industry} | ${m.state} | reportsTo=${m.reportingTo}`));
      return process.exit(0);
    }

    for (const m of managers) {
      const boss = m.reportingTo ? await User.findById(m.reportingTo).select('name role').lean() : null;
      const team = await User.find({ reportingTo: m._id }).select('name role district').lean();
      console.log('\n============================');
      console.log(`Name      : ${m.name}`);
      console.log(`Email     : ${m.email}`);
      console.log(`Role      : ${m.role}`);
      console.log(`Industry  : ${m.industry}`);
      console.log(`State     : ${m.state}`);
      console.log(`District  : ${m.district || '-'}`);
      console.log(`Active    : ${m.isActive !== false}`);
      console.log(`Reports to: ${boss ? `${boss.name} (${boss.role})` : 'nobody'}`);
      console.log(`Team (${team.length}): ${team.map(t => `${t.name}[${t.role}]`).join(', ') || 'none'}`);
    }
    console.log('\n(Passwords are bcrypt-hashed and cannot be printed. Use resetExecPassword-style reset if login is needed.)');
    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
})();
