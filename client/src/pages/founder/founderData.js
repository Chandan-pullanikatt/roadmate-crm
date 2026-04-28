/* ══════════════ FOUNDER DASHBOARD MOCK DATA ══════════════ */

export const stateMgrs = [
  { id: 1, name: 'Rahul Sharma', state: 'Maharashtra', av: 'RS', avClass: 'fd-av-state', leads: 224, converted: 48, revenue: '\u20B982.4L', workPct: 78, calls: 312, meetings: 28, status: 'Active' },
  { id: 2, name: 'Srinivas Reddy', state: 'Telangana', av: 'SR', avClass: 'fd-av-state', leads: 198, converted: 44, revenue: '\u20B974.1L', workPct: 82, calls: 286, meetings: 32, status: 'Active' },
  { id: 3, name: 'Karthik Nair', state: 'Karnataka', av: 'KN', avClass: 'fd-av-state', leads: 176, converted: 38, revenue: '\u20B968.8L', workPct: 74, calls: 244, meetings: 22, status: 'Active' },
  { id: 4, name: 'Meena Iyer', state: 'Tamil Nadu', av: 'MI', avClass: 'fd-av-state', leads: 162, converted: 35, revenue: '\u20B961.3L', workPct: 71, calls: 218, meetings: 19, status: 'Active' },
  { id: 5, name: 'Nikhil Patel', state: 'Gujarat', av: 'NP', avClass: 'fd-av-state', leads: 148, converted: 30, revenue: '\u20B955.7L', workPct: 68, calls: 196, meetings: 16, status: 'Active' },
];

export const executives = [
  { name: 'Anjali Kumar', state: 'TG', industry: 'Auto', handling: 42, connected: 28, followup: 12, converted: 8, revenue: '\u20B94.2L', workPct: 84, leaves: 1 },
  { name: 'Mohan Reddy', state: 'MH', industry: 'Electronics', handling: 38, connected: 24, followup: 10, converted: 6, revenue: '\u20B93.6L', workPct: 76, leaves: 2 },
  { name: 'Priya Sharma', state: 'KA', industry: 'FMCG', handling: 35, connected: 22, followup: 9, converted: 7, revenue: '\u20B93.9L', workPct: 81, leaves: 0 },
  { name: 'Vasu Krishnan', state: 'TN', industry: 'Pharma', handling: 31, connected: 19, followup: 8, converted: 5, revenue: '\u20B93.1L', workPct: 72, leaves: 3 },
  { name: 'Ravi Mehra', state: 'GJ', industry: 'Agri', handling: 28, connected: 16, followup: 7, converted: 4, revenue: '\u20B92.8L', workPct: 67, leaves: 1 },
  { name: 'Deepa Nair', state: 'TG', industry: 'Auto', handling: 40, connected: 26, followup: 11, converted: 9, revenue: '\u20B94.8L', workPct: 88, leaves: 0 },
];

export const leaveRequests = [
  { name: 'Rahul Sharma', role: 'State Manager, MH', av: 'RS', avClass: 'fd-av-state', type: 'Sick Leave', days: 2, from: 'Mar 28', to: 'Mar 29', reason: 'Fever and cold', status: 'pending' },
  { name: 'Kavitha Nair', role: 'Industry Mgr, TG', av: 'KN', avClass: 'fd-av-ind', type: 'Personal Leave', days: 1, from: 'Mar 27', to: 'Mar 27', reason: 'Personal work', status: 'pending' },
  { name: 'Anjali Kumar', role: 'Executive, TG', av: 'AK', avClass: 'fd-av-exec', type: 'Optional Holiday', days: 1, from: 'Mar 30', to: 'Mar 30', reason: 'Ugadi optional', status: 'pending' },
];

export const expectedLeads = [
  { name: 'TechVision Pvt Ltd', contact: 'Raj Kumar', state: 'TG', assignedTo: 'Srinivas Reddy', status: 'hot', date: 'Mar 27' },
  { name: 'Arjun Exports', contact: 'Arjun Mehta', state: 'MH', assignedTo: 'Rahul Sharma', status: 'warm', date: 'Mar 28' },
  { name: 'FreshHarvest Foods', contact: 'Priya Nair', state: 'KA', assignedTo: 'Karthik Nair', status: 'hot', date: 'Mar 27' },
  { name: 'MedPlus Distributors', contact: 'Vasu Reddy', state: 'TG', assignedTo: 'Anjali Kumar', status: 'warm', date: 'Mar 29' },
  { name: 'AutoParts Hub', contact: 'Suresh Naidu', state: 'TN', assignedTo: 'Meena Iyer', status: 'hot', date: 'Mar 27' },
];

export const allLeads = [
  { name: 'Raj Kumar', company: 'TechVision Pvt Ltd', phone: '98765 43210', assigned: 'Anjali K', status: 'hot', lastAction: 'Called · Note taken', nextFollowup: 'Today 4PM' },
  { name: 'Arjun Mehta', company: 'Arjun Exports', phone: '87654 32109', assigned: 'Mohan R', status: 'meeting', lastAction: 'Meeting scheduled', nextFollowup: 'Today 3PM' },
  { name: 'Priya Nair', company: 'FreshHarvest Foods', phone: '76543 21098', assigned: 'Priya S', status: 'warm', lastAction: 'WhatsApp replied', nextFollowup: 'Mar 28' },
  { name: 'Vasu Reddy', company: 'MedPlus Distributors', phone: '65432 10987', assigned: 'Vasu K', status: 'followup', lastAction: 'Follow-up call done', nextFollowup: 'Mar 29' },
  { name: 'Suresh N', company: 'AutoParts Hub', phone: '54321 09876', assigned: 'Ravi M', status: 'rnr', lastAction: 'RNR — afternoon retry', nextFollowup: 'Today PM' },
  { name: 'Deepa P', company: 'HomeStyle Furniture', phone: '43210 98765', assigned: 'Deepa N', status: 'converted', lastAction: 'Agreement signed', nextFollowup: '—' },
  { name: 'Kiran S', company: 'GrainFresh Agri', phone: '32109 87654', assigned: 'Anjali K', status: 'lost', lastAction: 'Not interested', nextFollowup: '—' },
];

export const attendanceData = [
  { name: 'Rahul Sharma', role: 'State Mgr', present: 22, absent: 1, halfDay: 1, leave: 0, workPct: 84, status: 'Active' },
  { name: 'Srinivas Reddy', role: 'State Mgr', present: 23, absent: 0, halfDay: 1, leave: 0, workPct: 88, status: 'Active' },
  { name: 'Anjali Kumar', role: 'Executive', present: 20, absent: 2, halfDay: 1, leave: 1, workPct: 74, status: 'Active' },
  { name: 'Mohan Reddy', role: 'Executive', present: 19, absent: 2, halfDay: 2, leave: 1, workPct: 70, status: 'Half Day' },
  { name: 'Kavitha Nair', role: 'Ind. Mgr', present: 21, absent: 1, halfDay: 2, leave: 0, workPct: 79, status: 'Active' },
  { name: 'Priya Sharma', role: 'Executive', present: 22, absent: 0, halfDay: 2, leave: 0, workPct: 86, status: 'Active' },
];

export const salaryData = [
  { name: 'Rahul Sharma', basic: 35000, workDays: 22, leaves: 1, deductions: 1591, incentives: 8000, net: 41409 },
  { name: 'Srinivas Reddy', basic: 35000, workDays: 23, leaves: 0, deductions: 0, incentives: 9500, net: 44500 },
  { name: 'Anjali Kumar', basic: 22000, workDays: 20, leaves: 1, deductions: 1000, incentives: 4200, net: 25200 },
  { name: 'Mohan Reddy', basic: 22000, workDays: 19, leaves: 1, deductions: 2000, incentives: 3600, net: 23600 },
];

export const upcomingEvents = [
  { time: 'Today 3:00 PM', title: 'Virtual Meeting — Arjun Exports', person: 'Srinivas Reddy (TG)', type: 'meeting' },
  { time: 'Today 5:00 PM', title: 'Follow-up Call — TechVision', person: 'Anjali Kumar (TG)', type: 'followup' },
  { time: 'Mar 27 10:00 AM', title: 'Direct Meeting — AutoParts Hub', person: 'Mohan Reddy (MH)', type: 'direct' },
  { time: 'Mar 28 2:00 PM', title: 'Virtual Meeting — FreshHarvest', person: 'Karthik Nair (KA)', type: 'meeting' },
  { time: 'Mar 29', title: 'Rahul Sharma Leave (pending approval)', person: 'State Mgr, MH', type: 'leave' },
];

export const indMgrPerf = [
  { name: 'Kavitha Nair', state: 'TG', industry: 'Electronics', workPct: 82, calls: 98, meetings: 11, followups: 34, revenue: '\u20B914.8L', leaves: 0 },
  { name: 'Vijay Reddy', state: 'TG', industry: 'Automobile', workPct: 78, calls: 112, meetings: 14, followups: 42, revenue: '\u20B922.4L', leaves: 1 },
  { name: 'Sunita Prasad', state: 'MH', industry: 'FMCG', workPct: 68, calls: 76, meetings: 8, followups: 28, revenue: '\u20B99.6L', leaves: 2 },
  { name: 'Dr. Prasad', state: 'MH', industry: 'Pharma', workPct: 84, calls: 88, meetings: 10, followups: 32, revenue: '\u20B911.2L', leaves: 0 },
  { name: 'Ramesh Goud', state: 'KA', industry: 'Agriculture', workPct: 71, calls: 64, meetings: 7, followups: 24, revenue: '\u20B97.4L', leaves: 1 },
];

export const fmt = (n) => '\u20B9' + Number(n).toLocaleString('en-IN');

export const statusMap = { hot: 'fd-ls-hot', warm: 'fd-ls-warm', cold: 'fd-ls-cold', rnr: 'fd-ls-rnr', converted: 'fd-ls-converted', lost: 'fd-ls-lost', followup: 'fd-ls-followup', meeting: 'fd-ls-meeting' };

export const perfColor = (pct) => pct >= 80 ? 'var(--accent)' : pct >= 60 ? 'var(--amber)' : 'var(--red)';
