import React, { useState } from 'react';
import { Button, Tag } from '../../../components/ui';
import { dashboardApi } from '../../../api/dashboardApi';
import { useToast } from '../../../context/ToastContext';
import { useAuth } from '../../../context/AuthContext';

const Reports = () => {
  const [loading, setLoading] = useState(false);
  const { addToast } = useToast();
  const { user: currentUser } = useAuth();

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
      }

      downloadCSV(formattedData, filename);
    } catch (err) {
      console.error("Error generating report", err);
      addToast("Failed to generate report", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="bg-gradient-to-br from-purple to-purple-mid p-8 rounded-3xl text-white shadow-xl shadow-purple/20">
         <h2 className="text-2xl font-bold tracking-tight mb-2">Team Analytics & Reports</h2>
         <p className="text-purple-light/80 text-sm max-w-lg mb-6">Generate detailed CSV reports for leads, team attendance, and revenue metrics. Data is scoped to your industry and assigned districts.</p>
         <div className="flex gap-4">
            <Tag className="bg-white/20 text-white border-transparent backdrop-blur-md">Industry: {currentUser?.industry || 'N/A'}</Tag>
            <Tag className="bg-white/20 text-white border-transparent backdrop-blur-md">State: {currentUser?.state || 'N/A'}</Tag>
         </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
         {/* Lead Report */}
         <div className="bg-surface border border-border rounded-2xl p-6 shadow-sm flex flex-col items-center text-center group hover:border-purple/30 transition-all">
            <div className="w-14 h-14 rounded-2xl bg-purple-light text-purple flex items-center justify-center text-2xl mb-4 group-hover:scale-110 transition-transform">📊</div>
            <h3 className="font-bold text-text-primary mb-2">Lead Lifecycle Report</h3>
            <p className="text-xs text-text-muted mb-6 px-4 leading-relaxed">Full breakdown of all leads, current owner, status history, and conversion probability.</p>
            <Button 
               className="w-full bg-surface2 text-text-primary border border-border hover:bg-purple hover:text-white transition-all"
               onClick={() => generateReport('leads')}
               disabled={loading}
            >
               {loading ? 'Preparing...' : 'Download CSV'}
            </Button>
         </div>

         {/* Attendance Report */}
         <div className="bg-surface border border-border rounded-2xl p-6 shadow-sm flex flex-col items-center text-center group hover:border-accent/30 transition-all">
            <div className="w-14 h-14 rounded-2xl bg-accent-light text-accent flex items-center justify-center text-2xl mb-4 group-hover:scale-110 transition-transform">📅</div>
            <h3 className="font-bold text-text-primary mb-2">Team Attendance Audit</h3>
            <p className="text-xs text-text-muted mb-6 px-4 leading-relaxed">Daily logs, check-in/out times, and work percentage metrics for district executives.</p>
            <Button 
               className="w-full bg-surface2 text-text-primary border border-border hover:bg-accent hover:text-white transition-all"
               onClick={() => generateReport('attendance')}
               disabled={loading}
            >
               {loading ? 'Preparing...' : 'Download CSV'}
            </Button>
         </div>

         {/* Revenue Report */}
         <div className="bg-surface border border-border rounded-2xl p-6 shadow-sm flex flex-col items-center text-center group hover:border-amber/30 transition-all">
            <div className="w-14 h-14 rounded-2xl bg-amber-light text-amber flex items-center justify-center text-2xl mb-4 group-hover:scale-110 transition-transform">📈</div>
            <h3 className="font-bold text-text-primary mb-2">Performance & Growth</h3>
            <p className="text-xs text-text-muted mb-6 px-4 leading-relaxed">Consolidated performance data, executive contribution, and district rankings.</p>
            <Button 
               className="w-full bg-surface2 text-text-primary border border-border hover:bg-amber hover:text-white transition-all"
               onClick={() => generateReport('performance')}
               disabled={loading}
            >
               {loading ? 'Preparing...' : 'Download CSV'}
            </Button>
         </div>
      </div>

      <div className="p-10 border border-border border-dashed rounded-3xl bg-surface2/30 flex flex-col items-center text-center">
         <div className="w-10 h-10 rounded-full bg-surface border border-border flex items-center justify-center text-text-muted mb-4 opacity-50 font-bold">?</div>
         <h4 className="text-sm font-bold text-text-secondary mb-1">Need custom data filtering?</h4>
         <p className="text-xs text-text-muted max-w-sm leading-relaxed">Advanced reporting filters are coming soon. For now, you can download full datasets and filter them locally using Excel or Sheets.</p>
      </div>
    </div>
  );
};

export default Reports;
