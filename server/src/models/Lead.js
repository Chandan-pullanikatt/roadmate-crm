const mongoose = require('mongoose');

const leadSchema = new mongoose.Schema({
  name: { type: String, required: true },
  company: { type: String },
  phone: { type: String, required: true },
  email: { type: String },
  status: {
    type: String,
    enum: [
      'new','called','followup','rnr',
      'meeting_virtual','meeting_direct',
      'converted','blocking_amount_received','full_amount_received','agreement_signed',
      'lost','not_interested','escalated'
    ],
    default: 'new'
  },
  priority: { 
    type: String, 
    enum: ['hot','warm','cold'], 
    default: 'cold' 
  },
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  allocatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  state: { type: String },
  district: { type: String },
  country: { type: String },
  industry: { type: String },
  leadSource: { type: String },
  rnrCount: { type: Number, default: 0 },
  hasBeenEngaged: { type: Boolean, default: false }, // True if lead has ever moved to engaged status (called, followup, meeting, etc.)
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
    fileKey: String,
    size: Number,
    contentType: String,
    uploadedAt: { type: Date, default: Date.now } 
  }],
  meetingLink: { type: String },
  meetingAt: { type: Date },
  meetingInvitees: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  escalatedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  escalationNote: { type: String },
  expectedRevenue: { type: Number, default: 0 },
  subStatus: { type: String },
  remarks: { type: String },
  actualRevenue: { type: Number, default: 0 },
  revenueCategory: {
    type: String,
    enum: ['partnership', 'shop_subscription', 'delivery_subscription', 'distributor_subscription', 'manufacturer_subscription', 'other'],
    default: 'other'
  },
  regionType: { type: String, enum: ['Panchayat', 'Municipality', 'Corporation', ''], default: '' },
  region: { type: String },

  // Client-specified bulk upload fields
  leadHandling: { type: String },
  messagedStatus: { type: String },
  lastContactDate: { type: Date },
  partnershipCategory: { type: String },
  followUpNotes: { type: String },
  followUpCount: { type: Number, default: 0 },
  nextAction: { type: String },
  outcome: { type: String },
  blockingDate: { type: Date },
  fullAmountReceivedDate: { type: Date },
  reasonForLost: { type: String },
}, { timestamps: true });

// Performance Indexes
leadSchema.index({ phone: 1 }); // bulk upload de-dupes by phone on every row — must be indexed
leadSchema.index({ status: 1 });
leadSchema.index({ priority: 1 });
leadSchema.index({ owner: 1 });
leadSchema.index({ state: 1 });
leadSchema.index({ industry: 1 });
leadSchema.index({ createdAt: -1 });
leadSchema.index({ updatedAt: -1 });
leadSchema.index({ meetingAt: 1 });

module.exports = mongoose.model('Lead', leadSchema);
