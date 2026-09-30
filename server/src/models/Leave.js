const mongoose = require('mongoose');

const leaveSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  applicantRole: { type: String, enum: ['founder','state_manager','industry_manager','executive'], default: null },
  type: {
    type: String,
    enum: ['paid','unpaid','optional_holiday','sick'],
    required: true
  },
  fromDate: { type: Date, required: true },
  toDate: { type: Date, required: true },
  days: { type: Number, required: true },
  // A half-day leave covers one session of a single day (days = 0.5). The
  // other half is still a working day: the queue stands and attendance is
  // scored on it -- see attendanceService.completeWork.
  isHalfDay: { type: Boolean, default: false },
  halfDaySession: { type: String, enum: ['first_half','second_half', null], default: null },
  reason: { type: String, required: true },
  status: { 
    type: String, 
    enum: ['pending','approved','rejected'], 
    default: 'pending' 
  },
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  approvalNote: { type: String },
  requestedAt: { type: Date, default: Date.now },
}, { timestamps: true });

module.exports = mongoose.model('Leave', leaveSchema);
