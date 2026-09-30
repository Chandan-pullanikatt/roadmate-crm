const cron = require('node-cron');
const Attendance = require('../models/Attendance');
const Lead = require('../models/Lead');
const attendanceService = require('../services/attendanceService');
const leadService = require('../services/leadService');
const scheduleService = require('../services/scheduleService');
const pushService = require('../services/pushService');
const notificationService = require('../services/notificationService');
const { attendanceDay } = require('../utils/workingDays');

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
  // Pinned to IST. The server runs in UTC, so an unpinned 23:59 fired at 05:29
  // IST the NEXT morning -- completeWork then scored the new, empty day and
  // recorded every forgotten day as 0% (Mekha: 110 leads, 21 calls, 0%).
  cron.schedule('59 23 * * *', async () => {
    console.log('[Cron] Running daily attendance auto-complete...');
    try {
      const incomplete = await Attendance.find({
        date: attendanceDay(),
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

    try {
      const marked = await attendanceService.markAbsentees();
      console.log(`[Cron] Marked ${marked} absent (no login, no approved leave).`);
    } catch (err) {
      console.error('[Cron] Absentee marking error:', err.message);
    }
  }, { timezone: 'Asia/Kolkata' });

  // ─── 00:30 daily: Carry pending work to the next working day ─────────────
  // Anything not done on its day moves to the owner's next available working
  // day. Meetings and fixed follow-ups keep their date (see scheduleService).
  cron.schedule('30 0 * * *', async () => {
    try {
      const moved = await scheduleService.escalatePending();
      console.log(`[Cron] Carried ${moved} pending lead(s) forward.`);
    } catch (err) {
      console.error('[Cron] Pending carry-forward error:', err.message);
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

          // Browser push so the reminder lands even if the CRM isn't open
          const when = key === '1h' ? 'in 1 hour' : 'in 15 minutes';

          // ...and a bell entry, so a push dismissed on the road still leaves a
          // record. Booking a meeting is its own confirmation now, so this
          // reminder is the only prompt anyone gets.
          await notificationService.onMeetingReminder({
            userIds: [lead.owner, ...(lead.meetingInvitees || [])],
            leadName: payload.lead,
            meetingAt: lead.meetingAt,
            meetingType: payload.type,
            when,
            io,
          });

          pushService.sendToUsers([lead.owner, ...(lead.meetingInvitees || [])], {
            title: `Meeting ${when}`,
            body: `${payload.type === 'virtual' ? 'Virtual' : 'In-person'} meeting with ${payload.lead} ${when}.`,
            url: '/',
            tag: dedupKey,
            requireInteraction: key === '15m',
          });
        }
      }
    } catch (err) {
      console.error('[Cron] Meeting reminder error:', err.message);
    }
  });

  // ─── Every 15 min: Promote past-deadline tasks to overdue ──────────────
  // Authoritative sweep. The task list also promotes the rows it is about to
  // return, so a freshly-expired task shows correctly before this next runs.
  cron.schedule('*/15 * * * *', async () => {
    try {
      const Task = require('../models/Task');
      const res = await Task.updateMany(
        { status: 'pending', endDate: { $lt: new Date() } },
        { status: 'overdue' }
      );
      if (res.modifiedCount) {
        console.log(`[Cron] Marked ${res.modifiedCount} task(s) overdue.`);
      }
    } catch (err) {
      console.error('[Cron] Overdue task sweep error:', err.message);
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

  // The meeting-confirmation crons that used to live here (the 30-minute virtual
  // check and the 09:00 day-before direct check) are gone. Client rule: booking a
  // meeting is the confirmation, so there is no second confirmation call on
  // another day. Both pushed a task into the owner's queue by setting
  // nextActionAt, which is exactly the work the day-filtered queue must not carry.
  // The 1h/15m reminder above is what the owner and the invited managers get.

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
