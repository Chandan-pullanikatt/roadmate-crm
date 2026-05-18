import React, { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  StatCard,
  Button,
  Tag,
  Avatar,
  DashboardSkeleton
} from '../../../components/ui';
import { leadsApi } from '../../../api/leadsApi';
import { attendanceApi } from '../../../api/attendanceApi';
import { dashboardApi } from '../../../api/dashboardApi';
import { useToast } from '../../../context/ToastContext';
import { useAuth } from '../../../context/AuthContext';
import CallFeedbackModal from './CallFeedbackModal';

const MyWork = () => {
  const queryClient = useQueryClient();
  const { addToast } = useToast();
  const { user: currentUser } = useAuth();

  const [currentLeadIdx, setCurrentLeadIdx] = useState(0);
  const [tableFilter, setTableFilter] = useState('All');
  const [strategyNote, setStrategyNote] = useState('');

  // Call feedback modal state
  const [feedbackModal, setFeedbackModal] = useState({ open: false, outcome: null });
  const openFeedback = (outcome) => setFeedbackModal({ open: true, outcome });
  const closeFeedback = () => setFeedbackModal({ open: false, outcome: null });

  // 1. Fetch Personal Stats
  const { data: dashData, isLoading: dashLoading } = useQuery({
    queryKey: ['dashboard', 'executive'],
    queryFn: () => dashboardApi.getExecutiveDashboard().then(res => res.data),
    staleTime: 5 * 60 * 1000,
    placeholderData: (prev) => prev
  });

  // 2. Fetch All My Leads
  const { data: allLeadsData, isLoading: queueLoading } = useQuery({
    queryKey: ['leads', 'personal-list'],
    queryFn: () => leadsApi.getLeads({ limit: 100 }).then(res => res.data),
    staleTime: 0,
    placeholderData: (prev) => prev
  });

  // 3. Fetch lead activity for the active lead
  const activeLead = (allLeadsData?.leads || [])[currentLeadIdx];
  const { data: activityData } = useQuery({
    queryKey: ['lead-activity', activeLead?._id],
    queryFn: () => leadsApi.getLeadActivity(activeLead._id).then(r => r.data),
    enabled: !!activeLead?._id,
    staleTime: 60 * 1000,
  });

  useEffect(() => {
    const handleLeadRefresh = () => {
      queryClient.invalidateQueries({ queryKey: ['leads', 'personal-list'] });
    };
    window.addEventListener('refresh-leads', handleLeadRefresh);
    return () => window.removeEventListener('refresh-leads', handleLeadRefresh);
  }, [queryClient]);

  const startWorkMutation = useMutation({
    mutationFn: attendanceApi.startWork,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard'], exact: false });
      addToast("Work started! Good luck.", "success");
    }
  });

  const endWorkMutation = useMutation({
    mutationFn: attendanceApi.endWork,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard'], exact: false });
      addToast("Work ended. Great job today!", "info");
    }
  });

  const saveStrategyMutation = useMutation({
    mutationFn: (note) => dashboardApi.saveStrategy({ note }),
    onSuccess: () => {
      setStrategyNote('');
      queryClient.invalidateQueries(['dashboard', 'executive']);
      addToast("Strategy logged", "success");
    }
  });

  const openModal = (type, data = null) => {
    window.dispatchEvent(new CustomEvent('open-modal', {
      detail: typeof type === 'string' ? { type, ...data } : type
    }));
  };

  const workStarted = !!dashData?.attendance?.workStartedAt && !dashData?.attendance?.workCompletedAt;
  const workCompleted = !!dashData?.attendance?.workCompletedAt;
  const myQueue = allLeadsData?.leads || [];
  const isQueueEmpty = myQueue.length === 0;
  const isLastLead = currentLeadIdx >= myQueue.length;

  const filteredLeads = useMemo(() => {
    const leads = allLeadsData?.leads || [];
    if (tableFilter === 'All') return leads;
    if (tableFilter === 'Hot') return leads.filter(l => l.priority === 'hot');
    return leads.filter(l => l.status === tableFilter.toLowerCase());
  }, [allLeadsData, tableFilter]);

  const formatCurrency = (val) => {
    if (val >= 100000) return `₹${(val / 100000).toFixed(1)}L`;
    if (val >= 1000) return `₹${(val / 1000).toFixed(1)}K`;
    return `₹${val}`;
  };

  const getStatusColor = (status) => {
    if (status === 'converted') return 'text-green';
    if (status === 'rnr') return 'text-red';
    if (status === 'followup') return 'text-amber';
    if (status === 'hot') return 'text-red';
    return 'text-purple';
  };

  if ((dashLoading || queueLoading) && !dashData) return <DashboardSkeleton />;

  const todayStats = dashData?.todayStats || {};
  const weeklyStats = dashData?.weeklyStats || {};
  const monthlyStats = dashData?.monthlyStats || {};

  const recentActivity = activityData?.activities || [];

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-500">

      {/* Sub Header / Work Status */}
      <div className="bg-surface border border-border/60 rounded-2xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm">
        <div>
          <h2 className="text-lg font-bold text-text-primary">
            My Work — {dashData?.user?.name} · {dashData?.user?.industry}
          </h2>
          <p className="text-xs text-text-muted mt-0.5">
            Your personal lead queue · District Partner leads · One-by-one execution
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <span
            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider
              ${workStarted ? 'bg-green/10 text-green' : workCompleted ? 'bg-surface2 text-text-muted' : 'bg-amber/10 text-amber'}`}
          >
            <span className={`w-2 h-2 rounded-full ${workStarted ? 'bg-green animate-pulse' : 'bg-amber'}`} />
            {workStarted ? 'Work Active' : workCompleted ? 'Work Ended' : 'Work Not Started'}
          </span>
          <Button
            className={`${workStarted ? 'bg-red' : 'bg-purple'} text-white border-none rounded-xl px-6 h-9 font-bold`}
            onClick={() => workStarted ? endWorkMutation.mutate(dashData?.attendance?._id) : startWorkMutation.mutate()}
            disabled={workCompleted || startWorkMutation.isPending || endWorkMutation.isPending}
          >
            {workStarted ? '■ Stop Work' : workCompleted ? 'Work Ended' : '▶ Start Work'}
          </Button>
          <Button
            variant="outline"
            className="border-purple/30 text-purple hover:bg-purple/5 rounded-xl px-5 h-9 font-bold"
            onClick={() => openModal('create-exec', {
              prefill: {
                role: 'executive',
                state: currentUser?.state || '',
                industry: currentUser?.industry || '',
                reportingTo: currentUser?._id || '',
              }
            })}
          >
            + Onboard Executive
          </Button>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="My Leads Today" value={myQueue.length} delta={`→ ${todayStats.followups || 0} follow-ups`} deltaType="up" colorClass="purple" />
        <StatCard label="Completed Today" value={todayStats.completedLeads || 0} delta={`of ${myQueue.length} total`} deltaType="up" colorClass="green" />
        <StatCard label="My Calls This Week" value={weeklyStats.calls || 0} delta={`↑ ${weeklyStats.callGrowth || 0} vs last week`} deltaType="up" colorClass="blue" />
        <StatCard label="My Conversions" value={monthlyStats.converted || 0} delta="This month" deltaType="up" colorClass="teal" />
      </div>

      {/* ── MAIN TWO-COLUMN: Active Lead | Queue + Sources ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* LEFT: Active Lead Card + Action Panel */}
        <div className="flex flex-col gap-5">
          <div className="card overflow-hidden flex flex-col">
            {/* Card Header */}
            <div className="px-6 pt-5 pb-0 flex items-start justify-between">
              <div className="flex items-center gap-2">
                <span className="text-lg">🎯</span>
                <div>
                  <div className="font-bold text-sm text-text-primary">Active Lead</div>
                  <div className="text-[11px] text-text-muted">
                    {workStarted && activeLead
                      ? `${currentLeadIdx + 1} of ${myQueue.length} leads`
                      : 'Start work to load your first lead'}
                  </div>
                </div>
              </div>
              <Tag
                variant={workStarted && activeLead ? (activeLead.priority === 'hot' ? 'red' : 'blue') : 'surface2'}
                label={workStarted && activeLead ? activeLead.priority?.toUpperCase() || 'NORMAL' : 'Waiting'}
              />
            </div>

            {/* Card Body */}
            <div className="flex-1 p-6">
              {!workStarted ? (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <div className="w-20 h-20 rounded-full bg-surface2 flex items-center justify-center text-3xl mb-4 border border-border/50">👨‍💼</div>
                  <h4 className="text-base font-bold text-text-primary mb-1">Press "Start Work" to begin</h4>
                  <p className="text-xs text-text-muted max-w-xs">Leads appear one-by-one · Direct meetings first, then follow-ups, then new leads</p>
                </div>
              ) : isQueueEmpty ? (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <div className="text-4xl mb-3">✅</div>
                  <h4 className="text-base font-bold">Queue Completed!</h4>
                  <p className="text-xs text-text-muted mt-1">You've worked through all your tasks for now.</p>
                </div>
              ) : isLastLead ? (
                <div className="flex flex-col items-center justify-center py-10 text-center gap-3">
                  <div className="text-4xl">🙌</div>
                  <h4 className="text-base font-bold">End of Queue</h4>
                  <Button variant="outline" onClick={() => setCurrentLeadIdx(0)} className="rounded-xl px-5 h-9 font-bold">Restart Queue</Button>
                </div>
              ) : (
                /* Active lead: 2-column layout */
                <div className="animate-in slide-in-from-bottom-2 duration-300">
                  {/* Lead header */}
                  <div className="mb-5">
                    <h4 className="text-xl font-bold text-text-primary tracking-tight">{activeLead.company || activeLead.name}</h4>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className="text-xs text-text-muted">Contact: <span className="font-semibold text-text-primary">{activeLead.name}</span></span>
                      <span className="w-1 h-1 rounded-full bg-border2" />
                      <span className="text-xs text-purple font-bold">{activeLead.phone}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-5">
                    {/* Left: Lead details */}
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-2">
                        {[
                          { label: 'District', value: activeLead.district || '—' },
                          { label: 'Status', value: activeLead.status?.replace(/_/g, ' ') || '—', colored: true },
                          { label: 'RNR Count', value: activeLead.rnrCount ? `${activeLead.rnrCount}× RNR` : 'None' },
                          { label: 'Revenue', value: activeLead.expectedRevenue ? formatCurrency(activeLead.expectedRevenue) : '—' },
                        ].map(f => (
                          <div key={f.label} className="p-3 rounded-xl bg-surface2 border border-border/40">
                            <div className="text-[9px] font-bold text-text-muted uppercase tracking-wider mb-1">{f.label}</div>
                            <div className={`text-sm font-bold ${f.colored ? getStatusColor(activeLead.status) : 'text-text-primary'}`}>{f.value}</div>
                          </div>
                        ))}
                      </div>

                      {/* 2×2 action buttons */}
                      <div className="grid grid-cols-2 gap-2.5">
                        <button
                          onClick={() => openFeedback('connected')}
                          className="flex flex-col items-center gap-1.5 p-3.5 rounded-xl border-2 border-border bg-surface hover:border-green hover:bg-green/5 transition-all group cursor-pointer"
                        >
                          <span className="text-xl">✓</span>
                          <span className="text-[11px] font-bold text-text-secondary group-hover:text-green">Call Done</span>
                        </button>
                        <button
                          onClick={() => openFeedback('rnr')}
                          className="flex flex-col items-center gap-1.5 p-3.5 rounded-xl border-2 border-border bg-surface hover:border-red hover:bg-red/5 transition-all group cursor-pointer"
                        >
                          <span className="text-xl">📵</span>
                          <span className="text-[11px] font-bold text-text-secondary group-hover:text-red">RNR</span>
                        </button>
                        <button
                          onClick={() => openFeedback('meeting')}
                          className="flex flex-col items-center gap-1.5 p-3.5 rounded-xl border-2 border-border bg-surface hover:border-blue hover:bg-blue/5 transition-all group cursor-pointer"
                        >
                          <span className="text-xl">📅</span>
                          <span className="text-[11px] font-bold text-text-secondary group-hover:text-blue">Meeting Set</span>
                        </button>
                        <button
                          onClick={() => openModal('update-lead', { leadData: activeLead })}
                          className="flex flex-col items-center gap-1.5 p-3.5 rounded-xl border-2 border-border bg-surface hover:border-purple hover:bg-purple/5 transition-all group cursor-pointer"
                        >
                          <span className="text-xl">⬆️</span>
                          <span className="text-[11px] font-bold text-text-secondary group-hover:text-purple">Escalate</span>
                        </button>
                      </div>
                    </div>

                    {/* Right: Interaction history */}
                    <div>
                      <div className="text-[10px] font-bold text-text-muted uppercase tracking-wider mb-3">Interaction History</div>
                      <div className="relative pl-4">
                        <div className="absolute left-1.5 top-1 bottom-1 w-px bg-border/60" />
                        {recentActivity.length > 0 ? (
                          recentActivity.slice(0, 5).map((a, i) => (
                            <div key={i} className="relative mb-3.5">
                              <div className={`absolute -left-[13px] top-1 w-2.5 h-2.5 rounded-full border-2 border-white ${i === 0 ? 'bg-blue' : 'bg-border2'}`} />
                              <div className="text-xs font-bold text-text-primary">
                                {new Date(a.createdAt || a.timestamp).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                              </div>
                              <div className="text-[11px] text-text-secondary mt-0.5 leading-relaxed">
                                {a.action?.replace(/_/g, ' ')}
                                {a.note ? ` — ${a.note.slice(0, 60)}${a.note.length > 60 ? '…' : ''}` : ''}
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="text-xs text-text-muted italic">No activity yet for this lead.</div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT: Queue + Lead Sources stacked */}
        <div className="flex flex-col gap-5">
          {/* Today's Queue */}
          <div className="card overflow-hidden flex-1">
            <div className="px-5 py-4 border-b border-border/50 flex items-center justify-between">
              <div>
                <div className="font-bold text-sm text-text-primary">Today's Queue · My Leads</div>
                <div className="text-[10px] text-text-muted uppercase font-bold tracking-widest mt-0.5">Direct meetings → Follow-ups → New leads</div>
              </div>
            </div>
            <div className="divide-y divide-border/40 max-h-[280px] overflow-y-auto">
              {myQueue.map((lead, idx) => (
                <div
                  key={lead._id}
                  onClick={() => setCurrentLeadIdx(idx)}
                  className={`px-5 py-3.5 flex items-center gap-3 cursor-pointer transition-all hover:bg-surface2/60 ${currentLeadIdx === idx ? 'bg-purple-light/20 border-l-4 border-purple' : 'border-l-4 border-transparent'}`}
                >
                  <div className="text-[10px] font-bold text-text-muted w-5 shrink-0">{idx + 1}</div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold text-text-primary truncate">{lead.company || lead.name}</div>
                    <div className="text-[11px] text-text-muted truncate">{lead.district} · {lead.name}</div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-[10px] font-bold text-text-muted">
                      {(lead.meetingAt || lead.nextActionAt || lead.followUpDate)
                        ? new Date(lead.meetingAt || lead.nextActionAt || lead.followUpDate)
                            .toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                        : '—'}
                    </div>
                    <div className={`text-[9px] font-bold uppercase tracking-tighter mt-0.5 ${getStatusColor(lead.status)}`}>
                      {lead.status?.replace(/_/g, ' ')}
                    </div>
                  </div>
                </div>
              ))}
              {isQueueEmpty && <div className="p-10 text-center text-text-muted text-sm italic">Queue empty</div>}
            </div>
            <div className="px-5 py-3 bg-surface2/50 border-t border-border/40 text-center">
              <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest">
                {todayStats.completedLeads || 0}/{myQueue.length} completed today
              </span>
            </div>
          </div>

          {/* My Lead Sources */}
          {dashData?.leadSources?.length > 0 && (
            <div className="card overflow-hidden">
              <div className="px-5 py-4 border-b border-border/50">
                <div className="font-bold text-sm text-text-primary">My Lead Sources</div>
                <div className="text-[11px] text-text-muted mt-0.5">Leads from District Partners · Mapped to me</div>
              </div>
              <div className="p-4 space-y-2">
                {dashData.leadSources.map((source, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 bg-surface2 rounded-xl border border-border/40 hover:border-purple/30 transition-colors cursor-pointer group">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center text-lg shadow-sm group-hover:scale-110 transition-transform">{source.icon}</div>
                      <div>
                        <div className="text-xs font-bold text-text-primary">{source.label}</div>
                        <div className="text-[10px] text-text-muted">District Partner Leads</div>
                      </div>
                    </div>
                    <div className="text-sm font-bold text-purple">{source.count} leads</div>
                  </div>
                ))}
                <Tag variant="purple" label="District Partner Leads" className="w-full justify-center py-2 mt-1" />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── FULL WIDTH: All Leads Table ── */}
      <div className="card overflow-hidden">
        <div className="px-6 py-5 border-b border-border/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="font-bold text-sm text-text-primary">
              My All Leads · {dashData?.user?.industry} · {dashData?.user?.state}
            </div>
            <div className="text-[11px] text-text-muted mt-0.5">Leads assigned to me from district partners across all districts</div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex bg-surface2 p-1 rounded-lg border border-border/40">
              {['All', 'Hot', 'Follow-up', 'RNR', 'Converted'].map(tab => (
                <button
                  key={tab}
                  onClick={() => setTableFilter(tab)}
                  className={`px-3.5 py-1.5 text-[10px] font-bold rounded-md transition-all ${tableFilter === tab ? 'bg-white shadow-sm text-purple' : 'text-text-muted hover:text-text-primary'}`}
                >
                  {tab}
                </button>
              ))}
            </div>
            <Button
              size="sm"
              className="bg-purple text-white border-none rounded-xl px-5 h-9 font-bold"
              onClick={() => openModal('add-lead')}
            >
              + Add Lead
            </Button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-surface2/50 border-b border-border/50">
              <tr>
                {['#', 'Partner / Business', 'District', 'Source', 'Status', 'RNR', 'Revenue', ''].map(h => (
                  <th key={h} className="px-5 py-3.5 text-[10px] font-black text-text-muted uppercase tracking-widest whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30">
              {filteredLeads.map((lead, idx) => (
                <tr key={lead._id} className="hover:bg-surface2/30 transition-colors group">
                  <td className="px-5 py-3.5 text-[10px] font-bold text-text-muted">MN-{String(idx + 1).padStart(2, '0')}</td>
                  <td className="px-5 py-3.5">
                    <div className="text-sm font-bold text-text-primary">{lead.company || lead.name}</div>
                    <div className="text-[11px] text-text-muted mt-0.5">{lead.name} · {lead.phone}</div>
                  </td>
                  <td className="px-5 py-3.5 text-sm text-text-secondary">{lead.district || '—'}</td>
                  <td className="px-5 py-3.5">
                    <span className="px-2 py-1 rounded-lg bg-surface2 text-[10px] font-bold text-text-secondary border border-border/40">
                      {lead.source || 'District Partner'}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-tight
                      ${lead.status === 'converted' ? 'bg-green/10 text-green' :
                        lead.priority === 'hot' ? 'bg-red/10 text-red' :
                        lead.status === 'rnr' ? 'bg-surface2 text-text-muted' :
                        'bg-amber-light text-amber'}`}>
                      {lead.status?.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className={`text-[11px] font-bold ${lead.rnrCount > 0 ? 'text-amber' : 'text-text-muted opacity-40'}`}>
                      {lead.rnrCount > 0 ? `${lead.rnrCount}× RNR` : '—'}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 font-mono text-xs font-bold text-text-primary">
                    {lead.expectedRevenue ? formatCurrency(lead.expectedRevenue) : '—'}
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2 justify-end">
                      <button
                        onClick={() => openModal('update-lead', { leadData: lead })}
                        className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider border border-border rounded-lg hover:bg-surface2 transition-colors"
                      >
                        Update
                      </button>
                      <button
                        onClick={() => openModal('allocate-lead', { leadData: lead })}
                        className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider border border-purple/20 text-purple rounded-lg hover:bg-purple/5 transition-colors"
                      >
                        Allocate
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredLeads.length === 0 && (
            <div className="p-14 text-center text-text-muted italic text-sm">No leads found with this filter</div>
          )}
        </div>
      </div>

      {/* ── BOTTOM: Performance + Strategy Log (50/50) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* My Performance */}
        <div className="card overflow-hidden">
          <div className="px-6 py-5 border-b border-border/50">
            <div className="font-bold text-sm text-text-primary">My Performance · This Month</div>
          </div>
          <div className="p-6 space-y-5">
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Total Calls',  value: monthlyStats.totalCalls || 0,    color: 'text-blue' },
                { label: 'Meetings',     value: monthlyStats.totalMeetings || 0, color: 'text-teal' },
                { label: 'Conversions',  value: monthlyStats.converted || 0,     color: 'text-green' },
                { label: 'Revenue',      value: formatCurrency(monthlyStats.revenue || 0), color: 'text-purple' },
              ].map(stat => (
                <div key={stat.label} className="p-4 bg-surface2 rounded-2xl text-center border border-border/40">
                  <div className={`text-2xl font-black ${stat.color}`}>{stat.value}</div>
                  <div className="text-[10px] text-text-muted uppercase font-bold tracking-widest mt-1">{stat.label}</div>
                </div>
              ))}
            </div>
            <div>
              <div className="flex justify-between items-end mb-2">
                <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Work Completion</span>
                <span className="text-sm font-black text-purple">{Math.min(dashData?.attendance?.completionPct || 0, 100)}%</span>
              </div>
              <div className="h-2 bg-surface2 rounded-full overflow-hidden border border-border/40">
                <div
                  className="h-full bg-gradient-to-r from-purple to-purple-dark transition-all duration-1000"
                  style={{ width: `${Math.min(dashData?.attendance?.completionPct || 0, 100)}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Strategy Log */}
        <div className="card overflow-hidden flex flex-col">
          <div className="px-6 py-5 border-b border-border/50">
            <div className="font-bold text-sm text-text-primary">My Strategy Log</div>
          </div>
          <div className="flex-1 p-5 space-y-4">
            <p className="text-[10px] text-text-muted uppercase font-bold tracking-widest">What strategy worked for recent conversions?</p>
            <div className="space-y-2.5 max-h-[160px] overflow-y-auto pr-1">
              {dashData?.strategyLogs?.map((log, idx) => (
                <div key={idx} className="p-3 bg-green/5 border border-green/10 rounded-xl">
                  <div className="flex justify-between items-start mb-1">
                    <div className="text-xs font-bold text-text-primary">{log.leadName}</div>
                    <Tag variant="green" label="Converted" className="text-[8px] py-0 px-1.5" />
                  </div>
                  <div className="text-[11px] text-text-muted italic leading-relaxed">Strategy: {log.strategy}</div>
                </div>
              ))}
              {(!dashData?.strategyLogs || dashData.strategyLogs.length === 0) && (
                <div className="p-4 text-center text-text-muted text-[11px] italic">No recent conversions logged</div>
              )}
            </div>
            <div className="space-y-2.5 pt-1">
              <textarea
                className="w-full bg-surface2 border border-border/50 rounded-xl p-3 text-xs focus:ring-2 focus:ring-purple/20 transition-all outline-none resize-none"
                placeholder="Log today's winning strategy…"
                rows={2}
                value={strategyNote}
                onChange={(e) => setStrategyNote(e.target.value)}
              />
              <div className="flex justify-end">
                <Button
                  className="bg-purple text-white border-none rounded-lg px-4 py-2 h-auto text-[10px] font-bold uppercase tracking-wider"
                  onClick={() => saveStrategyMutation.mutate(strategyNote)}
                  disabled={!strategyNote || saveStrategyMutation.isPending}
                >
                  Save Strategy
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Call Feedback Modal */}
      {activeLead && (
        <CallFeedbackModal
          isOpen={feedbackModal.open}
          onClose={closeFeedback}
          lead={activeLead}
          initialOutcome={feedbackModal.outcome}
          onSuccess={() => {
            // Move to next lead after feedback is submitted
            setCurrentLeadIdx(prev => prev + 1);
          }}
        />
      )}
    </div>
  );
};

export default MyWork;
