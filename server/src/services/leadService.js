const Lead = require('../models/Lead');
const LeadActivity = require('../models/LeadActivity');
const User = require('../models/User');
const LeavePolicy = require('../models/LeavePolicy');
const mongoose = require('mongoose');
const notificationService = require('./notificationService');

/**
 * Helper to check if a date is a working day (not Sunday and not a holiday)
 */
async function isWorkingDay(date, state) {
  const day = date.getDay();
  if (day === 0) return false; // Sunday

  const year = date.getFullYear();
  const policy = await LeavePolicy.findOne({ state, year });
  if (policy && policy.holidays) {
    const isHoliday = policy.holidays.some(h => 
      h.date.toDateString() === date.toDateString()
    );
    if (isHoliday) return false;
  }
  return true;
}

/**
 * Get next N working days
 */
async function getNextWorkingDays(count, state) {
  const workingDays = [];
  let current = new Date();
  current.setHours(0, 0, 0, 0);

  // We start looking from tomorrow
  let daysAdded = 0;
  let safetyCounter = 0;

  while (workingDays.length < count && safetyCounter < 30) {
    current.setDate(current.getDate() + 1);
    if (await isWorkingDay(current, state)) {
      workingDays.push(new Date(current));
    }
    safetyCounter++;
  }

  return workingDays.map(d => ({
    label: d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
    value: d.toISOString().split('T')[0]
  }));
}

const leadService = {
  /**
   * Transition lead state.
   * @param {string} leadId
   * @param {string} action
   * @param {Object} data
   * @param {Object|null} performedBy - user object, or null for system-triggered transitions
   * @param {Object|null} io - Socket.io instance for real-time notifications
   */
  async transition(leadId, action, data, performedBy = null, io = null) {
    const lead = await Lead.findById(leadId);
    if (!lead) throw new Error('Lead not found');

    const activityData = {
      lead: lead._id,
      performedBy: performedBy?._id ?? null,
      action: '',
      note: data.note || '',
      metadata: {}
    };

    switch (action) {
      case 'mark_called':
        lead.status = 'called';
        lead.lastCallAt = new Date();
        activityData.action = 'called';
        break;

      case 'set_feedback':
        const { nextAction, note } = data;
        lead.feedback.push({ note, createdBy: performedBy._id });
        
        if (nextAction === 'followup') {
          lead.status = 'followup';
          activityData.action = 'followup_set';
        } else if (nextAction === 'converted') {
          lead.status = 'converted';
          lead.convertedAt = new Date();
          lead.strategyNote = data.strategyNote;
          if (data.revenueCategory) lead.revenueCategory = data.revenueCategory;
          if (data.actualRevenue) lead.actualRevenue = data.actualRevenue;
          
          activityData.action = 'converted';
          activityData.metadata = {
            revenue: lead.actualRevenue || lead.expectedRevenue || 0,
            category: lead.revenueCategory
          };
        } else if (nextAction === 'not_interested') {
          lead.status = 'not_interested';
          lead.strategyNote = data.strategyNote;
          activityData.action = 'not_interested';
        } else if (nextAction === 'schedule_virtual') {
          lead.status = 'meeting_virtual';
          lead.meetingAt = new Date(data.meetingAt);
          lead.meetingLink = data.meetingLink;
          if (data.meetingInvitees) lead.meetingInvitees = data.meetingInvitees;
          activityData.action = 'meeting_scheduled';

          // Schedule initial confirmation task: 2 hours before the meeting
          // (or immediately if the meeting is within 2 hours)
          const vmConfirmAt = new Date(lead.meetingAt.getTime() - 2 * 60 * 60 * 1000);
          lead.nextActionAt = vmConfirmAt > new Date() ? vmConfirmAt : new Date();
          lead.subStatus = 'pre_meeting_confirm';

        } else if (nextAction === 'direct_meeting') {
          lead.status = 'meeting_direct';
          lead.meetingAt = new Date(data.meetingAt);
          if (data.meetingInvitees) lead.meetingInvitees = data.meetingInvitees;
          activityData.action = 'meeting_scheduled';

          // Schedule confirmation task based on how far away the meeting is
          const tomorrowEnd = new Date();
          tomorrowEnd.setDate(tomorrowEnd.getDate() + 1);
          tomorrowEnd.setHours(23, 59, 59, 999);

          if (lead.meetingAt > tomorrowEnd) {
            // Meeting is day-after-tomorrow or later → confirm the day before at 10 AM
            const dayBeforeAt10 = new Date(lead.meetingAt);
            dayBeforeAt10.setDate(dayBeforeAt10.getDate() - 1);
            dayBeforeAt10.setHours(10, 0, 0, 0);
            lead.nextActionAt = dayBeforeAt10;
            lead.subStatus = 'day_before_confirm';
          } else {
            // Meeting is today or tomorrow → confirm immediately
            lead.nextActionAt = new Date();
            lead.subStatus = 'pre_meeting_confirm';
          }
        } else if (nextAction === 'blocking_amount_received') {
          lead.status = 'blocking_amount_received';
          activityData.action = 'blocking_amount_received';
        } else if (nextAction === 'full_amount_received') {
          lead.status = 'full_amount_received';
          activityData.action = 'full_amount_received';
        } else if (nextAction === 'agreement_signed') {
          lead.status = 'agreement_signed';
          activityData.action = 'agreement_signed';
        }
        break;

      case 'mark_rnr': {
        lead.rnrCount = (lead.rnrCount || 0) + 1;
        activityData.action = 'rnr';

        // ── Special case: Direct Meeting lead on the DAY of the meeting ──────
        // Keep retrying every hour until the scheduled meeting time.
        // Do not escalate or change status — the meeting is still on.
        const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
        const todayEnd   = new Date(); todayEnd.setHours(23, 59, 59, 999);
        const meetingAt  = lead.meetingAt ? new Date(lead.meetingAt) : null;
        const isDMDay    = lead.status === 'meeting_direct' &&
                           meetingAt && meetingAt >= todayStart && meetingAt <= todayEnd;

        if (isDMDay) {
          const oneHourFromNow = new Date(Date.now() + 60 * 60 * 1000);
          lead.nextActionAt = oneHourFromNow < meetingAt ? oneHourFromNow : meetingAt;
          activityData.note = `Pre-meeting retry #${lead.rnrCount}. Next attempt: ${lead.nextActionAt.toLocaleTimeString()}. Meeting at: ${meetingAt.toLocaleTimeString()}`;
          break; // skip normal RNR escalation
        }

        // ── Normal RNR path ──────────────────────────────────────────────────
        lead.status = 'rnr';

        if (lead.rnrCount === 1) {
          // Retry same afternoon at 1:30 PM
          const today = new Date();
          today.setHours(13, 30, 0, 0);
          lead.nextActionAt = today;
        } else if (lead.rnrCount === 2) {
          // Next working day at a random time between 10 AM–2 PM
          const nextDay = new Date();
          nextDay.setDate(nextDay.getDate() + 1);
          const rHour2 = Math.floor(Math.random() * (14 - 10 + 1)) + 10;
          const rMin2  = Math.floor(Math.random() * 60);
          nextDay.setHours(rHour2, rMin2, 0, 0);
          lead.nextActionAt = nextDay;
        } else if (lead.rnrCount === 3) {
          // Two days later at a random time between 9 AM–4 PM
          const twoDaysLater = new Date();
          twoDaysLater.setDate(twoDaysLater.getDate() + 2);
          const rHour3 = Math.floor(Math.random() * (16 - 9 + 1)) + 9;
          twoDaysLater.setHours(rHour3, 0, 0, 0);
          lead.nextActionAt = twoDaysLater;
        } else if (lead.rnrCount >= 4) {
          // Capture previous owner BEFORE reassigning
          const previousOwnerId = lead.owner;

          const otherExec = await User.findOne({
            role: 'executive',
            isActive: true,
            state: lead.state,
            industry: lead.industry,
            _id: { $ne: previousOwnerId }
          });

          if (otherExec) {
            lead.owner = otherExec._id;
            lead.nextActionAt = new Date(); // Queue immediately for new executive
            activityData.action = 'reallocated';
            activityData.note = `Auto-reallocated after ${lead.rnrCount} RNR attempts. Previous owner: ${previousOwnerId}`;

            await notificationService.onLeadAutoReallocated({
              executiveId: otherExec._id,
              leadName: lead.company || lead.name || 'Lead',
              rnrCount: lead.rnrCount,
              io,
            });
          } else {
            // No available executive in same territory — mark as lost
            lead.status = 'lost';
            lead.lostAt = new Date();
            activityData.action = 'lost';
            activityData.note = `Auto-lost: no available executive in ${lead.state}/${lead.industry} after ${lead.rnrCount} RNR attempts`;
          }
        }
        break;
      }

      case 'set_followup_date':
        lead.followUpDate = new Date(data.followUpDate);
        lead.followUpTime = data.followUpTime;
        lead.nextActionAt = new Date(data.followUpDate);
        if (data.isCustom) {
          lead.notes = data.customReason; // Store in notes if isCustom
        }
        activityData.action = 'followup_set';
        break;

      case 'meeting_done':
        lead.strategyNote = data.strategyNote;
        activityData.action = 'meeting_done';
        // For now stays converted or stays meeting (based on prompt)
        // prompt says "status = 'converted' or stays 'meeting_direct'/'meeting_virtual' (just log for now)"
        break;

      case 'escalate':
        lead.status = 'escalated';
        lead.escalatedTo = data.escalateTo;
        lead.escalationNote = data.note;
        activityData.action = 'escalated';
        break;

      case 'reallocate':
        lead.owner = data.newOwner;
        activityData.action = 'reallocated';
        break;

      case 'confirm_meeting': {
        // Executive called and confirmed the meeting is happening.
        // Clear the confirmation task subStatus.
        lead.subStatus = null;
        activityData.action = 'meeting_confirmed';
        activityData.note = data.note || 'Meeting confirmed by executive';

        // For virtual meetings: if the meeting is still > 30 min away,
        // push nextActionAt to 30 min before so the 30-min cron can
        // detect it and create the final confirmation task.
        if (lead.status === 'meeting_virtual' && lead.meetingAt) {
          const thirtyMinBefore = new Date(lead.meetingAt.getTime() - 30 * 60 * 1000);
          if (thirtyMinBefore > new Date()) {
            lead.nextActionAt = thirtyMinBefore;
          }
        }
        break;
      }

      default:
        throw new Error('Invalid transition action');
    }

    await lead.save();
    // Skip activity log for system-triggered transitions that have no real performer
    if (activityData.action) {
      await LeadActivity.create(activityData);
    }
    return lead;
  },

  /**
   * Get sorted lead queue for executive
   */
  async getQueue(userId) {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const CLOSED_STATUSES = ['converted', 'lost', 'not_interested', 'blocking_amount_received', 'full_amount_received', 'agreement_signed'];
    const leads = await Lead.find({ owner: userId, status: { $nin: CLOSED_STATUSES } });

    // SORT ORDER:
    // 1. Direct meetings scheduled for today
    // 2. Virtual meetings scheduled for today
    // 3. Follow-ups due today (hot first, then warm, then cold, then call-back/RNR)
    // 4. New leads allocated

    return leads.sort((a, b) => {
      const getPriorityValue = (lead) => {
        const isTodayMeeting = lead.meetingAt && lead.meetingAt >= todayStart && lead.meetingAt <= todayEnd;
        if (isTodayMeeting && lead.status === 'meeting_direct') return 1;
        if (isTodayMeeting && lead.status === 'meeting_virtual') return 2;
        
        const isTodayFollowup = lead.nextActionAt && lead.nextActionAt <= todayEnd;
        if (isTodayFollowup) {
          if (lead.priority === 'hot') return 3;
          if (lead.priority === 'warm') return 4;
          if (lead.priority === 'cold') return 5;
          return 6; // RNR etc
        }
        
        if (lead.status === 'new') return 7;
        return 8;
      };

      const valA = getPriorityValue(a);
      const valB = getPriorityValue(b);

      if (valA !== valB) return valA - valB;
      
      // Secondary sort by date
      const dateA = a.meetingAt || a.nextActionAt || a.createdAt;
      const dateB = b.meetingAt || b.nextActionAt || b.createdAt;
      return dateA - dateB;
    });
  },

  /**
   * Get suggested dates for a state
   */
  async getSuggestedDates(state) {
    return await getNextWorkingDays(4, state);
  },
  
  /**
   * Comprehensive workflow data for "Start My Work"
   */
  async getWorkflowData(userId) {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const fullQueue = await this.getQueue(userId);
    
    // 1. Current Lead
    const currentLead = fullQueue[0] || null;

    // 2. Task Sequence (Next 5)
    const taskSequence = fullQueue.slice(0, 8).map((l, i) => ({
      id: l._id,
      index: i + 1,
      name: l.company || l.name,
      type: l.status.includes('meeting') ? 'Meeting' : l.status === 'new' ? 'New Lead' : 'Follow-up',
      time: l.meetingAt || l.nextActionAt,
      priority: l.priority
    }));

    // 3. Today's Meetings
    const todayMeetings = await Lead.find({
      owner: userId,
      meetingAt: { $gte: todayStart, $lte: todayEnd }
    }).sort({ meetingAt: 1 });

    const meetingsFormatted = todayMeetings.map(m => ({
      id: m._id,
      name: m.company || m.name,
      time: m.meetingAt,
      type: m.status === 'meeting_virtual' ? 'Virtual' : 'Direct',
      status: m.status === 'meeting_done' ? 'DONE' : (new Date(m.meetingAt) < new Date() ? 'NOW' : 'CONFIRM'),
      location: m.city || m.address || 'Online'
    }));

    // 4. Live Activity Feed
    const activityFeed = await LeadActivity.find({ performedBy: userId })
      .populate('lead', 'name company')
      .sort({ createdAt: -1 })
      .limit(10);

    const feedFormatted = activityFeed.map(a => ({
      id: a._id,
      action: a.action,
      leadName: a.lead?.company || a.lead?.name || 'Unknown',
      time: a.createdAt,
      note: a.note
    }));

    return {
      currentLead,
      taskSequence,
      todayMeetings: meetingsFormatted,
      activityFeed: feedFormatted,
      queueLength: fullQueue.length
    };
  }
};

module.exports = leadService;
