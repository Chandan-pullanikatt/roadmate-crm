const User = require('../models/User');
const Attendance = require('../models/Attendance');
const Salary = require('../models/Salary');
const LeavePolicy = require('../models/LeavePolicy');
const LeadActivity = require('../models/LeadActivity');
const mongoose = require('mongoose');

/**
 * Generate monthly salary for all active users
 */
const generateMonthlySalary = async (month, year) => {
  try {
    console.log(`Generating salary for ${month}/${year}...`);
    
    const users = await User.find({ isActive: true });
    const results = [];

    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59, 999);

    for (const user of users) {
      if (user.role === 'founder') continue;

      // 1. Get Attendance Summary
      const attendances = await Attendance.find({
        user: user._id,
        date: { $gte: startDate, $lte: endDate }
      });

      const presentDays = attendances.filter(a => a.status === 'present').length;
      const halfDays = attendances.filter(a => a.status === 'half-day').length;
      const leaveDays = attendances.filter(a => a.status === 'leave').length;

      // 2. Get Policy (for working days)
      const policy = await LeavePolicy.findOne({ state: user.state, year }) || 
                     await LeavePolicy.findOne({ state: 'default', year });
      
      // Default to 26 working days if policy missing
      const workingDaysInMonth = 26; 

      // 3. Calculate Base Component
      const dailyRate = (user.basicSalary || 0) / workingDaysInMonth;
      const grossSalary = (dailyRate * presentDays) + (dailyRate * 0.5 * halfDays);

      // 4. Calculate Incentives (e.g. from conversions in that month)
      const conversions = await LeadActivity.countDocuments({
        performedBy: user._id,
        action: 'converted',
        createdAt: { $gte: startDate, $lte: endDate }
      });
      
      // Simple incentive: 500 per conversion (can be made dynamic later)
      const incentives = conversions * 500;

      const netSalary = Math.round(grossSalary + incentives);

      // 5. Upsert Salary Record
      const salaryRecord = await Salary.findOneAndUpdate(
        { user: user._id, month, year },
        {
          baseSalary: user.basicSalary || 0,
          incentives,
          netSalary,
          attendanceStats: {
            present: presentDays,
            halfDay: halfDays,
            leave: leaveDays
          },
          status: 'generated',
          generatedAt: new Date()
        },
        { upsert: true, new: true }
      );

      results.push(salaryRecord);
    }

    return results;
  } catch (error) {
    console.error('Salary Generation Error:', error);
    throw error;
  }
};

module.exports = {
  generateMonthlySalary
};
