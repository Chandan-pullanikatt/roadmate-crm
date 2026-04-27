import React, { useState } from 'react';
import { Button, Tag, Avatar } from '../../../components/ui';
import { dashboardApi } from '../../../api/dashboardApi';
import { useToast } from '../../../context/ToastContext';
import { useAuth } from '../../../context/AuthContext';
import { useQuery } from '@tanstack/react-query';

const Reports = () => {
  const [loading, setLoading] = useState(false);
  const { addToast } = useToast();
  const { user: currentUser } = useAuth();

  const { data: dashData } = useQuery({
    queryKey: ['dashboard', 'industry-manager'],
    queryFn: () => dashboardApi.getIndustryManagerDashboard().then(res => res.data)
  });

  const userInfo = dashData?.user || currentUser || {};

  const downloadCSV = (data, filename) => {
    if (!data || data.length === 0) {
      addToast("No data found for this report", "error");
      return;
    }
    
    const headers = Object.keys(data[0]).join(',');
    const rows = data.map(row => 
      Object.values(row).map(val => {
        if (val === null || val === undefined) return '""';
        return typeof val === 'string' ? `"${val.replace(/"/g, '""')}"` : val;
      }).join(',')
    ).join('\n');
    
    const csvContent = headers + "\n" + rows;
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `${filename}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    addToast(`${filename} downloaded successfully`, "success");
  };

  const generateReport = async (type) => {
    try {
      setLoading(true);
      const res = await dashboardApi.getReport(type);
      const data = res.data || [];
      
      let filename = "report";
      let formattedData = [];

      if (type === 'leads') {
        filename = "Lead_Lifecycle_Report";
        formattedData = data.map(l => ({
          Company: l.company,
          Contact: l.name,
          Email: l.email,
          Phone: l.phone,
          Status: l.status,
          Priority: l.priority,
          Owner: l.owner?.name || 'Unassigned',
          LastActivity: l.history?.length > 0 ? new Date(l.history[0].createdAt).toLocaleDateString() : 'N/A'
        }));
      } else if (type === 'attendance') {
        filename = "Attendance_Audit_Report";
        formattedData = data.map(a => ({
          Employee: a.user?.name,
          Date: new Date(a.date).toLocaleDateString(),
          Status: a.status,
          Efficiency: `${a.workPercentage || 0}%`,
          CheckIn: a.startTime || '-',
          CheckOut: a.endTime || '-'
        }));
      } else if (type === 'performance') {
        filename = "Team_Performance_Report";
        formattedData = data.map(p => ({
          Executive: p.name,
          District: p.district,
          Calls: p.callsToday || 0,
          Meetings: p.meetingsDone || 0,
          Conversions: p.conversionsTotal || 0,
          Efficiency: `${p.completionPct || 0}%`
        }));
      } else if (type === 'salary') {
        filename = "Salary_Breakdown_Report";
        formattedData = data.map(s => ({
          Executive: s.name,
          Basic: s.basic || 15000,
          Incentives: s.incentives || 2500,
          Leaves: s.leaves || 0,
          Final_Salary: (s.basic || 15000) + (s.incentives || 2500)
        }));
      }

      downloadCSV(formattedData, filename);
    } catch (err) {
      console.error("Error generating report", err);
      addToast("Failed to generate report", "error");
    } finally {
      setLoading(false);
    }
  };

  const reportCards = [
    { type: 'leads', title: 'Lead Report', sub: 'All leads · Status · Conversion', icon: '📊' },
    { type: 'performance', title: 'Staff Performance', sub: 'Daily · Weekly · Monthly', icon: '📈' },
    { type: 'revenue', title: 'Revenue Report', sub: 'By executive · By district', icon: '💰' },
    { type: 'attendance', title: 'Attendance Report', sub: 'Work % · Half days · Leaves', icon: '📅' },
    { type: 'salary', title: 'Salary Report', sub: 'Basic · Incentives · Leaves', icon: '💼' },
    { type: 'rnr', title: 'RNR & Reallocation', sub: 'Auto-reallocation history', icon: '🔀' },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-700 pb-12">
       {/* Page Header */}
       <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Reports</h1>
          <p className="text-sm text-text-muted">Lead, performance, revenue, attendance, salary</p>
        </div>
        <div className="flex items-center gap-3">
            <div className="relative">
                <input 
                    type="text" 
                    placeholder="Search leads, executives..." 
                    className="pl-10 pr-4 py-2 bg-surface2 border border-border rounded-xl text-[11px] font-bold focus:ring-2 focus:ring-purple/20 transition-all outline-none min-w-[280px]"
                />
                <span className="absolute left-3 top-1/2 -translate-y-1/2 opacity-40 text-sm">🔍</span>
            </div>
            <button className="w-10 h-10 rounded-xl bg-surface2 border border-border flex items-center justify-center hover:bg-surface3 transition-colors relative">
                <span className="text-lg">🔔</span>
            </button>
            <Avatar name={userInfo.name} size="md" className="border-2 border-purple/10" />
        </div>
      </div>

      {/* Sub Header Card */}
      <div className="bg-surface1 border border-border/40 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm">
        <div>
          <h2 className="text-lg font-bold">Reports · {userInfo.industry} · {userInfo.state}</h2>
          <p className="text-xs text-text-muted">Lead, performance, revenue, attendance, salary</p>
        </div>
        <Button className="bg-purple text-white border-none rounded-xl px-5 h-10 font-bold text-[11px] uppercase tracking-widest shadow-lg shadow-purple/10">
            Export All
        </Button>
      </div>

      {/* Reports Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
         {reportCards.map((card, idx) => (
            <div 
              key={idx} 
              onClick={() => generateReport(card.type)}
              className="card p-10 flex flex-col items-center text-center group hover:border-purple/30 transition-all shadow-lg shadow-purple/5 border-border/40 cursor-pointer"
            >
               <div className="w-16 h-16 rounded-3xl bg-surface2 flex items-center justify-center text-3xl mb-6 group-hover:scale-110 group-hover:bg-purple-light/20 transition-all duration-500 shadow-inner">
                  {card.icon}
               </div>
               <h3 className="text-lg font-black text-text-primary mb-2 uppercase tracking-tight group-hover:text-purple transition-colors">{card.title}</h3>
               <p className="text-[11px] text-text-muted font-bold uppercase tracking-tighter opacity-60 leading-relaxed">{card.sub}</p>
            </div>
         ))}
      </div>
    </div>
  );
};

export default Reports;
