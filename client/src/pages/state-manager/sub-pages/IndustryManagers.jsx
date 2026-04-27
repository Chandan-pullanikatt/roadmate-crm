import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { usersApi } from '../../../api/usersApi';
import { dashboardApi } from '../../../api/dashboardApi';
import { Avatar, Button, Tag } from '../../../components/ui';
import { toast } from 'react-hot-toast';

const IndustryManagers = () => {
  const queryClient = useQueryClient();
  const [period, setPeriod] = useState('Monthly');

  const { data: dashData, isLoading: dashLoading } = useQuery({
    queryKey: ['dashboard', 'state-manager'],
    queryFn: () => dashboardApi.getStateManagerDashboard().then(res => res.data)
  });

  const { data: managersRaw, isLoading: managersLoading } = useQuery({
    queryKey: ['users', 'industry-managers'],
    queryFn: () => usersApi.getUsers({ role: 'industry-manager' }).then(res => res.data)
  });

  const escalateMutation = useMutation({
    mutationFn: (data) => toast.promise(Promise.resolve(), { loading: 'Escalating...', success: 'Escalated to Founder', error: 'Failed' }),
    onSuccess: () => {
      queryClient.invalidateQueries(['dashboard', 'state-manager']);
    }
  });

  if (dashLoading || managersLoading) return <div className="p-8 text-center text-text-muted">Loading industry portfolio...</div>;

  const stats = dashData?.stats || {};
  const escalations = dashData?.escalated || [];
  const industryManagers = dashData?.industryManagers || [];
  const user = dashData?.user || {};

  const formatCurrency = (val) => {
    if (val >= 100000) return `₹${(val / 100000).toFixed(1)}L`;
    return `₹${val.toLocaleString()}`;
  };

  return (
    <div className="animate-in fade-in duration-500">
      {/* HEADER */}
      <div className="section-header mb-6">
        <div>
          <div className="section-title">Industry State Managers · {user.state}</div>
          <div className="section-sub text-[13px]">All {stats.industryManagersCount || 0} industries - Full drill-in view</div>
        </div>
        <Button className="bg-blue text-white shadow-sm" size="sm" onClick={() => window.dispatchEvent(new CustomEvent('open-modal', { detail: { type: 'create-exec', role: 'industry-manager' } }))}>+ Create Industry Manager</Button>
      </div>

      {/* STAT CARDS */}
      <div className="stat-grid mb-8">
        <div className="stat-card border-l-4 border-blue">
          <div className="stat-label">Total Industry Managers</div>
          <div className="stat-value text-blue">{stats.industryManagersCount || 0}</div>
          <div className="stat-delta text-green font-bold">↑ All active</div>
        </div>
        <div className="stat-card border-l-4 border-green">
          <div className="stat-label">Combined Revenue</div>
          <div className="stat-value text-green">{formatCurrency(stats.totalRevenue || 0)}</div>
          <div className="stat-delta text-green font-bold">↑ {stats.revGrowth || 0}% MoM</div>
        </div>
        <div className="stat-card border-l-4 border-amber">
          <div className="stat-label">Total Leads Handled</div>
          <div className="stat-value text-amber">{stats.activeLeads || 0}</div>
          <div className="stat-delta text-amber font-medium">Across all industries</div>
        </div>
        <div className="stat-card border-l-4 border-teal">
          <div className="stat-label">Conversion Rate</div>
          <div className="stat-value text-teal">{stats.convRate || 0}%</div>
          <div className="stat-delta text-teal font-bold">↑ {stats.convGrowth || 0}% vs last month</div>
        </div>
      </div>

      {/* PERFORMANCE LIST */}
      <div className="card mb-8">
        <div className="card-header border-b border-border bg-surface2/5">
          <div className="section-title text-[15px]">Industry Manager Performance</div>
          <div className="flex bg-surface2 p-1 rounded-lg border border-border">
             {['Monthly', 'Weekly', 'Daily'].map(t => (
               <button 
                 key={t} 
                 className={`px-4 py-1 text-[11px] font-bold uppercase rounded-md transition-all ${period === t ? 'bg-white shadow-sm text-blue' : 'text-text-muted hover:text-text'}`}
                 onClick={() => setPeriod(t)}
               >
                 {t}
               </button>
             ))}
          </div>
        </div>
        <div className="card-body p-0">
          {industryManagers.map((m, idx) => (
            <div key={m._id} className="flex items-center gap-6 p-5 border-b last:border-0 hover:bg-surface2 transition-all group">
              <Avatar name={m.name} size="lg" className={`av-${idx % 5}`} />
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-center mb-1.5">
                   <div className="font-black text-[15px] tracking-tight">{m.name} <span className="text-text-muted font-normal text-xs ml-1">· {m.industry}</span></div>
                   <div className="text-[10px] font-black text-blue mono tracking-widest">{m.efficiency || 0}%</div>
                </div>
                <div className="text-[11px] text-text-muted mb-2 font-medium">{user.state} · {m.districts || 0} Districts Managed</div>
                <div className="h-1.5 w-full bg-surface2 rounded-full overflow-hidden border border-border/50">
                  <div className="h-full bg-blue transition-all duration-1000 shadow-[0_0_8px_rgba(37,99,235,0.4)]" style={{ width: `${m.efficiency || 0}%` }}></div>
                </div>
              </div>
              
              <div className="flex gap-10 mx-6">
                <div className="text-center"><div className="text-[15px] font-black text-blue mono">{m.calls || 0}</div><div className="text-[9px] text-text-muted uppercase font-bold tracking-tighter">Calls</div></div>
                <div className="text-center"><div className="text-[15px] font-black text-purple mono">{m.meetings || 0}</div><div className="text-[9px] text-text-muted uppercase font-bold tracking-tighter">Meetings</div></div>
                <div className="text-center"><div className="text-[15px] font-black text-green mono">{m.conversions || 0}</div><div className="text-[9px] text-text-muted uppercase font-bold tracking-tighter">Converted</div></div>
                <div className="text-center"><div className="text-[15px] font-black text-accent mono">₹{(m.revenue / 100000).toFixed(1)}L</div><div className="text-[9px] text-text-muted uppercase font-bold tracking-tighter">Revenue</div></div>
                <div className="text-center"><div className="text-[15px] font-black text-amber mono">{m.leadsCount || 0}</div><div className="text-[9px] text-text-muted uppercase font-bold tracking-tighter">Leads</div></div>
              </div>

              <div className="flex gap-2">
                <Button size="xs" variant="outline" className="border-border text-text-secondary px-3 py-1.5 font-bold">View Details</Button>
                <Button size="xs" variant="outline" className="text-amber border-amber/30 px-3 py-1.5 font-bold hover:bg-amber-light/10">Escalate</Button>
              </div>
            </div>
          ))}
          {industryManagers.length === 0 && <div className="p-16 text-center text-text-muted italic">No industry managers assigned to {user.state} portfolio.</div>}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* LEAD OWNER MAPPING */}
        <div className="card">
          <div className="card-header border-b border-border bg-surface2/5">
            <div className="section-title text-sm">Lead Owner Mapping</div>
            <Button size="xs" variant="outline" className="text-[10px] uppercase tracking-widest font-bold">Manage Mapping</Button>
          </div>
          <div className="card-body p-2">
            {industryManagers.map((m, i) => (
              <div key={m._id} className="flex items-center gap-4 p-4 bg-surface2/50 rounded-xl mb-2 last:mb-0 border border-border/30 group hover:border-blue/30 transition-all">
                <Avatar name={m.name} size="sm" className={`av-${i % 5}`} />
                <div className="flex-1">
                   <div className="text-[13px] font-black">{m.name} <span className="text-[10px] text-text-muted font-normal">· {m.industry}</span></div>
                </div>
                <div className="mono text-[13px] font-black text-blue">{m.leadsCount || 0} leads</div>
                <Button size="xs" variant="outline" className="bg-white border-border text-[10px] font-bold px-3">Remap</Button>
              </div>
            ))}
          </div>
        </div>

        {/* ESCALATED LEADS */}
        <div className="card">
          <div className="card-header border-b border-border bg-surface2/5">
            <div className="section-title text-sm">Escalated Leads</div>
            <Button size="xs" variant="outline" className="text-[10px] uppercase tracking-widest font-bold">Escalate to Founder</Button>
          </div>
          <div className="card-body p-4 space-y-4">
            {escalations.map((esc, i) => (
              <div key={i} className="flex items-start gap-4 p-4 border border-border/50 rounded-2xl bg-white shadow-sm relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1 h-full bg-amber"></div>
                <Avatar name={esc.owner?.name} size="md" className="av-state" />
                <div className="flex-1">
                   <div className="flex justify-between items-start">
                      <div>
                         <div className="text-[14.5px] font-black">{esc.business}</div>
                         <div className="text-[10.5px] text-text-muted mt-0.5">
                            Escalated by <span className="font-bold text-text">{esc.owner?.name}</span> · {esc.priority || 'Warm'} · {esc.district}
                         </div>
                      </div>
                      <Button 
                        size="xs" 
                        variant="outline" 
                        className="text-amber border-amber/30 font-bold hover:bg-amber-light/10"
                        onClick={() => escalateMutation.mutate()}
                      >
                        Escalate to Founder
                      </Button>
                   </div>
                   <div className="text-[12px] text-amber font-medium italic mt-3 bg-amber-light/5 p-2 rounded-lg border border-amber/10">
                      Reason: Client wants State Head decision on pricing
                   </div>
                </div>
              </div>
            ))}
            {escalations.length === 0 && <div className="p-12 text-center text-text-muted text-xs italic">No pending escalations in {user.state} portfolio.</div>}
          </div>
        </div>
      </div>
    </div>
  );
};

export default IndustryManagers;

