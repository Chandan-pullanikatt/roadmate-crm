const cron = require('node-cron');
const Attendance = require('../models/Attendance');
const attendanceService = require('../services/attendanceService');

/**
 * Initialize all cron jobs
 */
const initCronJobs = () => {
  // At 23:59 daily: Auto-complete work for all who didn't
  cron.schedule('59 23 * * *', async () => {
    console.log('Running daily attendance auto-complete cron...');
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const incomplete = await Attendance.find({
        date: today,
        workStartedAt: { $exists: true },
        workCompletedAt: { $exists: false }
      });

      console.log(`Found ${incomplete.length} incomplete records.`);

      for (const record of incomplete) {
        try {
          await attendanceService.completeWork(record.user, record._id);
          console.log(`Auto-completed for user ${record.user}`);
        } catch (err) {
          console.error(`Failed to auto-complete for user ${record.user}: ${err.message}`);
        }
      }
    } catch (err) {
      console.error('Cron job error:', err.message);
    }
  });

  // At 00:01 on the 1st of every month: Generate salary for previous month
  cron.schedule('1 0 1 * *', async () => {
    console.log('Running monthly salary generation cron...');
    try {
      const lastMonth = new Date();
      lastMonth.setMonth(lastMonth.getMonth() - 1);
      const month = lastMonth.getMonth() + 1;
      const year = lastMonth.getFullYear();

      const salaryService = require('../services/salaryService');
      await salaryService.generateMonthlySalary(month, year);
      console.log('Salary generation completed.');
    } catch (err) {
      console.error('Salary cron error:', err.message);
    }
  });

  console.log('Cron jobs initialized');
};

module.exports = initCronJobs;
