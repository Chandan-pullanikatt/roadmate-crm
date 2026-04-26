const mongoose = require('mongoose');

const leavePolicySchema = new mongoose.Schema({
  state: { type: String, required: true },
  year: { type: Number, required: true },
  holidays: [{ 
    date: { type: Date, required: true }, 
    name: { type: String, required: true }, 
    type: { type: String, enum: ['national','public','festive','optional'], required: true } 
  }],
  paidLeavesPerMonth: { type: Number, default: 1 },
  optionalHolidayQuota: { type: Number, default: 0.5 },
  ramadanStart: { type: Date },
  ramadanEnd: { type: Date },
  ramadanWorkStart: { type: String, default: '09:00' },
  normalWorkStart: { type: String, default: '09:30' },
}, { timestamps: true });

module.exports = mongoose.model('LeavePolicy', leavePolicySchema);
