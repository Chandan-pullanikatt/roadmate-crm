const mongoose = require('mongoose');

const holidaySchema = new mongoose.Schema({
  name: { type: String, required: true },
  date: { type: Date, required: true },
  state: { type: String }, // Optional: State specific holidays
  type: { 
    type: String, 
    enum: ['public', 'optional', 'observance'], 
    default: 'public' 
  },
  isOptional: { type: Boolean, default: false }
}, { timestamps: true });

module.exports = mongoose.model('Holiday', holidaySchema);
