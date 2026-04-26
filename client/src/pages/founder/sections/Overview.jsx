import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { dashboardApi } from '../../../api/dashboardApi';
import { Avatar, Button, Tag } from '../../../components/ui';

const Overview = () => {
  const [summaryTab, setSummaryTab] = useState('month');

  const { data: dashData, isLoading } = useQuery({
    queryKey: ['dashboard', 'founder', summaryTab],
    queryFn: () => dashboardApi.getFounderDashboard(summaryTab).then(res => res.data)
  });

  const openModal = (id) => {
    window.dispatchEvent(new CustomEvent('open-modal', { detail: id }));
  };

  if (isLoading) return <div className="p-8 text-center text-text-muted">Calculating enterprise metrics...</div>;

  const stats = dashData?.stats || {};
  const pipeline = dashData?.pipeline || [];
  const managers = dashData?.stateManagers || [];
  const pendingLeaves = dashData?.pendingLeaves || [];
  const recentLeads = dashData?.recentLeads || [];

  return (
    <div className="animate-in fade-in duration-500">
      {/* UPCOMING MEETING ALERT */}
      <div className="meeting-alert mb-6 bg-accent-light/10 border border-accent/20 p-4 rounded-2xl flex items-center gap-4 cursor-pointer hover:bg-accent-light/20 transition-all">
        <div className="w-10 h-10 bg-accent rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg shadow-accent/20">
          <svg width="20" height="20" viewBox="0 0 16 16" fill="none">
            <rect x="2" y="3" width="12" height="11" rx="1.5" stroke="white" strokeWidth="1.4" />
            <path d="M2 7h12M5 2v2M11 2v2" stroke="white" strokeWidth="1.3" strokeLinecap="round" />
            <circle cx="8" cy="11" r="1.5" fill="white" />
          </svg>
        </div>
        <div className="flex-1">
          <div className="text-[13.5px] font-bold text-accent">Board Meeting in 45 min — Q1 Revenue Review</div>
          <div className="text-[11.5px] text-accent/70 mt-0.5">3:30 PM · All State Managers · Zoom Link Ready</div>
        </div>
        <div className="flex gap-2">
          <Button size="xs" className="bg-accent text-white border-none">Join Now</Button>
          <Button size="xs" variant="outline" className="border-accent/20 text-accent" onClick={() => openModal('all-meetings')}>All Meetings</Button>
        </div>
      </div>

      <div className="section-header">
        <div>
          <div className="section-title">Founder Summary</div>
          <div className="section-sub">Enterprise overview — all states, industries & staff</div>
        </div>
        <div className="flex bg-surface2 p-1 rounded-xl border border-border">
          {['today', 'week', 'month', 'year'].map(t => (
            <button 
              key={t}
              onClick={() => setSummaryTab(t)}
              className={`px-6 py-1.5 text-[10px] font-bold uppercase tracking-widest rounded-lg transition-all ${summaryTab === t ? 'bg-surface text-purple shadow-sm' : 'text-text-muted hover:text-text-secondary'}`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="stat-grid mb-6">
        <div className="stat-card">
          <div className="stat-label">Total Enterprise Leads</div>
          <div className="stat-value text-blue">{stats.totalLeads || 0}</div>
          <div className="stat-delta text-blue">Across all states</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Conversion Rate</div>
          <div className="stat-value text-accent">{stats.conversionRate || 0}%</div>
          <div className="stat-delta text-accent">↑ Platform average</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Total Revenue</div>
          <div className="stat-value text-teal">₹{stats.totalRevenue?.toLocaleString() || '0'}</div>
          <div className="stat-delta text-teal">Aggregated state totals</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Active Staff</div>
          <div className="stat-value text-purple">{stats.totalStaff || 0}</div>
          <div className="stat-delta text-purple">{stats.onLeaveCount || 0} on leave today</div>
        </div>
      </div>

      <div className="section-header">
        <div><div className="section-title">Global Lead Pipeline</div><div className="section-sub">Aggregate distribution across all lifecycle stages</div></div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
        {pipeline.map((s, i) => (
          <div key={i} className="card p-4 text-center border-border/50 bg-surface hover:border-purple/30 transition-colors">
            <div className="text-[20px] font-bold mono text-purple mb-1">{s.count}</div>
            <div className="text-[10px] font-bold text-text-muted uppercase tracking-wider mb-3">{s.label}</div>
            <div className="h-1.5 w-full bg-surface2 rounded-full overflow-hidden border border-border">
              <div className="h-full bg-purple" style={{ width: `${s.percentage}%` }}></div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="card">
          <div className="card-header border-b border-border bg-surface2/10 flex justify-between items-center">
            <div className="section-title text-sm">State Manager Performance</div>
            <Button size="xs" variant="outline">Detailed Analytics</Button>
          </div>
          <div className="divide-y divide-border">
            {managers.map((m, i) => (
              <div key={m._id} className="flex items-center gap-4 p-4 hover:bg-surface2 transition-colors cursor-pointer">
                <Avatar name={m.name} size="md" className="av-state" />
                <div className="flex-1 min-w-0">
                  <div className="text-[13.5px] font-bold">{m.name}</div>
                  <div className="text-[11px] text-text-muted mt-0.5">📍 {m.state} · SM</div>
                </div>
                <div className="flex gap-6 mx-4">
                  <div className="text-center"><div className="text-xs font-bold text-blue mono">{m.leadsCount || 0}</div><div className="text-[9px] text-text-muted uppercase">Leads</div></div>
                  <div className="text-center"><div className="text-xs font-bold text-accent mono">₹{m.revenue?.toLocaleString() || '0'}</div><div className="text-[9px] text-text-muted uppercase">Rev</div></div>
                </div>
                <div className="flex items-center gap-2">
                   <div className="text-[10px] font-bold mono">{m.completionPct || 0}%</div>
                   <div className="w-12 h-1 bg-surface2 rounded-full overflow-hidden">
                      <div className="h-full bg-accent" style={{ width: `${m.completionPct || 0}%` }}></div>
                   </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-6">
          <div className="card">
            <div className="card-header border-b border-border bg-surface2/10">
              <div className="section-title text-sm">Pending Founder Approvals</div>
              <Tag variant="amber" label={`${pendingLeaves.length} Leaves`} />
            </div>
            <div className="divide-y divide-border max-h-[300px] overflow-y-auto">
              {pendingLeaves.map((l) => (
                <div key={l._id} className="flex items-center gap-4 p-4 hover:bg-surface2 transition-colors">
                  <Avatar name={l.user?.name} size="sm" className="av-state" />
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-bold">{l.user?.name}</div>
                    <div className="text-[11px] text-text-muted truncate">SM · {l.type} · {l.reason}</div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="xs" className="bg-accent text-white">Approve</Button>
                    <Button size="xs" variant="outline" className="text-red border-red/10">Reject</Button>
                  </div>
                </div>
              ))}
              {pendingLeaves.length === 0 && <div className="p-12 text-center text-text-muted text-xs italic">No pending requests</div>}
            </div>
          </div>

          <div className="card">
            <div className="card-header border-b border-border bg-surface2/10">
              <div className="section-title text-sm">Recent Global Leads</div>
            </div>
            <div className="p-4">
              {recentLeads.slice(0, 3).map((l, i) => (
                <div key={i} className="flex justify-between items-center mb-4 last:mb-0">
                  <div>
                    <div className="text-xs font-bold">{l.company}</div>
                    <div className="text-[10px] text-text-muted">{l.state} · {l.industry}</div>
                  </div>
                  <Tag variant={l.status === 'hot' ? 'red' : 'gray'} label={l.status.toUpperCase()} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Overview;
