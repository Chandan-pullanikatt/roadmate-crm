const mongoose = require('mongoose');

/**
 * A document published to a role's Documents tab (formerly "SOP").
 *
 * Originally one row per role, enforced by a unique index — uploading replaced
 * whatever was there. The Documents tab now holds many files per role, so the
 * uniqueness is gone. The old index still exists on any database created before
 * this change and MUST be dropped, otherwise the second upload for a role fails
 * with E11000: run scripts/dropSopRoleIndex.js once per environment.
 */
const sopSchema = new mongoose.Schema({
  role: {
    type: String,
    enum: ['industry_manager', 'executive'],
    required: true,
    index: true,
  },
  title:     { type: String, trim: true },
  fileKey:   { type: String, required: true },
  fileName:  { type: String, required: true },
  fileType:  { type: String, enum: ['pdf', 'docx', 'doc', 'txt'], required: true },
  uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

sopSchema.index({ role: 1, createdAt: -1 });

module.exports = mongoose.model('Sop', sopSchema);
