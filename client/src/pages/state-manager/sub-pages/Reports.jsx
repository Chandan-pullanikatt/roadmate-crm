import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { dashboardApi } from '../../../api/dashboardApi';
import { Button } from '../../../components/ui';
import { toast } from 'react-hot-toast';

const Reports = () => {
  const [loading, setLoading] = useState(false);

  const { data: dashData } = useQuery({
    queryKey: ['dashboard', 'state-manager'],
    queryFn: () => dashboardApi.getStateManagerDashboard().then(res => res.data)
  });

  const downloadCSV = (data, filename) => {
    if (!data || data.length === 0) {
      toast.error("No data available for this report");
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
    toast.success(`${filename} generated successfully`);
  };

  const generateReport = async (type) => {
    try {
      setLoading(true);
      const res = await dashboardApi.getReport(type, { limit: 1000 });
      const rawData = res.data?.data || res.data || [];
      
      let filename = type.toUpperCase() + "_REPORT";
      let formatted = [];

      switch(type) {
        case 'leads':
          formatted = rawData.map(l => ({
            ID: l.leadId,
            Business: l.business || l.company,
            Contact: l.name,
            Status: l.status,
            Industry: l.industry,
            District: l.district,
            Owner: l.owner?.name || 'Unassigned',
            Created: new Date(l.createdAt).toLocaleDateString()
          }));
          break;
        case 'performance':
          formatted = rawData.map(p => ({
            Name: p.user?.name,
            Industry: p.user?.industry,
            Calls: p.calls || 0,
            Meetings: p.meetings || 0,
            Conversions: p.conversions || 0,
            Revenue: p.revenue || 0
          }));
          break;
        case 'revenue':
          formatted = rawData.map(r => ({
            Date: r._id,
            Revenue: r.totalRevenue,
            Transactions: r.count
          }));
          break;
        case 'attendance':
          formatted = rawData.map(a => ({
            Name: a.user?.name,
            Role: a.user?.role,
            Date: new Date(a.date).toLocaleDateString(),
            Status: a.status,
            WorkPct: `${a.workPercentage || 0}%`,
            Efficiency: `${a.completionPct || 0}%`
          }));
          break;
        case 'salary':
          formatted = rawData.map(s => ({
            Name: s.user?.name,
            Period: `${s.month}/${s.year}`,
            Base: s.baseSalary,
            Incentives: s.incentives,
            Net: s.netSalary
          }));
          break;
        case 'leaves':
          formatted = rawData.map(l => ({
            Name: l.user?.name,
            Type: l.type,
            From: new Date(l.fromDate).toLocaleDateString(),
            To: new Date(l.toDate).toLocaleDateString(),
            Days: l.days,
            Status: l.status
          }));
          break;
        default:
          formatted = rawData;
      }

      downloadCSV(formatted, filename);
    } catch (err) {
      toast.error("Failed to generate report");
    } finally {
      setLoading(false);
    }
  };

  const reportCards = [
    { id: 'leads', title: 'Lead Report', desc: 'All leads · Status · Conversion', icon: '📊' },
    { id: 'performance', title: 'Performance Report', desc: 'Staff · Industry · Revenue', icon: '📈' },
    { id: 'revenue', title: 'Revenue Report', desc: 'By industry · By district', icon: '💰' },
    { id: 'attendance', title: 'Attendance Report', desc: 'Daily · Monthly · Half days', icon: '📅' },
    { id: 'salary', title: 'Salary Report', desc: 'Basic · Leaves · Incentives', icon: '💼' },
    { id: 'leaves', title: 'Leave Report', desc: 'Leaves taken · Balance', icon: '📋' },
  ];

  const user = dashData?.user || {};

  return (
    <div className="animate-in fade-in duration-500">
      {/* HEADER */}
      <div className="section-header mb-8">
        <div>
          <div className="section-title">Reports · {user.state}</div>
          <div className="section-sub text-[13px]">Lead, performance, revenue, attendance, salary</div>
        </div>
        <Button className="bg-blue text-white font-black px-6 shadow-lg shadow-blue/20 hover:shadow-blue/40 transition-all" onClick={() => toast.success("Compiling all data aggregates...")}>
          Export All
        </Button>
      </div>

      {/* REPORT GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {reportCards.map((r) => (
          <div 
            key={r.id} 
            className="card border-none shadow-xl bg-white/80 backdrop-blur-md hover:scale-[1.02] transition-all cursor-pointer group"
            onClick={() => !loading && generateReport(r.id)}
          >
            <div className="card-body py-16 flex flex-col items-center text-center">
              <div className="w-20 h-20 bg-surface rounded-3xl flex items-center justify-center text-4xl mb-8 shadow-inner border border-border/50 group-hover:rotate-12 transition-transform">
                {r.icon}
              </div>
              <div className="font-black text-[17px] tracking-tight mb-2 group-hover:text-blue transition-colors">{r.title}</div>
              <div className="text-[13px] text-text-muted font-medium tracking-tight px-6">{r.desc}</div>
              
              <div className="mt-8 opacity-0 group-hover:opacity-100 transition-opacity">
                <span className="text-[10px] font-black uppercase tracking-widest text-blue bg-blue-light/10 px-4 py-2 rounded-full border border-blue/20">
                  {loading ? 'Processing...' : 'Download CSV'}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Reports;

