const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { verifyToken } = require('../middleware/auth');
const leadService = require('../services/leadService');
const notificationService = require('../services/notificationService');
const Lead = require('../models/Lead');
const LeadActivity = require('../models/LeadActivity');
const User = require('../models/User');
const { getScopeOwnerIds, applyLeadScope, canAccessLead } = require('../utils/hierarchy');
const { statusesForParam } = require('../constants/leadStatusGroups');
const { resolveStatus } = require('../constants/leadStatusRank');
const { createdAtRange } = require('../utils/dateRange');
const { generateLeadId, syncCountersWithIds } = require('../services/leadIdService');
const { prefixForSource } = require('../constants/leadSources');
const { Country, State } = require('country-state-city');

// Protect all routes
router.use(verifyToken);

const normalizePriority = (priority) => {
  if (!priority) return 'cold';
  const value = String(priority).toLowerCase();
  if (value.includes('hot')) return 'hot';
  if (value.includes('warm')) return 'warm';
  return 'cold';
};

/**
 * Reduces a phone number to its significant digits so that "+91 98765 43210",
 * "09876543210" and "9876543210" all compare equal when checking duplicates.
 */
const toComparablePhone = (phone) => {
  const digits = String(phone || '').replace(/\D/g, '');
  return digits.length > 10 ? digits.slice(-10) : digits;
};

/**
 * Indian numbers must be a valid 10-digit mobile (never starting 0-5). The form
 * accepts any country code, so non-Indian numbers are range-checked instead.
 * A bare 10-digit number (no "+") is treated as Indian.
 */
const isValidMobile = (phone) => {
  const raw = String(phone || '').trim();
  const digits = raw.replace(/\D/g, '');
  const isIndian = raw.startsWith('+91') || (!raw.startsWith('+') && digits.length === 10);
  if (isIndian) return /^[6-9]\d{9}$/.test(toComparablePhone(raw));
  return digits.length >= 7 && digits.length <= 15;
};

const normalizeStatusValue = (status, { forFilter = false } = {}) => {
  if (!status) return status;
  const value = String(status).trim().toLowerCase();

  // Filtering resolves through the canonical groups, so a list shows exactly the
  // leads its pipeline card counted. Before this, ?status=closing (and blocking)
  // hit an exact match on a status no lead has and returned nothing, while
  // ?status=followup and ?status=lost silently dropped the second status in
  // their group (QA BUG-004/005/010).
  if (forFilter) return statusesForParam(value);

  // Writes keep the single-status mapping: a lead is saved with one status,
  // never a group.
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
    const insertedLeads = [];
    const updatedLeads = [];
    const errors = [];
    // Cache owner lookups so a 300-row upload doesn't issue 300 identical queries.
    const ownerScopeCache = new Map();
    // Lead IDs are unique, so one sheet can't use the same ID on two rows.
    const seenSheetIds = new Map();

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
      'nri - whatsapp messaged/connected': 'called', 'nri': 'called',
      'disconnected': 'rnr', 'disconnect': 'rnr',
      'decision pending - future': 'followup', 'decision pending': 'followup', 'pending': 'followup',
      'no budget': 'not_interested', 'budget issue': 'not_interested',
      'duplicate': 'lost', 'duplicates': 'lost', 'dup': 'lost',
      'business lead': 'new', 'business': 'new',
      'not interested': 'not_interested', 'not intersted': 'not_interested', 'not intrested': 'not_interested',
      'call back later': 'followup', 'will call back': 'followup', 'cb': 'followup',
      'busy': 'rnr', 'not available': 'rnr', 'not reachable': 'rnr', 'unreachable': 'rnr',
    };

    for (let i = 0; i < req.body.length; i++) {
      const item = req.body[i];
      try {
        const normalized = normalizeLeadPayload(item);
        const hasPhone = !!(normalized.phone && String(normalized.phone).trim());
        const hasSheetId = !!(normalized._id && String(normalized._id).trim());

        // A row needs a phone unless it names an existing lead by its Lead ID
        if (!hasPhone && !hasSheetId) {
          errors.push({ row: i + 1, reason: 'Missing phone number' });
          continue;
        }
        // Fallback for blank name
        if (!normalized.name || !String(normalized.name).trim()) {
          normalized.name = normalized.company || normalized.phone;
        }

        normalized.allocatedBy = req.user._id;
        // Did this upload EXPLICITLY choose an owner (allocation dropdown -> ownerId, or
        // "Assigned To" below)? If so we honor it everywhere. If not, we only default the
        // owner for brand-new leads — an existing lead's owner must NEVER be silently
        // reassigned on a plain re-upload (that bug let a Founder/admin re-upload steal
        // every matched lead away from the Industry Manager who actually works it).
        let explicitOwner = normalized.owner != null;
        // Default owner to the uploader ONLY for roles that actually work leads, so a new
        // lead shows up in their My Leads immediately. A founder or state manager uploading
        // with "Keep unallocated" must leave owner null, or the rows get stamped with their
        // id and vanish: they no longer match the Unallocated filter (owner: null) and their
        // owner appears in no staff table, so there is nowhere to drill down and find them.
        // Same rule as the single-lead POST below.
        if (!normalized.owner && ['executive', 'industry_manager'].includes(req.user.role)) {
          normalized.owner = req.user._id;
        }

        // Enforce role-based scoping on bulk imports too
        if (req.user.role === 'state_manager') normalized.state = req.user.state;
        if (req.user.role === 'industry_manager') normalized.industry = req.user.industry;

        // Handle "Assigned To" — lookup user by name (overrides default owner above)
        if (item.assignedTo) {
          const assignee = await User.findOne({
            name: { $regex: new RegExp(`^${item.assignedTo.trim()}$`, 'i') }
          }).select('_id');
          if (assignee) {
            normalized.owner = assignee._id;
            explicitOwner = true;
          }
        }

        // Status override — if not in map, default to 'new' so enum validation never fails
        if (item.status) {
          const mappedStatus = statusMap[(item.status || '').toLowerCase().trim()];
          normalized.status = mappedStatus || 'new';
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

        // Scope the lead to its owner's industry/state. Dashboards filter leads by
        // the manager's industry, so a lead assigned to a manager/executive MUST
        // carry that owner's industry (and state) or it stays invisible to them.
        if (normalized.owner) {
          const ownerKey = String(normalized.owner);
          let ownerScope = ownerScopeCache.get(ownerKey);
          if (ownerScope === undefined) {
            ownerScope = await User.findById(normalized.owner).select('industry state').lean();
            ownerScopeCache.set(ownerKey, ownerScope || null);
          }
          if (ownerScope) {
            if (ownerScope.industry) normalized.industry = ownerScope.industry;
            if (ownerScope.state) normalized.state = ownerScope.state;
          }
        }

        // --- UPSERT LOGIC ---
        // The sheet's Lead ID is either a MongoDB ObjectId or our own Lead ID (RMFOL01...)
        const { _id: rawId, ...insertPayload } = normalized;
        const rawLeadId = rawId ? String(rawId).trim() : '';
        const isObjectId = !!rawLeadId && mongoose.Types.ObjectId.isValid(rawLeadId);
        delete insertPayload.leadId;
        if (rawLeadId && !isObjectId) insertPayload.leadId = rawLeadId;
        if (rawLeadId) {
          const idKey = rawLeadId.toUpperCase();
          if (seenSheetIds.has(idKey)) {
            errors.push({ row: i + 1, reason: `Lead ID ${rawLeadId} is already used on row ${seenSheetIds.get(idKey)} of this sheet` });
            continue;
          }
          seenSheetIds.set(idKey, i + 1);
        }
        // Updates must not touch owner/allocatedBy unless this upload explicitly chose an
        // assignee — otherwise a re-upload reassigns existing leads to the uploader.
        const updatePayload = { ...insertPayload };
        if (!explicitOwner) {
          delete updatePayload.owner;
          delete updatePayload.allocatedBy;
        }
        let lead = null;
        let isUpdate = false;

        // 1. Try update by valid MongoDB ObjectId, or by our Lead ID
        if (rawLeadId) {
          lead = await Lead.findOneAndUpdate(
            isObjectId ? { _id: rawLeadId } : { leadId: rawLeadId },
            { $set: updatePayload },
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
              { $set: updatePayload },
              { new: true, runValidators: false }
            );
            if (lead) isUpdate = true;
          }
        }

        // 3. Create new lead if no match found
        if (!lead) {
          if (!hasPhone) {
            errors.push({ row: i + 1, reason: `No lead found with ID ${rawLeadId}, and no phone number to create one` });
            continue;
          }
          // Sheet rows without a Lead ID get one generated from their source
          if (!insertPayload.leadId) {
            insertPayload.leadId = await generateLeadId(insertPayload.leadSource);
            if (!insertPayload.leadId) {
              errors.push({
                row: i + 1,
                reason: `No Lead ID, and source "${insertPayload.leadSource || ''}" has no ID pattern — add a Lead ID or use a listed source`
              });
              continue;
            }
          }
          lead = await Lead.create(insertPayload);
        }

        if (isUpdate) updatedLeads.push(lead);
        else insertedLeads.push(lead);
      } catch (rowErr) {
        const reason = rowErr.code === 11000
          ? `Lead ID ${rowErr.keyValue?.leadId || ''} already belongs to another lead`
          : rowErr.message;
        errors.push({ row: i + 1, reason });
      }
    }

    const allProcessed = [...insertedLeads, ...updatedLeads];
    await syncCountersWithIds(allProcessed.map(l => l.leadId).filter(Boolean));

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

const PAYMENT_STAGES = ['blocking_amount_received', 'full_amount_received'];

// Lead fields that make up its contact details — see PATCH /:id/details.
const CONTACT_FIELDS = ['name', 'company', 'phone', 'email', 'country', 'state', 'district', 'regionType', 'region'];
const CONTACT_LABELS = {
  name: 'Name', company: 'Company', phone: 'Phone', email: 'Email',
  country: 'Country', state: 'State', district: 'District', regionType: 'Region type', region: 'Region'
};
const DETAIL_EDITOR_ROLES = ['founder', 'state_manager', 'industry_manager'];

/**
 * PATCH /api/leads/:id/details - Edit a lead's contact details.
 * Managers and the founder only, and only for leads in their own team. A phone
 * that matches another lead is warned about (409) until confirmDuplicate is sent,
 * the same as when adding a lead. Every change is written to the lead's history.
 */
const updateLeadDetails = async (req, res) => {
  try {
    if (!DETAIL_EDITOR_ROLES.includes(req.user.role)) {
      return res.status(403).json({ message: 'Only managers can edit lead details.' });
    }
    const lead = await Lead.findById(req.params.id);
    if (!lead) return res.status(404).json({ message: 'Lead not found' });
    if (!(await canAccessLead(req.user, lead))) {
      return res.status(403).json({ message: 'You can only edit leads in your own team.' });
    }

    const updates = {};
    for (const field of CONTACT_FIELDS) {
      if (req.body[field] === undefined) continue;
      const value = String(req.body[field] ?? '').trim();
      if (value === String(lead[field] ?? '')) continue;
      // Older leads store a bare "9876543210"; the form sends "+919876543210".
      // Same number, so it is not an edit.
      if (field === 'phone' && !String(lead.phone || '').startsWith('+')
        && toComparablePhone(value) === toComparablePhone(lead.phone)) continue;
      updates[field] = value;
    }

    if (updates.phone !== undefined) {
      if (!isValidMobile(updates.phone)) {
        return res.status(400).json({ message: 'Enter a valid 10-digit mobile number.', field: 'phone' });
      }
      if (!req.body.confirmDuplicate) {
        const existing = await Lead.findOne({
          _id: { $ne: lead._id },
          phone: { $regex: `${toComparablePhone(updates.phone)}$` }
        }).populate('owner', 'name').lean();
        if (existing) {
          return res.status(409).json({
            duplicate: true,
            message: 'Another lead already has this mobile number.',
            existing: {
              _id: existing._id,
              name: existing.name,
              company: existing.company,
              phone: existing.phone,
              status: existing.status,
              owner: existing.owner?.name || 'Unassigned',
              createdAt: existing.createdAt
            }
          });
        }
      }
    }
    // Name is required on the model — fall back to the phone, as when adding a lead.
    if (updates.name === '') updates.name = updates.phone || lead.phone;
    if (updates.regionType !== undefined && !['Panchayat', 'Municipality', 'Corporation', ''].includes(updates.regionType)) {
      return res.status(400).json({ message: 'Invalid region type.', field: 'regionType' });
    }

    const fields = Object.keys(updates);
    if (!fields.length) return res.json(lead);

    const changes = fields.map(f => ({ field: f, from: lead[f] || '', to: updates[f] }));
    Object.assign(lead, updates);
    await lead.save();

    await LeadActivity.create({
      lead: lead._id,
      performedBy: req.user._id,
      action: 'updated',
      note: `Details edited: ${changes.map(c => `${CONTACT_LABELS[c.field]} "${c.from || '—'}" → "${c.to || '—'}"`).join(', ')}`,
      metadata: { detailsEdited: changes }
    });

    res.json(lead);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

const updateLead = async (req, res) => {
  try {
    const payload = normalizeLeadPayload(req.body);
    delete payload.leadId; // IDs are permanent once assigned
    // Money received is booked by the payment entries, never typed onto the lead.
    delete payload.actualRevenue;
    delete payload.blockingAmount;
    delete payload.fullAmount;
    // Maintained by the status rank and RNR rules only.
    delete payload.peakStatus;
    delete payload.rnrTransferredAt;
    delete payload.rnrTransferredFrom;
    // Contact details are edited only through PATCH /:id/details (managers only).
    CONTACT_FIELDS.forEach(f => delete payload[f]);

    // Moving a lead to a payment stage records a payment: route it through the
    // same transition the call-feedback screens use, so the amount is captured
    // and counted as revenue, and Converted is reached by the same rule.
    const existing = await Lead.findById(req.params.id).select('status owner allocatedBy');
    if (!existing) return res.status(404).json({ message: 'Lead not found' });
    if (!(await canAccessLead(req.user, existing))) {
      return res.status(403).json({ message: 'You can only update leads in your own team.' });
    }
    const paymentStage = PAYMENT_STAGES.includes(payload.status) && payload.status !== existing.status
      ? payload.status
      : null;
    if (paymentStage) {
      delete payload.status;
      await leadService.transition(req.params.id, 'set_feedback', {
        nextAction: paymentStage,
        amount: req.body.amount,
        revenueCategory: payload.revenueCategory,
        note: req.body.notes,
      }, req.user, req.app.get('io'));
    }

    // A status picked by hand obeys the same rank lock as the call screens.
    if (payload.status) {
      const current = await Lead.findById(req.params.id).select('status peakStatus');
      Object.assign(payload, resolveStatus(current, payload.status));
    }

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

// The period window normally means "created in", but a Conversions card counts by
// when the lead converted. Whitelisted so a caller can never filter on an arbitrary
// field; anything else falls back to createdAt.
const PERIOD_DATE_FIELDS = ['createdAt', 'convertedAt'];
const periodFieldOf = (dateField) =>
  PERIOD_DATE_FIELDS.includes(dateField) ? dateField : 'createdAt';

// A priority filter may arrive as one value ('hot') or as a comma-separated set
// ('hot,warm'), which is how the Expected Onboarding card drills down -- that card
// counts Hot AND Warm, so a single-value filter could never reproduce its number.
const priorityFilterOf = (priority) => {
  if (!priority) return undefined;
  const list = String(priority).split(',').map(s => s.trim()).filter(Boolean);
  if (!list.length) return undefined;
  return list.length === 1 ? list[0] : { $in: list };
};

/**
 * GET /api/leads/counts - Get counts grouped by status
 */
router.get('/counts', async (req, res) => {
  try {
    const query = {};
    const { owner, priority, period, value, state, dateField } = req.query;

    // These counts run through aggregation pipelines, which (unlike .find/.countDocuments)
    // do NOT auto-cast string ids to ObjectId. Cast every owner id explicitly or $match
    // silently matches nothing — the bug behind "All 0 / New 0" while the list showed leads.
    const toOwnerId = (v) => {
      try { return new mongoose.Types.ObjectId(v); } catch { return v; }
    };

    // Hierarchy-based scoping: visibility follows the reporting tree (reportingTo),
    // not the lead's industry/state field. Founder is unrestricted.
    const scopeIds = await getScopeOwnerIds(req.user);
    applyLeadScope(query, scopeIds, req.user._id, owner);

    // When the list is filtered to one priority, the status tab counts must be
    // filtered the same way or the numbers contradict the rows underneath them.
    const priorityClause = priorityFilterOf(priority);
    if (priorityClause !== undefined) query.priority = priorityClause;

    // Same reasoning for the period: with a month selected the tabs counted all
    // time while the rows under them were one month's worth, so "All 603" sat on
    // top of 47 September leads.
    if (period) query[periodFieldOf(dateField)] = createdAtRange(period, value);

    // The list has always offered a state filter; the tabs above it did not honour
    // one, so filtering to Telangana left the counts reading every state.
    if (state) query.state = state;

    const [statusCounts, priorityCounts, total] = await Promise.all([
      Lead.aggregate([
        { $match: query },
        { $group: { _id: '$status', count: { $sum: 1 } } }
      ]),
      // Priority (hot/warm/cold) is a separate axis from status. The UI shows a
      // "Hot Pipeline" figure that excludes closed leads, so mirror that here.
      Lead.aggregate([
        { $match: { ...query, status: { $nin: ['converted', 'lost'] } } },
        { $group: { _id: '$priority', count: { $sum: 1 } } }
      ]),
      Lead.countDocuments(query)
    ]);

    const result = {
      total,
      new: 0,
      called: 0,
      followup: 0,
      meeting_virtual: 0,
      meeting_direct: 0,
      converted: 0,
      blocking_amount_received: 0,
      full_amount_received: 0,
      agreement_signed: 0,
      lost: 0,
      rnr: 0,
      not_interested: 0,
      escalated: 0,
      hot: 0,
      warm: 0,
      cold: 0
    };

    statusCounts.forEach(c => {
      if (result.hasOwnProperty(c._id)) {
        result[c._id] = c.count;
      }
    });
    priorityCounts.forEach(c => {
      if (c._id === 'hot' || c._id === 'warm' || c._id === 'cold') {
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
    const dates = await leadService.getSuggestedDates(req.user);
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
      country,
      industry,
      search,
      period,
      value,
      dateField,
      excludeStatuses,
      completedToday,
      page = 1,
      limit = 10
    } = req.query;
    const query = {};

    // Search query
    if (search) {
      query.$or = [
        { leadId: { $regex: search, $options: 'i' } },
        { name: { $regex: search, $options: 'i' } },
        { company: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }

    // Hierarchy-based scoping: visibility follows the reporting tree (reportingTo),
    // not the lead's industry/state field. Applied after the other filters below.
    const scopeIds = await getScopeOwnerIds(req.user);

    // Filters
    if (status) {
      const statusFilter = normalizeStatusFilter(status);
      // 'all' and empty resolve to nothing to filter on — leave query.status unset
      // rather than matching on undefined.
      if (statusFilter !== undefined) query.status = statusFilter;
    }
    // Date window for the selected period, shared with the dashboard cards that
    // link here so a card's number and this list can never disagree.
    if (period) query[periodFieldOf(dateField)] = createdAtRange(period, value);
    const priorityClause = priorityFilterOf(priority);
    if (priorityClause !== undefined) query.priority = priorityClause;
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
        action: { $in: ['called', 'rnr', 'followup_set', 'meeting_scheduled', 'meeting_done', 'converted', 'blocking_amount_received', 'lost', 'not_interested'] }
      });
      query._id = { $in: leadIds };
    }
    // Apply hierarchy visibility + the optional ?owner= filter together.
    applyLeadScope(query, scopeIds, req.user._id, owner);

    // industry/state/country remain available as UI display filters (not a security boundary).
    if (state) query.state = state;
    if (country) {
      // Most leads (bulk uploads) carry a state but no country, so a country filter
      // also matches country-less leads whose state belongs to that country.
      const iso = Country.getAllCountries().find((c) => c.name === country)?.isoCode;
      const stateNames = iso ? State.getStatesOfCountry(iso).map((s) => s.name) : [];
      query.$and = [
        ...(query.$and || []),
        {
          $or: [
            { country },
            { country: { $in: [null, ''] }, state: { $in: stateNames } }
          ]
        }
      ];
    }
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

    if (!isValidMobile(payload.phone)) {
      return res.status(400).json({
        message: 'Enter a valid 10-digit mobile number.',
        field: 'phone'
      });
    }
    if (!payload.leadSource || !String(payload.leadSource).trim()) {
      return res.status(400).json({ message: 'Lead source is required.', field: 'leadSource' });
    }
    if (!prefixForSource(payload.leadSource)) {
      return res.status(400).json({ message: `Unknown lead source "${payload.leadSource}".`, field: 'leadSource' });
    }
    // Name is optional on the form — fall back to the phone number, as bulk upload does
    if (!payload.name || !String(payload.name).trim()) {
      payload.name = payload.phone;
    }

    // Duplicate leads are warned about, not blocked — the same person can
    // legitimately be re-entered. The client re-submits with confirmDuplicate
    // once the user has acknowledged the warning.
    if (!req.body.confirmDuplicate) {
      const existing = await Lead.findOne({
        phone: { $regex: `${toComparablePhone(payload.phone)}$` }
      }).populate('owner', 'name').lean();

      if (existing) {
        return res.status(409).json({
          duplicate: true,
          message: 'A lead with this mobile number already exists.',
          existing: {
            _id: existing._id,
            name: existing.name,
            company: existing.company,
            phone: existing.phone,
            status: existing.status,
            owner: existing.owner?.name || 'Unassigned',
            createdAt: existing.createdAt
          }
        });
      }
    }

    // Executives and industry managers own the leads they create,
    // unless the lead is explicitly being assigned to someone else.
    if (['executive', 'industry_manager'].includes(req.user.role) && !payload.owner) {
      payload.owner = req.user._id;
    }
    // Always scope to creator's state — prevents mismatched leads
    if (req.user.role === 'state_manager') {
      payload.state = req.user.state;
    }
    if (req.user.role === 'industry_manager') {
      payload.industry = req.user.industry;
    }
    // When a lead is assigned to another user (cross-role), inherit their industry/state
    // so the lead is always visible to the person it's assigned to.
    // E.g. SM creates a lead and assigns it to an IM — the lead must carry the IM's industry.
    if (payload.owner) {
      try {
        const ownerUser = await User.findById(payload.owner).select('industry state');
        if (ownerUser) {
          if (!payload.industry && ownerUser.industry) payload.industry = ownerUser.industry;
          if (!payload.state   && ownerUser.state)    payload.state   = ownerUser.state;
        }
      } catch (_) { /* non-fatal — lead still saves */ }
    }
    let lead;
    for (let attempt = 1; ; attempt++) {
      lead = new Lead({
        ...payload,
        leadId: await generateLeadId(payload.leadSource),
        allocatedBy: req.user._id
      });
      try {
        await lead.save();
        break;
      } catch (saveErr) {
        // A bulk upload took this number between generating and saving — take the next one
        if (saveErr.code !== 11000 || !saveErr.keyValue?.leadId || attempt >= 3) throw saveErr;
      }
    }

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
 * Narrows a list of lead ids from the client to the ones the caller may actually
 * act on. Selecting rows in the UI can only ever offer visible leads, but the ids
 * still arrive from the browser, so every bulk action re-checks them against the
 * reporting tree -- the same rule canAccessLead applies to a single lead, resolved
 * once for the whole batch instead of per id.
 */
async function accessibleLeadIds(user, leadIds) {
  const ids = leadIds.filter(id => mongoose.Types.ObjectId.isValid(id));
  if (!ids.length) return [];
  const scopeIds = await getScopeOwnerIds(user);
  if (scopeIds === null) return ids; // founder
  const scope = new Set(scopeIds.map(String));
  const selfId = String(user._id);
  const leads = await Lead.find({ _id: { $in: ids } }).select('owner allocatedBy').lean();
  return leads
    .filter(l => (l.owner
      ? scope.has(String(l.owner))
      : String(l.allocatedBy || '') === selfId))
    .map(l => l._id);
}

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

    const allowedIds = await accessibleLeadIds(req.user, leadIds);
    if (!allowedIds.length) {
      return res.status(403).json({ message: 'None of the selected leads are in your team' });
    }

    // Re-scope to the assignee's industry/state so the leads stay visible to them.
    const assignee = await User.findById(assignedTo).select('industry state').lean();
    const scopeUpdate = {};
    if (assignee?.industry) scopeUpdate.industry = assignee.industry;
    if (assignee?.state) scopeUpdate.state = assignee.state;

    const result = await Lead.updateMany(
      { _id: { $in: allowedIds } },
      {
        owner: assignedTo,
        allocatedBy: req.user._id,
        updatedAt: new Date(),
        ...scopeUpdate
      }
    );

    // Add activity logs
    const activities = allowedIds.map(id => ({
      lead: id,
      performedBy: req.user._id,
      action: 'reallocated',
      note: `Bulk allocated to ${assignedTo}`
    }));
    await LeadActivity.insertMany(activities);

    res.json({
      updated: result.nModified || result.modifiedCount,
      skipped: leadIds.length - allowedIds.length
    });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

/**
 * PATCH /api/leads/bulk-escalate - Escalate several selected leads at once.
 *
 * Every lead goes through leadService.transition('escalate'), the same path the
 * single-lead Escalate action uses, so the status, escalatedTo, note and activity
 * log come out identical -- this only saves the client from firing one request per
 * selected row.
 */
router.patch('/bulk-escalate', async (req, res) => {
  try {
    // The founder is the top of the tree and has nobody to escalate to.
    if (req.user.role === 'founder') {
      return res.status(403).json({ message: 'Forbidden: there is nobody above you to escalate to' });
    }

    const { leadIds, escalateTo, note } = req.body;
    if (!leadIds || !Array.isArray(leadIds) || !leadIds.length || !escalateTo) {
      return res.status(400).json({ message: 'leadIds array and escalateTo are required' });
    }

    const allowedIds = await accessibleLeadIds(req.user, leadIds);
    if (!allowedIds.length) {
      return res.status(403).json({ message: 'None of the selected leads are in your team' });
    }

    const io = req.app.get('io');
    const failed = [];
    let escalated = 0;
    for (const id of allowedIds) {
      try {
        await leadService.transition(id, 'escalate', { escalateTo, note }, req.user, io);
        escalated += 1;
      } catch (err) {
        failed.push({ leadId: String(id), message: err.message });
      }
    }

    res.json({
      escalated,
      skipped: leadIds.length - allowedIds.length,
      failed
    });
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

    // Enforce hierarchy visibility on direct-by-id access (prevents opening a
    // peer's lead via its URL/ID). Founder (scopeIds === null) is unrestricted.
    const scopeIds = await getScopeOwnerIds(req.user);
    if (scopeIds !== null) {
      const ownerId = String(lead.owner?._id || lead.owner || '');
      const selfId = String(req.user._id);
      const allowed =
        (ownerId && scopeIds.some(id => String(id) === ownerId)) ||
        (!ownerId && String(lead.allocatedBy?._id || lead.allocatedBy || '') === selfId) ||
        String(lead.escalatedTo || '') === selfId;
      if (!allowed) return res.status(404).json({ message: 'Lead not found' });
    }

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

router.patch('/:id/details', updateLeadDetails);

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
    // Re-scope to the new owner's industry/state so the lead stays visible to them.
    const newOwner = await User.findById(ownerId).select('industry state').lean();
    if (newOwner) {
      if (newOwner.industry) lead.industry = newOwner.industry;
      if (newOwner.state) lead.state = newOwner.state;
    }
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
 * DELETE /api/leads/:id - founder only
 */
router.delete('/:id', async (req, res) => {
  try {
    const lead = await Lead.findById(req.params.id);
    if (!lead) return res.status(404).json({ message: 'Lead not found' });

    // Deleting a lead is the founder's call alone. A lead carries its call log,
    // meetings and any money booked against it, and every dashboard figure adds
    // those up — so no manager erases one, not even one of their own.
    if (req.user.role !== 'founder') {
      return res.status(403).json({ message: 'Only the founder can delete leads.' });
    }

    // Activities outlive the lead otherwise, and the dashboards count them by
    // action without checking the lead still exists — so the day's call, meeting
    // and revenue tallies would keep counting a lead that is gone.
    await LeadActivity.deleteMany({ lead: lead._id });
    await lead.deleteOne();

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
