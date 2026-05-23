const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/auth');
const { generatePresignedDownload } = require('../config/r2');
const Sop = require('../models/Sop');

router.use(verifyToken);

/**
 * POST /api/sop
 * Founder uploads (or replaces) an SOP for a given role.
 * Body: { role, fileKey, fileName, fileType }
 */
router.post('/', async (req, res) => {
  try {
    if (req.user.role !== 'founder') {
      return res.status(403).json({ message: 'Only founders can upload SOPs' });
    }

    const { role, fileKey, fileName, fileType } = req.body;

    if (!role || !fileKey || !fileName || !fileType) {
      return res.status(400).json({ message: 'role, fileKey, fileName and fileType are required' });
    }

    if (!['industry_manager', 'executive'].includes(role)) {
      return res.status(400).json({ message: 'role must be industry_manager or executive' });
    }

    const allowed = ['pdf', 'docx', 'doc', 'txt'];
    if (!allowed.includes(fileType.toLowerCase())) {
      return res.status(400).json({ message: 'fileType must be pdf, docx, doc or txt' });
    }

    // Upsert — one document per role
    const sop = await Sop.findOneAndUpdate(
      { role },
      {
        fileKey,
        fileName,
        fileType: fileType.toLowerCase(),
        uploadedBy: req.user._id,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    res.json(sop);
  } catch (err) {
    console.error('SOP upload error:', err);
    res.status(500).json({ message: err.message });
  }
});

/**
 * GET /api/sop?role=industry_manager|executive
 * Returns the SOP metadata + a short-lived presigned download URL.
 * Accessible by all authenticated users.
 */
router.get('/', async (req, res) => {
  try {
    const { role } = req.query;

    if (!role || !['industry_manager', 'executive'].includes(role)) {
      return res.status(400).json({ message: 'Valid role query param required' });
    }

    const sop = await Sop.findOne({ role });
    if (!sop) {
      return res.status(404).json({ message: 'No SOP uploaded yet for this role' });
    }

    // Generate a 1-hour presigned URL for viewing
    const viewUrl = await generatePresignedDownload(sop.fileKey, 3600, 'inline');

    res.json({
      _id:        sop._id,
      role:       sop.role,
      fileName:   sop.fileName,
      fileType:   sop.fileType,
      viewUrl,
      updatedAt:  sop.updatedAt,
    });
  } catch (err) {
    console.error('SOP fetch error:', err);
    res.status(500).json({ message: err.message });
  }
});

/**
 * GET /api/sop/all
 * Founder-only: returns both SOPs (no presigned URL, for the upload management page).
 */
router.get('/all', async (req, res) => {
  try {
    if (req.user.role !== 'founder') {
      return res.status(403).json({ message: 'Forbidden' });
    }
    const sops = await Sop.find().populate('uploadedBy', 'name');
    res.json(sops);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
