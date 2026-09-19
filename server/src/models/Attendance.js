const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  date: { type: Date, required: true },
  workStartedAt: { type: Date },
  workCompletedAt: { type: Date },
  totalLeads: { type: Number, default: 0 },
  // The day's work, fixed at Start Work: leads due that day plus pending ones
  // carried over. Completion % is how many of these were worked.
  plannedLeads: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Lead' }],
  completedLeads: { type: Number, default: 0 },
  completionPct: { type: Number, default: 0 },
  status: { 
    type: String, 
    enum: ['present','half_day','absent','leave','holiday','optional_holiday'], 
    default: 'absent' 
  },
  salaryDeduction: { type: Number, default: 0 },
  // Late Coming / Early Exit marks; minutes are measured from the start / end time.
  isLateLogin: { type: Boolean, default: false },
  lateLoginMinutes: { type: Number, default: 0 },
  isEarlyExit: { type: Boolean, default: false },
  earlyExitMinutes: { type: Number, default: 0 },
  note: { type: String },
  isWFH: { type: Boolean, default: false },
  location: { type: String },
  wfhReason: { type: String },
  wfhDescription: { type: String },
}, { timestamps: true });

// Compound index for unique attendance per user per day
attendanceSchema.index({ user: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('Attendance', attendanceSchema);
