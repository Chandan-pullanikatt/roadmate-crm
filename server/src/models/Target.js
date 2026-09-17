const mongoose = require('mongoose');

const targetSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  period: { type: String, enum: ['monthly', 'weekly'], required: true, default: 'monthly' },
  // 'YYYY-MM' for a monthly target; the Monday the week starts on ('YYYY-MM-DD') for a weekly one
  periodKey: { type: String, required: true },
  directMeetings: { type: Number, default: 0 },
  blocking: { type: Number, default: 0 },
  conversions: { type: Number, default: 0 },
  assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

targetSchema.index({ user: 1, period: 1, periodKey: 1 }, { unique: true });

module.exports = mongoose.model('Target', targetSchema);
