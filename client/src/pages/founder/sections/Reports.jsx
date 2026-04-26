import React, { useState } from 'react';
import { dashboardApi } from '../../../api/dashboardApi';
import { Button, Tag, DataTable } from '../../../components/ui';
import { useToast } from '../../../context/ToastContext';

const Reports = () => {
  const { addToast } = useToast();
  const [activeTab, setActiveTab] = useState('lead');
  const [loading, setLoading] = useState(false);

  const reportTypes = [
    { id: 'lead', label: 'Lead Report' },
    { id: 'performance', label: 'Performance Report' },
    { id: 'attendance', label: 'Attendance Report' },
    { id: 'salary', label: 'Salary Report' },
    { id: 'revenue', label: 'Revenue Report' }
  ];

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
      const res = await dashboardApi.getReport(type === 'lead' ? 'leads' : type);
      const data = res.data || [];
      
      let formatted = [];
      if (type === 'lead') {
        formatted = data.map(l => ({
          ID: l.leadId, Company: l.company, Status: l.status, State: l.state, Owner: l.owner?.name
        }));
      } else if (type === 'performance') {
        formatted = data.map(p => ({
          Name: p.name, Role: p.role, Efficiency: `${p.completionPct}%`, Revenue: p.revenue
        }));
      } else if (type === 'attendance') {
        formatted = data.map(a => ({
          Name: a.user?.name, Status: a.status, WorkPct: `${a.workPercentage}%`, Date: a.date
        }));
      }

      downloadCSV(formatted, type.toUpperCase());
    } catch (err) {
      addToast("Failed to generate report", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="animate-in fade-in duration-500">
      <div className="section-header">
        <div>
          <div className="section-title">Enterprise Analytics & Reports</div>
          <div className="section-sub">Consolidated platform data · Multi-state summaries · Global exports</div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => generateReport('performance')}>Export All Data</Button>
        </div>
      </div>

      <div className="inline-tabs mb-6">
        {reportTypes.map(t => (
          <div 
            key={t.id} 
            className={`inline-tab ${activeTab === t.id ? 'active' : ''}`} 
            onClick={() => setActiveTab(t.id)}
          >
            {t.label}
          </div>
        ))}
      </div>

      <div className="card">
        <div className="card-header border-b border-border bg-surface2/10 flex justify-between items-center">
          <div className="section-title text-sm">{reportTypes.find(t => t.id === activeTab).label} — Global View</div>
          <Button className="bg-purple text-white" size="sm" disabled={loading} onClick={() => generateReport(activeTab)}>
            {loading ? 'Processing...' : 'Download Master CSV'}
          </Button>
        </div>
        <div className="p-12 text-center text-text-muted">
           <div className="text-4xl mb-4 opacity-50">📂</div>
           <div className="text-sm font-bold text-text-secondary">Ready for Export</div>
           <p className="text-xs max-w-[300px] mx-auto mt-2 leading-relaxed">
              Platform-wide {activeTab} data is aggregated and ready for generation. Click the button above to download the latest cross-state records.
           </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
         {[
           { lbl: 'Total Reports', val: '18', icon: '📝' },
           { lbl: 'Last Export', val: 'Today', icon: '⏰' },
           { lbl: 'Storage Usage', val: '1.2 GB', icon: '☁️' },
           { lbl: 'System Status', val: 'Healthy', icon: '✅' }
         ].map((s, i) => (
           <div key={i} className="card p-4 flex items-center gap-4">
              <div className="w-10 h-10 bg-surface2 rounded-xl flex items-center justify-center text-xl">{s.icon}</div>
              <div>
                 <div className="text-[10px] font-bold text-text-muted uppercase">{s.lbl}</div>
                 <div className="text-sm font-bold">{s.val}</div>
              </div>
           </div>
         ))}
      </div>
    </div>
  );
};

export default Reports;
