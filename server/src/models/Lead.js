const mongoose = require('mongoose');

const leadSchema = new mongoose.Schema({
  // Human-readable ID: taken from the sheet on bulk upload, otherwise generated
  // from the lead source (see constants/leadSources.js).
  leadId: { type: String, trim: true, required: true },
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
  // Best-ranked status ever reached; the displayed status never falls below it
  // (see constants/leadStatusRank.js).
  peakStatus: { type: String, default: null },
  // RNRs logged by the current owner. Reset when the lead is handed to a peer.
  rnrCount: { type: Number, default: 0 },
  // Set when an unengaged lead is handed to a peer after RNR_LIMIT RNRs. A second
  // run of RNR_LIMIT RNRs after that marks the lead Lost.
  rnrTransferredAt: { type: Date, default: null },
  rnrTransferredFrom: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  hasBeenEngaged: { type: Boolean, default: false }, // True if lead has ever moved to engaged status (called, followup, meeting, etc.)
  nextActionAt: { type: Date },
  followUpDate: { type: Date },
  followUpTime: { type: String },
  // A fixed follow-up keeps its date: leave and carry-forward never move it.
  followUpFixed: { type: Boolean, default: false },
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
  meetingDoneAt: { type: Date }, // last time a meeting was recorded as conducted
  escalatedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  escalationNote: { type: String },
  // Escalation approval (client rule, Sep 2026). Escalating no longer hands the
  // lead over on its own: it stays with the owner who escalated it until the
  // manager it was escalated to approves it, and only then does the owner move
  // up. A rejection sends it back down with a note.
  //   pending  -> waiting on escalatedTo's decision
  //   approved -> owner is now escalatedTo
  //   rejected -> owner never changed; escalatedFrom keeps working it
  // Leads escalated before this existed carry no value at all, which the
  // pending-escalation filter reads as pending (see utils/escalation.js).
  escalationStatus: { type: String, enum: ['pending', 'approved', 'rejected'], default: null },
  escalatedFrom: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  escalatedAt: { type: Date },
  // The stage the lead was at before it was escalated. Restored on either
  // decision, so an approved or rejected lead goes back to something workable
  // instead of sitting on 'escalated' forever.
  statusBeforeEscalation: { type: String, default: null },
  escalationDecisionBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  escalationDecisionAt: { type: Date },
  escalationDecisionNote: { type: String },
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
  // Money collected at each payment stage (₹). Re-recording a stage adds to it;
  // actualRevenue is kept as the sum of the two.
  blockingAmount: { type: Number, default: 0 },
  fullAmountReceivedDate: { type: Date },
  fullAmount: { type: Number, default: 0 },
  agreementSignedAt: { type: Date },
  reasonForLost: { type: String },
}, { timestamps: true });

// Performance Indexes
leadSchema.index({ phone: 1 }); // bulk upload de-dupes by phone on every row — must be indexed
leadSchema.index({ leadId: 1 }, { unique: true });
leadSchema.index({ status: 1 });
leadSchema.index({ priority: 1 });
leadSchema.index({ owner: 1 });
leadSchema.index({ state: 1 });
leadSchema.index({ industry: 1 });
leadSchema.index({ createdAt: -1 });
leadSchema.index({ updatedAt: -1 });
leadSchema.index({ meetingAt: 1 });
// The approvals page queries every pending escalation aimed at one manager.
leadSchema.index({ escalatedTo: 1, escalationStatus: 1 });

module.exports = mongoose.model('Lead', leadSchema);
