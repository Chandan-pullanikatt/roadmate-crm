const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  date: { type: Date, required: true },
  workStartedAt: { type: Date },
  workCompletedAt: { type: Date },
  totalLeads: { type: Number, default: 0 },
  completedLeads: { type: Number, default: 0 },
  completionPct: { type: Number, default: 0 },
  status: { 
    type: String, 
    enum: ['present','half_day','absent','leave','holiday','optional_holiday'], 
    default: 'absent' 
  },
  salaryDeduction: { type: Number, default: 0 },
  note: { type: String },
}, { timestamps: true });

// Compound index for unique attendance per user per day
attendanceSchema.index({ user: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('Attendance', attendanceSchema);
