import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Tag,
  LeadFunnel,
  DashboardSkeleton
} from '../../../components/ui';
import { dashboardApi } from '../../../api/dashboardApi';
import { leaveApi } from '../../../api/leaveApi';
import { useToast } from '../../../context/ToastContext';

const Overview = () => {
  const queryClient = useQueryClient();
  const { addToast } = useToast();
  const navigate = useNavigate();
  const [funnelPeriod, setFunnelPeriod] = useState('month');

  const { data: dashData, isLoading } = useQuery({
    queryKey: ['dashboard', 'industry-manager'],
    queryFn: () => dashboardApi.getIndustryManagerDashboard().then(res => res.data),
    staleTime: 0,
    placeholderData: (prev) => prev
  });

  const approveMutation = useMutation({
    mutationFn: leaveApi.approveLeave,
    onSuccess: () => {
      queryClient.invalidateQueries(['dashboard', 'industry-manager']);
      addToast("Leave request approved", "success");
    }
  });

  const rejectMutation = useMutation({
    mutationFn: (id) => leaveApi.rejectLeave(id, { reason: 'Rejected by manager' }),
    onSuccess: () => {
      queryClient.invalidateQueries(['dashboard', 'industry-manager']);
      addToast("Leave request rejected", "error");
    }
  });

  if (isLoading && !dashData) return <DashboardSkeleton />;

  const stats = dashData?.stats || {};
  const periodStats = dashData?.periodStats || {};
  const activeLeads = dashData?.activeLeads ?? 0;
  const team = dashData?.executivePerformance || [];
  const leadStats = dashData?.leadStats || {};
  const events = dashData?.upcomingEvents || [];
  const leaves = dashData?.leaveRequests || [];
  const userInfo = dashData?.user || {};
  const escalatedLeads = dashData?.escalatedLeads || [];
  const recentLeads = dashData?.leads || [];

  const formatCurrency = (val) => {
    if (val >= 100000) return `₹${(val / 100000).toFixed(1)}L`;
    if (val >= 1000) return `₹${(val / 1000).toFixed(1)}K`;
    return `₹${val}`;
  };

  const getInitials = (name) => name?.split(' ').map(n => n[0]).join('').toUpperCase() || 'U';

  const convDelta = (periodStats.converted ?? 0) - (stats.convertedLastMonth ?? 0);

  const statCards = [
    {
      color: 'var(--purple)',
      label: 'District Executives',
      value: stats.totalExecutives || 0,
      valueColor: 'var(--purple)',
      delta: `↑ ${stats.activeToday >= stats.totalExecutives && stats.totalExecutives > 0 ? 'All' : (stats.activeToday || 0)} active · ${userInfo.industry || ''}`,
      deltaColor: 'var(--accent)',
      page: 'team'
    },
    {
      color: 'var(--accent)',
      label: `Revenue · ${userInfo.industry || ''} · ${userInfo.state || ''}`,
      value: formatCurrency(stats.revenue || 0),
      valueColor: 'var(--accent)',
      delta: `${(stats.revGrowth ?? 0) >= 0 ? '↑' : '↓'} ${Math.abs(Math.round(stats.revGrowth || 0))}% vs last month`,
      deltaColor: (stats.revGrowth ?? 0) >= 0 ? 'var(--accent)' : 'var(--red)',
      page: 'reports'
    },
    {
      color: '#D97706',
      label: 'Total Leads',
      value: stats.totalLeads || 0,
      valueColor: '#D97706',
      delta: `→ ${leadStats.followup || 0} follow-ups today`,
      deltaColor: 'var(--text-muted)',
      page: 'leads'
    },
    {
      color: 'var(--teal)',
      label: 'Converted This Month',
      value: periodStats.converted ?? 0,
      valueColor: 'var(--teal)',
      delta: `${convDelta > 0 ? '↑' : convDelta < 0 ? '↓' : '→'} ${Math.abs(convDelta)} vs last month`,
      deltaColor: convDelta >= 0 ? 'var(--accent)' : 'var(--red)',
      page: 'leads'
    },
    {
      color: 'var(--blue)',
      label: 'Calls This Week',
      value: stats.callsThisWeek || 0,
      valueColor: 'var(--blue)',
      delta: `${(stats.callGrowth ?? 0) >= 0 ? '↑' : '↓'} ${Math.abs(Math.round(stats.callGrowth || 0))}% vs last week`,
      deltaColor: (stats.callGrowth ?? 0) >= 0 ? 'var(--accent)' : 'var(--red)',
      page: 'calls'
    },
    {
      color: 'var(--teal)',
      label: 'Meetings',
      value: stats.meetings?.total || 0,
      valueColor: 'var(--teal)',
      delta: `→ ${stats.meetings?.virtual || 0} virtual, ${stats.meetings?.direct || 0} direct`,
      deltaColor: 'var(--text-muted)',
      page: 'meetings'
    },
    {
      color: 'var(--red)',
      label: 'RNR Leads',
      value: leadStats.rnr ?? 0,
      valueColor: 'var(--red)',
      delta: (leadStats.rnr ?? 0) > 0 ? `↑ ${leadStats.escalated || 0} auto-reallocated` : '↑ All on track',
      deltaColor: (leadStats.rnr ?? 0) > 0 ? 'var(--amber)' : 'var(--accent)',
      page: 'leads'
    },
    {
      color: 'var(--orange)',
      label: 'Leave Requests',
      value: leaves.length,
      valueColor: 'var(--orange)',
      delta: leaves.length > 0 ? 'Needs approval' : 'All clear',
      deltaColor: leaves.length > 0 ? 'var(--amber)' : 'var(--accent)',
      page: 'approvals'
    }
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="px-2.5 py-1 rounded-md bg-purple-light text-purple text-[10px] font-bold uppercase tracking-wider border border-purple/10">
              Industry Hub
            </div>
            <span className="text-text-muted opacity-30">/</span>
            <span className="text-text-muted text-[10px] font-bold uppercase tracking-wider">{userInfo.state}</span>
          </div>
          <h1 className="text-3xl font-extrabold text-text-primary tracking-tight">{userInfo.name}</h1>
          <p className="text-sm text-text-muted mt-1 font-medium">
            Industry Manager <span className="mx-2 opacity-30">·</span> {userInfo.industry} <span className="mx-2 opacity-30">·</span> {userInfo.state}
          </p>
        </div>
        <div className="flex items-center gap-4 bg-white p-2 rounded-2xl border border-border/60 shadow-sm">
          <div className="flex -space-x-3 px-2">
            {team.slice(0, 4).map((exec, i) => (
              <div key={i} className={`w-10 h-10 rounded-full border-2 border-white flex items-center justify-center text-xs font-bold text-white shadow-sm av-${i % 5}`}>
                {getInitials(exec.name)}
              </div>
            ))}
            {team.length > 4 && (
              <div className="w-10 h-10 rounded-full border-2 border-white bg-surface2 flex items-center justify-center text-[10px] font-bold text-text-muted shadow-sm">
                +{team.length - 4}
              </div>
            )}
          </div>
          <div className="h-8 w-px bg-border/60" />
          <div className="pr-4 pl-2">
            <div className="text-[10px] font-bold text-text-muted uppercase tracking-tight">Total Team</div>
            <div className="text-sm font-bold text-purple">{team.length} Executives</div>
          </div>
        </div>
      </div>

      {/* Escalation Banner */}
      {escalatedLeads.length > 0 && (
        <div style={{
          background: 'var(--amber-light)',
          border: '1px solid #FCD34D',
          borderRadius: 'var(--radius-sm)',
          padding: '10px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          fontSize: 13,
          color: 'var(--amber)'
        }}>
          <span>⚠️</span>
          <span>
            <strong>{escalatedLeads.length} Lead{escalatedLeads.length > 1 ? 's' : ''} Escalated from Executive</strong>
            {escalatedLeads[0] && ` — ${escalatedLeads[0].company || escalatedLeads[0].name || ''} · ${escalatedLeads[0].owner?.name || ''} · Needs manager decision`}
          </span>
          <button
            className="btn btn-xs btn-warn"
            style={{ marginLeft: 'auto', fontSize: 11, padding: '3px 10px', borderRadius: 5, border: '1px solid #FCD34D', background: 'transparent', color: 'var(--amber)', cursor: 'pointer', fontWeight: 600 }}
            onClick={() => navigate('/dashboard?page=leads')}
          >
            Review Lead
          </button>
          <button
            className="btn btn-xs btn-outline"
            style={{ fontSize: 11, padding: '3px 10px', borderRadius: 5, border: '1px solid var(--border)', background: 'var(--surface)', cursor: 'pointer', fontWeight: 600, color: 'var(--text-secondary)' }}
            onClick={() => navigate('/dashboard?page=leads')}
          >
            Escalate to State Manager
          </button>
        </div>
      )}

      {/* 8 Stat Cards — 4 per row, matching design */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {statCards.map((card, idx) => (
          <div
            key={idx}
            onClick={() => navigate(`/dashboard?page=${card.page}`)}
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
              padding: '18px 20px',
              boxShadow: 'var(--shadow)',
              position: 'relative',
              overflow: 'hidden',
              cursor: 'pointer',
              transition: 'transform 0.15s, box-shadow 0.15s'
            }}
            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = 'var(--shadow-md)'; }}
            onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = 'var(--shadow)'; }}
          >
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: card.color }} />
            <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', fontWeight: 500 }}>{card.label}</div>
            <div style={{ fontSize: 26, fontWeight: 600, letterSpacing: '-0.5px', margin: '6px 0 4px', fontFamily: "'DM Mono', monospace", color: card.valueColor }}>{card.value}</div>
            <div style={{ fontSize: '11.5px', color: card.deltaColor }}>{card.delta}</div>
          </div>
        ))}
      </div>

      {/* Middle Section: Team & Funnel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* District Executives Snapshot */}
        <div className="card lg:col-span-2 shadow-sm border-border/40">
          <div className="card-header border-none px-8 pt-8">
            <div>
              <h3 className="text-xl font-bold text-text-primary tracking-tight">District Executives</h3>
              <p className="text-sm text-text-muted mt-1 font-medium">Performance snapshot for {userInfo.industry}</p>
            </div>
            <div className="flex gap-2">
              <div className="px-3 py-1.5 rounded-xl bg-surface2 border border-border text-[11px] font-bold text-text-secondary cursor-pointer hover:bg-surface3 transition-all">Filter</div>
              <div
                className="px-3 py-1.5 rounded-xl bg-purple text-white text-[11px] font-bold cursor-pointer hover:opacity-90 transition-all shadow-lg shadow-purple/20"
                onClick={() => navigate('/dashboard?page=team')}
              >Full List</div>
            </div>
          </div>
          <div className="p-4">
            <div className="overflow-hidden rounded-2xl border border-border/40 bg-surface/30">
              <div className="bg-surface2/50 px-6 py-3 border-b border-border/40 flex items-center text-[10px] font-bold text-text-muted uppercase tracking-widest">
                <div className="flex-1">Executive</div>
                <div className="w-32 text-center">Work %</div>
                <div className="w-48 text-right pr-4">Today's Metrics</div>
              </div>
              <div className="max-h-[420px] overflow-y-auto scrollbar-hide">
                {team.map((exec, idx) => (
                  <div key={exec._id || idx} className="px-6 py-4 flex items-center border-b border-border/30 last:border-0 hover:bg-white transition-all group cursor-pointer">
                    <div className="flex-1 flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xs font-bold text-white shadow-sm av-${idx % 5}`}>
                        {getInitials(exec.name)}
                      </div>
                      <div>
                        <div className="text-sm font-bold text-text-primary group-hover:text-purple transition-colors">{exec.name}</div>
                        <div className="text-[11px] text-text-muted font-medium mt-0.5">{exec.district} · {exec.leadsCount} leads</div>
                      </div>
                    </div>
                    <div className="w-32 flex flex-col items-center">
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className={`text-[11px] font-bold ${exec.completionPct >= 70 ? 'text-green' : exec.completionPct >= 30 ? 'text-amber' : 'text-red'}`}>{exec.completionPct}%</span>
                        <span className={`text-[9px] font-bold ${exec.workGrowth >= 0 ? 'text-green' : 'text-red'}`}>
                          {exec.workGrowth >= 0 ? '↑' : '↓'}{Math.abs(exec.workGrowth)}%
                        </span>
                      </div>
                      <div className="w-20 h-1.5 bg-surface2 rounded-full overflow-hidden border border-border/40">
                        <div
                          className={`h-full rounded-full transition-all duration-700 ${exec.completionPct >= 70 ? 'bg-green' : exec.completionPct >= 30 ? 'bg-amber' : 'bg-red'}`}
                          style={{ width: `${exec.completionPct}%` }}
                        />
                      </div>
                    </div>
                    <div className="w-48 flex items-center justify-end gap-3 pr-2">
                      <div className="text-right">
                        <div className="text-[10px] font-bold text-blue uppercase">Calls</div>
                        <div className="text-sm font-bold">{exec.calls}</div>
                      </div>
                      <div className="w-px h-6 bg-border/40 mx-1" />
                      <div className="text-right">
                        <div className="text-[10px] font-bold text-accent uppercase">Conv</div>
                        <div className="text-sm font-bold">{exec.converted}</div>
                      </div>
                      <div className="w-px h-6 bg-border/40 mx-1" />
                      <div className="text-right">
                        <div className="text-[10px] font-bold text-red uppercase">RNR</div>
                        <div className="text-sm font-bold">{exec.rnrCount}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Lead Funnel */}
        <div className="card shadow-sm border-border/40">
          <div className="card-header border-none px-8 pt-8">
            <div>
              <h3 className="text-xl font-bold text-text-primary tracking-tight">Lead Funnel</h3>
              <p className="text-sm text-text-muted mt-1 font-medium">Pipeline breakdown</p>
            </div>
            <div className="bg-surface2 p-1 rounded-xl flex gap-1 border border-border/40">
              <button
                onClick={() => setFunnelPeriod('month')}
                className={`px-3 py-1 text-[10px] font-bold rounded-lg transition-all ${funnelPeriod === 'month' ? 'bg-white shadow-sm text-purple' : 'text-text-muted hover:text-text-primary'}`}
              >Month</button>
              <button
                onClick={() => setFunnelPeriod('week')}
                className={`px-3 py-1 text-[10px] font-bold rounded-lg transition-all ${funnelPeriod === 'week' ? 'bg-white shadow-sm text-purple' : 'text-text-muted hover:text-text-primary'}`}
              >Week</button>
            </div>
          </div>
          <div className="card-body px-8 pt-4 pb-8">
            <LeadFunnel stages={[
              { label: 'Total Leads', val: leadStats.total || 0, pct: 100, color: 'var(--purple)' },
              { label: 'Hot Leads', val: leadStats.hot || 0, pct: (leadStats.hot / leadStats.total) * 100, color: 'var(--red)' },
              { label: 'Warm Leads', val: leadStats.warm || 0, pct: (leadStats.warm / leadStats.total) * 100, color: 'var(--amber)' },
              { label: 'Follow-ups', val: leadStats.followup || 0, pct: (leadStats.followup / leadStats.total) * 100, color: 'var(--blue)' },
              { label: 'Meetings', val: (stats.meetings?.total || 0), pct: ((stats.meetings?.total || 0) / leadStats.total) * 100, color: 'var(--teal)' },
              { label: 'Converted', val: leadStats.converted || 0, pct: (leadStats.converted / leadStats.total) * 100, color: 'var(--green)' },
            ]} />
            <div className="mt-8 pt-6 border-t border-border/40">
              <div className="flex items-center justify-between mb-4">
                <div className="text-[11px] font-bold text-text-muted uppercase tracking-wider">Conversion Rate</div>
                <div className="text-lg font-black text-purple">
                  {leadStats.total > 0 ? Math.round((leadStats.converted / leadStats.total) * 100) : 0}%
                </div>
              </div>
              <div className="w-full h-2 bg-surface2 rounded-full overflow-hidden border border-border/40">
                <div
                  className="h-full bg-purple transition-all duration-1000 ease-out shadow-sm"
                  style={{ width: `${leadStats.total > 0 ? (leadStats.converted / leadStats.total) * 100 : 0}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Section: Events & Leaves */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Upcoming Events */}
        <div className="card lg:col-span-2 shadow-sm border-border/40">
          <div className="card-header border-none px-8 pt-8">
            <div>
              <h3 className="text-xl font-bold text-text-primary tracking-tight">Upcoming Events</h3>
              <p className="text-sm text-text-muted mt-1 font-medium">Meetings &amp; follow-ups scheduled for today</p>
            </div>
            <Tag variant="purple" label="Today's Schedule" className="py-1.5 px-3 rounded-xl" />
          </div>
          <div className="card-body px-4 pt-4 pb-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {events.slice(0, 6).map((ev, idx) => (
                <div key={idx} className="p-4 rounded-2xl bg-surface/40 border border-border/30 hover:border-purple/30 hover:bg-white hover:shadow-md transition-all cursor-pointer group flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl transition-all group-hover:scale-110 ${ev.type === 'meeting' ? 'bg-teal-light text-teal shadow-teal/10' : 'bg-blue-light text-blue shadow-blue/10'}`}>
                    {ev.type === 'meeting' ? (ev.status?.includes('virtual') ? '🎥' : '🤝') : '📞'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold text-text-primary group-hover:text-purple transition-colors truncate">
                      {ev.name}
                    </div>
                    <div className="text-[11px] text-text-muted font-medium mt-0.5">
                      {ev.ownerName} <span className="mx-1">→</span> {ev.company}
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      <div className="px-2 py-0.5 rounded-lg bg-surface2 text-[9px] font-bold text-text-muted uppercase tracking-wider group-hover:bg-purple/5 group-hover:text-purple">
                        {new Date(ev.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                      <Tag
                        variant={ev.type === 'meeting' ? 'teal' : 'blue'}
                        label={ev.type === 'meeting' ? (ev.status?.includes('virtual') ? 'virtual' : 'direct') : 'followup'}
                        className="text-[9px] py-0.5"
                      />
                    </div>
                  </div>
                </div>
              ))}
              {events.length === 0 && (
                <div className="col-span-full py-16 text-center">
                  <div className="text-4xl mb-4">📅</div>
                  <div className="text-text-muted font-medium">No events scheduled for the rest of today.</div>
                  <button className="mt-4 text-purple text-sm font-bold hover:underline">View Tomorrow's Schedule →</button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Leave Requests Quick Approval */}
        <div className="card shadow-sm border-border/40">
          <div className="card-header border-none px-8 pt-8">
            <div>
              <h3 className="text-xl font-bold text-text-primary tracking-tight">Leave Approvals</h3>
              <p className="text-sm text-text-muted mt-1 font-medium">Pending requests</p>
            </div>
            {leaves.length > 0 && <div className="w-6 h-6 rounded-full bg-red text-white flex items-center justify-center text-[10px] font-bold shadow-lg shadow-red/20">{leaves.length}</div>}
          </div>
          <div className="card-body p-4 pt-0">
            <div className="space-y-3">
              {leaves.slice(0, 3).map((leave, idx) => (
                <div key={idx} className="p-4 rounded-2xl bg-surface/40 border border-border/30 hover:border-purple/20 transition-all">
                  <div className="flex items-center gap-3 mb-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xs font-bold text-white av-${idx % 5}`}>
                      {getInitials(leave.user?.name)}
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-bold text-text-primary">{leave.user?.name}</div>
                      <div className="text-[10px] text-text-muted font-semibold uppercase tracking-wider">
                        {leave.type.replace('_', ' ')} · {leave.days} Day{leave.days > 1 ? 's' : ''}
                      </div>
                    </div>
                  </div>
                  <p className="text-xs text-text-secondary leading-relaxed bg-surface2/50 p-2.5 rounded-xl border border-border/20 mb-4 line-clamp-2 italic">
                    "{leave.reason}"
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => approveMutation.mutate(leave._id)}
                      className="py-2.5 rounded-xl text-xs font-bold bg-green text-white hover:bg-green-dark transition-all shadow-md shadow-green/10"
                    >Approve</button>
                    <button
                      onClick={() => rejectMutation.mutate(leave._id)}
                      className="py-2.5 rounded-xl text-xs font-bold bg-white border border-red/20 text-red hover:bg-red-light transition-all"
                    >Reject</button>
                  </div>
                </div>
              ))}
              {leaves.length === 0 && (
                <div className="py-12 text-center">
                  <div className="text-3xl mb-3">✅</div>
                  <div className="text-text-muted text-sm font-medium">All leave requests processed.</div>
                </div>
              )}
              {leaves.length > 0 && (
                <button
                  className="w-full py-3 rounded-xl text-xs font-bold text-purple bg-purple-light hover:bg-purple hover:text-white transition-all"
                  onClick={() => navigate('/dashboard?page=approvals')}
                >
                  View All Requests
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Lead Owner Mapping */}
      <div className="card shadow-sm border-border/40">
        <div className="card-header border-none px-8 pt-6 pb-4">
          <div>
            <h3 className="text-base font-bold text-text-primary tracking-tight">Lead Owner Mapping · {userInfo.industry} Executives</h3>
            <p className="text-xs text-text-muted mt-0.5 font-medium">Map &amp; reassign leads · One-by-one delivery to executive</p>
          </div>
          <button
            className="px-4 py-2 rounded-xl bg-purple text-white text-xs font-bold hover:opacity-90 transition-all shadow-lg shadow-purple/20"
            onClick={() => navigate('/dashboard?page=leads')}
          >
            Manage Mapping
          </button>
        </div>
        <div className="overflow-x-auto">
          {recentLeads.length === 0 ? (
            <div className="px-8 py-10 text-center text-text-muted text-sm">No leads to display.</div>
          ) : (
            <table className="w-full border-collapse text-[13px]">
              <thead>
                <tr className="bg-surface2/60 border-b border-border">
                  <th className="text-left px-6 py-3 text-[10px] font-bold uppercase tracking-wider text-text-muted">Company</th>
                  <th className="text-left px-6 py-3 text-[10px] font-bold uppercase tracking-wider text-text-muted">Contact</th>
                  <th className="text-left px-6 py-3 text-[10px] font-bold uppercase tracking-wider text-text-muted">Assigned To</th>
                  <th className="text-left px-6 py-3 text-[10px] font-bold uppercase tracking-wider text-text-muted">District</th>
                  <th className="text-left px-6 py-3 text-[10px] font-bold uppercase tracking-wider text-text-muted">Status</th>
                  <th className="px-6 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {recentLeads.slice(0, 8).map((lead, idx) => (
                  <tr key={lead._id || idx} className="border-b border-border/40 hover:bg-surface2/30 transition-colors">
                    <td className="px-6 py-3 font-semibold">{lead.company || lead.name || '—'}</td>
                    <td className="px-6 py-3 text-text-secondary">{lead.name || '—'}</td>
                    <td className="px-6 py-3">
                      {lead.owner && lead.owner !== 'Unassigned' ? (
                        <span className="inline-flex items-center gap-1.5">
                          <span className="w-6 h-6 rounded-full bg-purple/10 text-purple text-[9px] font-bold flex items-center justify-center">
                            {lead.owner.charAt(0)}
                          </span>
                          <span className="text-text-secondary text-[12px]">{lead.owner}</span>
                        </span>
                      ) : (
                        <span className="text-text-muted text-[12px] italic">Unassigned</span>
                      )}
                    </td>
                    <td className="px-6 py-3 text-text-secondary">{lead.district || '—'}</td>
                    <td className="px-6 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-tight
                        ${lead.status === 'converted' ? 'bg-green/10 text-green' :
                          lead.status === 'hot' ? 'bg-red/10 text-red' :
                          lead.status === 'rnr' ? 'bg-surface2 text-text-muted' :
                          'bg-amber-light text-amber'}`}>
                        {lead.status || 'fresh'}
                      </span>
                    </td>
                    <td className="px-6 py-3">
                      <button
                        className="text-[11px] font-bold text-purple hover:underline"
                        onClick={() => window.dispatchEvent(new CustomEvent('open-modal', { detail: { type: 'allocate-lead', leadData: lead } }))}
                      >
                        Reassign
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {recentLeads.length > 8 && (
            <div className="px-8 py-4 border-t border-border/40">
              <button
                className="text-xs font-bold text-purple hover:underline"
                onClick={() => navigate('/dashboard?page=leads')}
              >
                View all {recentLeads.length} leads →
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Overview;
