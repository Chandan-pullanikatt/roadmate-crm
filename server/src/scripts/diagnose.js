/**
 * READ-ONLY diagnostic. Confirms lead scoping/field issues reported by the client.
 * Prints aggregate distributions only — no PII dumps, no writes.
 * Run: node src/scripts/diagnose.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const Lead = require('../models/Lead');
const User = require('../models/User');

const dist = (arr, key) => {
  const m = {};
  for (const d of arr) {
    const v = d[key] === undefined ? '<undefined>' : d[key] === null ? '<null>' : d[key] === '' ? '<empty>' : String(d[key]);
    m[v] = (m[v] || 0) + 1;
  }
  return m;
};

(async () => {
  await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 8000 });
  console.log('Host:', mongoose.connection.host, '| DB:', mongoose.connection.name);

  const totalLeads = await Lead.countDocuments({});
  console.log('\nTOTAL LEADS IN DB:', totalLeads);

  // Industry managers
  const ims = await User.find({ role: 'industry_manager' }).select('_id name industry state').lean();
  console.log('\nINDUSTRY MANAGERS:');
  for (const im of ims) {
    console.log(`  - ${im.name} | industry=${JSON.stringify(im.industry)} state=${JSON.stringify(im.state)} id=${im._id}`);
  }

  // Look at the IM with the most owned leads (likely "Nayana")
  for (const im of ims) {
    const owned = await Lead.find({ owner: im._id }).select('industry state status priority').lean();
    if (owned.length === 0) continue;
    console.log(`\n=== Leads OWNED by ${im.name} (owner=${im._id}) : ${owned.length} ===`);
    console.log('  industry field:', dist(owned, 'industry'));
    console.log('  state field   :', dist(owned, 'state'));
    console.log('  status        :', dist(owned, 'status'));
    console.log('  priority      :', dist(owned, 'priority'));

    // How many of these match the IM's own industry scope (the filter used by dashboards)?
    const matchIndustry = owned.filter(l => l.industry === im.industry).length;
    console.log(`  -> match IM.industry (${JSON.stringify(im.industry)}): ${matchIndustry} / ${owned.length}`);

    // What an industry-scoped query would return (what Overview/Performance see)
    const industryScoped = await Lead.countDocuments({ industry: im.industry });
    console.log(`  -> Lead.countDocuments({industry: IM.industry}) = ${industryScoped}`);
  }

  await mongoose.disconnect();
  console.log('\nDone.');
  process.exit(0);
})().catch(e => { console.error('DIAG ERROR:', e.message); process.exit(1); });
