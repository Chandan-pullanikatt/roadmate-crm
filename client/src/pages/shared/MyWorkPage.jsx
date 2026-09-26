import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button, Tag, Modal, DashboardSkeleton } from '../../components/ui';
import { leadsApi } from '../../api/leadsApi';
import { attendanceApi } from '../../api/attendanceApi';
import { dashboardApi } from '../../api/dashboardApi';
import { tasksApi } from '../../api/tasksApi';
import { usersApi } from '../../api/usersApi';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../hooks/useSocket';

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
// The queue endpoint already excludes them; this is the client-side guard for
// anything that slips through a stale cache.
const CLOSED_STATUSES = [
  'converted', 'lost', 'not_interested',
  'blocking_amount_received', 'full_amount_received', 'agreement_signed',
];

// A lead parked on one of these sub-statuses is not an ordinary call: it is a
// meeting-confirmation task pushed by cron, and the role that owns those (the
// District Manager) answers it through its own wizard.
const CONFIRM_SUBSTATUS = ['pre_meeting_confirm', 'day_before_confirm', 'day_before_queued', '30m_confirm_queued'];

const DEFAULT_NAV_TARGETS = {
  myLeads:     '/dashboard?page=leads',
  completed:   '/dashboard?page=leads&completedToday=true',
  calls:       '/dashboard?page=leads',
  conversions: '/dashboard?page=leads&status=converted&period=month',
  blocking:    '/dashboard?page=leads&status=blocking_amount_received',
};

/**
 * The personal work page, shared by the Industry Manager, the State Manager and
 * the District Manager. All three do the same job here -- five summary cards, the
 * active lead beside today's queue, the tasks allocated to them and their
 * strategy log -- and the API scopes every query to the caller, so one component
 * serves all of them. Keeping one copy is what stops the three pages drifting:
 * each used to carry its own hand-written layout, its own card set and its own
 * queue arithmetic.
 *
 * Only the wording, the allocation target and the feedback dialog differ, and
 * those arrive as props.
 */
const MyWorkPage = ({
  // Trailing scope in the page title (an industry, a state, a district).
  scopeLabel,
  subtitle,
  startPrompt = 'Leads appear one-by-one · Direct meetings first, then follow-ups, then new leads',
  queueSubtitle = 'Direct meetings → Follow-ups → New leads',
  // The role's own Call Feedback dialog: the outcome set differs per role.
  FeedbackModal,
  // Optional wizard for cron-pushed meeting-confirmation tasks (District Manager).
  ConfirmTaskWizard = null,
  // Who this role may hand a lead down to, or null when it has no one below it.
  // { role, fieldLabel, emptyMsg }
  allocate = null,
  // Capture a work-from-home declaration when starting the day.
  wfhCapture = false,
  // Where each summary card's "View Full Details" goes, per role's own sidebar.
  navTargets = DEFAULT_NAV_TARGETS,
  // Role dashboard caches to refresh after a lead is actioned.
  extraInvalidateKeys = [],
}) => {
  const queryClient = useQueryClient();
  const { addToast } = useToast();
  const { user: currentUser } = useAuth();
  const navigate = useNavigate();
  const socket = useSocket();

  const [activeLeadId, setActiveLeadId] = useState(null);
  const [queueComplete, setQueueComplete] = useState(false);
  const [taskFilter, setTaskFilter] = useState('All');
  const [summaryModal, setSummaryModal] = useState(null);
  const [leadDetailOpen, setLeadDetailOpen] = useState(false);
  const [allocateOpen, setAllocateOpen] = useState(false);
  const [allocateUserId, setAllocateUserId] = useState('');
  const [strategyNote, setStrategyNote] = useState('');

  // Work-from-home declaration, asked once when the day is started.
  const [wfhOpen, setWfhOpen] = useState(false);
  const [wfhData, setWfhData] = useState({ isWFH: false, location: '', reason: '', description: '' });

  // Call feedback modal state
  const [feedbackModal, setFeedbackModal] = useState({ open: false, outcome: null });
  const openFeedback = (outcome) => setFeedbackModal({ open: true, outcome });
  const closeFeedback = () => setFeedbackModal({ open: false, outcome: null });

  // 1. Personal stats (work attendance, personal completions, strategy logs)
  const { data: dashData, isLoading: dashLoading, isFetching: dashFetching } = useQuery({
    queryKey: ['dashboard', 'executive'],
    queryFn: () => dashboardApi.getExecutiveDashboard().then(res => res.data),
    staleTime: 5 * 60 * 1000,
    placeholderData: (prev) => prev
  });

  // 2. The work queue: open leads only, ordered meetings -> follow-ups -> new,
  //    each tagged with whether it has already been worked today.
  const { data: queueData, isFetching: queueFetching } = useQuery({
    queryKey: ['leads', 'my-work-queue'],
    queryFn: () => leadsApi.getLeadQueue().then(res => res.data),
    staleTime: 0,
    placeholderData: (prev) => prev
  });

  // 3. Every lead owned by this user, closed ones included -- the denominator the
  //    summary cards and the queue footer count against.
  const { data: allLeadsData, isFetching: allLeadsFetching } = useQuery({
    queryKey: ['leads', 'personal-list'],
    queryFn: () => leadsApi.getLeads({ owner: 'self', limit: 2000 }).then(res => res.data),
    staleTime: 0,
    placeholderData: (prev) => prev
  });

  // 4. Tasks allocated to this user
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

  const startTaskMutation = useMutation({
    mutationFn: (id) => tasksApi.startTask(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      addToast('Task moved to In Progress', 'success');
    },
  });

  // The team members this role may allocate a lead down to (inline allocate modal)
  const { data: teamUsersData } = useQuery({
    queryKey: ['users', 'allocate-team', allocate?.role, currentUser?._id],
    queryFn: () => usersApi.getUsers({ role: allocate.role, reportingTo: currentUser._id }).then(r => r.data),
    enabled: allocateOpen && !!allocate?.role && !!currentUser?._id,
    staleTime: 5 * 60 * 1000,
  });

  const refreshLeadCaches = () => {
    queryClient.invalidateQueries({ queryKey: ['leads', 'my-work-queue'] });
    queryClient.invalidateQueries({ queryKey: ['leads', 'personal-list'] });
  };

  const allocateLeadMutation = useMutation({
    mutationFn: ({ leadId, userId }) => leadsApi.allocateLead(leadId, userId),
    onSuccess: () => {
      refreshLeadCaches();
      addToast('Lead allocated successfully!', 'success');
      setAllocateOpen(false);
      setAllocateUserId('');
    },
    onError: (err) => addToast(err?.response?.data?.message || 'Allocation failed', 'error'),
  });

  // The active work queue. The active lead is tracked by _id (not array position)
  // so a refetch or a tab-switch remount can never resurface a completed lead as
  // the active one.
  const workQueue = useMemo(
    () => (queueData?.queue || []).filter(l => !CLOSED_STATUSES.includes(l.status)),
    [queueData]
  );
  // Still to be worked today. The rest stay in the list so the numbering and the
  // day's tally hold, but they are not handed out as the active lead again.
  const pendingQueue = useMemo(() => workQueue.filter(l => !l.workedToday), [workQueue]);

  const activeLead = workQueue.find(l => l._id === activeLeadId) || null;
  const activeIndex = workQueue.findIndex(l => l._id === activeLeadId);

  // Keep the active selection valid: hold whatever the user picked as long as it
  // is still in the queue, otherwise fall back to the first lead still pending,
  // and to nothing at all once the day's work is done. Recovers automatically
  // when the current lead leaves the queue (actioned, allocated, closed).
  useEffect(() => {
    if (queueComplete) return;
    if (activeLeadId && workQueue.some(l => l._id === activeLeadId)) return;
    if (workQueue.length === 0) {
      if (activeLeadId !== null) setActiveLeadId(null);
      return;
    }
    setActiveLeadId(pendingQueue[0]?._id ?? null);
  }, [workQueue, pendingQueue, activeLeadId, queueComplete]);

  // Next lead to work after `fromId`: the following pending one in queue order,
  // wrapping back to the top so finishing the last row returns to the leads above
  // it instead of ending the day. null when nothing is left.
  const nextPendingAfter = (fromId) => {
    if (workQueue.length === 0) return null;
    const start = workQueue.findIndex(l => l._id === fromId);
    for (let step = 1; step <= workQueue.length; step++) {
      const candidate = workQueue[(start + step) % workQueue.length];
      if (candidate && candidate._id !== fromId && !candidate.workedToday) return candidate._id;
    }
    return null;
  };

  const advanceToNext = () => {
    const next = nextPendingAfter(activeLeadId);
    if (next) {
      setActiveLeadId(next);
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
    const handleLeadRefresh = () => refreshLeadCaches();
    window.addEventListener('refresh-leads', handleLeadRefresh);
    return () => window.removeEventListener('refresh-leads', handleLeadRefresh);
  }, [queryClient]);

  // Cron pushes two kinds of timed work into the queue -- an hourly RNR retry
  // before a meeting, and a meeting confirmation call. Both arrive over the
  // socket, so the queue has to refetch rather than wait for the next poll.
  useEffect(() => {
    if (!socket) return;
    const handleRetry = ({ leadName, meetingAt }) => {
      refreshLeadCaches();
      const timeStr = new Date(meetingAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      addToast(`⏰ Retry: "${leadName}" — call again before meeting at ${timeStr}`, 'warning');
    };
    const handleConfirmTask = ({ leadName, meetingAt, taskType }) => {
      refreshLeadCaches();
      const timeStr = new Date(meetingAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      addToast(
        taskType === '30m_vm_confirm'
          ? `⚡ 30-min check: Call "${leadName}" before virtual meeting at ${timeStr}`
          : `📅 Confirm tomorrow's meeting: "${leadName}" at ${timeStr}`,
        'warning'
      );
    };
    socket.on('lead:dm_retry', handleRetry);
    socket.on('lead:confirmation_task', handleConfirmTask);
    return () => {
      socket.off('lead:dm_retry', handleRetry);
      socket.off('lead:confirmation_task', handleConfirmTask);
    };
  }, [socket, queryClient, addToast]);

  const startWorkMutation = useMutation({
    mutationFn: (payload) => attendanceApi.startWork(payload),
    onSuccess: (res) => {
      const data = res?.data || res;
      if (data?.isLateHalfDay) {
        addToast(`Late login: ${data.lateLoginMinutes} min late — today will be marked Half Day.`, 'warning');
      } else if (data?.isLateLogin) {
        addToast(`Late Coming: ${data.lateLoginMinutes} min late.`, 'warning');
      } else {
        addToast("Work started! Good luck.", "success");
      }
      queryClient.invalidateQueries({ queryKey: ['dashboard'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['attendance'], exact: false });
      refreshLeadCaches();
      setWfhOpen(false);
    }
  });

  const endWorkMutation = useMutation({
    mutationFn: attendanceApi.endWork,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['attendance'], exact: false });
      addToast("Work ended. Great job today!", "info");
    }
  });

  const saveStrategyMutation = useMutation({
    mutationFn: (note) => dashboardApi.saveStrategy({ note }),
    onSuccess: () => {
      setStrategyNote('');
      queryClient.invalidateQueries({ queryKey: ['dashboard', 'executive'] });
      addToast("Strategy logged", "success");
    }
  });

  const goToLead = (leadId) => {
    if (!leadId) return;
    navigate(`/leads/${leadId}`);
  };

  /** Prefer non-empty drilldown list; the API returns [] for a card with no rows. */
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
  const isRefreshing = dashFetching || queueFetching || allLeadsFetching;

  const todayStats = dashData?.todayStats || {};
  const weeklyStats = dashData?.weeklyStats || {};
  const monthlyStats = dashData?.monthlyStats || {};
  const summaryDrilldowns = dashData?.summaryDrilldowns || {};
  // Every metric on this page comes off the same personal source (the executive
  // dashboard, which scopes itself to whoever calls it) so counts can't flip
  // between caches.
  const personalCallRows = pickCallRows(summaryDrilldowns.calls?.rows, []);
  const personalCallsCount = summaryDrilldowns.calls?.count ?? personalCallRows.length;
  const personalCallGrowth = weeklyStats.callGrowth ?? 0;

  const recentActivity = activityData?.activities || [];

  const isConfirmTask = !!(ConfirmTaskWizard && activeLead?.subStatus && CONFIRM_SUBSTATUS.includes(activeLead.subStatus));
  const isVirtualMeeting = activeLead?.status === 'meeting_virtual' && !!activeLead?.meetingLink;

  const handleLeadActioned = () => {
    refreshLeadCaches();
    queryClient.invalidateQueries({ queryKey: ['dashboard', 'executive'] });
    extraInvalidateKeys.forEach(key => queryClient.invalidateQueries({ queryKey: key }));
    queryClient.invalidateQueries({ queryKey: ['activities'], exact: false });
    if (activeLead?._id) queryClient.invalidateQueries({ queryKey: ['lead-activity', activeLead._id] });
  };

  const onStartWorkClick = () => {
    if (workStarted) {
      endWorkMutation.mutate(dashData?.attendance?._id);
    } else if (wfhCapture) {
      setWfhOpen(true);
    } else {
      startWorkMutation.mutate();
    }
  };

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-500">

      {/* Sub Header / Work Status */}
      <div className="bg-surface border border-border/60 rounded-2xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm">
        <div>
          <h2 className="text-lg font-bold text-text-primary flex items-center gap-2">
            My Work — {currentUser?.name}{scopeLabel ? ` · ${scopeLabel}` : ''}
            {isRefreshing && (
              <span className="inline-flex items-center gap-1 text-[12px] font-semibold text-text-muted bg-surface2 px-2 py-0.5 rounded-full">
                <svg className="w-2.5 h-2.5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" strokeLinecap="round"/>
                </svg>
                Loading
              </span>
            )}
          </h2>
          <p className="text-[14px] text-text-muted mt-0.5">{subtitle}</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <span
            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-[12px] font-bold uppercase tracking-wider
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
              <span className="text-[11px] text-text-muted uppercase tracking-widest font-bold leading-none">
                {workCompleted ? 'Final' : 'Live'}
              </span>
            </div>
          )}

          {workStarted && dashData?.attendance?.isWFH && (
            <span className="px-2 py-0.5 bg-orange/10 text-orange rounded-full text-[10px] uppercase font-black">
              Working From Home
            </span>
          )}

          <Button
            className={`${workStarted ? 'bg-red' : 'bg-purple'} text-white border-none rounded-xl px-6 h-9 font-bold`}
            onClick={onStartWorkClick}
            disabled={workCompleted || startWorkMutation.isPending || endWorkMutation.isPending}
          >
            {workStarted ? '■ Stop Work' : workCompleted ? 'Work Ended' : '▶ Start Work'}
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
                  <div className="text-[12px] sm:text-[13px] font-bold text-text-muted uppercase tracking-wider mb-2 sm:mb-3 leading-tight">
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
                  <div className="text-[12px] sm:text-[13px] font-medium text-text-muted leading-tight truncate">
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

      {/* ── MAIN TWO-COLUMN: Active Lead | Today's Queue ── */}
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
                  <div className="text-[13px] text-text-muted">
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
                {allocate && workStarted && activeLead && (
                  <button
                    onClick={() => { setAllocateOpen(true); setAllocateUserId(''); }}
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
                  <p className="text-[14px] text-text-muted max-w-xs">{startPrompt}</p>
                </div>
              ) : isQueueEmpty ? (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <div className="text-4xl mb-3">✅</div>
                  <h4 className="text-base font-bold">Queue Completed!</h4>
                  <p className="text-[14px] text-text-muted mt-1">You've worked through all your tasks for now.</p>
                </div>
              ) : queueComplete || (!activeLead && pendingQueue.length === 0) ? (
                <div className="flex flex-col items-center justify-center py-10 text-center gap-3">
                  <div className="text-4xl">🙌</div>
                  <h4 className="text-base font-bold">All work done for today!</h4>
                  <p className="text-[14px] text-text-muted">You've worked every lead in your queue.</p>
                  <Button
                    variant="outline"
                    onClick={() => { setQueueComplete(false); setActiveLeadId(workQueue[0]?._id ?? null); }}
                    className="rounded-xl px-5 h-9 font-bold"
                  >
                    Restart Queue
                  </Button>
                </div>
              ) : !activeLead ? (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <div className="text-[16px] text-text-muted italic">Loading next lead…</div>
                </div>
              ) : isConfirmTask ? (
                /* Meeting confirmation task — answered through the role's wizard */
                <ConfirmTaskWizard
                  lead={activeLead}
                  onComplete={() => { handleLeadActioned(); advanceToNext(); }}
                  queueLength={workQueue.length}
                  currentIndex={activeIndex + 1}
                />
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
                      <span className="ml-2 text-[13px] font-semibold text-text-muted opacity-0 group-hover:opacity-60 transition-opacity">↗ Details</span>
                    </button>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className="text-[14px] text-text-muted">Contact: <span className="font-semibold text-text-primary">{activeLead.name}</span></span>
                      <span className="w-1 h-1 rounded-full bg-border2" />
                      <span className="text-xs text-purple font-bold">{activeLead.phone}</span>
                    </div>
                  </div>

                  {/* Virtual meeting link — joined from here rather than hunted for */}
                  {isVirtualMeeting && (
                    <div className="mb-5 flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl bg-blue/5 border border-blue/15">
                      <span className="text-[13px] text-text-muted truncate">{activeLead.meetingLink}</span>
                      <a
                        href={activeLead.meetingLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="shrink-0 px-3 py-1.5 rounded-lg bg-blue text-white text-[11px] font-bold uppercase tracking-wider hover:opacity-90"
                      >
                        Join →
                      </a>
                    </div>
                  )}

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
                            <div className="text-[11px] font-bold text-text-muted uppercase tracking-wider mb-1">{f.label}</div>
                            <div className={`text-sm font-bold ${f.colored ? getStatusColor(activeLead.status) : 'text-text-primary'}`}>{f.value}</div>
                          </div>
                        ))}
                      </div>

                      {/* Call Done · RNR · Meeting Done · Skip */}
                      <div className="grid grid-cols-2 gap-2.5">
                        <button
                          onClick={() => openFeedback('connected')}
                          className="flex flex-col items-center gap-1.5 p-3.5 rounded-xl border-2 border-border bg-surface hover:border-green hover:bg-green/5 transition-all group cursor-pointer"
                        >
                          <span className="text-xl">✓</span>
                          <span className="text-[13px] font-bold text-text-secondary group-hover:text-green">Call Done</span>
                        </button>
                        <button
                          onClick={() => openFeedback('rnr')}
                          className="flex flex-col items-center gap-1.5 p-3.5 rounded-xl border-2 border-border bg-surface hover:border-red hover:bg-red/5 transition-all group cursor-pointer"
                        >
                          <span className="text-xl">📵</span>
                          <span className="text-[13px] font-bold text-text-secondary group-hover:text-red">RNR</span>
                        </button>
                        <button
                          onClick={() => openFeedback('meeting_done')}
                          className="flex flex-col items-center gap-1.5 p-3.5 rounded-xl border-2 border-border bg-surface hover:border-blue hover:bg-blue/5 transition-all group cursor-pointer"
                        >
                          <span className="text-xl">🤝</span>
                          <span className="text-[13px] font-bold text-text-secondary group-hover:text-blue">Meeting Done</span>
                        </button>
                        <button
                          onClick={advanceToNext}
                          className="flex flex-col items-center gap-1.5 p-3.5 rounded-xl border-2 border-border bg-surface hover:border-purple hover:bg-purple/5 transition-all group cursor-pointer"
                        >
                          <span className="text-xl">⏭️</span>
                          <span className="text-[13px] font-bold text-text-secondary group-hover:text-purple">Skip for Now</span>
                        </button>
                      </div>
                    </div>

                    {/* Right: Interaction history */}
                    <div>
                      <div className="text-[12px] font-bold text-text-muted uppercase tracking-wider mb-3">Interaction History</div>
                      <div className="relative pl-4">
                        <div className="absolute left-1.5 top-1 bottom-1 w-px bg-border/60" />
                        {recentActivity.length > 0 ? (
                          recentActivity.slice(0, 5).map((a, i) => (
                            <div key={i} className="relative mb-3.5">
                              <div className={`absolute -left-[13px] top-1 w-2.5 h-2.5 rounded-full border-2 border-white ${i === 0 ? 'bg-blue' : 'bg-border2'}`} />
                              <div className="text-xs font-bold text-text-primary">
                                {new Date(a.createdAt || a.timestamp).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                              </div>
                              <div className="text-[13px] text-text-secondary mt-0.5 leading-relaxed">
                                {a.action?.replace(/_/g, ' ')}
                                {a.note ? ` — ${a.note.slice(0, 60)}${a.note.length > 60 ? '…' : ''}` : ''}
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="text-[14px] text-text-muted italic">No activity yet for this lead.</div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT: Queue */}
        <div className="flex flex-col gap-5">
          {/* Today's Queue */}
          <div className="card overflow-hidden flex-1">
            <div className="px-5 py-4 border-b border-border/50 flex items-center justify-between">
              <div>
                <div className="font-bold text-sm text-text-primary">Today's Queue · My Leads</div>
                <div className="text-[12px] text-text-muted uppercase font-bold tracking-widest mt-0.5">{queueSubtitle}</div>
              </div>
            </div>
            <div className="divide-y divide-border/40 max-h-[280px] overflow-y-auto">
              {workQueue.map((lead, idx) => {
                const done = !!lead.workedToday;
                const isActive = activeLead?._id === lead._id;
                return (
                  <div
                    key={lead._id}
                    role="button"
                    tabIndex={0}
                    aria-current={isActive ? 'true' : undefined}
                    onClick={() => { setQueueComplete(false); setActiveLeadId(lead._id); }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setQueueComplete(false);
                        setActiveLeadId(lead._id);
                      }
                    }}
                    title={done ? `${lead.company || lead.name} is done for today` : `Work ${lead.company || lead.name} next`}
                    className={`px-5 py-3.5 flex items-center gap-3 cursor-pointer transition-all hover:bg-surface2/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple/30 ${done ? 'opacity-60' : ''} ${isActive ? 'bg-purple-light/20 border-l-4 border-purple' : 'border-l-4 border-transparent'}`}
                  >
                    <div className={`text-[12px] font-bold w-5 shrink-0 ${done ? 'text-green' : 'text-text-muted'}`}>
                      {done ? '✓' : idx + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className={`text-sm font-bold truncate ${done ? 'text-text-muted line-through' : 'text-text-primary'}`}>
                        {lead.company || lead.name}
                      </div>
                      <div className="text-[13px] text-text-muted truncate">{lead.district} · {lead.name}</div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-[12px] font-bold text-text-muted">
                        {(lead.meetingAt || lead.nextActionAt || lead.followUpDate)
                          ? new Date(lead.meetingAt || lead.nextActionAt || lead.followUpDate)
                              .toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                          : '—'}
                      </div>
                      <div className={`text-[9px] font-bold uppercase tracking-tighter mt-0.5 ${done ? 'text-green' : getStatusColor(lead.status)}`}>
                        {done ? 'done' : lead.status?.replace(/_/g, ' ')}
                      </div>
                    </div>
                  </div>
                );
              })}
              {isQueueEmpty && <div className="p-10 text-center text-text-muted text-[16px] italic">Queue empty</div>}
            </div>
            <div className="px-5 py-3 bg-surface2/50 border-t border-border/40 text-center">
              <span className="text-[12px] font-bold text-text-muted uppercase tracking-widest">
                {todayStats.completedLeads || 0}/{myQueue.length} completed today · {pendingQueue.length} in queue
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── ALLOCATED TASKS ── */}
      <div className="card overflow-hidden">
        <div className="px-6 py-5 border-b border-border/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="font-bold text-sm text-text-primary">Allocated Tasks</div>
            <div className="text-[13px] text-text-muted mt-0.5">
              Tasks assigned to you · {(tasksData?.tasks || []).filter(t => t.status !== 'completed').length} pending
            </div>
          </div>
          <div className="flex bg-surface2 p-1 rounded-lg border border-border/40">
            {['All', 'Pending', 'In Progress', 'Overdue'].map(tab => (
              <button
                key={tab}
                onClick={() => setTaskFilter(tab)}
                className={`px-3.5 py-1.5 text-[12px] font-bold rounded-md transition-all ${taskFilter === tab ? 'bg-white shadow-sm text-purple' : 'text-text-muted hover:text-text-primary'}`}
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
                  <th key={i} className="px-5 py-3.5 text-[12px] font-black text-text-muted uppercase tracking-widest whitespace-nowrap">{h}</th>
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
                      <div className={`text-[16px] font-bold truncate ${isDone ? 'line-through text-text-muted' : 'text-text-primary'}`}>
                        {task.title}
                      </div>
                      {task.description && (
                        <div className="text-[13px] text-text-muted mt-0.5 truncate max-w-[260px]">
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
                        <span className="text-[14px] text-text-secondary font-medium">
                          {task.assignedBy?.name || '—'}
                        </span>
                      </div>
                    </td>

                    {/* Due date */}
                    <td className="px-5 py-3.5 whitespace-nowrap">
                      <div className={`text-xs font-bold ${isOverdue ? 'text-red' : 'text-text-primary'}`}>
                        {new Date(task.endDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </div>
                      <div className="text-[12px] text-text-muted mt-0.5">{task.endTime}</div>
                    </td>

                    {/* Priority badge */}
                    <td className="px-5 py-3.5">
                      <span className={`px-2 py-0.5 rounded-md text-[12px] font-bold uppercase tracking-tight ${PRIORITY_STYLE[task.priority] || 'bg-surface2 text-text-muted'}`}>
                        {task.priority}
                      </span>
                    </td>

                    {/* Status badge */}
                    <td className="px-5 py-3.5">
                      <span className={`px-2.5 py-1 rounded-lg text-[12px] font-bold uppercase tracking-tight ${TASK_STATUS_STYLE[task.status] || 'bg-surface2 text-text-muted'}`}>
                        {task.status.replace(/_/g, ' ')}
                      </span>
                    </td>

                    {/* Action */}
                    <td className="px-5 py-3.5 whitespace-nowrap">
                      {(task.status === 'pending' || isOverdue) && (
                        <button
                          onClick={() => startTaskMutation.mutate(task._id)}
                          disabled={startTaskMutation.isPending}
                          className="mr-2 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider border border-blue/30 text-blue rounded-lg hover:bg-blue/5 transition-colors disabled:opacity-40"
                        >
                          Start
                        </button>
                      )}
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
              <p className="text-[16px] font-medium text-text-muted">
                {taskFilter === 'All' ? 'No tasks allocated yet' : `No ${taskFilter.toLowerCase()} tasks`}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Strategy Log */}
      <div className="card overflow-hidden flex flex-col">
        <div className="px-6 py-5 border-b border-border/50">
          <div className="font-bold text-sm text-text-primary">My Strategy Log</div>
        </div>
        <div className="flex-1 p-5 space-y-4">
          <p className="text-[12px] text-text-muted uppercase font-bold tracking-widest">What strategy worked for recent conversions?</p>
          <div className="space-y-2.5 max-h-[160px] overflow-y-auto pr-1">
            {dashData?.strategyLogs?.map((log, idx) => (
              <div key={idx} className="p-3 bg-green/5 border border-green/10 rounded-xl">
                <div className="flex justify-between items-start mb-1">
                  <div className="text-xs font-bold text-text-primary">{log.leadName}</div>
                  <Tag variant="green" label="Converted" className="text-[8px] py-0 px-1.5" />
                </div>
                <div className="text-[13px] text-text-muted italic leading-relaxed">Strategy: {log.strategy}</div>
              </div>
            ))}
            {(!dashData?.strategyLogs || dashData.strategyLogs.length === 0) && (
              <div className="p-4 text-center text-text-muted text-[13px] italic">No recent conversions logged</div>
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
            navTarget: navTargets.myLeads,
            emptyMsg: 'No leads in your queue today.',
          },
          completed: {
            title: 'Completed Today',
            subtitle: `${completedLeads.length} leads actioned today`,
            color: '#059669',
            leads: completedLeads.slice(0, 20),
            navTarget: navTargets.completed,
            emptyMsg: 'No completed leads found for today.',
          },
          calls: {
            title: 'Calls This Week',
            subtitle: `${callRows.length} calls made`,
            color: '#2563EB',
            callRows,
            navTarget: navTargets.calls,
            emptyMsg: 'No calls found this week.',
          },
          conversions: {
            title: 'My Conversions',
            subtitle: `${monthlyStats.converted || 0} conversions this month`,
            color: '#0D9488',
            leads: conversionLeads.slice(0, 20),
            navTarget: navTargets.conversions,
            emptyMsg: 'No conversions recorded yet.',
          },
          blocking: {
            title: 'Blocking Amount Received',
            subtitle: `${blockingLeads.length} leads with blocking payment`,
            color: '#D97706',
            leads: blockingLeads.slice(0, 20),
            navTarget: navTargets.blocking,
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
                <div className="text-[14px] text-text-muted mt-0.5">{cfg.subtitle}</div>
              </div>
            </div>

            {/* Lead list OR stat-only message */}
            {cfg.callRows ? (
              cfg.callRows.length === 0 ? (
                <div className="py-8 text-center">
                  <div className="text-3xl mb-3">📞</div>
                  <p className="text-[16px] text-text-muted">{cfg.emptyMsg}</p>
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
                          <div className="text-[13px] text-text-muted truncate">{lead?.district || '—'} · {row.note || 'Call logged'}</div>
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
                <p className="text-[16px] text-text-muted">{cfg.emptyMsg}</p>
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
                      <div className="text-[13px] text-text-muted truncate">
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

      {/* Work-from-home declaration, asked when the day is started */}
      {wfhOpen && (
        <Modal
          isOpen
          title="Start Work"
          subtitle="Declare where you are working from today"
          onClose={() => setWfhOpen(false)}
          className="max-w-sm"
        >
          <div className="p-3 bg-surface2 rounded-xl border border-border/40 mb-5 flex items-center justify-between gap-3">
            <div className="text-sm font-bold text-text-primary">Working from home today?</div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                className="sr-only peer"
                checked={wfhData.isWFH}
                onChange={(e) => setWfhData({ ...wfhData, isWFH: e.target.checked })}
              />
              <div className="w-11 h-6 bg-border2 rounded-full peer peer-checked:bg-orange peer-focus:outline-none after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:border-border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full peer-checked:after:border-white" />
            </label>
          </div>

          {wfhData.isWFH && (
            <div className="space-y-3 mb-5 animate-in slide-in-from-top-2 duration-300">
              <div>
                <label className="block text-[11px] font-bold text-text-muted uppercase tracking-wider mb-1.5">Current Location</label>
                <input
                  type="text"
                  className="input w-full"
                  placeholder="Where are you working from?"
                  value={wfhData.location}
                  onChange={e => setWfhData({ ...wfhData, location: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-text-muted uppercase tracking-wider mb-1.5">Reason</label>
                <input
                  type="text"
                  className="input w-full"
                  placeholder="e.g. Travel, Health"
                  value={wfhData.reason}
                  onChange={e => setWfhData({ ...wfhData, reason: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-text-muted uppercase tracking-wider mb-1.5">Work Description</label>
                <input
                  type="text"
                  className="input w-full"
                  placeholder="What's the plan?"
                  value={wfhData.description}
                  onChange={e => setWfhData({ ...wfhData, description: e.target.value })}
                />
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t border-border/40">
            <Button variant="outline" onClick={() => setWfhOpen(false)}>Cancel</Button>
            <Button
              className="bg-purple text-white border-none"
              disabled={startWorkMutation.isPending}
              onClick={() => startWorkMutation.mutate(wfhData)}
            >
              {startWorkMutation.isPending ? 'Starting…' : '▶ Start Work'}
            </Button>
          </div>
        </Modal>
      )}

      {/* Team Allocate Modal — only the people reporting to this user */}
      {allocate && activeLead && allocateOpen && (
        <Modal
          isOpen
          title="Allocate Lead"
          subtitle={`Assign to a ${allocate.fieldLabel?.toLowerCase() || 'team member'} in your team`}
          onClose={() => { setAllocateOpen(false); setAllocateUserId(''); }}
          className="max-w-sm"
        >
          <div className="p-3 bg-surface2 rounded-xl border border-border/40 mb-5">
            <div className="text-sm font-bold text-text-primary">{activeLead.company || activeLead.name}</div>
            <div className="text-[13px] text-text-muted mt-0.5">{activeLead.district} · {activeLead.phone}</div>
          </div>

          <div className="space-y-2 mb-6">
            <label className="block text-[14px] font-bold text-text-secondary mb-1.5">
              Select {allocate.fieldLabel || 'Team Member'} <span className="text-red">*</span>
            </label>
            <select
              className="select w-full"
              value={allocateUserId}
              onChange={e => setAllocateUserId(e.target.value)}
            >
              <option value="">— Choose from your team —</option>
              {(teamUsersData || []).map(u => (
                <option key={u._id} value={u._id}>{u.name} · {u.district || u.industry || u.state}</option>
              ))}
            </select>
            {teamUsersData?.length === 0 && (
              <p className="text-[11px] text-amber font-medium mt-1">
                {allocate.emptyMsg || 'No team members found in your team.'}
              </p>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-border/40">
            <Button variant="outline" onClick={() => { setAllocateOpen(false); setAllocateUserId(''); }}>
              Cancel
            </Button>
            <Button
              className="bg-purple text-white border-none"
              disabled={!allocateUserId || allocateLeadMutation.isPending}
              onClick={() => allocateLeadMutation.mutate({ leadId: activeLead._id, userId: allocateUserId })}
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
              { label: 'Source',   value: activeLead.source || activeLead.leadSource || '—' },
              { label: 'Priority', value: activeLead.priority?.toUpperCase() || '—' },
              { label: 'Status',   value: activeLead.status?.replace(/_/g, ' ') || '—' },
              { label: 'Phone',    value: activeLead.phone || '—' },
            ].map(f => (
              <div key={f.label} className="p-3 rounded-xl bg-surface2 border border-border/40">
                <div className="text-[11px] font-bold text-text-muted uppercase tracking-wider mb-1">{f.label}</div>
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
                <div className="text-[12px] font-bold text-text-muted uppercase tracking-wider mb-2">All Handlers</div>
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
            <div className="text-[12px] font-bold text-text-muted uppercase tracking-wider mb-3">Full Remarks History</div>
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
                    <div className="text-[13px] font-semibold text-text-secondary">
                      {a.action?.replace(/_/g, ' ')}
                    </div>
                    {a.note && (
                      <div className="text-[13px] text-text-muted mt-0.5 leading-relaxed bg-surface2 rounded-lg px-2.5 py-1.5 border border-border/40">
                        {a.note}
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <div className="py-6 text-center text-[16px] text-text-muted italic">No activity recorded yet.</div>
              )}
            </div>
          </div>
        </Modal>
      )}

      {/* Call Feedback Modal */}
      {activeLead && (
        <FeedbackModal
          isOpen={feedbackModal.open}
          onClose={closeFeedback}
          lead={activeLead}
          initialOutcome={feedbackModal.outcome}
          onSuccess={() => {
            handleLeadActioned();
            advanceToNext();
          }}
        />
      )}
    </div>
  );
};

export default MyWorkPage;
