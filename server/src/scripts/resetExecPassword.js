require('dotenv').config();
const connectDB = require('../config/db');
const User = require('../models/User');

const resetExecPassword = async () => {
  try {
    await connectDB();

    const exec = await User.findOne({ email: 'exec@roadmate.com' });

    if (!exec) {
      console.log('Executive user not found. Creating fresh...');
      const indMgr = await User.findOne({ email: 'indmgr@roadmate.com' });
      await User.create({
        name: 'Hospitality Executive',
        email: 'exec@roadmate.com',
        password: 'Test@12345',
        role: 'executive',
        state: 'Kerala',
        industry: 'Hospitality',
        reportingTo: indMgr?._id || null,
      });
      console.log('Executive user created: exec@roadmate.com / Test@12345');
    } else {
      exec.password = 'Test@12345'; // pre-save hook will re-hash it
      await exec.save();
      console.log('Executive password reset to Test@12345');
    }

    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
};

resetExecPassword();
