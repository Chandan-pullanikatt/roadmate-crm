const Lead = require('../models/Lead');
const LeadActivity = require('../models/LeadActivity');
const User = require('../models/User');
const LeavePolicy = require('../models/LeavePolicy');
const mongoose = require('mongoose');

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
   * Transition lead state
   */
  async transition(leadId, action, data, performedBy) {
    const lead = await Lead.findById(leadId);
    if (!lead) throw new Error('Lead not found');

    const activityData = {
      lead: lead._id,
      performedBy: performedBy._id,
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
        } else if (nextAction === 'direct_meeting') {
          lead.status = 'meeting_direct';
          lead.meetingAt = new Date(data.meetingAt);
          if (data.meetingInvitees) lead.meetingInvitees = data.meetingInvitees;
          activityData.action = 'meeting_scheduled';
        }
        break;

      case 'mark_rnr':
        lead.rnrCount = (lead.rnrCount || 0) + 1;
        activityData.action = 'rnr';
        
        if (lead.rnrCount === 1) {
          const today = new Date();
          today.setHours(13, 30, 0, 0);
          lead.nextActionAt = today;
        } else if (lead.rnrCount === 2) {
          const nextDay = new Date();
          nextDay.setDate(nextDay.getDate() + 1);
          // Simple random time between 10 AM and 2 PM
          const randomHour = Math.floor(Math.random() * (14 - 10 + 1)) + 10;
          const randomMin = Math.floor(Math.random() * 60);
          nextDay.setHours(randomHour, randomMin, 0, 0);
          lead.nextActionAt = nextDay;
        } else if (lead.rnrCount === 3) {
          const twoDaysLater = new Date();
          twoDaysLater.setDate(twoDaysLater.getDate() + 2);
          const randomHour = Math.floor(Math.random() * (16 - 9 + 1)) + 9;
          twoDaysLater.setHours(randomHour, 0, 0, 0);
          lead.nextActionAt = twoDaysLater;
        } else if (lead.rnrCount >= 4) {
          // Reallocate
          const otherExec = await User.findOne({
            role: 'executive',
            isActive: true,
            state: lead.state,
            industry: lead.industry,
            _id: { $ne: lead.owner }
          });

          if (otherExec) {
            lead.owner = otherExec._id;
            activityData.action = 'reallocated';
            activityData.note = `Auto-reallocated due to RNR count ${lead.rnrCount}. Previous owner: ${lead.owner}`;
          } else if (lead.rnrCount >= 5) {
            lead.status = 'lost';
            lead.lostAt = new Date();
            activityData.action = 'lost';
          }
        }
        break;

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

      default:
        throw new Error('Invalid transition action');
    }

    await lead.save();
    await LeadActivity.create(activityData);
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

    const leads = await Lead.find({ owner: userId, status: { $nin: ['converted', 'lost', 'not_interested'] } });

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
