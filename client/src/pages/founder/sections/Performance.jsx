import React, { useState, useMemo } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import DashboardSkeleton from '../../../components/skeletons/DashboardSkeleton';
import { dashboardApi } from '../../../api/dashboardApi';
import { Avatar, Tag } from '../../../components/ui';

const SortIcon = ({ active, dir }) => (
  <span className="ml-1 inline-flex flex-col gap-px opacity-40" style={{ opacity: active ? 1 : 0.35 }}>
    <span style={{ borderLeft: '3px solid transparent', borderRight: '3px solid transparent', borderBottom: active && dir === 'asc' ? '4px solid currentColor' : '4px solid transparent', display: 'block' }} />
    <span style={{ borderLeft: '3px solid transparent', borderRight: '3px solid transparent', borderTop: active && dir === 'desc' ? '4px solid currentColor' : '4px solid transparent', display: 'block' }} />
  </span>
);

const Performance = () => {
  const navigate = useNavigate();
  const [viewType, setViewType] = useState('monthly');
  const [sortKey, setSortKey] = useState('completionPct');
  const [sortDir, setSortDir] = useState('desc');

  const { data: dashData, isLoading } = useQuery({
    queryKey: ['dashboard', 'founder', viewType],
    queryFn: () => dashboardApi.getFounderDashboard(viewType).then(res => res.data),
    staleTime: 5 * 60 * 1000,
    placeholderData: keepPreviousData
  });

  const stats = dashData?.stats || {};
  const managers = dashData?.stateManagers || [];

  const sortedManagers = useMemo(() => {
    return [...managers].sort((a, b) => {
      const av = a[sortKey] ?? 0;
      const bv = b[sortKey] ?? 0;
      if (typeof av === 'string') return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
      return sortDir === 'asc' ? av - bv : bv - av;
    });
  }, [managers, sortKey, sortDir]);

  const toggleSort = (key) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('desc'); }
  };

  const th = (label, key) => (
    <th
      className="p-4 text-left text-[10px] font-black uppercase tracking-widest text-text-muted cursor-pointer select-none hover:text-text-primary transition-colors"
      onClick={() => toggleSort(key)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        <SortIcon active={sortKey === key} dir={sortDir} />
      </span>
    </th>
  );

  if (isLoading) return <DashboardSkeleton />;

  return (
    <div className="animate-in fade-in duration-500">
      <div className="section-header">
        <div>
          <div className="section-title">Performance Analytics</div>
          <div className="section-sub">Enterprise-wide conversion tracking &amp; regional office metrics</div>
        </div>
        <div className="flex bg-surface2 p-1 rounded-xl border border-border">
          {['daily', 'weekly', 'monthly', 'quarterly'].map(type => (
            <button
              key={type}
              onClick={() => setViewType(type)}
              className={`px-6 py-1.5 text-[10px] font-bold uppercase tracking-widest rounded-lg transition-all ${viewType === type ? 'bg-surface text-purple shadow-sm' : 'text-text-muted hover:text-text-secondary'}`}
            >
              {type}
            </button>
          ))}
        </div>
      </div>

      <div className="stat-grid mb-6">
        <div className="stat-card">
          <div className="stat-label">Avg Work Completion</div>
          <div className="stat-value text-green">{stats.attendancePct || 0}%</div>
          <div className="stat-delta">Cross-platform efficiency</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Leads Reach Rate</div>
          <div className="stat-value text-blue">{stats.reachRate || 0}%</div>
          <div className="stat-delta">Contact connectivity</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Meeting Rate</div>
          <div className="stat-value text-amber">{stats.meetingRate || 0}%</div>
          <div className="stat-delta">Leads → Meeting</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Conversion Rate</div>
          <div className="stat-value text-teal">{stats.conversionRate || 0}%</div>
          <div className="stat-delta">Platform average</div>
        </div>
      </div>

      {/* Monthly comparison chart — conversions per state manager */}
      {sortedManagers.length > 0 && (
        <div className="card">
          <div className="card-header border-b border-border bg-surface2/10">
            <div className="section-title text-sm">Performance Comparison — {viewType.charAt(0).toUpperCase() + viewType.slice(1)}</div>
          </div>
          <div className="p-6">
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={sortedManagers} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F0" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fontWeight: 700 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{ border: '1px solid #E5E7EB', borderRadius: 12, fontSize: 12 }}
                  cursor={{ fill: '#F9FAFB' }}
                />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, paddingTop: 12 }} />
                <Bar dataKey="leadsCount"       name="Leads"       fill="#3B82F6" radius={[4,4,0,0]} maxBarSize={32} />
                <Bar dataKey="conversionsTotal" name="Conversions" fill="#059669" radius={[4,4,0,0]} maxBarSize={32} />
                <Bar dataKey="completionPct"    name="Work %"      fill="#7C3AED" radius={[4,4,0,0]} maxBarSize={32} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      <div className="card">
        <div className="card-header border-b border-border bg-surface2/10 flex justify-between items-center">
          <div className="section-title text-sm">State Office Leaderboard</div>
          <span className="text-[11px] text-text-muted font-medium">Click column headers to sort</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface2/40 border-b border-border">
                {th('Manager / Region', 'name')}
                {th('Efficiency', 'completionPct')}
                {th('Leads', 'leadsCount')}
                {th('Converted', 'conversionsTotal')}
                {th('Revenue', 'revenue')}
                <th className="p-4 text-[10px] font-black uppercase tracking-widest text-text-muted text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {sortedManagers.length === 0 ? (
                <tr><td colSpan="6" className="p-12 text-center text-text-muted italic">No performance data available</td></tr>
              ) : sortedManagers.map((m, idx) => (
                <tr key={m._id || idx} className="hover:bg-surface2/30 transition-colors group">
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <Avatar name={m.name} size="sm" className="av-state" />
                      <div>
                        <div className="font-bold text-[13px]">{m.name}</div>
                        <div className="text-[10px] text-text-muted uppercase">📍 {m.state} Head</div>
                      </div>
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="h-1.5 w-20 bg-surface2 rounded-full overflow-hidden border border-border">
                        <div
                          className={`h-full transition-all ${(m.completionPct || 0) >= 80 ? 'bg-accent' : (m.completionPct || 0) >= 50 ? 'bg-amber' : 'bg-red'}`}
                          style={{ width: `${m.completionPct || 0}%` }}
                        />
                      </div>
                      <span className="text-[11px] font-bold font-mono">{m.completionPct || 0}%</span>
                    </div>
                  </td>
                  <td className="p-4"><span className="font-mono text-[11px] font-bold text-blue">{m.leadsCount || 0}</span></td>
                  <td className="p-4"><span className="font-mono text-[11px] font-bold text-accent">{m.conversionsTotal || 0}</span></td>
                  <td className="p-4"><span className="font-mono text-[11px] font-bold text-teal">₹{(m.revenue || 0).toLocaleString()}</span></td>
                  <td className="p-4">
                    <div className="flex items-center gap-2 justify-end">
                      <Tag
                        variant={(m.completionPct || 0) >= 80 ? 'green' : (m.completionPct || 0) >= 50 ? 'amber' : 'red'}
                        label={(m.completionPct || 0) >= 80 ? 'OPTIMAL' : (m.completionPct || 0) >= 50 ? 'STABLE' : 'CRITICAL'}
                      />
                      <button
                        className="opacity-0 group-hover:opacity-100 transition-opacity text-[11px] font-bold text-blue underline underline-offset-2"
                        onClick={() => navigate(`/dashboard/state-managers/${m._id}`)}
                      >
                        View Details
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Performance;
