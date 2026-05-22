const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { verifyToken } = require('../middleware/auth');
const leadService = require('../services/leadService');
const notificationService = require('../services/notificationService');
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
  if (payload.status) {
    normalized.status = normalizeStatusValue(payload.status);
  } else if (payload.meetingAt) {
    normalized.status = payload.meetingType === 'virtual' ? 'meeting_virtual' : 'meeting_direct';
  }
  
  if (payload.expectedRevenue !== undefined && payload.expectedRevenue !== null && payload.expectedRevenue !== '') {
    normalized.expectedRevenue = Number(payload.expectedRevenue) || 0;
  }
  if (payload.actualRevenue !== undefined && payload.actualRevenue !== null && payload.actualRevenue !== '') {
    normalized.actualRevenue = Number(payload.actualRevenue) || 0;
  }
  if (payload.revenueCategory) normalized.revenueCategory = payload.revenueCategory;
  if (payload.regionType) normalized.regionType = payload.regionType;
  if (payload.region) normalized.region = payload.region;
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
    const User = require('../models/User');
    const insertedLeads = [];
    const updatedLeads = [];
    const errors = [];

    const statusMap = {
      'new': 'new', 'called': 'called', 'follow-up': 'followup', 'followup': 'followup',
      'rnr': 'rnr', 'not reached': 'rnr', 'switched off': 'rnr', 'not reachable': 'rnr',
      'virtual meeting': 'meeting_virtual', 'meeting virtual': 'meeting_virtual',
      'direct meeting': 'meeting_direct', 'meeting direct': 'meeting_direct',
      'meeting': 'meeting_direct', 'meeting conducted': 'meeting_direct',
      'meeting scheduled': 'meeting_direct',
      'converted': 'converted', 'lost': 'lost',
      'not interested': 'not_interested', 'not intersted': 'not_interested',
      'escalated': 'escalated',
      'blocking amount received': 'blocking_amount_received',
      'blocking_amount_received': 'blocking_amount_received',
      'full amount received': 'full_amount_received',
      'full_amount_received': 'full_amount_received',
      'agreement signed': 'agreement_signed',
      'agreement_signed': 'agreement_signed',
      'call back': 'followup', 'callback': 'followup',
      'followup required': 'followup', 'interested': 'followup', 'intersted': 'followup',
      'connected': 'called', 'invalid': 'lost',
    };

    for (let i = 0; i < req.body.length; i++) {
      const item = req.body[i];
      try {
        const normalized = normalizeLeadPayload(item);
        normalized.allocatedBy = req.user._id;

        // Enforce role-based scoping on bulk imports too
        if (req.user.role === 'state_manager') normalized.state = req.user.state;
        if (req.user.role === 'industry_manager') normalized.industry = req.user.industry;

        // Handle "Assigned To" — lookup user by name
        if (item.assignedTo) {
          const assignee = await User.findOne({
            name: { $regex: new RegExp(`^${item.assignedTo.trim()}$`, 'i') }
          }).select('_id');
          if (assignee) {
            normalized.owner = assignee._id;
          }
        }

        // Status override
        if (item.status) {
          const mappedStatus = statusMap[(item.status || '').toLowerCase().trim()];
          if (mappedStatus) normalized.status = mappedStatus;
        }

        if (item.subStatus) normalized.subStatus = item.subStatus;

        if (item.followUpDate) {
          const fDate = new Date(item.followUpDate);
          if (!isNaN(fDate.getTime())) normalized.followUpDate = fDate;
        }

        if (item.remarks) {
          normalized.remarks = item.remarks;
          normalized.feedback = [{
            note: item.remarks,
            createdAt: new Date(),
            createdBy: req.user._id
          }];
        }

        if (item.createdDate) {
          const cDate = new Date(item.createdDate);
          if (!isNaN(cDate.getTime())) normalized.createdAt = cDate;
        }

        // New client-specified date fields
        const parseDateField = (val) => {
          if (!val) return undefined;
          const d = new Date(val);
          return isNaN(d.getTime()) ? undefined : d;
        };
        if (item.lastContactDate) normalized.lastContactDate = parseDateField(item.lastContactDate);
        if (item.blockingDate) normalized.blockingDate = parseDateField(item.blockingDate);
        if (item.fullAmountReceivedDate) normalized.fullAmountReceivedDate = parseDateField(item.fullAmountReceivedDate);

        // New string fields passed through normalizeLeadPayload already via spread,
        // but explicitly set here for clarity
        if (item.leadHandling) normalized.leadHandling = item.leadHandling;
        if (item.messagedStatus) normalized.messagedStatus = item.messagedStatus;
        if (item.partnershipCategory) normalized.partnershipCategory = item.partnershipCategory;
        if (item.followUpNotes) normalized.followUpNotes = item.followUpNotes;
        if (item.followUpCount !== undefined) normalized.followUpCount = Number(item.followUpCount) || 0;
        if (item.nextAction) normalized.nextAction = item.nextAction;
        if (item.outcome) normalized.outcome = item.outcome;
        if (item.reasonForLost) normalized.reasonForLost = item.reasonForLost;

        // --- UPSERT LOGIC ---
        // Extract _id from payload (may be a MongoDB ObjectId or a custom string ID)
        const { _id: rawLeadId, ...insertPayload } = normalized;
        let lead = null;
        let isUpdate = false;

        // 1. Try update by valid MongoDB ObjectId
        if (rawLeadId && mongoose.Types.ObjectId.isValid(rawLeadId)) {
          lead = await Lead.findByIdAndUpdate(
            rawLeadId,
            { $set: insertPayload },
            { new: true, runValidators: false }
          );
          if (lead) isUpdate = true;
        }

        // 2. Try update by phone match (deduplication)
        if (!lead && insertPayload.phone) {
          const existing = await Lead.findOne({ phone: insertPayload.phone });
          if (existing) {
            lead = await Lead.findByIdAndUpdate(
              existing._id,
              { $set: insertPayload },
              { new: true, runValidators: false }
            );
            if (lead) isUpdate = true;
          }
        }

        // 3. Create new lead if no match found
        if (!lead) {
          lead = await Lead.create(insertPayload);
        }

        if (isUpdate) updatedLeads.push(lead);
        else insertedLeads.push(lead);
      } catch (rowErr) {
        errors.push({ row: i + 1, reason: rowErr.message });
      }
    }

    const allProcessed = [...insertedLeads, ...updatedLeads];

    if (allProcessed.length > 0) {
      const activities = [
        ...insertedLeads.map(l => ({
          lead: l._id, performedBy: req.user._id, action: 'created', note: 'Bulk upload'
        })),
        ...updatedLeads.map(l => ({
          lead: l._id, performedBy: req.user._id, action: 'updated', note: 'Bulk update'
        }))
      ];
      await LeadActivity.insertMany(activities);
    }

    // Notify managers about new leads in their territory
    const io = req.app.get('io');
    const states = [...new Set(insertedLeads.map(l => l.state).filter(Boolean))];
    if (states.length > 0) {
      const managers = await User.find({ role: { $in: ['state_manager', 'industry_manager'] }, state: { $in: states } }).select('_id');
      for (const mgr of managers) {
        await notificationService.onLeadAdded({
          managerId: mgr._id,
          leadName: `${insertedLeads.length} leads (bulk upload)`,
          createdByName: req.user.name || 'System',
          io,
        });
      }
    }

    res.status(201).json({
      total: req.body.length,
      imported: insertedLeads.length,
      updated: updatedLeads.length,
      skipped: errors.length,
      errors: errors.slice(0, 50),
      count: insertedLeads.length + updatedLeads.length
    });
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
    if (!['executive', 'industry_manager', 'state_manager'].includes(req.user.role)) {
      return res.status(403).json({ message: 'Forbidden: Role not authorized to access queue' });
    }
    let targetUserId = req.user._id;
    if (req.query.userId && ['industry_manager', 'state_manager', 'founder'].includes(req.user.role)) {
      targetUserId = req.query.userId;
    }
    const workflow = await leadService.getWorkflowData(targetUserId);
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
    const { owner } = req.query;

    // Scoping based on role
    if (req.user.role === 'executive') {
      query.owner = req.user._id;
    } else if (req.user.role === 'state_manager') {
      query.state = req.user.state;
    } else if (req.user.role === 'industry_manager') {
      query.industry = req.user.industry;
    }

    if (owner === 'unassigned' || owner === 'none') {
      query.$and = [
        ...(query.$and || []),
        { $or: [{ owner: null }, { owner: { $exists: false } }] }
      ];
    } else if (owner) {
      query.owner = owner;
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
      blocking_amount_received: 0,
      full_amount_received: 0,
      agreement_signed: 0,
      lost: 0,
      rnr: 0,
      escalated: 0
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
    const {
      status,
      priority,
      owner,
      state,
      industry,
      search,
      period,
      value,
      excludeStatuses,
      completedToday,
      page = 1,
      limit = 10
    } = req.query;
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
    if (period) {
      const getDateRange = (type, periodValue) => {
        const now = new Date();
        let start = new Date(now);
        let end = new Date(now);
        const normalized = type === 'day' ? 'today' : type === 'week' ? 'weekly' : type === 'month' ? 'monthly' : type;

        if (normalized === 'today') {
          start.setHours(0, 0, 0, 0);
          end.setHours(23, 59, 59, 999);
        } else if (normalized === 'weekly') {
          if (periodValue && periodValue.startsWith('Week ')) {
            const weekNum = parseInt(periodValue.split(' ')[1]);
            start.setDate(1 + (weekNum - 1) * 7);
            start.setHours(0, 0, 0, 0);
            end = new Date(start);
            if (weekNum === 4 || weekNum === 5) end = new Date(start.getFullYear(), start.getMonth() + 1, 0, 23, 59, 59, 999);
            else {
              end.setDate(start.getDate() + 6);
              end.setHours(23, 59, 59, 999);
            }
          } else {
            const day = now.getDay();
            const diff = now.getDate() - day + (day === 0 ? -6 : 1);
            start.setDate(diff);
            start.setHours(0, 0, 0, 0);
            end.setHours(23, 59, 59, 999);
          }
        } else if (normalized === 'monthly') {
          if (periodValue) {
            const monthMap = { January: 0, February: 1, March: 2, April: 3, May: 4, June: 5, July: 6, August: 7, September: 8, October: 9, November: 10, December: 11 };
            const monthIdx = monthMap[periodValue];
            if (monthIdx !== undefined) start.setMonth(monthIdx);
          }
          start.setDate(1);
          start.setHours(0, 0, 0, 0);
          end = new Date(start.getFullYear(), start.getMonth() + 1, 0, 23, 59, 59, 999);
        } else if (normalized === 'quarter') {
          const qMap = { Q1: 0, Q2: 3, Q3: 6, Q4: 9 };
          const qMonth = qMap[periodValue] !== undefined ? qMap[periodValue] : Math.floor(now.getMonth() / 3) * 3;
          start.setMonth(qMonth, 1);
          start.setHours(0, 0, 0, 0);
          end = new Date(start.getFullYear(), qMonth + 3, 0, 23, 59, 59, 999);
        } else if (normalized === 'year') {
          const year = periodValue ? parseInt(periodValue) : now.getFullYear();
          start = new Date(year, 0, 1);
          end = new Date(year, 11, 31, 23, 59, 59, 999);
        }
        return { start, end };
      };
      const { start, end } = getDateRange(period, value);
      query.createdAt = { $gte: start, $lte: end };
    }
    if (priority) query.priority = priority;
    if (excludeStatuses) {
      const excluded = String(excludeStatuses).split(',').map(s => normalizeStatusValue(s)).filter(Boolean);
      if (excluded.length) {
        query.status = query.status && typeof query.status === 'object'
          ? query.status
          : { ...(query.status ? { $eq: query.status } : {}), $nin: excluded };
      }
    }
    if (completedToday === 'true') {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      const end = new Date();
      end.setHours(23, 59, 59, 999);
      const leadIds = await LeadActivity.distinct('lead', {
        performedBy: req.user._id,
        createdAt: { $gte: start, $lte: end },
        action: { $in: ['called', 'followup_set', 'meeting_scheduled', 'meeting_done', 'converted'] }
      });
      query._id = { $in: leadIds };
    }
    if (owner === 'unassigned' || owner === 'none') {
      query.$and = [
        ...(query.$and || []),
        { $or: [{ owner: null }, { owner: { $exists: false } }] }
      ];
    } else if (owner) {
      query.owner = owner;
    }
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
    const payload = normalizeLeadPayload(req.body);
    // Executives always own the leads they create
    if (req.user.role === 'executive' && !payload.owner) {
      payload.owner = req.user._id;
    }
    // Always scope to creator's state/industry — prevents mismatched leads that become invisible to the creator
    if (req.user.role === 'state_manager') {
      payload.state = req.user.state;
    }
    if (req.user.role === 'industry_manager') {
      payload.industry = req.user.industry;
    }
    const lead = new Lead({
      ...payload,
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

    // Notify new owner
    const io = req.app.get('io');
    await notificationService.onLeadAllocated({
      executiveId: ownerId,
      leadName: lead.name || lead.company || 'Lead',
      allocatedByName: req.user.name || 'Manager',
      io,
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
    const io = req.app.get('io');
    const lead = await leadService.transition(req.params.id, action, data, req.user, io);

    if (io && lead.owner) {
      const ownerId = lead.owner.toString();

      io.to(ownerId).emit('lead:updated', {
        leadId: lead._id,
        status: lead.status,
        nextActionAt: lead.nextActionAt
      });

      // If a DM-day lead was marked RNR, the status stays 'meeting_direct'
      // Push lead:dm_retry so the exec's queue refreshes immediately
      if (action === 'mark_rnr' && lead.status === 'meeting_direct') {
        io.to(ownerId).emit('lead:dm_retry', {
          leadId: lead._id,
          leadName: lead.company || lead.name,
          meetingAt: lead.meetingAt
        });
      }

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
