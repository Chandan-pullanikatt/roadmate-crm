import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  StatCard, 
  PerformanceMeter, 
  Avatar, 
  Button, 
  Tag, 
  LeadFunnel,
  MemberRow,
  Modal
} from '../../../components/ui';
import { dashboardApi } from '../../../api/dashboardApi';
import { leaveApi } from '../../../api/leaveApi';
import { leadsApi } from '../../../api/leadsApi';
import { useToast } from '../../../context/ToastContext';

const Overview = () => {
  const queryClient = useQueryClient();
  const { addToast } = useToast();

  const { data: dashData, isLoading } = useQuery({
    queryKey: ['dashboard', 'industry-manager'],
    queryFn: () => dashboardApi.getIndustryManagerDashboard().then(res => res.data)
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

  if (isLoading) return <div className="p-8 text-center text-text-muted">Loading industry metrics...</div>;

  const stats = dashData?.stats || {};
  const team = dashData?.executives || [];
  const funnel = dashData?.funnel || [];
  const events = dashData?.upcomingEvents || [];
  const leaves = dashData?.pendingLeaves || [];
  const escalations = dashData?.escalatedLeads || [];

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Escalation Banner */}
      {escalations.length > 0 && (
        <div className="bg-amber-light border border-amber/30 rounded-xl p-4 flex items-center gap-4 shadow-sm">
          <div className="w-10 h-10 rounded-full bg-amber/20 flex items-center justify-center text-amber text-xl shrink-0">⚠️</div>
          <div className="flex-1">
            <h4 className="text-sm font-bold text-amber">{escalations.length} Lead(s) Escalated from Executive</h4>
            <p className="text-xs text-amber/80">{escalations[0].name} · {escalations[0].company} · Needs manager decision</p>
          </div>
          <div className="flex gap-2 shrink-0">
            <Button size="xs" className="bg-amber text-white border-none hover:bg-amber/90">Review Leads</Button>
          </div>
        </div>
      )}

      {/* Stat Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="District Executives" value={team.length} delta="Automobile industry" colorClass="purple" />
        <StatCard label="Total Leads (Month)" value={stats.totalLeads || 0} delta="↑ 12% vs last month" colorClass="amber" />
        <StatCard label="Meetings Done" value={stats.meetingsDone || 0} delta="Virtual & Direct" colorClass="teal" />
        <StatCard label="Leads Converted" value={stats.converted || 0} delta="High priority conversion" colorClass="green" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Team Snapshot */}
        <div className="card">
          <div className="card-header">
            <div>
              <h3 className="section-title">District Executives Performance</h3>
              <p className="section-sub">Live monitoring of your team</p>
            </div>
            <Button size="sm" variant="outline">View All</Button>
          </div>
          <div className="p-0 max-h-[400px] overflow-y-auto">
            {team.map((exec, idx) => (
              <MemberRow 
                key={idx}
                name={exec.name}
                meta={`${exec.district} · ${exec.activeLeadsCount || 0} active leads`}
                avatarClass={`av-${idx % 5}`}
                workPct={exec.completionPct || 0}
                status={exec.isWorking ? 'Active' : 'Offline'}
                metrics={[
                  { label: 'Calls', value: exec.callsToday || 0, colorClass: 'text-blue' },
                  { label: 'Conv.', value: exec.conversionsTotal || 0, colorClass: 'text-accent' }
                ]}
              />
            ))}
          </div>
        </div>

        {/* Lead Funnel */}
        <div className="card">
          <div className="card-header">
            <div>
              <h3 className="section-title">Industry Pipeline</h3>
              <p className="section-sub">Lead distribution by stage</p>
            </div>
          </div>
          <div className="card-body">
            <LeadFunnel stages={funnel.map(s => ({
              ...s,
              pct: (s.val / (stats.totalLeads || 1)) * 100
            }))} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upcoming Events */}
        <div className="card">
          <div className="card-header">
            <div>
              <h3 className="section-title">Upcoming Team Events</h3>
              <p className="section-sub">Scheduled meetings & follow-ups</p>
            </div>
          </div>
          <div className="divide-y divide-border">
            {events.map((ev, idx) => (
              <div key={idx} className="p-4 flex items-start gap-3 hover:bg-surface2 transition-colors">
                <div className="text-xl shrink-0">{ev.type === 'meeting_scheduled' ? '🎥' : '📞'}</div>
                <div className="flex-1 min-width-0">
                  <div className="text-sm font-semibold truncate">{ev.name}</div>
                  <div className="text-xs text-text-muted">{ev.ownerName} → {ev.company}</div>
                  <div className="text-xs text-purple font-medium mt-1">{new Date(ev.time).toLocaleString()}</div>
                </div>
                <Tag variant="blue" label={ev.type} />
              </div>
            ))}
            {events.length === 0 && <div className="p-8 text-center text-text-muted">No upcoming events</div>}
          </div>
        </div>

        {/* Leave Approvals */}
        <div className="card">
          <div className="card-header">
            <div>
              <h3 className="section-title">Pending Leave Requests</h3>
              <p className="section-sub">Executive level approvals</p>
            </div>
          </div>
          <div className="divide-y divide-border">
            {leaves.map((leave, idx) => (
              <div key={idx} className="p-4 flex items-center gap-3">
                <Avatar name={leave.userName} size="sm" />
                <div className="flex-1">
                  <div className="text-sm font-semibold">{leave.userName}</div>
                  <div className="text-[11px] text-text-muted">{leave.type} · {leave.days} day(s)</div>
                  <div className="text-[11px] italic text-text-muted mt-0.5">"{leave.reason}"</div>
                </div>
                <div className="flex gap-2">
                  <button className="btn btn-xs bg-accent-light text-accent border-accent/20" onClick={() => approveMutation.mutate(leave._id)}>Approve</button>
                  <button className="btn btn-xs bg-red-light text-red border-red/20" onClick={() => rejectMutation.mutate(leave._id)}>Reject</button>
                </div>
              </div>
            ))}
            {leaves.length === 0 && <div className="p-8 text-center text-text-muted">No pending leave requests</div>}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Overview;
