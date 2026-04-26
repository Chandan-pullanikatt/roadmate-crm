const mongoose = require('mongoose');

const salarySchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  month: { type: Number, required: true }, // 1-12
  year: { type: Number, required: true },
  basicSalary: { type: Number, required: true },
  workingDays: { type: Number, required: true },
  presentDays: { type: Number, required: true },
  halfDays: { type: Number, required: true },
  leaveDays: { type: Number, required: true },
  grossSalary: { type: Number },
  incentives: { type: Number, default: 0 },
  incentiveNote: { type: String },
  deductions: { type: Number, default: 0 },
  netSalary: { type: Number },
  status: { type: String, enum: ['draft','finalized'], default: 'draft' },
}, { timestamps: true });

// Compound index for unique salary record per user per month
salarySchema.index({ user: 1, month: 1, year: 1 }, { unique: true });

module.exports = mongoose.model('Salary', salarySchema);
