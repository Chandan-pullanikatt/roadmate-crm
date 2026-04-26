const mongoose = require('mongoose');

const leadActivitySchema = new mongoose.Schema({
  lead: { type: mongoose.Schema.Types.ObjectId, ref: 'Lead', required: true },
  performedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  action: { 
    type: String, 
    enum: [
      'created','called','rnr','followup_set','meeting_scheduled',
      'meeting_done','converted','lost','not_interested',
      'escalated','reallocated','note_added','document_attached'
    ],
    required: true
  },
  note: { type: String },
  metadata: { type: mongoose.Schema.Types.Mixed },
}, { timestamps: true });

module.exports = mongoose.model('LeadActivity', leadActivitySchema);
