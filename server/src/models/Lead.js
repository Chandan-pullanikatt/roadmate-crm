const mongoose = require('mongoose');

const leadSchema = new mongoose.Schema({
  name: { type: String, required: true },
  company: { type: String },
  phone: { type: String, required: true },
  email: { type: String },
  status: { 
    type: String, 
    enum: ['new','called','followup','rnr','meeting_virtual','meeting_direct','converted','lost','not_interested'], 
    default: 'new' 
  },
  priority: { 
    type: String, 
    enum: ['hot','warm','cold'], 
    default: 'cold' 
  },
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  allocatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  state: { type: String },
  district: { type: String },
  country: { type: String },
  industry: { type: String },
  leadSource: { type: String },
  rnrCount: { type: Number, default: 0 },
  nextActionAt: { type: Date },
  followUpDate: { type: Date },
  followUpTime: { type: String },
  lastCallAt: { type: Date },
  convertedAt: { type: Date },
  lostAt: { type: Date },
  notes: { type: String },
  feedback: [{ 
    note: String, 
    createdAt: { type: Date, default: Date.now }, 
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' } 
  }],
  strategyNote: { type: String },
  documents: [{ 
    name: String, 
    url: String, 
    uploadedAt: { type: Date, default: Date.now } 
  }],
  meetingLink: { type: String },
  meetingAt: { type: Date },
  meetingInvitees: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  escalatedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  escalationNote: { type: String },
  expectedRevenue: { type: Number, default: 0 },
}, { timestamps: true });

module.exports = mongoose.model('Lead', leadSchema);
