import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  StatCard, 
  Avatar, 
  Tag,
  DataTable,
  DashboardSkeleton
} from '../../../components/ui';
import { dashboardApi } from '../../../api/dashboardApi';

const Performance = () => {
  const [viewType, setViewType] = useState('Monthly');
  const [searchTerm, setSearchTerm] = useState('');

  const { data: dashData, isLoading } = useQuery({
    queryKey: ['dashboard', 'industry-manager'],
    queryFn: () => dashboardApi.getIndustryManagerDashboard().then(res => res.data),
    staleTime: 5 * 60 * 1000,
    placeholderData: (prev) => prev
  });

  const allExecutives = useMemo(() => dashData?.executivePerformance || [], [dashData]);

  const executives = useMemo(() => {
    if (!searchTerm.trim()) return allExecutives;
    const q = searchTerm.toLowerCase();
    return allExecutives.filter(e =>
      e.name?.toLowerCase().includes(q) ||
      e.district?.toLowerCase().includes(q)
    );
  }, [allExecutives, searchTerm]);
  const userInfo = dashData?.user || {};

  // Calculate Winners for Stat Cards
  const topPerformer = useMemo(() => {
    if (!executives.length) return null;
    return [...executives].sort((a, b) => b.converted - a.converted || b.completionPct - a.completionPct)[0];
  }, [executives]);

  const bestRevenue = useMemo(() => {
    if (!executives.length) return null;
    return [...executives].sort((a, b) => b.revenue - a.revenue)[0];
  }, [executives]);

  const mostCalls = useMemo(() => {
    if (!executives.length) return null;
    return [...executives].sort((a, b) => b.calls - a.calls)[0];
  }, [executives]);

  const mostFollowups = useMemo(() => {
    if (!executives.length) return null;
    return [...executives].sort((a, b) => b.followupsCount - a.followupsCount)[0];
  }, [executives]);

  const formatCurrency = (val) => {
    if (val >= 100000) return `₹${(val / 100000).toFixed(1)}L`;
    if (val >= 1000) return `₹${(val / 1000).toFixed(1)}K`;
    return `₹${val}`;
  };

  const getInitials = (name) => name?.split(' ').map(n => n[0]).join('').toUpperCase() || 'U';

  if (isLoading && !dashData) return <DashboardSkeleton />;

  return (
    <div className="space-y-6 animate-in fade-in duration-700 pb-12">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Staff Performance</h1>
          <p className="text-sm text-text-muted">Daily · Weekly · Monthly · All executives</p>
        </div>
        <div className="flex items-center gap-3">
            <div className="relative">
                <input
                    type="text"
                    placeholder="Search leads, executives..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="pl-10 pr-4 py-2 bg-surface2 border border-border rounded-xl text-[11px] font-bold focus:ring-2 focus:ring-purple/20 transition-all outline-none min-w-[280px]"
                />
                <span className="absolute left-3 top-1/2 -translate-y-1/2 opacity-40 text-sm">🔍</span>
            </div>
            <button className="w-10 h-10 rounded-xl bg-surface2 border border-border flex items-center justify-center hover:bg-surface3 transition-colors relative">
                <span className="text-lg">🔔</span>
                <span className="absolute top-2.5 right-2.5 w-2 h-2 bg-red rounded-full border-2 border-surface2"></span>
            </button>
            <Avatar name={userInfo.name} size="md" className="border-2 border-purple/10" />
        </div>
      </div>

      {/* Sub Header / Tab Bar */}
      <div className="bg-surface1 border border-border/40 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm">
        <div>
          <h2 className="text-lg font-bold">Staff Performance - {userInfo.industry} - {userInfo.state}</h2>
          <p className="text-xs text-text-muted">Daily · Weekly · Monthly · Calls · Meetings · Revenue · Leaves</p>
        </div>
        <div className="flex bg-surface2 p-1 rounded-xl border border-border/40 shadow-sm">
            {['Monthly', 'Weekly', 'Daily'].map(tab => (
                <button 
                    key={tab}
                    onClick={() => setViewType(tab)}
                    className={`px-6 py-2 text-[10px] font-black rounded-lg transition-all uppercase tracking-widest ${viewType === tab ? 'bg-white shadow-sm text-purple' : 'text-text-muted hover:text-text-primary'}`}
                >{tab}</button>
            ))}
        </div>
      </div>

      {/* Top 4 Performance Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Top Performer */}
        <div className="card p-6 border-l-4 border-purple shadow-sm hover:shadow-md transition-shadow">
            <div className="text-[10px] font-bold text-text-muted uppercase tracking-widest mb-3">Top Performer</div>
            <div className="flex items-center gap-4">
                <div className="text-xl font-black text-purple">{topPerformer?.name || '—'}</div>
            </div>
            <div className="mt-2 text-xs font-bold text-text-muted">
                <span className="text-purple">{topPerformer?.completionPct || 0}% Work</span> · {topPerformer?.converted || 0} Conv.
            </div>
        </div>

        {/* Best Revenue */}
        <div className="card p-6 border-l-4 border-green shadow-sm hover:shadow-md transition-shadow">
            <div className="text-[10px] font-bold text-text-muted uppercase tracking-widest mb-3">Best Revenue</div>
            <div className="text-2xl font-black text-text-primary">{formatCurrency(bestRevenue?.revenue || 0)}</div>
            <div className="mt-2 text-[10px] font-bold text-text-muted">
                {bestRevenue?.name} · {bestRevenue?.district}
            </div>
        </div>

        {/* Most Calls */}
        <div className="card p-6 border-l-4 border-blue shadow-sm hover:shadow-md transition-shadow">
            <div className="text-[10px] font-bold text-text-muted uppercase tracking-widest mb-3">Most Calls</div>
            <div className="text-2xl font-black text-text-primary">{mostCalls?.calls || 0}</div>
            <div className="mt-2 text-[10px] font-bold text-text-muted">
                {mostCalls?.name} · {mostCalls?.district}
            </div>
        </div>

        {/* Most Follow-ups */}
        <div className="card p-6 border-l-4 border-amber shadow-sm hover:shadow-md transition-shadow">
            <div className="text-[10px] font-bold text-text-muted uppercase tracking-widest mb-3">Most Follow-ups</div>
            <div className="text-2xl font-black text-text-primary">{mostFollowups?.followupsCount || 0}</div>
            <div className="mt-2 text-[10px] font-bold text-text-muted">
                {mostFollowups?.name} · {mostFollowups?.district}
            </div>
        </div>
      </div>

      {/* Detail Table Card */}
      <div className="card shadow-lg shadow-purple/5 border-border/40 overflow-hidden">
        <div className="card-header border-none px-8 pt-8 pb-4">
           <h3 className="text-sm font-black uppercase tracking-widest text-text-muted">Staff-by-Staff Detail Report</h3>
        </div>
        
        <div className="p-0 overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[1000px]">
            <thead>
              <tr className="bg-surface2/30 text-[9px] font-black text-text-muted uppercase tracking-widest border-y border-border/40">
                <th className="px-8 py-4">Executive</th>
                <th className="px-6 py-4">District</th>
                <th className="px-6 py-4 text-center">Calls</th>
                <th className="px-6 py-4 text-center">Meetings</th>
                <th className="px-6 py-4 text-center">Follow-ups</th>
                <th className="px-6 py-4 text-center">Converted</th>
                <th className="px-6 py-4">Revenue</th>
                <th className="px-6 py-4 text-center">Leaves</th>
                <th className="px-6 py-4">Work %</th>
                <th className="px-6 py-4 text-right pr-8">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {executives.map((exec, idx) => (
                <tr key={exec._id || idx} className="hover:bg-purple-light/10 transition-colors group">
                  <td className="px-8 py-4">
                    <div className="flex items-center gap-3">
                       <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-black text-white av-${idx % 5} shadow-sm`}>
                          {getInitials(exec.name)}
                       </div>
                       <span className="text-xs font-black text-text-primary group-hover:text-purple transition-colors">{exec.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-[10px] font-bold text-text-secondary uppercase tracking-tight">{exec.district}</span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className="text-[11px] font-black text-blue">{exec.calls}</span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className="text-[11px] font-black text-teal">{exec.meetings}</span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className="text-[11px] font-bold text-purple">{exec.followupsCount}</span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className="text-[11px] font-black text-accent">{exec.converted}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-[11px] font-black text-text-primary">{formatCurrency(exec.revenue)}</span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className="text-[11px] font-bold text-text-muted">{exec.leaves || 2}</span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                        <div className="w-16 h-1.5 bg-surface2 rounded-full overflow-hidden border border-border/40">
                            <div 
                                className={`h-full rounded-full transition-all duration-1000 ${exec.completionPct >= 70 ? 'bg-green' : exec.completionPct >= 30 ? 'bg-amber' : 'bg-red'}`} 
                                style={{ width: `${exec.completionPct}%` }} 
                            />
                        </div>
                        <span className="text-[10px] font-black text-text-primary">{exec.completionPct}%</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right pr-8">
                    <Tag 
                        variant={exec.isWorking ? 'green' : 'amber'} 
                        label={exec.isWorking ? 'Active' : 'On Leave'} 
                        className="text-[9px] font-black px-3 py-1 rounded-lg uppercase tracking-tighter"
                    />
                  </td>
                </tr>
              ))}
              {executives.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-8 py-16 text-center text-text-muted italic">No executives found</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Performance;
