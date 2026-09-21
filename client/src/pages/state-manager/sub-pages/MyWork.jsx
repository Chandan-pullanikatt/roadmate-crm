import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import DashboardSkeleton from '../../../components/skeletons/DashboardSkeleton';
import { leadsApi } from '../../../api/leadsApi';
import { attendanceApi } from '../../../api/attendanceApi';
import { dashboardApi } from '../../../api/dashboardApi';
import { Avatar, Button, Tag, DataTable } from '../../../components/ui';
import { toast } from 'react-hot-toast';
import { useAuth } from '../../../context/AuthContext';
import CallFeedbackModal from '../../industry-manager/components/CallFeedbackModal';

const MyWork = () => {
  const queryClient = useQueryClient();
  const { user: currentUser } = useAuth();
  // The active lead is tracked by id, not by position. The queue keeps every
  // open lead -- working one does not remove it -- so a numeric cursor that was
  // bumped after each call walked off the end of the list and left the page
  // claiming the day was done while most of the queue was still untouched.
  const [selectedLeadId, setSelectedLeadId] = useState(null);
  // The full list runs to hundreds of rows, so it is paged 15 at a time.
  const LEADS_PER_PAGE = 15;
  const [leadsPage, setLeadsPage] = useState(1);

  // Call Done / RNR open the same feedback dialog the Industry Manager work page
  // uses, so the outcome, priority, notes and any follow-up or meeting are captured
  // instead of the status being flipped blind.
  const [feedbackModal, setFeedbackModal] = useState({ open: false, outcome: null });
  const openModal = (type, data = null) => {
    window.dispatchEvent(new CustomEvent('open-modal', {
      detail: typeof type === 'string' ? { type, ...data } : type
    }));
  };

  const openFeedback = (outcome) => setFeedbackModal({ open: true, outcome });
  const closeFeedback = () => setFeedbackModal({ open: false, outcome: null });
  const [strategyNote, setStrategyNote] = useState('');

  const { data: queueData, isLoading: queueLoading } = useQuery({
    queryKey: ['leads', 'my-queue'],
    queryFn: () => leadsApi.getLeadQueue().then(res => res.data),
    staleTime: 5 * 60 * 1000,
    placeholderData: keepPreviousData
  });

  const { data: allLeadsData, isLoading: allLeadsLoading } = useQuery({
    queryKey: ['leads', 'sm-my-all', leadsPage],
    queryFn: () => leadsApi.getLeads({ page: leadsPage, limit: LEADS_PER_PAGE }).then(res => res.data),
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
      queryClient.invalidateQueries({ queryKey: ['dashboard'], exact: false });
      toast.success("Work session started");
    }
  });

  const endWorkMutation = useMutation({
    mutationFn: attendanceApi.endWork,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard'], exact: false });
      toast.success("Work session ended");
    }
  });

  const isWorking = !!personalDash?.attendance?.workStartedAt && !personalDash?.attendance?.workCompletedAt;
  const hasCompletedWork = !!personalDash?.attendance?.workCompletedAt;
  const myLeads = queueData?.queue || [];
  const allMyLeads = allLeadsData?.leads || [];
  const allMyLeadsTotal = allLeadsData?.total || 0;
  const allMyLeadsPages = allLeadsData?.totalPages || 1;

  // Leads still to be worked today; the rest are already done and stay in the
  // list only so the numbering and the day's tally hold.
  const pendingLeads = myLeads.filter(l => !l.workedToday);
  const completedToday = queueData?.completedToday ?? 0;
  const currentLead =
    pendingLeads.find(l => l._id === selectedLeadId) || pendingLeads[0] || null;

  // Next lead to work after `fromId`: the following pending one in queue order,
  // wrapping back to the top so finishing the last row returns to the leads
  // above it instead of ending the day. null when nothing is left.
  const nextPendingAfter = (fromId) => {
    const start = myLeads.findIndex(l => l._id === fromId);
    for (let step = 1; step <= myLeads.length; step++) {
      const candidate = myLeads[(start + step) % myLeads.length];
      if (candidate && candidate._id !== fromId && !candidate.workedToday) return candidate._id;
    }
    return null;
  };
  const advance = (fromId) => setSelectedLeadId(nextPendingAfter(fromId));
  
  // The line under "My Leads Today" has to describe the queue whose size sits above
  // it. It used to read todayStats, which counts activities already performed today
  // -- a different measure that can never add up to the queue length -- and
  // todayStats.new is not a field the API returns at all, so that third figure was
  // hard-wired to 0. Bucket the still-pending queue, in the order getQueue() sorts by.
  const queueBreakdown = (() => {
    const dayStart = new Date();
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date();
    dayEnd.setHours(23, 59, 59, 999);

    const isMeetingToday = (l) => {
      if (!l.meetingAt || !['meeting_direct', 'meeting_virtual'].includes(l.status)) return false;
      const at = new Date(l.meetingAt);
      return at >= dayStart && at <= dayEnd;
    };

    return pendingLeads.reduce((acc, l) => {
      if (isMeetingToday(l)) acc.meetings += 1;
      else if (l.status === 'new') acc.fresh += 1;
      else if (l.nextActionAt && new Date(l.nextActionAt) <= dayEnd) {
        if (l.status === 'rnr') acc.rnr += 1;
        else acc.followups += 1;
      }
      else acc.other += 1;
      return acc;
    }, { meetings: 0, fresh: 0, followups: 0, rnr: 0, other: 0 });
  })();

  const todayStats = personalDash?.todayStats || {};
  const monthlyStats = personalDash?.monthlyStats || {};
  const strategyLogs = personalDash?.strategyLogs || [];

  if (queueLoading || dashLoading || allLeadsLoading) return <DashboardSkeleton />;

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
             {isWorking ? 'Working Active' : hasCompletedWork ? 'Work Ended' : 'Work Not Started'}
          </div>
          <Button 
            className={isWorking ? 'bg-red text-white' : 'bg-blue text-white'}
            size="sm" 
            onClick={() => isWorking ? endWorkMutation.mutate(personalDash?.attendance?._id) : startWorkMutation.mutate()}
            disabled={hasCompletedWork || startWorkMutation.isPending || endWorkMutation.isPending}
          >
            {isWorking ? 'Stop Work' : hasCompletedWork ? 'Work Ended' : 'Start Work'}
          </Button>
        </div>
      </div>

      {/* TOP STAT CARDS */}
      <div className="stat-grid mb-8">
        <div className="stat-card border-l-4 border-blue">
          <div className="stat-label">My Leads Today</div>
          <div className="stat-value text-blue">{pendingLeads.length}</div>
          <div className="stat-delta text-[11px] font-medium opacity-70">
             {"\u2192"} {queueBreakdown.meetings} meetings, {queueBreakdown.fresh} new, {queueBreakdown.followups} follow-ups, {queueBreakdown.rnr} RNR{queueBreakdown.other > 0 ? `, ${queueBreakdown.other} other` : ''}
          </div>
        </div>
        <div className="stat-card border-l-4 border-green">
          <div className="stat-label">Completed Today</div>
          <div className="stat-value text-green">{completedToday}</div>
          <div className="stat-delta text-[11px] font-medium opacity-70">
             of {pendingLeads.length + completedToday} total tasks
          </div>
        </div>
        <div className="stat-card border-l-4 border-purple">
          <div className="stat-label">My Calls This Week</div>
          <div className="stat-value text-purple">{monthlyStats.totalCalls || 0}</div>
          <div className="stat-delta text-purple">{"\u2191"} 3 vs last week</div>
        </div>
        <div className="stat-card border-l-4 border-amber">
          <div className="stat-label">My Conversions</div>
          <div className="stat-value text-amber">{monthlyStats.converted || 0}</div>
          <div className="stat-delta text-amber font-medium opacity-70">Industry Partners · This month</div>
        </div>
      </div>

      {/* QUEUE & ACTIVE LEAD SECTION */}
      {/* items-start: the queue can run to 30+ rows, and a stretching grid row used to
          drag the Active Lead card down with it, leaving a screen-high empty card. */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 mb-8 items-start">
        <div className="lg:col-span-3">
          <div className="card min-h-[400px]">
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
                   <p className="text-text-muted text-[16px] max-w-[350px] leading-relaxed">
                     Industry Partner leads appear one-by-one · Direct meetings first, then follow-ups, then new leads
                   </p>
                </div>
             ) : !currentLead ? (
                <div className="flex flex-col items-center justify-center h-[350px] text-center p-8">
                   <div className="text-5xl mb-6">🎉</div>
                   <div className="text-lg font-bold mb-2">All work done for today!</div>
                   <p className="text-text-muted text-[16px]">You've completed your entire personal queue.</p>
                </div>
             ) : (
                <div className="card-body">
                   <div className="flex justify-between items-start mb-8">
                      <div>
                         <div className="text-2xl font-black tracking-tight">{currentLead.company || currentLead.business}</div>
                         <div className="flex items-center gap-2 mt-2">
                            <span className="text-[14px] text-text-muted">Primary Contact:</span>
                            <span className="text-sm font-bold">{currentLead.name}</span>
                            <span className="w-1 h-1 rounded-full bg-border"></span>
                            <span className="text-sm font-bold text-blue">{currentLead.phone}</span>
                         </div>
                      </div>
                      <div className="bg-surface2 px-3 py-1.5 rounded-lg border border-border mono text-[11px] font-bold">{currentLead.leadId || 'RM-ID'}</div>
                   </div>

                   <div className="grid grid-cols-3 gap-4 mb-8">
                      <div className="bg-surface2 p-4 rounded-xl border border-border/50">
                         <div className="text-[12px] font-bold text-text-muted uppercase tracking-widest mb-1">District</div>
                         <div className="text-sm font-bold">{currentLead.district}</div>
                      </div>
                      <div className="bg-surface2 p-4 rounded-xl border border-border/50">
                         <div className="text-[12px] font-bold text-text-muted uppercase tracking-widest mb-1">Status</div>
                         <div className="text-sm font-bold capitalize">{currentLead.status}</div>
                      </div>
                      <div className="bg-surface2 p-4 rounded-xl border border-border/50">
                         <div className="text-[12px] font-bold text-text-muted uppercase tracking-widest mb-1">RNR Count</div>
                         <div className="text-sm font-bold">{currentLead.rnrCount || 0}x</div>
                      </div>
                   </div>

                   <div className="bg-blue-light/5 border border-blue/10 p-5 rounded-2xl mb-10 text-[15px] leading-relaxed italic text-text-secondary shadow-inner">
                      <strong>💡 Strategy Note:</strong> High-priority Industry Partner. Focus on state-wide franchise benefits and volume-based revenue sharing models.
                   </div>

                   <div className="flex gap-4">
                      <Button className="flex-1 bg-green text-white py-3" onClick={() => openFeedback('connected')}>✓ Call Completed</Button>
                      <Button className="flex-1 border-amber text-amber border py-3" variant="outline" onClick={() => openFeedback('rnr')}>📵 Mark RNR</Button>
                      <Button className="px-6 border-border text-text-muted border" variant="outline" onClick={() => advance(currentLead._id)}>Skip</Button>
                   </div>
                </div>
             )}
          </div>
        </div>

        <div className="lg:col-span-2 flex flex-col gap-6">
           <div className="card flex-1 flex flex-col">
              <div className="card-header border-b border-border bg-surface2/5">
                 <div className="section-title text-sm">Today's Queue · My Leads</div>
                 <div className="text-[11px] font-bold text-text-muted uppercase tracking-tighter">Meetings {"\u2192"} Follow-ups {"\u2192"} New</div>
              </div>
              {/* Scrolls inside a fixed height so a 30-lead queue cannot set the row height */}
              <div className="divide-y divide-border overflow-y-auto max-h-[560px]">
                 {myLeads.map((l, i) => {
                    const isActive = currentLead && l._id === currentLead._id;
                    const done = !!l.workedToday;
                    return (
                    <div
                      key={l._id}
                      role="button"
                      tabIndex={0}
                      aria-current={isActive ? 'true' : undefined}
                      aria-disabled={done ? 'true' : undefined}
                      onClick={() => { if (!done) setSelectedLeadId(l._id); }}
                      onKeyDown={(e) => {
                        if (done) return;
                        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedLeadId(l._id); }
                      }}
                      title={done ? `${l.company || l.business || l.name} is done for today` : `Work ${l.company || l.business || l.name} next`}
                      className={`group flex items-center gap-4 p-4 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-blue/50 ${done ? 'opacity-50 cursor-default' : 'hover:bg-surface2 cursor-pointer'} ${isActive ? 'bg-blue-light/5 border-l-4 border-blue' : ''}`}
                    >
                       <div className={`w-5 h-5 rounded-full border flex items-center justify-center text-[12px] font-bold ${done ? 'border-green/40 text-green' : 'border-border text-text-muted'}`}>{done ? '✓' : i + 1}</div>
                       <div className="flex-1 min-w-0">
                          <div className={`text-[13px] font-bold truncate ${done ? 'line-through' : 'group-hover:text-blue'}`}>{l.company || l.business}</div>
                          <div className="text-[13px] text-text-muted">{l.district} · {l.name}</div>
                       </div>
                       <div className="text-right">
                          <div className="text-[10px] font-bold mono">10:00 AM</div>
                          <div className={`text-[11px] uppercase font-bold mt-0.5 ${done ? 'text-green' : 'text-text-muted'}`}>{done ? '✓ done' : l.status === 'meeting_scheduled' ? '🤝 meeting' : '📞 followup'}</div>
                       </div>
                    </div>
                    );
                 })}
                 {myLeads.length === 0 && <div className="p-12 text-center text-text-muted text-[14px] italic">No leads in queue today</div>}
              </div>
              <div className="card-footer bg-surface2/5 border-t border-border p-3 text-center">
                 <div className="text-[12px] font-bold text-text-muted uppercase tracking-widest">{completedToday}/{pendingLeads.length + completedToday} completed today {"·"} {pendingLeads.length} in queue</div>
              </div>
           </div>

        </div>
      </div>

      {/* ALL LEADS TABLE */}
      <div className="card mb-8">
        <div className="card-header border-b border-border bg-surface2/5">
           <div>
              <div className="section-title text-[15px]">My All Leads - {currentUser?.state} State Level</div>
              <div className="text-[13px] text-text-muted mt-0.5">Industry Partners & State-level connections assigned to me directly</div>
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
            { header: 'ID', accessor: 'leadId', render: (val, row) => <span className="mono text-[11px] font-bold">{val}</span> },
            { header: 'PARTNER / ORGANISATION', accessor: 'company', render: (val, row) => <div><div className="font-bold text-[13px]">{val || row.business}</div><div className="text-[13px] text-text-muted">{row.name} {"\u00B7"} {row.phone}</div></div> },
            { header: 'DISTRICT', accessor: 'district' },
            { header: 'SOURCE', accessor: 'leadSource', render: (val) => <Tag variant="gray" label={val || 'Direct'} /> },
            { header: 'STATUS', accessor: 'status', render: (val) => <Tag variant={val === 'converted' ? 'green' : (val === 'meeting_virtual' || val === 'meeting_direct') ? 'blue' : val === 'followup' ? 'amber' : 'gray'} label={(val || 'NEW').toUpperCase()} /> },
            { header: 'PRIORITY', accessor: 'priority', render: (val) => <Tag variant={val === 'hot' ? 'red' : val === 'warm' ? 'amber' : 'blue'} label={(val || 'COLD').toUpperCase()} /> },
            { header: 'RNR', accessor: 'rnrCount', render: (val) => <span className="mono text-[11px] font-bold text-amber">{val ? `${val}x RNR` : '--'}</span> },
            { header: 'REVENUE', accessor: 'expectedRevenue', render: (val) => <span className="mono font-bold text-[13px]">{"\u20B9"}{((val || 0) / 100000).toFixed(1)}L</span> },
            {
              header: 'ACTION', accessor: '_id',
              render: (id, row) => (
                <div className="flex items-center gap-2 justify-end">
                  <button
                    type="button"
                    onClick={() => openModal('update-lead', { leadData: row })}
                    className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider border border-border rounded-lg hover:bg-surface2 transition-colors"
                  >
                    Update
                  </button>
                  <button
                    type="button"
                    onClick={() => openModal('allocate-lead', { leadData: row })}
                    className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider border border-purple/20 text-purple rounded-lg hover:bg-purple/5 transition-colors"
                  >
                    Allocate
                  </button>
                </div>
              ),
              align: 'right'
            }
          ]}
          data={allMyLeads}
          emptyMessage="No leads found. Add your first lead above."
        />
        {allMyLeadsTotal > 0 && (
          <div className="flex justify-between items-center p-5 border-t border-border bg-surface2/5">
            <div className="text-[13px] text-text-muted font-bold uppercase tracking-tight">
              Showing {((leadsPage - 1) * LEADS_PER_PAGE) + 1} - {Math.min(leadsPage * LEADS_PER_PAGE, allMyLeadsTotal)} of {allMyLeadsTotal} leads
            </div>
            <div className="flex gap-2">
              <Button
                size="xs"
                variant="outline"
                className="bg-white border-border shadow-sm px-4"
                onClick={() => setLeadsPage(p => Math.max(1, p - 1))}
                disabled={leadsPage === 1}
              >
                Previous
              </Button>
              <Button
                size="xs"
                variant="outline"
                className="bg-white border-border shadow-sm px-4"
                onClick={() => setLeadsPage(p => p + 1)}
                disabled={leadsPage >= allMyLeadsPages}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* PERFORMANCE & STRATEGY LOG */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 mb-12">
        <div className="lg:col-span-3 card">
           <div className="card-header border-b border-border">
              <div className="section-title text-sm">My Performance {"\u00B7"} This Month</div>
           </div>
           <div className="card-body">
              <div className="grid grid-cols-2 gap-4 mb-8">
                 <div className="p-6 bg-surface2 rounded-2xl border border-border text-center">
                    <div className="text-[15px] font-bold text-text-muted mb-1">Total Calls</div>
                    <div className="text-3xl font-black text-blue">{monthlyStats.totalCalls || 0}</div>
                 </div>
                 <div className="p-6 bg-surface2 rounded-2xl border border-border text-center">
                    <div className="text-[15px] font-bold text-text-muted mb-1">Meetings</div>
                    <div className="text-3xl font-black text-purple">{monthlyStats.totalMeetings || 0}</div>
                 </div>
                 <div className="p-6 bg-surface2 rounded-2xl border border-border text-center">
                    <div className="text-[15px] font-bold text-text-muted mb-1">Conversions</div>
                    <div className="text-3xl font-black text-green">{monthlyStats.converted || 0}</div>
                 </div>
                 <div className="p-6 bg-surface2 rounded-2xl border border-border text-center">
                    <div className="text-[15px] font-bold text-text-muted mb-1">Revenue Closed</div>
                    <div className="text-3xl font-black text-accent">{"\u20B9"}{(monthlyStats.revenue / 100000).toFixed(1)}L</div>
                 </div>
              </div>
              <div className="px-2">
                 <div className="flex justify-between items-end mb-2">
                    <div className="text-[13px] font-bold uppercase tracking-widest text-text-muted">Work Completion</div>
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
              <div className="text-[13px] font-bold text-text-muted uppercase mb-4 tracking-widest">Strategies that worked for conversions</div>
              <div className="space-y-4 mb-8">
                 {strategyLogs.map((log, i) => (
                    <div key={i} className="p-4 bg-surface2 rounded-2xl border border-border/50">
                       <div className="flex justify-between items-center mb-2">
                          <div className="text-[12px] font-black">{log.leadName}</div>
                          <Tag variant="green" label="Converted" />
                       </div>
                       <div className="text-[13.5px] text-text-secondary leading-relaxed italic">
                          "Strategy: {log.strategy}"
                       </div>
                    </div>
                 ))}
                 {strategyLogs.length === 0 && <div className="text-center py-8 text-text-muted italic text-[14px]">No conversions logged yet</div>}
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

      {/* Call Done / RNR feedback dialog -- same component the Industry Manager uses */}
      {currentLead && (
        <CallFeedbackModal
          isOpen={feedbackModal.open}
          onClose={closeFeedback}
          lead={currentLead}
          initialOutcome={feedbackModal.outcome}
          onSuccess={() => {
            // The modal refreshes the Industry Manager's keys; these are this page's.
            queryClient.invalidateQueries({ queryKey: ['leads', 'my-queue'] });
            queryClient.invalidateQueries({ queryKey: ['leads', 'sm-my-all'], exact: false });
            queryClient.invalidateQueries({ queryKey: ['dashboard', 'personal'] });
            queryClient.invalidateQueries({ queryKey: ['dashboard', 'state-manager'] });
            // Move on to the next lead still pending; the one just worked drops
            // out of the pending set when the queue refetches.
            advance(currentLead._id);
          }}
        />
      )}
    </div>
  );
};

export default MyWork;
