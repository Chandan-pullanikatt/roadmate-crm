import React, { useState, useMemo } from 'react';
import { Button, Avatar, DashboardSkeleton } from '../../../components/ui';
import { dashboardApi } from '../../../api/dashboardApi';
import { useToast } from '../../../context/ToastContext';
import { useAuth } from '../../../context/AuthContext';
import { useQuery } from '@tanstack/react-query';

const reportCards = [
  { type: 'leads',       title: 'Lead Report',          sub: 'All leads · Status · Conversion',     icon: '📊' },
  { type: 'performance', title: 'Staff Performance',     sub: 'Daily · Weekly · Monthly',            icon: '📈' },
  { type: 'revenue',     title: 'Revenue Report',        sub: 'By executive · By district',          icon: '💰' },
  { type: 'attendance',  title: 'Attendance Report',     sub: 'Work % · Half days · Leaves',         icon: '📅' },
  { type: 'salary',      title: 'Salary Report',         sub: 'Basic · Incentives · Leaves',         icon: '💼' },
  { type: 'rnr',         title: 'RNR & Reallocation',   sub: 'Auto-reallocation history',           icon: '🔀' },
];

const downloadCSV = (data, filename, addToast) => {
  if (!data || data.length === 0) {
    addToast('No data found for this report', 'warning');
    return;
  }
  const headers = Object.keys(data[0]).join(',');
  const rows = data.map(row =>
    Object.values(row).map(val => {
      if (val === null || val === undefined) return '""';
      return typeof val === 'string' ? `"${val.replace(/"/g, '""')}"` : val;
    }).join(',')
  ).join('\n');
  const blob = new Blob([headers + '\n' + rows], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}_${new Date().toISOString().split('T')[0]}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  addToast(`${filename} downloaded`, 'success');
};

const formatData = (type, data) => {
  if (type === 'leads' || type === 'rnr') {
    return data.map(l => ({
      Company:       l.company || '',
      Contact:       l.name || '',
      Phone:         l.phone || '',
      Email:         l.email || '',
      Status:        l.status || '',
      Priority:      l.priority || '',
      RNR_Count:     l.rnrCount ?? 0,
      District:      l.district || '',
      Owner:         l.owner?.name || 'Unassigned',
      Last_Updated:  l.updatedAt ? new Date(l.updatedAt).toLocaleDateString() : '',
    }));
  }
  if (type === 'attendance') {
    return data.map(a => ({
      Employee:  a.user?.name || '',
      Date:      a.date ? new Date(a.date).toLocaleDateString() : '',
      Status:    a.status || '',
      Work_Pct:  `${a.workPercentage ?? a.completionPct ?? 0}%`,
      Check_In:  a.workStartedAt ? new Date(a.workStartedAt).toLocaleTimeString() : '-',
      Check_Out: a.workCompletedAt ? new Date(a.workCompletedAt).toLocaleTimeString() : '-',
    }));
  }
  if (type === 'performance') {
    return data.map(p => ({
      Executive:   p.user?.name || p.name || '',
      District:    p.district || '',
      Calls:       p.totalCalls ?? p.callsToday ?? 0,
      Meetings:    p.meetingsDone ?? 0,
      Conversions: p.conversionsTotal ?? 0,
      Efficiency:  `${p.completionPct ?? 0}%`,
    }));
  }
  if (type === 'salary') {
    return data.map(s => ({
      Executive:   s.user?.name || '',
      Month:       s.month || '',
      Year:        s.year || '',
      Basic:       s.basicSalary ?? 0,
      Incentives:  s.incentives ?? 0,
      Deductions:  s.deductions ?? 0,
      Net_Salary:  s.netSalary ?? 0,
    }));
  }
  if (type === 'revenue') {
    return data.map(r => ({
      Date:         r._id || '',
      Conversions:  r.count ?? 0,
      Total_Revenue: r.totalRevenue ?? 0,
    }));
  }
  return [];
};

const FILENAMES = {
  leads:       'Lead_Lifecycle_Report',
  performance: 'Team_Performance_Report',
  revenue:     'Revenue_Report',
  attendance:  'Attendance_Audit_Report',
  salary:      'Salary_Breakdown_Report',
  rnr:         'RNR_Leads_Report',
};

const Reports = () => {
  const [loading, setLoading] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const { addToast } = useToast();
  const { user: currentUser } = useAuth();

  const { data: dashData, isLoading } = useQuery({
    queryKey: ['dashboard', 'industry-manager'],
    queryFn: () => dashboardApi.getIndustryManagerDashboard().then(res => res.data),
    staleTime: 5 * 60 * 1000,
    placeholderData: (prev) => prev
  });

  if (isLoading && !dashData) return <DashboardSkeleton />;

  const userInfo = dashData?.user || currentUser || {};

  const filteredCards = useMemo(() => {
    if (!searchTerm.trim()) return reportCards;
    const q = searchTerm.toLowerCase();
    return reportCards.filter(c =>
      c.title.toLowerCase().includes(q) || c.sub.toLowerCase().includes(q)
    );
  }, [searchTerm]);

  const generateReport = async (type) => {
    if (loading) return;
    setLoading(type);
    try {
      // RNR reuses the leads endpoint with a status filter
      const res = type === 'rnr'
        ? await dashboardApi.getReport('leads', { status: 'rnr' })
        : await dashboardApi.getReport(type);

      // All endpoints return { data: [...], pagination, summary }
      const rows = res.data?.data || [];
      const formatted = formatData(type, rows);
      downloadCSV(formatted, FILENAMES[type], addToast);
    } catch {
      addToast('Failed to generate report', 'error');
    } finally {
      setLoading(null);
    }
  };

  const handleExportAll = async () => {
    for (const card of reportCards) {
      await generateReport(card.type);
      await new Promise(r => setTimeout(r, 400));
    }
  };

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
              placeholder="Search reports..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 bg-surface2 border border-border rounded-xl text-[11px] font-bold focus:ring-2 focus:ring-purple/20 transition-all outline-none min-w-[240px]"
            />
            <span className="absolute left-3 top-1/2 -translate-y-1/2 opacity-40 text-sm">🔍</span>
          </div>
          <button className="w-10 h-10 rounded-xl bg-surface2 border border-border flex items-center justify-center hover:bg-surface3 transition-colors">
            <span className="text-lg">🔔</span>
          </button>
          <Avatar name={userInfo.name} size="md" className="border-2 border-purple/10" />
        </div>
      </div>

      {/* Sub Header */}
      <div className="bg-surface1 border border-border/40 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm">
        <div>
          <h2 className="text-lg font-bold">Reports · {userInfo.industry} · {userInfo.state}</h2>
          <p className="text-xs text-text-muted">Click any card to download · CSV format</p>
        </div>
        <Button
          className="bg-purple text-white border-none rounded-xl px-5 h-10 font-bold text-[11px] uppercase tracking-widest shadow-lg shadow-purple/10"
          onClick={handleExportAll}
          disabled={!!loading}
        >
          {loading ? 'Exporting...' : 'Export All'}
        </Button>
      </div>

      {/* Reports Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredCards.map((card) => (
          <div
            key={card.type}
            onClick={() => generateReport(card.type)}
            className={`card p-10 flex flex-col items-center text-center group hover:border-purple/30 transition-all shadow-lg shadow-purple/5 border-border/40 ${loading ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
          >
            <div className="w-16 h-16 rounded-3xl bg-surface2 flex items-center justify-center text-3xl mb-6 group-hover:scale-110 group-hover:bg-purple-light/20 transition-all duration-500 shadow-inner">
              {loading === card.type ? (
                <div className="w-6 h-6 border-2 border-purple border-t-transparent rounded-full animate-spin" />
              ) : card.icon}
            </div>
            <h3 className="text-lg font-black text-text-primary mb-2 uppercase tracking-tight group-hover:text-purple transition-colors">
              {card.title}
            </h3>
            <p className="text-[11px] text-text-muted font-bold uppercase tracking-tighter opacity-60 leading-relaxed">
              {card.sub}
            </p>
          </div>
        ))}
        {filteredCards.length === 0 && (
          <div className="col-span-3 py-16 text-center text-text-muted italic">
            No reports match "{searchTerm}"
          </div>
        )}
      </div>
    </div>
  );
};

export default Reports;
