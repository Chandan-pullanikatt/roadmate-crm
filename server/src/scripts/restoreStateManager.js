/**
 * Restores the seeded Kerala State Manager (statemgr@roadmate.com) that was
 * hard-deleted via DELETE /api/users/:id.
 *
 * The account is recreated with its ORIGINAL _id (69eee5fb9fd757d7269e61d0) so
 * that the leads / attendance / leave / salary / target / activity documents
 * still pointing at that id reattach automatically.
 *
 * Also restores indmgr@roadmate.com -> state manager reporting link, which the
 * delete route unset (users.js: User.updateMany({reportingTo: id}, $unset)).
 */
require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const User = require('../models/User');

const SM_ID      = '69eee5fb9fd757d7269e61d0';
const FOUNDER_ID = '69eee5fa9fd757d7269e61cf';

const restoreStateManager = async () => {
  try {
    await connectDB();

    const existing = await User.findOne({
      $or: [{ _id: SM_ID }, { email: 'statemgr@roadmate.com' }],
    });

    if (existing) {
      console.log(`Already present: ${existing.email} (_id=${existing._id}). Resetting password only.`);
      existing.password = 'Test@1234';
      existing.isActive = true;
      await existing.save();
    } else {
      const founder = await User.findById(FOUNDER_ID);
      const sm = new User({
        _id: new mongoose.Types.ObjectId(SM_ID),
        name: 'Kerala State Manager',
        email: 'statemgr@roadmate.com',
        password: 'Test@1234', // hashed by the pre-save hook
        role: 'state_manager',
        state: 'Kerala',
        reportingTo: founder ? founder._id : null,
        isActive: true,
      });
      await sm.save();
      console.log(`Restored statemgr@roadmate.com with original _id=${sm._id}`);
    }

    // Re-link the industry manager that the delete orphaned
    const im = await User.findOne({ email: 'indmgr@roadmate.com' });
    if (im && !im.reportingTo) {
      im.reportingTo = new mongoose.Types.ObjectId(SM_ID);
      await im.save();
      console.log('Re-linked indmgr@roadmate.com -> statemgr@roadmate.com');
    } else if (im) {
      console.log(`indmgr@roadmate.com already reports to ${im.reportingTo} — left as is.`);
    }

    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
};

restoreStateManager();
