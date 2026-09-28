require('dotenv').config({ path: __dirname + '/../.env' });
const mongoose = require('mongoose');

(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  const User = require('../src/models/User');
  const { getDayWorkPct, getWorkPct } = require('../src/services/workPercentService');
  const { getDateRange } = require('../src/utils/dateRange');

  const sneha = await User.findOne({ name: /sneha/i }).select('_id name');
  const team = await User.find({ reportingTo: sneha._id }).select('_id name');
  const people = [sneha, ...team];

  console.log('--- TODAY (leads completed in queue / queue size) ---');
  for (const u of people) {
    const d = await getDayWorkPct(u._id);
    console.log(`${u.name.padEnd(20)} ${d.completedCount}/${d.queueCount} = ${Math.round(d.workPct)}%`);
  }

  for (const [label, period, value] of [['WEEK', 'week', null], ['MONTH', 'month', 'September'], ['YEAR', 'year', '2026']]) {
    const { start, end } = getDateRange(period, value);
    const m = await getWorkPct(people.map(u => u._id), start, end);
    console.log(`--- ${label} (average over days worked) ---`);
    for (const u of people) {
      const r = m.get(String(u._id));
      console.log(`${u.name.padEnd(20)} ${Math.round(r.workPct)}%  over ${r.days} day(s) worked`);
    }
  }
  process.exit(0);
})().catch(e => { console.error('ERR', e.stack); process.exit(1); });
