const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/auth');
const leadService = require('../services/leadService');
const Lead = require('../models/Lead');
const LeadActivity = require('../models/LeadActivity');

// Protect all routes
router.use(verifyToken);

const normalizePriority = (priority) => {
  if (!priority) return 'cold';
  const value = String(priority).toLowerCase();
  if (value.includes('hot')) return 'hot';
  if (value.includes('warm')) return 'warm';
  return 'cold';
};

const normalizeStatusValue = (status, { forFilter = false } = {}) => {
  if (!status) return status;
  const value = String(status).trim().toLowerCase();

  if (forFilter && value === 'meeting') return ['meeting_virtual', 'meeting_direct'];
  if (value === 'follow-up' || value === 'follow_up') return 'followup';
  if (value === 'meeting') return 'meeting_virtual';
  if (value === 'negotiation') return 'followup';

  return value;
};

const normalizeStatusFilter = (status) => {
  const values = String(status)
    .split(',')
    .flatMap((item) => {
      const normalized = normalizeStatusValue(item, { forFilter: true });
      return Array.isArray(normalized) ? normalized : [normalized];
    })
    .filter(Boolean);

  return values.length > 1 ? { $in: values } : values[0];
};

const normalizeLeadPayload = (payload = {}) => {
  const normalized = { ...payload };
  if (payload.ownerId && !payload.owner) normalized.owner = payload.ownerId;
  if (payload.priority !== undefined) normalized.priority = normalizePriority(payload.priority);
  if (payload.status) normalized.status = normalizeStatusValue(payload.status);
  if (payload.expectedRevenue !== undefined && payload.expectedRevenue !== null && payload.expectedRevenue !== '') {
    normalized.expectedRevenue = Number(payload.expectedRevenue) || 0;
  }
  if (Array.isArray(payload.documents)) {
    normalized.documents = payload.documents.map((doc) => ({
      name: doc.name || doc.fileName,
      url: doc.url,
      fileKey: doc.fileKey,
      size: doc.size,
      contentType: doc.contentType,
      uploadedAt: doc.uploadedAt || new Date()
    }));
  }
  delete normalized.ownerId;
  delete normalized.managerId;
  return normalized;
};

const bulkCreateLeads = async (req, res) => {
  try {
    const leadsData = req.body.map(item => {
      const normalized = normalizeLeadPayload(item);
      return {
        ...normalized,
        allocatedBy: req.user._id
      };
    });
    
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
};

const updateLead = async (req, res) => {
  try {
    const payload = normalizeLeadPayload(req.body);
    const lead = await Lead.findByIdAndUpdate(req.params.id, payload, { new: true });
    if (!lead) return res.status(404).json({ message: 'Lead not found' });

    // Add activity log
    await LeadActivity.create({
      lead: lead._id,
      performedBy: req.user._id,
      action: 'updated',
      note: `Status: ${lead.status}. ${req.body.notes || 'No notes provided.'}`
    });

    res.json(lead);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

/**
 * GET /api/leads/queue - Executive lead queue
 * MUST BE BEFORE /:id
 */
router.get('/queue', async (req, res) => {
  try {
    if (req.user.role !== 'executive') {
      return res.status(403).json({ message: 'Forbidden: Executive only' });
    }
    const workflow = await leadService.getWorkflowData(req.user._id);
    res.json(workflow);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/**
 * GET /api/leads/counts - Get counts grouped by status
 */
router.get('/counts', async (req, res) => {
  try {
    const query = {};

    // Scoping based on role
    if (req.user.role === 'executive') {
      query.owner = req.user._id;
    } else if (req.user.role === 'state_manager') {
      query.state = req.user.state;
    } else if (req.user.role === 'industry_manager') {
      query.industry = req.user.industry;
    }

    const counts = await Lead.aggregate([
      { $match: query },
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);

    const result = {
      new: 0,
      followup: 0,
      meeting_virtual: 0,
      meeting_direct: 0,
      converted: 0,
      lost: 0,
      rnr: 0
    };

    counts.forEach(c => {
      if (result.hasOwnProperty(c._id)) {
        result[c._id] = c.count;
      }
    });

    res.json(result);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/**
 * GET /api/leads/suggested-dates - Next 4 working days
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
    const { status, priority, owner, state, industry, search, page = 1, limit = 10 } = req.query;
    const query = {};

    // Search query
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { company: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }

    // Scoping based on role
    if (req.user.role === 'executive') {
      query.owner = req.user._id;
    } else if (req.user.role === 'state_manager') {
      query.state = req.user.state;
    } else if (req.user.role === 'industry_manager') {
      query.industry = req.user.industry;
    }

    // Filters
    if (status) {
      query.status = normalizeStatusFilter(status);
    }
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
      totalPages: Math.ceil(total / limit),
      page: Number(page)
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
      ...normalizeLeadPayload(req.body),
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
router.post('/bulk', bulkCreateLeads);

/**
 * POST /api/leads/bulk-upload - Bulk upload leads alias
 */
router.post('/bulk-upload', bulkCreateLeads);

/**
 * PATCH /api/leads/bulk-allocate - Bulk allocate leads to an executive
 */
router.patch('/bulk-allocate', async (req, res) => {
  try {
    if (['founder', 'state_manager', 'industry_manager'].indexOf(req.user.role) === -1) {
      return res.status(403).json({ message: 'Forbidden: Only managers can bulk allocate' });
    }

    const { leadIds, assignedTo } = req.body;
    if (!leadIds || !Array.isArray(leadIds) || !assignedTo) {
      return res.status(400).json({ message: 'leadIds array and assignedTo are required' });
    }

    const result = await Lead.updateMany(
      { _id: { $in: leadIds } },
      { 
        owner: assignedTo,
        allocatedBy: req.user._id,
        updatedAt: new Date()
      }
    );

    // Add activity logs
    const activities = leadIds.map(id => ({
      lead: id,
      performedBy: req.user._id,
      action: 'reallocated',
      note: `Bulk allocated to ${assignedTo}`
    }));
    await LeadActivity.insertMany(activities);

    res.json({ updated: result.nModified || result.modifiedCount });
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
router.put('/:id', updateLead);

/**
 * PATCH /api/leads/:id - Update lead fields alias
 */
router.patch('/:id', updateLead);

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
    const { name, url, fileKey, size, contentType } = req.body;
    const lead = await Lead.findById(req.params.id);
    if (!lead) return res.status(404).json({ message: 'Lead not found' });

    lead.documents.push({
      name,
      url,
      fileKey,
      size,
      contentType,
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
