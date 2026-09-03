const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/auth');
const { generatePresignedDownload } = require('../config/r2');
const Sop = require('../models/Sop');
const teamService = require('../services/teamService');
const notificationService = require('../services/notificationService');

router.use(verifyToken);

const VALID_ROLES = ['industry_manager', 'executive'];
const ALLOWED_TYPES = ['pdf', 'docx', 'doc', 'txt'];

/**
 * POST /api/sop
 * Founder publishes a document to a role's Documents tab, and everyone in that
 * role is notified. Uploading no longer replaces what is already there — the
 * tab holds many documents.
 * Body: { role, fileKey, fileName, fileType, title? }
 */
router.post('/', async (req, res) => {
  try {
    if (req.user.role !== 'founder') {
      return res.status(403).json({ message: 'Only founders can upload documents' });
    }

    const { role, fileKey, fileName, fileType, title } = req.body;

    if (!role || !fileKey || !fileName || !fileType) {
      return res.status(400).json({ message: 'role, fileKey, fileName and fileType are required' });
    }
    if (!VALID_ROLES.includes(role)) {
      return res.status(400).json({ message: 'role must be industry_manager or executive' });
    }
    if (!ALLOWED_TYPES.includes(String(fileType).toLowerCase())) {
      return res.status(400).json({ message: 'fileType must be pdf, docx, doc or txt' });
    }

    const doc = await Sop.create({
      role,
      title: (title || '').trim() || fileName,
      fileKey,
      fileName,
      fileType: String(fileType).toLowerCase(),
      uploadedBy: req.user._id,
    });

    // Only the role the document is for hears about it.
    const recipientIds = await teamService.getTeamRecipientIds(req.user, { role });
    await notificationService.onDocumentUploaded({
      userIds: recipientIds,
      uploaderName: req.user.name,
      uploaderRole: req.user.role,
      documentTitle: doc.title,
      documentId: doc._id,
      io: req.app.get('io'),
    });

    res.status(201).json({ ...doc.toObject(), notified: recipientIds.length });
  } catch (err) {
    console.error('Document upload error:', err);
    res.status(500).json({ message: err.message });
  }
});

/**
 * GET /api/sop?role=industry_manager|executive
 * Every document published for that role, newest first, each with a
 * short-lived presigned view URL. Accessible to all authenticated users.
 */
router.get('/', async (req, res) => {
  try {
    const { role } = req.query;
    if (!role || !VALID_ROLES.includes(role)) {
      return res.status(400).json({ message: 'Valid role query param required' });
    }

    const docs = await Sop.find({ role })
      .sort({ createdAt: -1 })
      .populate('uploadedBy', 'name role');

    const documents = await Promise.all(docs.map(async (doc) => ({
      _id:        doc._id,
      role:       doc.role,
      title:      doc.title || doc.fileName,
      fileName:   doc.fileName,
      fileType:   doc.fileType,
      uploadedBy: doc.uploadedBy?.name || 'Founder',
      viewUrl:    await generatePresignedDownload(doc.fileKey, 3600, 'inline'),
      createdAt:  doc.createdAt,
      updatedAt:  doc.updatedAt,
    })));

    res.json({ documents });
  } catch (err) {
    console.error('Document fetch error:', err);
    res.status(500).json({ message: err.message });
  }
});

/**
 * GET /api/sop/all
 * Founder-only: every document across roles, for the management page.
 */
router.get('/all', async (req, res) => {
  try {
    if (req.user.role !== 'founder') {
      return res.status(403).json({ message: 'Forbidden' });
    }
    const sops = await Sop.find().sort({ createdAt: -1 }).populate('uploadedBy', 'name');
    res.json(sops);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/**
 * DELETE /api/sop/:id
 * Founder-only. Removes the record; the file itself is left in storage so a
 * mistaken delete does not destroy the only copy.
 */
router.delete('/:id', async (req, res) => {
  try {
    if (req.user.role !== 'founder') {
      return res.status(403).json({ message: 'Only founders can delete documents' });
    }
    const deleted = await Sop.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: 'Document not found' });
    res.json({ message: 'Document removed' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
