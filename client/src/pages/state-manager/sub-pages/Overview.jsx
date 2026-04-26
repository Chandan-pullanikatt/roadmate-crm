import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { dashboardApi } from '../../../api/dashboardApi';
import { Avatar, Button, Tag } from '../../../components/ui';

const Overview = ({ openModal }) => {
  const { data: dashData, isLoading } = useQuery({
    queryKey: ['dashboard', 'state-manager'],
    queryFn: () => dashboardApi.getStateManagerDashboard().then(res => res.data)
  });

  if (isLoading) return <div className="p-8 text-center text-text-muted">Loading state metrics...</div>;

  const stats = dashData?.stats || {};
  const managers = dashData?.industryManagers || [];
  const funnel = dashData?.funnel || [];
  const events = dashData?.upcomingEvents || [];
  const leads = dashData?.latestLeads || [];
  const escalations = dashData?.escalations || [];

  return (
    <div className="animate-in fade-in duration-500">
      <div className="section-header">
        <div>
          <div className="section-title">{dashData?.user?.state} State Overview</div>
          <div className="section-sub">Comprehensive performance metrics across all industries in {dashData?.user?.state}</div>
        </div>
        <div className="flex gap-2">
           <Button variant="outline" size="sm">Download Stats</Button>
           <Button className="bg-purple text-white" size="sm" onClick={() => openModal('bulk-upload')}>Bulk Upload Leads</Button>
        </div>
      </div>

      {/* Escalation Banner */}
      {escalations.length > 0 && (
        <div className="bg-red-light border border-red/20 rounded-2xl p-4 flex items-center gap-4 shadow-sm mb-6">
          <div className="w-10 h-10 rounded-full bg-red/20 flex items-center justify-center text-red text-xl shrink-0">🚨</div>
          <div className="flex-1">
            <div className="font-bold text-[14px]">Escalated: {escalations[0].company}</div>
            <div className="text-[12.5px] text-text-muted mt-0.5">By {escalations[0].owner?.name} · Needs manager decision</div>
          </div>
          <Button size="sm" className="bg-red text-white">Review Now</Button>
        </div>
      )}

      {/* 8 STAT CARDS GRID */}
      <div className="stat-grid mb-6">
        <div className="stat-card">
          <div className="stat-label">Industry Managers</div>
          <div className="stat-value">{managers.length}</div>
          <div className="stat-delta">Managing {stats.totalIndustries || 0} industries</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Total Executives</div>
          <div className="stat-value">{stats.totalExecutives || 0}</div>
          <div className="stat-delta">Field force team</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Today's Present</div>
          <div className="stat-value" style={{ color: 'var(--accent)' }}>{stats.todayAttendance || 0}</div>
          <div className="stat-delta text-accent">↑ {stats.attendancePct || 0}% attendance</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Active Leads</div>
          <div className="stat-value" style={{ color: 'var(--purple)' }}>{stats.activeLeads || 0}</div>
          <div className="stat-delta">Total pipeline</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">State Revenue</div>
          <div className="stat-value" style={{ color: 'var(--teal)' }}>₹{stats.revenue?.toLocaleString() || '0'}</div>
          <div className="stat-delta text-teal">↑ This month</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">State Conversions</div>
          <div className="stat-value" style={{ color: 'var(--blue)' }}>{stats.conversions || 0}</div>
          <div className="stat-delta">Successful closings</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">On Leave</div>
          <div className="stat-value" style={{ color: 'var(--red)' }}>{stats.onLeaveToday || 0}</div>
          <div className="stat-delta">Approved leaves</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Pending Requests</div>
          <div className="stat-value" style={{ color: 'var(--amber)' }}>{stats.pendingLeaves || 0}</div>
          <div className="stat-delta">Needs approval</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* INDUSTRY MANAGER SUMMARY */}
        <div className="card">
          <div className="card-header border-b border-border">
            <div className="section-title">Industry Manager Summary</div>
            <Button variant="outline" size="sm">View All</Button>
          </div>
          <div className="card-body p-0 max-h-[400px] overflow-y-auto">
            {managers.map((m, idx) => (
              <div key={idx} className="flex items-center gap-4 p-5 border-b last:border-0 hover:bg-surface2 transition-colors cursor-pointer">
                <Avatar name={m.name} size="md" className={`av-${idx % 5}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-center mb-1">
                    <div className="font-bold text-[14.5px]">{m.name}</div>
                    <div className="text-[11px] font-bold text-blue mono">{m.completionPct || 0}% Efficiency</div>
                  </div>
                  <div className="text-[12px] text-text-muted mb-2">{m.industry} · {m.districtCount || 0} Districts</div>
                  <div className="h-1.5 w-full bg-surface2 rounded-full overflow-hidden border border-border">
                    <div className="h-full bg-blue transition-all" style={{ width: `${m.completionPct || 0}%` }}></div>
                  </div>
                </div>
                <div className="flex gap-4 ml-2">
                  <div className="text-center"><div className="text-sm font-bold text-blue mono">{m.callsToday || 0}</div><div className="text-[9px] text-text-muted uppercase font-bold">Calls</div></div>
                  <div className="text-center"><div className="text-sm font-bold text-accent mono">{m.conversionsTotal || 0}</div><div className="text-[9px] text-text-muted uppercase font-bold">Conv.</div></div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* PIPELINE & EVENTS */}
        <div className="flex flex-col gap-6">
          <div className="card">
            <div className="card-header border-b border-border"><div className="section-title">State Pipeline</div></div>
            <div className="card-body">
              {funnel.map((s, i) => (
                <div key={i} className="flex items-center gap-4 mb-4 last:mb-0">
                  <div className="w-20 text-xs text-text-secondary font-bold uppercase">{s.label}</div>
                  <div className="flex-1 h-2 bg-surface2 rounded-full overflow-hidden border border-border">
                    <div className="h-full transition-all" style={{ width: `${(s.val / (stats.activeLeads || 1)) * 100}%`, background: s.color || 'var(--purple)' }}></div>
                  </div>
                  <div className="font-mono text-xs w-8 text-right font-bold">{s.val}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <div className="card-header border-b border-border"><div className="section-title">Upcoming Team Events</div></div>
            <div className="card-body p-0 max-h-[250px] overflow-y-auto">
              {events.map((e, i) => (
                <div key={i} className="flex items-start gap-4 p-4 border-b last:border-0 hover:bg-surface2 transition-colors cursor-pointer">
                  <div className="text-xl mt-0.5">{e.type === 'meeting_scheduled' ? '🎥' : '📞'}</div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13.5px] font-bold truncate">{e.name}</div>
                    <div className="text-[12px] text-text-muted mt-0.5">{e.ownerName} → {e.company}</div>
                    <div className="text-[12px] text-blue font-bold mt-1.5">{new Date(e.time).toLocaleString()}</div>
                  </div>
                  <Tag variant="blue" label={e.type} />
                </div>
              ))}
              {events.length === 0 && <div className="p-8 text-center text-text-muted text-xs italic">No upcoming events</div>}
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header border-b border-border">
          <div>
            <div className="section-title">Latest State Leads</div>
            <div className="section-sub">Latest leads entered into the system across all industries</div>
          </div>
          <Button variant="outline" size="sm">View All Leads</Button>
        </div>
        <div className="table-scroll overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr className="bg-surface2/50 text-[10px] font-bold text-text-muted uppercase tracking-wider">
                <th className="p-4 text-left">Lead ID</th>
                <th className="p-4 text-left">Business Name</th>
                <th className="p-4 text-left">Industry</th>
                <th className="p-4 text-left">District</th>
                <th className="p-4 text-left">Owner</th>
                <th className="p-4 text-left">Status</th>
                <th className="p-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {leads.map((l, i) => (
                <tr key={i} className="hover:bg-surface2/20 transition-colors">
                  <td className="p-4 mono text-[11px] font-bold">{l.leadId}</td>
                  <td className="p-4">
                    <div className="font-bold text-[13.5px]">{l.company}</div>
                    <div className="text-[11px] text-text-muted">{l.name}</div>
                  </td>
                  <td className="p-4"><Tag variant="gray" label={l.industry} /></td>
                  <td className="p-4 text-sm">{l.district}</td>
                  <td className="p-4 font-medium text-sm">{l.owner?.name || 'Unassigned'}</td>
                  <td className="p-4">
                    <Tag variant={l.status === 'hot' ? 'red' : l.status === 'converted' ? 'green' : 'amber'} label={l.status.toUpperCase()} />
                  </td>
                  <td className="p-4 text-right">
                    <Button size="xs" variant="outline">Details</Button>
                  </td>
                </tr>
              ))}
              {leads.length === 0 && <tr><td colSpan="7" className="p-12 text-center text-text-muted italic">No leads found</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Overview;
