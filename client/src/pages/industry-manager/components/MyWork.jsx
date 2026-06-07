import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  StatCard,
  Button,
  Tag,
  Avatar,
  Modal,
  DashboardSkeleton
} from '../../../components/ui';
import { leadsApi } from '../../../api/leadsApi';
import { attendanceApi } from '../../../api/attendanceApi';
import { dashboardApi } from '../../../api/dashboardApi';
import { tasksApi } from '../../../api/tasksApi';
import { usersApi } from '../../../api/usersApi';
import { useToast } from '../../../context/ToastContext';
import { useAuth } from '../../../context/AuthContext';
import CallFeedbackModal from './CallFeedbackModal';

const PRIORITY_DOT = { high: 'bg-red', medium: 'bg-amber', low: 'bg-blue' };
const PRIORITY_STYLE = {
  high:   'bg-red/10 text-red',
  medium: 'bg-amber/10 text-amber',
  low:    'bg-blue/10 text-blue',
};
const TASK_STATUS_STYLE = {
  pending:     'bg-amber-light text-amber',
  in_progress: 'bg-blue-light text-blue',
  completed:   'bg-accent-light text-accent',
  overdue:     'bg-red/10 text-red',
};

// Closed statuses are removed from the active work queue so a completed lead
// (e.g. "Blocking Amount Received") can never resurface and get overwritten.
const CLOSED_STATUSES = [
  'converted', 'lost', 'not_interested',
  'blocking_amount_received', 'full_amount_received', 'agreement_signed',
];

const MyWork = () => {
  const queryClient = useQueryClient();
  const { addToast } = useToast();
  const { user: currentUser } = useAuth();
  const navigate = useNavigate();

  const [activeLeadId, setActiveLeadId] = useState(null);
  const [queueComplete, setQueueComplete] = useState(false);
  const [tableFilter, setTableFilter] = useState('All');
  const [showAllLeads, setShowAllLeads] = useState(false);
  const [taskFilter, setTaskFilter] = useState('All');
  const [summaryModal, setSummaryModal] = useState(null);
  const [leadDetailOpen, setLeadDetailOpen] = useState(false);
  const [allocateOpen, setAllocateOpen] = useState(false);
  const [allocateExecId, setAllocateExecId] = useState('');
  const [strategyNote, setStrategyNote] = useState('');

  // Call feedback modal state
  const [feedbackModal, setFeedbackModal] = useState({ open: false, outcome: null });
  const openFeedback = (outcome) => setFeedbackModal({ open: true, outcome });
  const closeFeedback = () => setFeedbackModal({ open: false, outcome: null });

  // 1. Fetch Personal Stats (work attendance, personal completions)
  const { data: dashData, isLoading: dashLoading, isFetching: dashFetching } = useQuery({
    queryKey: ['dashboard', 'executive'],
    queryFn: () => dashboardApi.getExecutiveDashboard().then(res => res.data),
    staleTime: 5 * 60 * 1000,
    placeholderData: (prev) => prev
  });

  // 2. Fetch All My Leads
  const { data: allLeadsData, isLoading: queueLoading, isFetching: queueFetching } = useQuery({
    queryKey: ['leads', 'personal-list'],
    queryFn: () => leadsApi.getLeads({ owner: 'self', limit: 2000 }).then(res => res.data),
    staleTime: 0,
    placeholderData: (prev) => prev
  });

  // 3. Fetch allocated tasks for this executive
  const { data: tasksData } = useQuery({
    queryKey: ['tasks', 'my-allocated'],
    queryFn: () => tasksApi.getTasks({ limit: 50 }).then(res => res.data),
    staleTime: 2 * 60 * 1000,
    placeholderData: (prev) => prev,
  });

  const completeTaskMutation = useMutation({
    mutationFn: (id) => tasksApi.completeTask(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks', 'my-allocated'] });
      addToast('Task marked as done!', 'success');
    },
  });

  // Team executives under current IM (for inline allocate modal)
  const { data: teamExecsData } = useQuery({
    queryKey: ['users', 'team-execs', currentUser?._id],
    queryFn: () => usersApi.getUsers({ role: 'executive', reportingTo: currentUser._id }).then(r => r.data),
    enabled: allocateOpen && !!currentUser?._id,
    staleTime: 5 * 60 * 1000,
  });

  const allocateLeadMutation = useMutation({
    mutationFn: ({ leadId, execId }) => leadsApi.allocateLead(leadId, execId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads', 'personal-list'] });
      addToast('Lead allocated successfully!', 'success');
      setAllocateOpen(false);
      setAllocateExecId('');
    },
    onError: (err) => addToast(err?.response?.data?.message || 'Allocation failed', 'error'),
  });

  // 4. Active work queue — owned leads with open statuses only.
  //    The active lead is tracked by _id (not array position) so a refetch or a
  //    tab-switch remount can never resurface a completed lead as the active one.
  const workQueue = useMemo(
    () => (allLeadsData?.leads || []).filter(l => !CLOSED_STATUSES.includes(l.status)),
    [allLeadsData]
  );
  const activeLead = workQueue.find(l => l._id === activeLeadId) || null;
  const activeIndex = workQueue.findIndex(l => l._id === activeLeadId);

  // Keep the active selection valid: default to the first open lead, and recover
  // automatically when the current lead leaves the queue (actioned, allocated, etc.)
  useEffect(() => {
    if (queueComplete) return;
    if (workQueue.length === 0) {
      if (activeLeadId !== null) setActiveLeadId(null);
      return;
    }
    if (!activeLeadId || !workQueue.some(l => l._id === activeLeadId)) {
      setActiveLeadId(workQueue[0]._id);
    }
  }, [workQueue, activeLeadId, queueComplete]);

  // Advance to the next open lead after handling the current one.
  const advanceToNext = () => {
    const idx = workQueue.findIndex(l => l._id === activeLeadId);
    const next = idx >= 0 ? workQueue[idx + 1] : workQueue[0];
    if (next) {
      setActiveLeadId(next._id);
    } else {
      setQueueComplete(true);
      setActiveLeadId(null);
    }
  };

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

  const goToLead = (leadId) => {
    if (!leadId) return;
    navigate(`/leads/${leadId}`);
  };

  /** Prefer non-empty drilldown list; executive API often returns [] while industry leads live in myQueue */
  const pickLeads = (drilldownLeads, fallback) =>
    Array.isArray(drilldownLeads) && drilldownLeads.length > 0 ? drilldownLeads : fallback;

  const pickCallRows = (rows, fallback = []) =>
    Array.isArray(rows) && rows.length > 0 ? rows : fallback;

  const workStarted = !!dashData?.attendance?.workStartedAt && !dashData?.attendance?.workCompletedAt;
  const workCompleted = !!dashData?.attendance?.workCompletedAt;
  const myQueue = allLeadsData?.leads || [];

  const completionPct = workCompleted
    ? Math.min(Math.round(dashData?.attendance?.completionPct || 0), 100)
    : Math.round(((dashData?.todayStats?.completedLeads || 0) / Math.max(myQueue.length, 1)) * 100);
  const pctColor = completionPct >= 70 ? 'text-accent' : completionPct >= 30 ? 'text-amber' : 'text-red';
  const barColor = completionPct >= 70 ? 'bg-accent' : completionPct >= 30 ? 'bg-amber' : 'bg-red';
  const isQueueEmpty = workQueue.length === 0;

  const filteredLeads = useMemo(() => {
    const leads = allLeadsData?.leads || [];
    if (tableFilter === 'All') return leads;
    if (tableFilter === 'Hot')      return leads.filter(l => l.priority === 'hot');
    if (tableFilter === 'Warm')     return leads.filter(l => l.priority === 'warm');
    if (tableFilter === 'Cold')     return leads.filter(l => l.priority === 'cold');
    if (tableFilter === 'Meeting')  return leads.filter(l => l.status === 'meeting_direct' || l.status === 'meeting_virtual');
    if (tableFilter === 'Blocking') return leads.filter(l => l.status === 'blocking_amount_received');
    // DB stores the status as "followup" (no hyphen) — the tab label has one.
    if (tableFilter === 'Follow-up') return leads.filter(l => l.status === 'followup');
    return leads.filter(l => l.status === tableFilter.toLowerCase());
  }, [allLeadsData, tableFilter]);

  const filteredTasks = useMemo(() => {
    const tasks = tasksData?.tasks || [];
    if (taskFilter === 'All') return tasks;
    if (taskFilter === 'In Progress') return tasks.filter(t => t.status === 'in_progress');
    return tasks.filter(t => t.status === taskFilter.toLowerCase());
  }, [tasksData, taskFilter]);

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

  if ((dashLoading || !dashData) && (dashFetching || queueFetching)) return <DashboardSkeleton />;
  const isRefreshing = dashFetching || queueFetching;

  const todayStats = dashData?.todayStats || {};
  const weeklyStats = dashData?.weeklyStats || {};
  const monthlyStats = dashData?.monthlyStats || {};
  const summaryDrilldowns = dashData?.summaryDrilldowns || {};
  // "My Work" is the IM's personal workspace — keep every metric on the same
  // personal source (executive dashboard) so counts don't flip between caches.
  const personalCallRows = pickCallRows(summaryDrilldowns.calls?.rows, []);
  const personalCallsCount = summaryDrilldowns.calls?.count ?? personalCallRows.length;
  const personalCallGrowth = weeklyStats.callGrowth ?? 0;

  const recentActivity = activityData?.activities || [];

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-500">

      {/* Sub Header / Work Status */}
      <div className="bg-surface border border-border/60 rounded-2xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm">
        <div>
          <h2 className="text-lg font-bold text-text-primary flex items-center gap-2">
            My Work — {dashData?.user?.name} · {dashData?.user?.industry}
            {isRefreshing && (
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-text-muted bg-surface2 px-2 py-0.5 rounded-full">
                <svg className="w-2.5 h-2.5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" strokeLinecap="round"/>
                </svg>
                Loading
              </span>
            )}
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

          {/* Work Completion % — shown once work has started */}
          {(workStarted || workCompleted) && (
            <div className="flex flex-col items-center gap-1 px-1 min-w-[56px]">
              <span className={`text-base font-black leading-none tabular-nums ${pctColor}`}>
                {completionPct}%
              </span>
              <div className="w-full h-1.5 bg-surface2 rounded-full overflow-hidden border border-border/40">
                <div
                  className={`h-full rounded-full transition-all duration-700 ${barColor}`}
                  style={{ width: `${completionPct}%` }}
                />
              </div>
              <span className="text-[9px] text-text-muted uppercase tracking-widest font-bold leading-none">
                {workCompleted ? 'Final' : 'Live'}
              </span>
            </div>
          )}

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
            + Create Executive
          </Button>
        </div>
      </div>

      {/* ── SUMMARY CARDS (5 clickable) ── */}
      {(() => {
        const blockingCount = myQueue.filter(l => l.status === 'blocking_amount_received').length;
        const cards = [
          { id: 'my-leads',    label: 'My Leads Today',    value: myQueue.length,                                              delta: `${todayStats.followups || 0} follow-ups pending`, color: '#7C3AED' },
          { id: 'completed',   label: 'Completed Today',   value: summaryDrilldowns.completed?.count ?? 0,                     delta: `of ${myQueue.length} total leads`,              color: '#059669' },
          { id: 'calls',       label: 'Calls This Week',   value: personalCallsCount,                                          delta: `${personalCallGrowth >= 0 ? '+' : ''}${personalCallGrowth} vs last week`, color: '#2563EB' },
          { id: 'conversions', label: 'My Conversions',    value: summaryDrilldowns.conversions?.count ?? 0,                   delta: 'This month',                                    color: '#0D9488' },
          { id: 'blocking',    label: 'Blocking Amount',   value: summaryDrilldowns.blocking?.count || blockingCount,          delta: 'Amount received',                               color: '#D97706' },
        ];

        return (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
            {cards.map((card) => (
              <button
                key={card.id}
                onClick={() => setSummaryModal(card.id)}
                className="group relative text-left w-full bg-surface border border-border rounded-xl p-4 sm:p-5 shadow-sm hover:-translate-y-0.5 hover:shadow-md hover:border-border2 transition-all overflow-hidden focus:outline-none focus:ring-2 focus:ring-purple/20"
              >
                {/* Top accent bar */}
                <div className="absolute top-0 left-0 right-0 h-[3px] rounded-t-xl" style={{ background: card.color }} />

                <div className="pt-1">
                  <div className="text-[10px] sm:text-[11px] font-bold text-text-muted uppercase tracking-wider mb-2 sm:mb-3 leading-tight">
                    {card.label}
                  </div>
                  <div
                    className="text-2xl sm:text-3xl font-black leading-none mb-1.5 sm:mb-2 tabular-nums"
                    style={{ color: card.color }}
                  >
                    {isRefreshing
                      ? <div className="h-8 w-14 rounded-lg animate-pulse" style={{ backgroundColor: `${card.color}22` }} />
                      : card.value}
                  </div>
                  <div className="text-[10px] sm:text-[11px] font-medium text-text-muted leading-tight truncate">
                    {card.delta}
                  </div>
                </div>

                {/* Hover arrow */}
                <span className="absolute bottom-3 right-3 text-[10px] font-bold opacity-0 group-hover:opacity-60 transition-opacity" style={{ color: card.color }}>
                  Details →
                </span>
              </button>
            ))}
          </div>
        );
      })()}

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
                      ? `${activeIndex + 1} of ${workQueue.length} leads`
                      : 'Start work to load your first lead'}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Tag
                  variant={workStarted && activeLead ? (activeLead.priority === 'hot' ? 'red' : 'blue') : 'surface2'}
                  label={workStarted && activeLead ? activeLead.priority?.toUpperCase() || 'NORMAL' : 'Waiting'}
                />
                {workStarted && activeLead && (
                  <button
                    onClick={() => { setAllocateOpen(true); setAllocateExecId(''); }}
                    className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider border border-purple/20 text-purple rounded-lg hover:bg-purple/5 transition-colors"
                  >
                    Allocate
                  </button>
                )}
              </div>
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
              ) : queueComplete ? (
                <div className="flex flex-col items-center justify-center py-10 text-center gap-3">
                  <div className="text-4xl">🙌</div>
                  <h4 className="text-base font-bold">End of Queue</h4>
                  <Button variant="outline" onClick={() => { setQueueComplete(false); setActiveLeadId(workQueue[0]?._id ?? null); }} className="rounded-xl px-5 h-9 font-bold">Restart Queue</Button>
                </div>
              ) : !activeLead ? (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <div className="text-sm text-text-muted italic">Loading next lead…</div>
                </div>
              ) : (
                /* Active lead: 2-column layout */
                <div className="animate-in slide-in-from-bottom-2 duration-300">
                  {/* Lead header */}
                  <div className="mb-5">
                    <button
                      onClick={() => setLeadDetailOpen(true)}
                      className="text-xl font-bold text-text-primary tracking-tight hover:text-purple transition-colors text-left group"
                    >
                      {activeLead.company || activeLead.name}
                      <span className="ml-2 text-[11px] font-semibold text-text-muted opacity-0 group-hover:opacity-60 transition-opacity">↗ Details</span>
                    </button>
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

                      {/* 3 action buttons */}
                      <div className="grid grid-cols-3 gap-2.5">
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
                          onClick={advanceToNext}
                          className="flex flex-col items-center gap-1.5 p-3.5 rounded-xl border-2 border-border bg-surface hover:border-purple hover:bg-purple/5 transition-all group cursor-pointer"
                        >
                          <span className="text-xl">⏭️</span>
                          <span className="text-[11px] font-bold text-text-secondary group-hover:text-purple">Skip for Now</span>
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
              {workQueue.map((lead, idx) => (
                <div
                  key={lead._id}
                  onClick={() => { setQueueComplete(false); setActiveLeadId(lead._id); }}
                  className={`px-5 py-3.5 flex items-center gap-3 cursor-pointer transition-all hover:bg-surface2/60 ${activeLead?._id === lead._id ? 'bg-purple-light/20 border-l-4 border-purple' : 'border-l-4 border-transparent'}`}
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

      {/* ── ALLOCATED TASKS ── */}
      <div className="card overflow-hidden">
        <div className="px-6 py-5 border-b border-border/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="font-bold text-sm text-text-primary">Allocated Tasks</div>
            <div className="text-[11px] text-text-muted mt-0.5">
              Tasks assigned to you · {(tasksData?.tasks || []).filter(t => t.status !== 'completed').length} pending
            </div>
          </div>
          <div className="flex bg-surface2 p-1 rounded-lg border border-border/40">
            {['All', 'Pending', 'In Progress', 'Overdue'].map(tab => (
              <button
                key={tab}
                onClick={() => setTaskFilter(tab)}
                className={`px-3.5 py-1.5 text-[10px] font-bold rounded-md transition-all ${taskFilter === tab ? 'bg-white shadow-sm text-purple' : 'text-text-muted hover:text-text-primary'}`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-surface2/50 border-b border-border/50">
              <tr>
                {['', 'Task', 'Assigned By', 'Due Date', 'Priority', 'Status', ''].map((h, i) => (
                  <th key={i} className="px-5 py-3.5 text-[10px] font-black text-text-muted uppercase tracking-widest whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30">
              {filteredTasks.map((task) => {
                const isOverdue = task.status === 'overdue';
                const isDone = task.status === 'completed';
                return (
                  <tr
                    key={task._id}
                    className={`transition-colors group ${isOverdue ? 'bg-red/5 hover:bg-red/10' : 'hover:bg-surface2/30'}`}
                  >
                    {/* Priority dot */}
                    <td className="pl-5 pr-2 py-3.5 w-6">
                      <span
                        className={`block w-2 h-2 rounded-full ${PRIORITY_DOT[task.priority] || 'bg-border2'}`}
                        title={task.priority}
                      />
                    </td>

                    {/* Task title + description */}
                    <td className="px-5 py-3.5 max-w-[300px]">
                      <div className={`text-sm font-bold truncate ${isDone ? 'line-through text-text-muted' : 'text-text-primary'}`}>
                        {task.title}
                      </div>
                      {task.description && (
                        <div className="text-[11px] text-text-muted mt-0.5 truncate max-w-[260px]">
                          {task.description}
                        </div>
                      )}
                    </td>

                    {/* Assigned by */}
                    <td className="px-5 py-3.5 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-purple/10 text-purple text-[9px] font-bold flex items-center justify-center shrink-0">
                          {task.assignedBy?.name?.charAt(0) || '?'}
                        </span>
                        <span className="text-xs text-text-secondary font-medium">
                          {task.assignedBy?.name || '—'}
                        </span>
                      </div>
                    </td>

                    {/* Due date */}
                    <td className="px-5 py-3.5 whitespace-nowrap">
                      <div className={`text-xs font-bold ${isOverdue ? 'text-red' : 'text-text-primary'}`}>
                        {new Date(task.endDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </div>
                      <div className="text-[10px] text-text-muted mt-0.5">{task.endTime}</div>
                    </td>

                    {/* Priority badge */}
                    <td className="px-5 py-3.5">
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-tight ${PRIORITY_STYLE[task.priority] || 'bg-surface2 text-text-muted'}`}>
                        {task.priority}
                      </span>
                    </td>

                    {/* Status badge */}
                    <td className="px-5 py-3.5">
                      <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-tight ${TASK_STATUS_STYLE[task.status] || 'bg-surface2 text-text-muted'}`}>
                        {task.status.replace(/_/g, ' ')}
                      </span>
                    </td>

                    {/* Action */}
                    <td className="px-5 py-3.5">
                      {!isDone && (
                        <button
                          onClick={() => completeTaskMutation.mutate(task._id)}
                          disabled={completeTaskMutation.isPending}
                          className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider border border-accent/30 text-accent rounded-lg hover:bg-accent/5 transition-colors disabled:opacity-40"
                        >
                          Mark Done
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {filteredTasks.length === 0 && (
            <div className="py-14 text-center">
              <div className="text-3xl mb-3">📋</div>
              <p className="text-sm font-medium text-text-muted">
                {taskFilter === 'All' ? 'No tasks allocated yet' : `No ${taskFilter.toLowerCase()} tasks`}
              </p>
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
              {['All', 'Hot', 'Warm', 'Cold', 'Follow-up', 'Meeting', 'Blocking', 'RNR', 'Converted'].map(tab => (
                <button
                  key={tab}
                  onClick={() => { setTableFilter(tab); setShowAllLeads(false); }}
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
              {(showAllLeads ? filteredLeads : filteredLeads.slice(0, 5)).map((lead, idx) => (
                <tr
                  key={lead._id}
                  className="hover:bg-surface2/30 transition-colors group cursor-pointer"
                  onClick={() => goToLead(lead._id)}
                >
                  <td className="px-5 py-3.5 text-[10px] font-bold text-text-muted">MN-{String(idx + 1).padStart(2, '0')}</td>
                  <td className="px-5 py-3.5">
                    <div className="text-sm font-bold text-text-primary group-hover:text-purple transition-colors">{lead.company || lead.name}</div>
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
                  <td className="px-5 py-3.5" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center gap-2 justify-end">
                      <button
                        type="button"
                        onClick={() => openModal('update-lead', { leadData: lead })}
                        className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider border border-border rounded-lg hover:bg-surface2 transition-colors"
                      >
                        Update
                      </button>
                      <button
                        type="button"
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
          {filteredLeads.length > 5 && (
            <div className="px-5 py-3.5 border-t border-border/40 bg-surface2/30 text-center">
              <button
                onClick={() => setShowAllLeads(v => !v)}
                className="text-[11px] font-bold text-purple hover:underline transition-colors"
              >
                {showAllLeads
                  ? `Show less ↑`
                  : `View All ${filteredLeads.length} leads ↓`}
              </button>
            </div>
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
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {[
                { label: 'Total Calls',   value: monthlyStats.totalCalls || 0,    color: 'text-blue' },
                { label: 'Meetings',      value: monthlyStats.totalMeetings || 0, color: 'text-teal' },
                { label: 'Conversions',   value: monthlyStats.converted || 0,     color: 'text-green' },
                { label: 'Blocking Amt',  value: (allLeadsData?.leads || []).filter(l => l.status === 'blocking_amount_received').length, color: 'text-amber' },
                { label: 'Revenue',       value: formatCurrency(monthlyStats.revenue || 0), color: 'text-purple' },
              ].map(stat => (
                <div key={stat.label} className="p-4 bg-surface2 rounded-2xl text-center border border-border/40">
                  <div className={`text-2xl font-black ${stat.color}`}>{stat.value}</div>
                  <div className="text-[10px] text-text-muted uppercase font-bold tracking-widest mt-1">{stat.label}</div>
                </div>
              ))}
            </div>
            <div>
              <div className="flex justify-between items-end mb-2">
                <div>
                  <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Monthly Lead Review</span>
                  <div className="text-[10px] text-text-muted mt-0.5">
                    {monthlyStats.reviewedLeads || 0} of {monthlyStats.totalAllLeads || 0} leads reviewed
                  </div>
                </div>
                <span className="text-sm font-black text-purple">{Math.min(monthlyStats.completionPct || 0, 100)}%</span>
              </div>
              <div className="h-2 bg-surface2 rounded-full overflow-hidden border border-border/40">
                <div
                  className="h-full bg-gradient-to-r from-purple to-purple-dark transition-all duration-1000"
                  style={{ width: `${Math.min(monthlyStats.completionPct || 0, 100)}%` }}
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

      {/* ── SUMMARY DETAIL MODAL ── */}
      {(() => {
        if (!summaryModal) return null;

        const drilldowns = summaryDrilldowns || {};
        const myLeads = pickLeads(drilldowns.myLeads?.leads, myQueue);
        const completedLeads = pickLeads(drilldowns.completed?.leads, []);
        const callRows = pickCallRows(drilldowns.calls?.rows, []);
        const conversionLeads = pickLeads(drilldowns.conversions?.leads, []);
        const blockingLeads = pickLeads(
          drilldowns.blocking?.leads,
          myQueue.filter(l => l.status === 'blocking_amount_received')
        );

        const CONFIG = {
          'my-leads': {
            title: 'My Leads Today',
            subtitle: `${myLeads.length} leads in your queue`,
            color: '#7C3AED',
            leads: myLeads.slice(0, 20),
            navTarget: '/dashboard?page=leads',
            emptyMsg: 'No leads in your queue today.',
          },
          completed: {
            title: 'Completed Today',
            subtitle: `${completedLeads.length} leads actioned today`,
            color: '#059669',
            leads: completedLeads.slice(0, 20),
            navTarget: '/dashboard?page=leads&completedToday=true',
            emptyMsg: 'No completed leads found for today.',
          },
          calls: {
            title: 'Calls This Week',
            subtitle: `${callRows.length} calls made`,
            color: '#2563EB',
            callRows,
            navTarget: '/dashboard?page=calls&period=weekly',
            emptyMsg: 'No calls found this week.',
          },
          conversions: {
            title: 'My Conversions',
            subtitle: `${monthlyStats.converted || 0} conversions this month`,
            color: '#0D9488',
            leads: conversionLeads.slice(0, 20),
            navTarget: '/dashboard?page=leads&status=converted&period=month',
            emptyMsg: 'No conversions recorded yet.',
          },
          blocking: {
            title: 'Blocking Amount Received',
            subtitle: `${blockingLeads.length} leads with blocking payment`,
            color: '#D97706',
            leads: blockingLeads.slice(0, 20),
            navTarget: '/dashboard?page=leads&status=blocking_amount_received',
            emptyMsg: 'No blocking amount received yet.',
          },
        };

        const cfg = CONFIG[summaryModal];
        if (!cfg) return null;

        return (
          <Modal
            isOpen
            title={cfg.title}
            subtitle={cfg.subtitle}
            onClose={() => setSummaryModal(null)}
            className="max-w-lg"
          >
            {/* Top stat highlight */}
            <div
              className="rounded-xl p-4 mb-5 flex items-center gap-4"
              style={{ background: `${cfg.color}12`, border: `1px solid ${cfg.color}30` }}
            >
              <div className="text-4xl font-black tabular-nums" style={{ color: cfg.color }}>
                {summaryModal === 'my-leads' ? myLeads.length
                  : summaryModal === 'completed' ? completedLeads.length
                  : summaryModal === 'calls' ? callRows.length
                  : summaryModal === 'conversions' ? conversionLeads.length
                  : blockingLeads.length}
              </div>
              <div>
                <div className="text-sm font-bold text-text-primary">{cfg.title}</div>
                <div className="text-xs text-text-muted mt-0.5">{cfg.subtitle}</div>
              </div>
            </div>

            {/* Lead list OR stat-only message */}
            {cfg.callRows ? (
              cfg.callRows.length === 0 ? (
                <div className="py-8 text-center">
                  <div className="text-3xl mb-3">📞</div>
                  <p className="text-sm text-text-muted">{cfg.emptyMsg}</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[340px] overflow-y-auto pr-1 -mr-2">
                  {cfg.callRows.map((row, i) => {
                    const lead = row.lead;
                    return (
                      <div
                        key={row._id || lead?._id || i}
                        className="flex items-center gap-3 p-3 rounded-xl bg-surface2 border border-border/40 hover:border-border2 transition-colors"
                      >
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center text-[11px] font-black text-white shrink-0" style={{ background: cfg.color }}>
                          {i + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-bold text-text-primary truncate">{lead?.name || lead?.company || 'Unknown Lead'}</div>
                          <div className="text-[11px] text-text-muted truncate">{lead?.district || '—'} · {row.note || 'Call logged'}</div>
                        </div>
                        <span className="text-[9px] font-bold uppercase tracking-tight px-2 py-0.5 rounded-md shrink-0" style={{ background: `${cfg.color}15`, color: cfg.color }}>
                          called
                        </span>
                      </div>
                    );
                  })}
                </div>
              )
            ) : cfg.leads.length === 0 ? (
              <div className="py-8 text-center">
                <div className="text-3xl mb-3">📋</div>
                <p className="text-sm text-text-muted">{cfg.emptyMsg}</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[340px] overflow-y-auto pr-1 -mr-2">
                {cfg.leads.map((lead, i) => (
                  <button
                    type="button"
                    key={lead._id || i}
                    onClick={() => {
                      setSummaryModal(null);
                      goToLead(lead._id);
                    }}
                    className="w-full flex items-center gap-3 p-3 rounded-xl bg-surface2 border border-border/40 hover:border-purple/30 hover:bg-purple-light/10 transition-colors text-left cursor-pointer"
                  >
                    <div
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-[11px] font-black text-white shrink-0"
                      style={{ background: cfg.color }}
                    >
                      {i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-bold text-text-primary truncate">
                        {lead.company || lead.name}
                      </div>
                      <div className="text-[11px] text-text-muted truncate">
                        {lead.district || '—'} · {lead.name}
                      </div>
                    </div>
                    <span
                      className="text-[9px] font-bold uppercase tracking-tight px-2 py-0.5 rounded-md shrink-0"
                      style={{ background: `${cfg.color}15`, color: cfg.color }}
                    >
                      {lead.status?.replace(/_/g, ' ') || 'new'}
                    </span>
                  </button>
                ))}
              </div>
            )}

            {/* View Full Details CTA */}
            <div className="mt-6 pt-4 border-t border-border/50 flex justify-end">
              <button
                onClick={() => {
                  setSummaryModal(null);
                  navigate(cfg.navTarget);
                }}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white transition-all hover:opacity-90 active:scale-95"
                style={{ background: cfg.color }}
              >
                View Full Details
                <span className="text-base leading-none">→</span>
              </button>
            </div>
          </Modal>
        );
      })()}

      {/* Team Allocate Modal — shows only executives under current IM */}
      {activeLead && allocateOpen && (
        <Modal
          isOpen
          title="Allocate Lead"
          subtitle="Assign to an executive in your team"
          onClose={() => { setAllocateOpen(false); setAllocateExecId(''); }}
          className="max-w-sm"
        >
          <div className="p-3 bg-surface2 rounded-xl border border-border/40 mb-5">
            <div className="text-sm font-bold text-text-primary">{activeLead.company || activeLead.name}</div>
            <div className="text-[11px] text-text-muted mt-0.5">{activeLead.district} · {activeLead.phone}</div>
          </div>

          <div className="space-y-2 mb-6">
            <label className="block text-xs font-bold text-text-secondary mb-1.5">
              Select Executive <span className="text-red">*</span>
            </label>
            <select
              className="select w-full"
              value={allocateExecId}
              onChange={e => setAllocateExecId(e.target.value)}
            >
              <option value="">— Choose from your team —</option>
              {(teamExecsData || []).map(ex => (
                <option key={ex._id} value={ex._id}>{ex.name} · {ex.district || ex.state}</option>
              ))}
            </select>
            {teamExecsData?.length === 0 && (
              <p className="text-[11px] text-amber font-medium mt-1">No executives found in your team.</p>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-border/40">
            <Button variant="outline" onClick={() => { setAllocateOpen(false); setAllocateExecId(''); }}>
              Cancel
            </Button>
            <Button
              className="bg-purple text-white border-none"
              disabled={!allocateExecId || allocateLeadMutation.isPending}
              onClick={() => allocateLeadMutation.mutate({ leadId: activeLead._id, execId: allocateExecId })}
            >
              {allocateLeadMutation.isPending ? 'Allocating…' : 'Allocate'}
            </Button>
          </div>
        </Modal>
      )}

      {/* Lead Detail Modal */}
      {activeLead && leadDetailOpen && (
        <Modal
          isOpen
          title={activeLead.company || activeLead.name}
          subtitle={`${activeLead.district || '—'} · ${activeLead.phone}`}
          onClose={() => setLeadDetailOpen(false)}
          className="max-w-lg"
        >
          {/* Info tiles */}
          <div className="grid grid-cols-2 gap-3 mb-5">
            {[
              { label: 'Source',   value: activeLead.source || 'District Partner' },
              { label: 'Priority', value: activeLead.priority?.toUpperCase() || '—' },
              { label: 'Status',   value: activeLead.status?.replace(/_/g, ' ') || '—' },
              { label: 'Phone',    value: activeLead.phone || '—' },
            ].map(f => (
              <div key={f.label} className="p-3 rounded-xl bg-surface2 border border-border/40">
                <div className="text-[9px] font-bold text-text-muted uppercase tracking-wider mb-1">{f.label}</div>
                <div className="text-sm font-bold text-text-primary">{f.value}</div>
              </div>
            ))}
          </div>

          {/* All handlers who touched this lead */}
          {recentActivity.length > 0 && (() => {
            const seen = new Set();
            const handlers = recentActivity
              .map(a => a.performedBy)
              .filter(p => p && !seen.has(p._id || p) && seen.add(p._id || p));
            return handlers.length > 0 ? (
              <div className="mb-5">
                <div className="text-[10px] font-bold text-text-muted uppercase tracking-wider mb-2">All Handlers</div>
                <div className="flex flex-wrap gap-2">
                  {handlers.map((p, i) => (
                    <div key={i} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-purple/5 border border-purple/10">
                      <span className="w-5 h-5 rounded-full bg-purple/10 text-purple text-[9px] font-bold flex items-center justify-center">
                        {(p.name || p)?.[0] || '?'}
                      </span>
                      <span className="text-[11px] font-bold text-text-primary">{p.name || p}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null;
          })()}

          {/* Remarks history */}
          <div>
            <div className="text-[10px] font-bold text-text-muted uppercase tracking-wider mb-3">Full Remarks History</div>
            <div className="relative pl-4 max-h-[280px] overflow-y-auto pr-1 -mr-2">
              <div className="absolute left-1.5 top-1 bottom-1 w-px bg-border/60" />
              {recentActivity.length > 0 ? (
                recentActivity.map((a, i) => (
                  <div key={i} className="relative mb-4">
                    <div className={`absolute -left-[13px] top-1 w-2.5 h-2.5 rounded-full border-2 border-white ${i === 0 ? 'bg-purple' : 'bg-border2'}`} />
                    <div className="flex items-center justify-between gap-2 mb-0.5">
                      <div className="text-[10px] font-bold text-text-primary">
                        {new Date(a.createdAt || a.timestamp).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </div>
                      {a.performedBy?.name && (
                        <span className="text-[9px] font-bold text-purple bg-purple/5 px-1.5 py-0.5 rounded-md">
                          {a.performedBy.name}
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] font-semibold text-text-secondary">
                      {a.action?.replace(/_/g, ' ')}
                    </div>
                    {a.note && (
                      <div className="text-[11px] text-text-muted mt-0.5 leading-relaxed bg-surface2 rounded-lg px-2.5 py-1.5 border border-border/40">
                        {a.note}
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <div className="py-6 text-center text-sm text-text-muted italic">No activity recorded yet.</div>
              )}
            </div>
          </div>
        </Modal>
      )}

      {/* Call Feedback Modal */}
      {activeLead && (
        <CallFeedbackModal
          isOpen={feedbackModal.open}
          onClose={closeFeedback}
          lead={activeLead}
          initialOutcome={feedbackModal.outcome}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['leads', 'personal-list'] });
            queryClient.invalidateQueries({ queryKey: ['dashboard', 'executive'] });
            queryClient.invalidateQueries({ queryKey: ['dashboard', 'industry-manager'] });
            queryClient.invalidateQueries({ queryKey: ['activities'], exact: false });
            queryClient.invalidateQueries({ queryKey: ['lead-activity', activeLead?._id] });
            advanceToNext();
          }}
        />
      )}
    </div>
  );
};

export default MyWork;
