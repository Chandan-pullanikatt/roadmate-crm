const cron = require('node-cron');
const Attendance = require('../models/Attendance');
const Lead = require('../models/Lead');
const attendanceService = require('../services/attendanceService');
const leadService = require('../services/leadService');

// In-memory dedup: prevents duplicate reminder pushes within the same day.
// Cleared at midnight each night.
const remindedFor1h  = new Set();
const remindedFor15m = new Set();

/**
 * Initialize all cron jobs.
 * @param {Object} io - Socket.io instance for real-time notifications
 */
const initCronJobs = (io = null) => {

  // ─── 23:59 daily: Auto-complete attendance for staff who forgot ───────────
  cron.schedule('59 23 * * *', async () => {
    console.log('[Cron] Running daily attendance auto-complete...');
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const incomplete = await Attendance.find({
        date: today,
        workStartedAt: { $exists: true },
        workCompletedAt: { $exists: false }
      });

      console.log(`[Cron] Found ${incomplete.length} incomplete attendance records.`);

      for (const record of incomplete) {
        try {
          await attendanceService.completeWork(record.user, record._id);
        } catch (err) {
          console.error(`[Cron] Failed auto-complete for user ${record.user}: ${err.message}`);
        }
      }
    } catch (err) {
      console.error('[Cron] Attendance auto-complete error:', err.message);
    }
  });

  // ─── 00:01 on 1st of month: Generate salary for previous month ───────────
  cron.schedule('1 0 1 * *', async () => {
    console.log('[Cron] Running monthly salary generation...');
    try {
      const lastMonth = new Date();
      lastMonth.setMonth(lastMonth.getMonth() - 1);
      const month = lastMonth.getMonth() + 1;
      const year = lastMonth.getFullYear();

      const salaryService = require('../services/salaryService');
      await salaryService.generateMonthlySalary(month, year);
      console.log('[Cron] Salary generation completed.');
    } catch (err) {
      console.error('[Cron] Salary generation error:', err.message);
    }
  });

  // ─── Every 2 min: Scan for upcoming meetings, push reminders ────────────
  // Emits meeting:reminder_1h  (55–65 min window)
  //        meeting:reminder_15m (13–17 min window)
  // to the lead owner + any invited managers via Socket.io.
  cron.schedule('*/2 * * * *', async () => {
    if (!io) return;
    try {
      const now = new Date();

      const windows = [
        { key: '1h',  minMs: 55 * 60 * 1000, maxMs: 65 * 60 * 1000, set: remindedFor1h,  event: 'meeting:reminder_1h'  },
        { key: '15m', minMs: 13 * 60 * 1000, maxMs: 17 * 60 * 1000, set: remindedFor15m, event: 'meeting:reminder_15m' },
      ];

      for (const { key, minMs, maxMs, set, event } of windows) {
        const from = new Date(now.getTime() + minMs);
        const to   = new Date(now.getTime() + maxMs);

        const upcomingLeads = await Lead.find({
          status: { $in: ['meeting_virtual', 'meeting_direct'] },
          meetingAt: { $gte: from, $lte: to },
          owner: { $exists: true, $ne: null },
        }).select('_id company name owner meetingAt meetingLink meetingInvitees status');

        for (const lead of upcomingLeads) {
          const dedupKey = `${lead._id}-${key}`;
          if (set.has(dedupKey)) continue; // already notified today
          set.add(dedupKey);

          const payload = {
            leadId:      lead._id,
            lead:        lead.company || lead.name,
            meetingAt:   lead.meetingAt,
            meetingLink: lead.meetingLink || null,
            type:        lead.status === 'meeting_virtual' ? 'virtual' : 'direct',
            reminderType: key,
          };

          // Notify the lead owner (executive)
          io.to(lead.owner.toString()).emit(event, payload);

          // Notify any invited managers
          (lead.meetingInvitees || []).forEach(inviteeId => {
            io.to(inviteeId.toString()).emit(event, payload);
          });
        }
      }
    } catch (err) {
      console.error('[Cron] Meeting reminder error:', err.message);
    }
  });

  // ─── Midnight: Reset meeting reminder tracking sets ───────────────────
  cron.schedule('0 0 * * *', () => {
    remindedFor1h.clear();
    remindedFor15m.clear();
    console.log('[Cron] Meeting reminder tracking sets reset for new day.');
  });

  // ─── Every hour 9–18 Mon–Sat: Push DM retry notifications ──────────────
  // For any direct-meeting lead whose hourly retry window has arrived,
  // emit lead:dm_retry so the executive's queue refreshes immediately.
  cron.schedule('0 9-18 * * 1-6', async () => {
    if (!io) return;
    try {
      const now = new Date();
      const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
      const todayEnd   = new Date(); todayEnd.setHours(23, 59, 59, 999);

      const dmRetryLeads = await Lead.find({
        status: 'meeting_direct',
        meetingAt: { $gte: todayStart, $lte: todayEnd },
        nextActionAt: { $lte: now },
        owner: { $exists: true, $ne: null }
      }).select('_id company name owner meetingAt');

      for (const lead of dmRetryLeads) {
        io.to(lead.owner.toString()).emit('lead:dm_retry', {
          leadId: lead._id,
          leadName: lead.company || lead.name,
          meetingAt: lead.meetingAt
        });
      }

      if (dmRetryLeads.length) {
        console.log(`[Cron] DM retry push sent for ${dmRetryLeads.length} lead(s).`);
      }
    } catch (err) {
      console.error('[Cron] DM retry push error:', err.message);
    }
  });

  // ─── Every 5 min: Virtual meeting 30-min final confirmation task ─────────
  // Detects VM leads whose meeting is 28–32 min away and have not yet had
  // the 30-min confirmation queued. Pushes them to the executive's queue now.
  cron.schedule('*/5 * * * *', async () => {
    if (!io) return;
    try {
      const now = new Date();
      const in28 = new Date(now.getTime() + 28 * 60 * 1000);
      const in32 = new Date(now.getTime() + 32 * 60 * 1000);

      const vmLeads = await Lead.find({
        status: 'meeting_virtual',
        meetingAt: { $gte: in28, $lte: in32 },
        subStatus: { $nin: ['30m_confirm_queued', null, undefined] }, // already confirmed once
        owner: { $exists: true, $ne: null },
      }).select('_id company name owner meetingAt meetingLink subStatus');

      for (const lead of vmLeads) {
        lead.nextActionAt = now;
        lead.subStatus = '30m_confirm_queued'; // mark as queued so we don't repeat
        await lead.save();

        io.to(lead.owner.toString()).emit('lead:confirmation_task', {
          leadId:    lead._id,
          leadName:  lead.company || lead.name,
          meetingAt: lead.meetingAt,
          taskType:  '30m_vm_confirm',
        });
      }
    } catch (err) {
      console.error('[Cron] VM 30-min confirmation error:', err.message);
    }
  });

  // ─── 09:00 AM Mon–Sat: Day-before DM confirmation task ───────────────────
  // Finds direct-meeting leads scheduled for tomorrow that have not yet had
  // the day-before confirmation queued. Pushes them into the executive's queue.
  cron.schedule('0 9 * * 1-6', async () => {
    if (!io) return;
    try {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStart = new Date(tomorrow); tomorrowStart.setHours(0, 0, 0, 0);
      const tomorrowEnd   = new Date(tomorrow); tomorrowEnd.setHours(23, 59, 59, 999);

      const dmLeads = await Lead.find({
        status: 'meeting_direct',
        meetingAt: { $gte: tomorrowStart, $lte: tomorrowEnd },
        subStatus: 'day_before_confirm', // only those still waiting for day-before confirm
        owner: { $exists: true, $ne: null },
      }).select('_id company name owner meetingAt subStatus');

      for (const lead of dmLeads) {
        lead.nextActionAt = new Date();
        lead.subStatus = 'day_before_queued'; // advance state so cron doesn't re-trigger
        await lead.save();

        io.to(lead.owner.toString()).emit('lead:confirmation_task', {
          leadId:    lead._id,
          leadName:  lead.company || lead.name,
          meetingAt: lead.meetingAt,
          taskType:  'day_before_dm_confirm',
        });
      }

      if (dmLeads.length) {
        console.log(`[Cron] Day-before DM confirmation queued for ${dmLeads.length} lead(s).`);
      }
    } catch (err) {
      console.error('[Cron] Day-before DM confirmation error:', err.message);
    }
  });

  // ─── 09:05 AM Mon–Sat: Auto-sweep overdue RNR leads ─────────────────────
  // Finds leads still in 'rnr' status whose nextActionAt was yesterday or
  // earlier and haven't been contacted since — auto-increments their RNR
  // counter, triggering reallocation or auto-lost when thresholds are hit.
  cron.schedule('5 9 * * 1-6', async () => {
    console.log('[Cron] Running RNR overdue sweep...');
    try {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      yesterday.setHours(23, 59, 59, 999);

      // Leads that were due yesterday or earlier with no call since they were scheduled
      const overdueLeads = await Lead.find({
        status: 'rnr',
        nextActionAt: { $lte: yesterday },
        $or: [
          { lastCallAt: { $exists: false } },
          { $expr: { $lt: ['$lastCallAt', '$nextActionAt'] } }
        ]
      }).select('_id company name rnrCount state industry owner');

      console.log(`[Cron] Found ${overdueLeads.length} overdue RNR lead(s).`);

      for (const lead of overdueLeads) {
        try {
          await leadService.transition(
            lead._id,
            'mark_rnr',
            { note: `Auto-incremented by system: lead not contacted on scheduled date (count was ${lead.rnrCount})` },
            null, // system-triggered, no user performer
            io
          );
          console.log(`[Cron] Auto-RNR processed: ${lead.company || lead.name} (${lead._id})`);
        } catch (err) {
          console.error(`[Cron] Failed to process overdue lead ${lead._id}: ${err.message}`);
        }
      }
    } catch (err) {
      console.error('[Cron] RNR sweep error:', err.message);
    }
  });

  console.log('[Cron] All cron jobs initialized');
};

module.exports = initCronJobs;
