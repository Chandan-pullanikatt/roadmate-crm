require('dotenv').config();
const connectDB = require('../config/db');
const User = require('../models/User');

const resetFounderPassword = async () => {
  try {
    await connectDB();

    const founder = await User.findOne({ email: 'founder@roadmate.com' });

    if (!founder) {
      console.log('Founder user not found. Creating fresh...');
      await User.create({
        name: 'Founder Account',
        email: 'founder@roadmate.com',
        password: 'Test@1234',
        role: 'founder',
      });
      console.log('Founder user created: founder@roadmate.com / Test@1234');
    } else {
      founder.password = 'Test@1234'; // pre-save hook will re-hash it
      await founder.save();
      console.log('Founder password reset to Test@1234');
    }

    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
};

resetFounderPassword();
