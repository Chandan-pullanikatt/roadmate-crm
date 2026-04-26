require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const User = require('../models/User');

const seedUsers = async () => {
  try {
    await connectDB();

    // Clear existing users
    await User.deleteMany({});
    console.log('Cleared existing users');

    // Create Founder
    const founder = await User.create({
      name: 'Founder Account',
      email: 'founder@roadmate.com',
      password: 'Test@1234',
      role: 'founder',
    });
    console.log('Founder created');

    // Create State Manager (Kerala)
    const stateMgr = await User.create({
      name: 'Kerala State Manager',
      email: 'statemgr@roadmate.com',
      password: 'Test@1234',
      role: 'state_manager',
      state: 'Kerala',
      reportingTo: founder._id,
    });
    console.log('State Manager created');

    // Create Industry Manager (Hospitality)
    const indMgr = await User.create({
      name: 'Hospitality Manager',
      email: 'indmgr@roadmate.com',
      password: 'Test@1234',
      role: 'industry_manager',
      state: 'Kerala',
      industry: 'Hospitality',
      reportingTo: stateMgr._id,
    });
    console.log('Industry Manager created');

    // Create Executive
    const exec = await User.create({
      name: 'Hospitality Executive',
      email: 'exec@roadmate.com',
      password: 'Test@1234',
      role: 'executive',
      state: 'Kerala',
      industry: 'Hospitality',
      reportingTo: indMgr._id,
    });
    console.log('Executive created');

    console.log('Seeding completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error(`Error seeding users: ${error.message}`);
    process.exit(1);
  }
};

seedUsers();
