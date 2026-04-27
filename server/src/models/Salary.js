const mongoose = require('mongoose');

const salarySchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  month: { type: Number, required: true }, // 1-12
  year: { type: Number, required: true },
  baseSalary: { type: Number, required: true },
  workingDays: { type: Number, required: true },
  presentDays: { type: Number, default: 0 },
  halfDays: { type: Number, default: 0 },
  leaveDays: { type: Number, default: 0 },
  attendanceStats: {
    totalDays: Number,
    present: Number,
    halfDay: Number,
    absent: Number,
    leave: Number,
    avgCompletionPct: Number
  },
  grossSalary: { type: Number },
  incentives: { type: Number, default: 0 },
  incentiveNote: { type: String },
  deductions: { type: Number, default: 0 },
  netSalary: { type: Number },
  status: { type: String, enum: ['draft', 'paid'], default: 'draft' },
  generatedAt: { type: Date, default: Date.now }
}, { timestamps: true });

// Compound index for unique salary record per user per month
salarySchema.index({ user: 1, month: 1, year: 1 }, { unique: true });

module.exports = mongoose.model('Salary', salarySchema);
