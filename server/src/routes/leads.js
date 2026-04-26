const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/auth');
const leadService = require('../services/leadService');
const Lead = require('../models/Lead');
const LeadActivity = require('../models/LeadActivity');

// Protect all routes
router.use(verifyToken);

/**
 * GET /api/leads/queue - Executive lead queue
 * MUST BE BEFORE /:id
 */
router.get('/queue', async (req, res) => {
  try {
    if (req.user.role !== 'executive') {
      return res.status(403).json({ message: 'Forbidden: Executive only' });
    }
    const queue = await leadService.getQueue(req.user._id);
    res.json(queue);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/**
 * GET /api/leads/suggested-dates - Next 4 working days
 * MUST BE BEFORE /:id
 */
router.get('/suggested-dates', async (req, res) => {
  try {
    const dates = await leadService.getSuggestedDates(req.user.state || 'default');
    res.json(dates);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/**
 * GET /api/leads - List leads with filtering and scoping
 */
router.get('/', async (req, res) => {
  try {
    const { status, priority, owner, state, industry, page = 1, limit = 10 } = req.query;
    const query = {};

    // Scoping based on role
    if (req.user.role === 'executive') {
      query.owner = req.user._id;
    } else if (req.user.role === 'state_manager') {
      query.state = req.user.state;
    } else if (req.user.role === 'industry_manager') {
      query.industry = req.user.industry;
    }

    // Filters
    if (status) query.status = status;
    if (priority) query.priority = priority;
    if (owner) query.owner = owner;
    if (state) query.state = state;
    if (industry) query.industry = industry;

    const leads = await Lead.find(query)
      .populate('owner', 'name email')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    const total = await Lead.countDocuments(query);

    res.json({
      leads,
      total,
      pages: Math.ceil(total / limit),
      currentPage: Number(page)
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/**
 * POST /api/leads - Create single lead
 */
router.post('/', async (req, res) => {
  try {
    const lead = new Lead({
      ...req.body,
      allocatedBy: req.user._id
    });
    await lead.save();

    await LeadActivity.create({
      lead: lead._id,
      performedBy: req.user._id,
      action: 'created',
      note: 'Lead manually created'
    });

    res.status(201).json(lead);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

/**
 * POST /api/leads/bulk - Bulk upload leads
 */
router.post('/bulk', async (req, res) => {
  try {
    const leadsData = req.body.map(item => ({
      ...item,
      allocatedBy: req.user._id
    }));
    
    const leads = await Lead.insertMany(leadsData);
    
    const activities = leads.map(l => ({
      lead: l._id,
      performedBy: req.user._id,
      action: 'created',
      note: 'Bulk upload'
    }));
    await LeadActivity.insertMany(activities);

    res.status(201).json({ count: leads.length });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

/**
 * GET /api/leads/:id - Get single lead
 */
router.get('/:id', async (req, res) => {
  try {
    const lead = await Lead.findById(req.params.id)
      .populate('owner', 'name email')
      .populate('allocatedBy', 'name role');
    if (!lead) return res.status(404).json({ message: 'Lead not found' });
    res.json(lead);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/**
 * PUT /api/leads/:id - Update lead fields
 */
router.put('/:id', async (req, res) => {
  try {
    const lead = await Lead.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!lead) return res.status(404).json({ message: 'Lead not found' });
    res.json(lead);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

/**
 * PUT /api/leads/:id/allocate - Explicitly re-allocate lead
 */
router.put('/:id/allocate', async (req, res) => {
  try {
    const { ownerId } = req.body;
    const lead = await Lead.findById(req.params.id);
    if (!lead) return res.status(404).json({ message: 'Lead not found' });

    const oldOwner = lead.owner;
    lead.owner = ownerId;
    lead.allocatedBy = req.user._id;
    await lead.save();

    await LeadActivity.create({
      lead: lead._id,
      performedBy: req.user._id,
      action: 'reallocated',
      note: `Lead reallocated from ${oldOwner} to ${ownerId}`
    });

    res.json(lead);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

/**
 * POST /api/leads/:id/documents - Attach document
 */
router.post('/:id/documents', async (req, res) => {
  try {
    const { name, url, fileKey, size } = req.body;
    const lead = await Lead.findById(req.params.id);
    if (!lead) return res.status(404).json({ message: 'Lead not found' });

    lead.documents.push({
      name,
      url,
      fileKey,
      size,
      uploadedAt: new Date()
    });
    await lead.save();

    await LeadActivity.create({
      lead: lead._id,
      performedBy: req.user._id,
      action: 'document_attached',
      note: `Attached document: ${name}`
    });

    res.json(lead.documents);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

/**
 * DELETE /api/leads/:id - Founder only
 */
router.delete('/:id', async (req, res) => {
  try {
    if (req.user.role !== 'founder') {
      return res.status(403).json({ message: 'Forbidden: Founder only' });
    }
    const lead = await Lead.findByIdAndDelete(req.params.id);
    if (!lead) return res.status(404).json({ message: 'Lead not found' });
    res.json({ message: 'Lead deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/**
 * POST /api/leads/:id/transition - State machine transition
 */
router.post('/:id/transition', async (req, res) => {
  try {
    const { action, ...data } = req.body;
    const lead = await leadService.transition(req.params.id, action, data, req.user);
    
    const io = req.app.get('io');
    if (io) {
      io.to(lead.owner.toString()).emit('lead:updated', {
        leadId: lead._id,
        status: lead.status,
        nextActionAt: lead.nextActionAt
      });

      if (action === 'set_feedback' && (data.nextAction === 'schedule_virtual' || data.nextAction === 'direct_meeting')) {
        const invitees = lead.meetingInvitees || [];
        invitees.forEach(inviteeId => {
          io.to(inviteeId.toString()).emit('meeting:scheduled', {
            lead: lead.name,
            meetingAt: lead.meetingAt,
            meetingLink: lead.meetingLink
          });
        });
      }
    }

    res.json(lead);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

/**
 * GET /api/leads/:id/activity - Get activity log
 */
router.get('/:id/activity', async (req, res) => {
  try {
    const activities = await LeadActivity.find({ lead: req.params.id })
      .populate('performedBy', 'name role')
      .sort({ createdAt: -1 });
    res.json(activities);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
