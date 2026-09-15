/**
 * Reset one user's password to a known value, by email.
 *
 *   node src/scripts/resetUserPassword.js <email> <newPassword>
 *
 * Passwords are bcrypt-hashed and cannot be read back, so resetting is the only
 * way to get into an existing account. This changes a real person's login —
 * whoever owns the account is locked out until you give them the new password.
 *
 * The User pre-save hook re-hashes on save, so the plain value is assigned here
 * deliberately and never stored as written.
 */
require('dotenv').config();
const connectDB = require('../config/db');
const User = require('../models/User');

const run = async () => {
  const [email, newPassword] = process.argv.slice(2);

  if (!email || !newPassword) {
    console.error('Usage: node src/scripts/resetUserPassword.js <email> <newPassword>');
    process.exit(1);
  }
  if (newPassword.length < 8) {
    console.error('Choose a password of at least 8 characters.');
    process.exit(1);
  }

  await connectDB();

  const user = await User.findOne({ email: email.toLowerCase().trim() });
  if (!user) {
    console.error(`No user found with email: ${email}`);
    process.exit(1);
  }

  user.password = newPassword; // pre-save hook hashes it
  await user.save();

  console.log(`Password reset for ${user.name} (${user.role}) — ${user.email}`);
  console.log('Tell the account owner, and ask them to change it after logging in.');
  process.exit(0);
};

run().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
