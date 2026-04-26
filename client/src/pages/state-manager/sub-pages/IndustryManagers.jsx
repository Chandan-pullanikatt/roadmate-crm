import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { usersApi } from '../../../api/usersApi';
import { dashboardApi } from '../../../api/dashboardApi';
import { Avatar, Button, Tag } from '../../../components/ui';
import { useToast } from '../../../context/ToastContext';

const IndustryManagers = ({ openModal }) => {
  const queryClient = useQueryClient();
  const { addToast } = useToast();

  const { data: dashData, isLoading: dashLoading } = useQuery({
    queryKey: ['dashboard', 'state-manager'],
    queryFn: () => dashboardApi.getStateManagerDashboard().then(res => res.data)
  });

  const { data: managers, isLoading: managersLoading } = useQuery({
    queryKey: ['users', 'industry-managers'],
    queryFn: () => usersApi.getUsers({ role: 'industry-manager' }).then(res => res.data)
  });

  const reassignMutation = useMutation({
    mutationFn: (data) => usersApi.updateUser(data.userId, { industry: data.newIndustry }),
    onSuccess: () => {
      queryClient.invalidateQueries(['users', 'industry-managers']);
      addToast("Manager reassigned successfully", "success");
    }
  });

  if (dashLoading || managersLoading) return <div className="p-8 text-center text-text-muted">Loading industry data...</div>;

  const stats = dashData?.stats || {};
  const escalations = dashData?.escalations || [];

  return (
    <div className="animate-in fade-in duration-500">
      <div className="section-header">
        <div>
          <div className="section-title">Industry State Managers</div>
          <div className="section-sub">Direct reporting line for {dashData?.user?.state} industry performance</div>
        </div>
        <Button className="bg-purple text-white" size="sm" onClick={() => openModal('create-ind-mgr')}>+ Create Industry Manager</Button>
      </div>

      <div className="stat-grid mb-6">
        <div className="stat-card">
          <div className="stat-label">Active Managers</div>
          <div className="stat-value" style={{ color: 'var(--blue)' }}>{managers?.length || 0}</div>
          <div className="stat-delta">Across all industries</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Combined Revenue</div>
          <div className="stat-value" style={{ color: 'var(--accent)' }}>₹{stats.revenue?.toLocaleString() || '0'}</div>
          <div className="stat-delta text-accent">↑ This month</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Total Leads</div>
          <div className="stat-value" style={{ color: 'var(--amber)' }}>{stats.activeLeads || 0}</div>
          <div className="stat-delta">In pipeline</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Avg Conversion</div>
          <div className="stat-value" style={{ color: 'var(--teal)' }}>{stats.conversionRate || 0}%</div>
          <div className="stat-delta text-teal">↑ Team average</div>
        </div>
      </div>

      <div className="card mb-6">
        <div className="card-header border-b border-border">
          <div className="section-title">Performance Breakdown</div>
        </div>
        <div className="card-body p-0">
          {managers?.map((m, idx) => (
            <div key={m._id} className="flex items-center gap-5 p-5 border-b last:border-0 hover:bg-surface2 transition-colors cursor-pointer">
              <Avatar name={m.name} size="lg" className={`av-${idx % 5}`} />
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-center mb-1">
                   <div className="font-bold text-[15px]">{m.name} <span className="text-text-muted font-normal text-sm ml-1">· {m.industry}</span></div>
                   <div className="text-[11px] font-bold text-blue mono">{m.completionPct || 0}% Efficiency</div>
                </div>
                <div className="text-[12px] text-text-muted mb-2">{m.state} · {m.districtCount || 0} Districts Managed</div>
                <div className="h-2 w-full bg-surface2 rounded-full overflow-hidden border border-border">
                  <div className="h-full bg-blue transition-all" style={{ width: `${m.completionPct || 0}%` }}></div>
                </div>
              </div>
              <div className="flex gap-8 mx-8">
                <div className="text-center"><div className="text-[15px] font-bold text-blue mono">{m.callsToday || 0}</div><div className="text-[9px] text-text-muted uppercase font-bold">Calls</div></div>
                <div className="text-center"><div className="text-[15px] font-bold text-accent mono">{m.conversionsTotal || 0}</div><div className="text-[9px] text-text-muted uppercase font-bold">Conv</div></div>
              </div>
              <div className="flex gap-2">
                <Button size="xs" variant="outline">Profile</Button>
                <Button size="xs" variant="outline" className="text-red border-red/20">Escalate</Button>
              </div>
            </div>
          ))}
          {managers?.length === 0 && <div className="p-12 text-center text-text-muted">No managers found</div>}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <div className="card-header border-b border-border">
            <div className="section-title">Lead Owner Mapping</div>
          </div>
          <div className="card-body p-0">
            {managers?.slice(0, 5).map((m, i) => (
              <div key={m._id} className="flex items-center gap-4 p-4 border-b last:border-0 hover:bg-surface2">
                <Avatar name={m.name} size="sm" className={`av-${i % 5}`} />
                <div className="flex-1">
                   <div className="text-[13.5px] font-bold">{m.name}</div>
                   <div className="text-[11.5px] text-text-muted">{m.industry}</div>
                </div>
                <div className="mono text-[13px] font-bold text-blue">{m.leadsCount || 0} Active</div>
                <Button size="xs" variant="outline">Remap</Button>
              </div>
            ))}
          </div>
        </div>
        <div className="card">
          <div className="card-header border-b border-border">
            <div className="section-title">Critical Escalations</div>
          </div>
          <div className="card-body p-0 max-h-[400px] overflow-y-auto">
            {escalations.map((esc, i) => (
              <div key={i} className="flex items-start gap-4 p-5 border-b last:border-0 bg-red-light/10">
                <Avatar name={esc.owner?.name} size="md" className="av-state" />
                <div className="flex-1">
                  <div className="flex justify-between items-center">
                     <div className="text-[14px] font-bold">{esc.company}</div>
                     <Tag variant="red" label="Critical" />
                  </div>
                  <div className="text-[12px] text-text-muted mt-0.5">Manager: {esc.owner?.name} · District: {esc.district}</div>
                  <div className="bg-white/50 border border-red/10 p-3 rounded-lg mt-3 text-[12.5px] text-red leading-relaxed italic">
                     "Needs state-head approval for bulk fleet discount."
                  </div>
                  <div className="flex gap-2 mt-4">
                     <Button size="sm" className="bg-accent text-white">Approve</Button>
                     <Button size="sm" variant="outline">Reject</Button>
                  </div>
                </div>
              </div>
            ))}
            {escalations.length === 0 && <div className="p-12 text-center text-text-muted text-xs italic">No critical escalations at this time</div>}
          </div>
        </div>
      </div>
    </div>
  );
};

export default IndustryManagers;
