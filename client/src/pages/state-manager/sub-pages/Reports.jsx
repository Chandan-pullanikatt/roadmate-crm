import React, { useState } from 'react';
import { dashboardApi } from '../../../api/dashboardApi';
import { Button, Tag, DataTable } from '../../../components/ui';
import { useToast } from '../../../context/ToastContext';

const Reports = () => {
  const { addToast } = useToast();
  const [loading, setLoading] = useState(false);

  const downloadCSV = (data, filename) => {
    if (!data || data.length === 0) {
      addToast("No data available for this report", "error");
      return;
    }
    const headers = Object.keys(data[0]).join(',');
    const rows = data.map(row => 
      Object.values(row).map(val => 
        typeof val === 'string' ? `"${val.replace(/"/g, '""')}"` : val
      ).join(',')
    ).join('\n');
    
    const blob = new Blob([headers + "\n" + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${filename}_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    addToast(`${filename} generated successfully`, "success");
  };

  const generateReport = async (type) => {
    try {
      setLoading(true);
      const res = await dashboardApi.getReport(type);
      const data = res.data || [];
      
      let filename = type.toUpperCase();
      let formatted = [];

      if (type === 'leads') {
        formatted = data.map(l => ({
          ID: l.leadId,
          Company: l.company,
          Contact: l.name,
          Status: l.status,
          Industry: l.industry,
          District: l.district,
          Owner: l.owner?.name || 'Unassigned',
          Created: new Date(l.createdAt).toLocaleDateString()
        }));
      } else if (type === 'performance') {
        formatted = data.map(p => ({
          Name: p.name,
          Role: p.role,
          Industry: p.industry,
          Calls: p.callsToday || 0,
          Conversions: p.conversionsTotal || 0,
          Efficiency: `${p.completionPct || 0}%`,
          Revenue: p.revenue || 0
        }));
      } else if (type === 'attendance') {
        formatted = data.map(a => ({
          Name: a.user?.name,
          Date: new Date(a.date).toLocaleDateString(),
          Status: a.status,
          CheckIn: a.startTime,
          WorkPct: `${a.workPercentage || 0}%`
        }));
      }

      downloadCSV(formatted, filename);
    } catch (err) {
      addToast("Failed to generate report", "error");
    } finally {
      setLoading(false);
    }
  };

  const reportCards = [
    { id: 'leads', title: 'Lead Lifecycle', desc: 'All leads, status, and conversion history.', icon: '📊' },
    { id: 'performance', title: 'Performance Matrix', desc: 'Staff activity, revenue, and efficiency.', icon: '📈' },
    { id: 'attendance', title: 'Attendance Logs', desc: 'Punch-in times and work percentages.', icon: '📅' },
  ];

  return (
    <div className="animate-in fade-in duration-500">
      <div className="section-header">
        <div>
          <div className="section-title">Operational Reports</div>
          <div className="section-sub">State-wide data aggregation and analytics for all verticals</div>
        </div>
        <Button className="bg-purple text-white" disabled={loading} onClick={() => generateReport('performance')}>Export All Aggregates</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        {reportCards.map((r, idx) => (
          <div 
            key={idx} 
            className="card hover:shadow-lg transition-all cursor-pointer group border border-border/30 hover:border-purple/30 bg-surface"
            onClick={() => !loading && generateReport(r.id)}
          >
            <div className="card-body py-12 flex flex-col items-center text-center">
              <div className="w-16 h-16 bg-surface2 rounded-2xl flex items-center justify-center text-4xl mb-6 group-hover:scale-110 transition-transform">{r.icon}</div>
              <div className="font-bold text-[15px] mb-2">{r.title}</div>
              <div className="text-[13px] text-text-muted leading-relaxed px-4">{r.desc}</div>
              <Button size="xs" variant="outline" className="mt-6">
                {loading ? 'Processing...' : 'Generate Now'}
              </Button>
            </div>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="card-header border-b border-border bg-surface2/10">
          <div className="section-title text-sm">Recent Generation History</div>
        </div>
        <div className="p-8 text-center text-text-muted text-xs italic">
          Download history is currently cleared on session refresh. Real-time exports are available above.
        </div>
      </div>
    </div>
  );
};

export default Reports;
