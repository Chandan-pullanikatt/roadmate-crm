import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import DashboardSkeleton from '../../../components/skeletons/DashboardSkeleton';
import { leadsApi } from '../../../api/leadsApi';
import { attendanceApi } from '../../../api/attendanceApi';
import { dashboardApi } from '../../../api/dashboardApi';
import { Avatar, Button, Tag, DataTable } from '../../../components/ui';
import { toast } from 'react-hot-toast';
import { useAuth } from '../../../context/AuthContext';

const MyWork = () => {
  const queryClient = useQueryClient();
  const { user: currentUser } = useAuth();
  const [currentLeadIdx, setCurrentLeadIdx] = useState(0);
  const [strategyNote, setStrategyNote] = useState('');

  const { data: queueData, isLoading: queueLoading } = useQuery({
    queryKey: ['leads', 'my-queue'],
    queryFn: () => leadsApi.getQueue().then(res => res.data),
    staleTime: 5 * 60 * 1000,
    placeholderData: keepPreviousData
  });

  const { data: personalDash, isLoading: dashLoading } = useQuery({
    queryKey: ['dashboard', 'personal'],
    queryFn: () => dashboardApi.getExecutiveDashboard().then(res => res.data),
    staleTime: 5 * 60 * 1000,
    placeholderData: keepPreviousData
  });

  const startWorkMutation = useMutation({
    mutationFn: attendanceApi.startWork,
    onSuccess: () => {
      queryClient.invalidateQueries(['dashboard']);
      toast.success("Work session started");
    }
  });

  const endWorkMutation = useMutation({
    mutationFn: attendanceApi.endWork,
    onSuccess: () => {
      queryClient.invalidateQueries(['dashboard']);
      toast.success("Work session ended");
    }
  });

  const transitionMutation = useMutation({
    mutationFn: (data) => leadsApi.transitionLead(data.id, data.action, data.payload),
    onSuccess: () => {
      queryClient.invalidateQueries(['leads', 'my-queue']);
      queryClient.invalidateQueries(['dashboard', 'personal']);
      toast.success("Lead status updated");
    }
  });

  const isWorking = personalDash?.workStarted || false;
  const myLeads = queueData?.queue || [];
  const currentLead = myLeads[currentLeadIdx];
  const isLastLead = currentLeadIdx >= myLeads.length;
  
  const todayStats = personalDash?.todayStats || {};
  const monthlyStats = personalDash?.monthlyStats || {};
  const strategyLogs = personalDash?.strategyLogs || [];
  const leadSources = personalDash?.leadSources || [];

  const handleAction = (action, payload = {}) => {
    if (!currentLead) return;
    transitionMutation.mutate({ id: currentLead._id, action, payload });
  };

  if (queueLoading || dashLoading) return <DashboardSkeleton />;

  return (
    <div className="animate-in fade-in duration-500">
      {/* HEADER SECTION */}
      <div className="section-header mb-6">
        <div>
          <div className="section-title">My Work - {currentUser?.name} - {currentUser?.state}</div>
          <div className="section-sub text-[13px]">Your personal lead queue · Industry Partner leads at state level · One-by-one execution</div>
        </div>
        <div className="flex items-center gap-4">
          <div className={`px-4 py-1.5 rounded-full text-[11px] font-bold flex items-center gap-2 border shadow-sm ${isWorking ? 'bg-green-light/10 text-green border-green/20' : 'bg-amber-light/10 text-amber border-amber/20'}`}>
             <span className={`w-2 h-2 rounded-full animate-pulse ${isWorking ? 'bg-green' : 'bg-amber'}`}></span>
             {isWorking ? 'Working Active' : 'Work Not Started'}
          </div>
          <Button 
            className={isWorking ? 'bg-red text-white' : 'bg-blue text-white'}
            size="sm" 
            onClick={() => isWorking ? endWorkMutation.mutate() : startWorkMutation.mutate()}
          >
            {isWorking ? 'Stop Work' : 'Start Work'}
          </Button>
        </div>
      </div>

      {/* TOP STAT CARDS */}
      <div className="stat-grid mb-8">
        <div className="stat-card border-l-4 border-blue">
          <div className="stat-label">My Leads Today</div>
          <div className="stat-value text-blue">{myLeads.length}</div>
          <div className="stat-delta text-[11px] font-medium opacity-70">
             → {todayStats.meetings || 0} direct meeting, {todayStats.followups || 0} follow-ups, {todayStats.new || 0} new
          </div>
        </div>
        <div className="stat-card border-l-4 border-green">
          <div className="stat-label">Completed Today</div>
          <div className="stat-value text-green">{todayStats.completedLeads || 0}</div>
          <div className="stat-delta text-[11px] font-medium opacity-70">
             of {myLeads.length + (todayStats.completedLeads || 0)} total tasks
          </div>
        </div>
        <div className="stat-card border-l-4 border-purple">
          <div className="stat-label">My Calls This Week</div>
          <div className="stat-value text-purple">{monthlyStats.totalCalls || 0}</div>
          <div className="stat-delta text-purple">↑ 3 vs last week</div>
        </div>
        <div className="stat-card border-l-4 border-amber">
          <div className="stat-label">My Conversions</div>
          <div className="stat-value text-amber">{monthlyStats.converted || 0}</div>
          <div className="stat-delta text-amber font-medium opacity-70">Industry Partners · This month</div>
        </div>
      </div>

      {/* QUEUE & ACTIVE LEAD SECTION */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 mb-8">
        <div className="lg:col-span-3">
          <div className="card h-full min-h-[400px]">
             <div className="card-header border-b border-border bg-surface2/5">
                <div className="flex items-center gap-3">
                   <div className="w-8 h-8 rounded-lg bg-red-light/10 flex items-center justify-center text-red">🎯</div>
                   <div className="section-title text-sm">Active Lead</div>
                </div>
                {!isWorking ? <Tag variant="gray" label="Waiting" /> : currentLead && <Tag variant={currentLead.priority === 'hot' ? 'red' : 'amber'} label={currentLead.status.toUpperCase()} />}
             </div>
             
             {!isWorking ? (
                <div className="flex flex-col items-center justify-center h-[350px] text-center p-8">
                   <div className="text-5xl mb-6">🧔</div>
                   <div className="text-lg font-bold mb-2">Press "Start Work" to begin your session</div>
                   <p className="text-text-muted text-sm max-w-[350px] leading-relaxed">
                     Industry Partner leads appear one-by-one · Direct meetings first, then follow-ups, then new leads
                   </p>
                </div>
             ) : !currentLead ? (
                <div className="flex flex-col items-center justify-center h-[350px] text-center p-8">
                   <div className="text-5xl mb-6">🎉</div>
                   <div className="text-lg font-bold mb-2">All work done for today!</div>
                   <p className="text-text-muted text-sm">You've completed your entire personal queue.</p>
                </div>
             ) : (
                <div className="card-body">
                   <div className="flex justify-between items-start mb-8">
                      <div>
                         <div className="text-2xl font-black tracking-tight">{currentLead.company || currentLead.business}</div>
                         <div className="flex items-center gap-2 mt-2">
                            <span className="text-xs text-text-muted">Primary Contact:</span>
                            <span className="text-sm font-bold">{currentLead.name}</span>
                            <span className="w-1 h-1 rounded-full bg-border"></span>
                            <span className="text-sm font-bold text-blue">{currentLead.phone}</span>
                         </div>
                      </div>
                      <div className="bg-surface2 px-3 py-1.5 rounded-lg border border-border mono text-[11px] font-bold">{currentLead.leadId || 'RM-ID'}</div>
                   </div>

                   <div className="grid grid-cols-3 gap-4 mb-8">
                      <div className="bg-surface2 p-4 rounded-xl border border-border/50">
                         <div className="text-[10px] font-bold text-text-muted uppercase tracking-widest mb-1">District</div>
                         <div className="text-sm font-bold">{currentLead.district}</div>
                      </div>
                      <div className="bg-surface2 p-4 rounded-xl border border-border/50">
                         <div className="text-[10px] font-bold text-text-muted uppercase tracking-widest mb-1">Status</div>
                         <div className="text-sm font-bold capitalize">{currentLead.status}</div>
                      </div>
                      <div className="bg-surface2 p-4 rounded-xl border border-border/50">
                         <div className="text-[10px] font-bold text-text-muted uppercase tracking-widest mb-1">RNR Count</div>
                         <div className="text-sm font-bold">{currentLead.rnrCount || 0}x</div>
                      </div>
                   </div>

                   <div className="bg-blue-light/5 border border-blue/10 p-5 rounded-2xl mb-10 text-[13px] leading-relaxed italic text-text-secondary shadow-inner">
                      <strong>💡 Strategy Note:</strong> High-priority Industry Partner. Focus on state-wide franchise benefits and volume-based revenue sharing models.
                   </div>

                   <div className="flex gap-4">
                      <Button className="flex-1 bg-green text-white py-3" onClick={() => handleAction('call_done')}>✓ Call Completed</Button>
                      <Button className="flex-1 border-amber text-amber border py-3" variant="outline" onClick={() => handleAction('rnr')}>📵 Mark RNR</Button>
                      <Button className="px-6 border-border text-text-muted border" variant="outline" onClick={() => setCurrentLeadIdx(prev => prev + 1)}>Skip</Button>
                   </div>
                </div>
             )}
          </div>
        </div>

        <div className="lg:col-span-2 flex flex-col gap-6">
           <div className="card flex-1">
              <div className="card-header border-b border-border bg-surface2/5">
                 <div className="section-title text-sm">Today's Queue · My Leads</div>
                 <div className="text-[9px] font-bold text-text-muted uppercase tracking-tighter">Meetings → Follow-ups → New</div>
              </div>
              <div className="divide-y divide-border">
                 {myLeads.map((l, i) => (
                    <div key={l._id} className={`flex items-center gap-4 p-4 hover:bg-surface2 transition-all cursor-pointer ${i === currentLeadIdx && isWorking ? 'bg-blue-light/5 border-l-4 border-blue' : ''}`}>
                       <div className="w-5 h-5 rounded-full border border-border flex items-center justify-center text-[10px] font-bold text-text-muted">{i + 1}</div>
                       <div className="flex-1 min-w-0">
                          <div className="text-[13px] font-bold truncate">{l.company || l.business}</div>
                          <div className="text-[11px] text-text-muted">{l.district} · {l.name}</div>
                       </div>
                       <div className="text-right">
                          <div className="text-[10px] font-bold mono">10:00 AM</div>
                          <div className="text-[9px] text-text-muted uppercase font-bold mt-0.5">{l.status === 'meeting_scheduled' ? '🤝 meeting' : '📞 followup'}</div>
                       </div>
                    </div>
                 ))}
                 {myLeads.length === 0 && <div className="p-12 text-center text-text-muted text-xs italic">No leads in queue today</div>}
              </div>
              <div className="card-footer bg-surface2/5 border-t border-border p-3 text-center">
                 <div className="text-[10px] font-bold text-text-muted uppercase tracking-widest">{todayStats.completedLeads || 0}/{myLeads.length + (todayStats.completedLeads || 0)} completed today</div>
              </div>
           </div>

           <div className="card">
              <div className="card-header border-b border-border py-3">
                 <div className="section-title text-[12px]">My Lead Sources</div>
                 <Tag variant="blue" label="Industry Partners" />
              </div>
              <div className="card-body py-4">
                 {leadSources.map((s, i) => (
                    <div key={i} className="flex items-center justify-between p-3 bg-surface2 rounded-xl mb-2 last:mb-0 border border-border/50">
                       <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-white border border-border flex items-center justify-center shadow-sm">{s.icon}</div>
                          <div>
                             <div className="text-[12px] font-bold">{s.label}</div>
                             <div className="text-[10px] text-text-muted">Direct connections</div>
                          </div>
                       </div>
                       <div className="text-sm font-black text-blue">{s.count} leads</div>
                    </div>
                 ))}
              </div>
           </div>
        </div>
      </div>

      {/* ALL LEADS TABLE */}
      <div className="card mb-8">
        <div className="card-header border-b border-border bg-surface2/5">
           <div>
              <div className="section-title text-[15px]">My All Leads - {currentUser?.state} State Level</div>
              <div className="text-[11px] text-text-muted mt-0.5">Industry Partners & State-level connections assigned to me directly</div>
           </div>
           <div className="flex gap-2">
              <div className="flex bg-surface2 p-1 rounded-lg border border-border">
                 {['All', 'Hot', 'Follow-up', 'Converted'].map(tab => <button key={tab} className="px-4 py-1 text-[10px] font-bold uppercase rounded-md hover:bg-white hover:shadow-sm transition-all">{tab}</button>)}
              </div>
              <Button size="sm" className="bg-blue text-white" onClick={() => window.dispatchEvent(new CustomEvent('open-modal', { detail: 'add-lead' }))}>+ Add Lead</Button>
           </div>
        </div>
        <DataTable 
          columns={[
            { header: 'ID', accessor: 'leadId', render: (val) => <span className="mono text-[11px] font-bold">{val || 'SM-01'}</span> },
            { header: 'PARTNER / ORGANISATION', accessor: 'company', render: (val, row) => <div><div className="font-bold text-[13px]">{val || row.business}</div><div className="text-[11px] text-text-muted">{row.name} · {row.phone}</div></div> },
            { header: 'DISTRICT', accessor: 'district' },
            { header: 'SOURCE', accessor: 'leadSource', render: (val) => <Tag variant="gray" label={val || 'Industry Partner'} /> },
            { header: 'STATUS', accessor: 'priority', render: (val) => <Tag variant={val === 'hot' ? 'red' : val === 'warm' ? 'amber' : 'blue'} label={(val || 'COLD').toUpperCase()} /> },
            { header: 'RNR', accessor: 'rnrCount', render: (val) => <span className="mono text-[11px] font-bold text-amber">{val ? `${val}x RNR` : '--'}</span> },
            { header: 'REVENUE', accessor: 'expectedRevenue', render: (val) => <span className="mono font-bold text-[13px]">₹{(val / 100000).toFixed(1)}L</span> },
            { header: 'ACTION', accessor: '_id', render: (id, row, idx) => <Button size="xs" variant="blue" onClick={() => { setCurrentLeadIdx(idx); }}>Work Lead</Button>, align: 'right' }
          ]}
          data={myLeads}
        />
      </div>

      {/* PERFORMANCE & STRATEGY LOG */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 mb-12">
        <div className="lg:col-span-3 card">
           <div className="card-header border-b border-border">
              <div className="section-title text-sm">My Performance · This Month</div>
           </div>
           <div className="card-body">
              <div className="grid grid-cols-2 gap-4 mb-8">
                 <div className="p-6 bg-surface2 rounded-2xl border border-border text-center">
                    <div className="text-[13px] font-bold text-text-muted mb-1">Total Calls</div>
                    <div className="text-3xl font-black text-blue">{monthlyStats.totalCalls || 0}</div>
                 </div>
                 <div className="p-6 bg-surface2 rounded-2xl border border-border text-center">
                    <div className="text-[13px] font-bold text-text-muted mb-1">Meetings</div>
                    <div className="text-3xl font-black text-purple">{monthlyStats.totalMeetings || 0}</div>
                 </div>
                 <div className="p-6 bg-surface2 rounded-2xl border border-border text-center">
                    <div className="text-[13px] font-bold text-text-muted mb-1">Conversions</div>
                    <div className="text-3xl font-black text-green">{monthlyStats.converted || 0}</div>
                 </div>
                 <div className="p-6 bg-surface2 rounded-2xl border border-border text-center">
                    <div className="text-[13px] font-bold text-text-muted mb-1">Revenue Closed</div>
                    <div className="text-3xl font-black text-accent">₹{(monthlyStats.revenue / 100000).toFixed(1)}L</div>
                 </div>
              </div>
              <div className="px-2">
                 <div className="flex justify-between items-end mb-2">
                    <div className="text-[11px] font-bold uppercase tracking-widest text-text-muted">Work Completion</div>
                    <div className="text-[13px] font-black text-blue">84%</div>
                 </div>
                 <div className="h-3 w-full bg-surface2 rounded-full overflow-hidden border border-border">
                    <div className="h-full bg-blue transition-all duration-1000" style={{ width: '84%' }}></div>
                 </div>
              </div>
           </div>
        </div>

        <div className="lg:col-span-2 card">
           <div className="card-header border-b border-border">
              <div className="section-title text-sm">My Strategy Log</div>
           </div>
           <div className="card-body">
              <div className="text-[11px] font-bold text-text-muted uppercase mb-4 tracking-widest">Strategies that worked for conversions</div>
              <div className="space-y-4 mb-8">
                 {strategyLogs.map((log, i) => (
                    <div key={i} className="p-4 bg-surface2 rounded-2xl border border-border/50">
                       <div className="flex justify-between items-center mb-2">
                          <div className="text-[12px] font-black">{log.leadName}</div>
                          <Tag variant="green" label="Converted" />
                       </div>
                       <div className="text-[11.5px] text-text-secondary leading-relaxed italic">
                          "Strategy: {log.strategy}"
                       </div>
                    </div>
                 ))}
                 {strategyLogs.length === 0 && <div className="text-center py-8 text-text-muted italic text-xs">No conversions logged yet</div>}
              </div>
              
              <textarea 
                className="w-full bg-surface2 border border-border rounded-xl p-4 text-[12px] outline-none focus:border-blue transition-all min-h-[100px]"
                placeholder="Log today's winning strategy..."
                value={strategyNote}
                onChange={(e) => setStrategyNote(e.target.value)}
              />
              <Button className="w-full mt-4 bg-blue text-white" onClick={() => { toast.success("Strategy saved!"); setStrategyNote(''); }}>Save Strategy</Button>
           </div>
        </div>
      </div>
    </div>
  );
};

export default MyWork;

