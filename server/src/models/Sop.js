const mongoose = require('mongoose');

const sopSchema = new mongoose.Schema({
  role: {
    type: String,
    enum: ['industry_manager', 'executive'],
    required: true,
    unique: true,   // one SOP per role — upload replaces
  },
  fileKey:   { type: String, required: true },
  fileName:  { type: String, required: true },
  fileType:  { type: String, enum: ['pdf', 'docx', 'doc', 'txt'], required: true },
  uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

module.exports = mongoose.model('Sop', sopSchema);
