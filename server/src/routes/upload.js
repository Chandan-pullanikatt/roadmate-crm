const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/auth');
const { generatePresignedUpload, generatePresignedDownload, deleteObject } = require('../config/r2');

// Whitelist of allowed file types
const ALLOWED_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // XLSX
  'text/csv',
  'application/msword', // DOC
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document' // DOCX
];

/**
 * @route   POST /api/upload/presign
 * @desc    Generate a presigned URL for direct file upload to R2
 * @access  Private
 */
router.post('/presign', verifyToken, async (req, res) => {
  try {
    const { folder, fileName, contentType, entityId } = req.body;

    if (!folder || !fileName || !contentType) {
      return res.status(400).json({ message: 'Missing required upload parameters' });
    }

    if (!ALLOWED_TYPES.includes(contentType)) {
      return res.status(400).json({ message: 'File type not allowed' });
    }

    // Sanitize fileName and create a unique key
    const timestamp = Date.now();
    const sanitizedName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
    const key = `${folder}/${entityId || 'general'}/${timestamp}-${sanitizedName}`;

    const uploadUrl = await generatePresignedUpload(key, contentType);

    res.json({
      uploadUrl,
      fileKey: key,
      expiresIn: 900 // 15 minutes
    });
  } catch (error) {
    console.error('Presign Upload Error:', error);
    res.status(500).json({ message: 'Server error generating upload URL' });
  }
});

/**
 * @route   GET /api/upload/url/:key(*)
 * @desc    Generate a presigned URL for secure file download/viewing
 * @access  Private
 */
router.get('/url', verifyToken, async (req, res) => {
  try {
    const key = req.query.key;
    
    if (!key) {
      return res.status(400).json({ message: 'File key is required' });
    }

    const downloadUrl = await generatePresignedDownload(key);

    res.json({
      downloadUrl,
      expiresIn: 3600 // 1 hour
    });
  } catch (error) {
    console.error('Presign Download Error:', error);
    res.status(500).json({ message: 'Server error generating download URL' });
  }
});

/**
 * @route   DELETE /api/upload/:key(*)
 * @desc    Delete a file from R2
 * @access  Private (Managers/Founder only)
 */
router.delete('/', verifyToken, async (req, res) => {
  try {
    const key = req.query.key;

    if (req.user.role === 'executive') {
      return res.status(403).json({ message: 'Not authorized to delete files' });
    }

    await deleteObject(key);
    res.json({ message: 'File deleted successfully' });
  } catch (error) {
    console.error('Delete Object Error:', error);
    res.status(500).json({ message: 'Server error deleting file' });
  }
});

module.exports = router;
