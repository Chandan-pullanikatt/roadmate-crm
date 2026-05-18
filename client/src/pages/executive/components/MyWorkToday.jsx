import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { attendanceApi } from '../../../api/attendanceApi';
import { leadsApi } from '../../../api/leadsApi';
import { dashboardApi } from '../../../api/dashboardApi';
import { useAuth } from '../../../hooks/useAuth';
import { useToast } from '../../../context/ToastContext';
import { useSocket } from '../../../hooks/useSocket';
import LeadWizard from './LeadWizard';
import ExecCallFeedbackModal from './ExecCallFeedbackModal';

const MyWorkToday = () => {
  const queryClient = useQueryClient();
  const { addToast } = useToast();
  const { user } = useAuth();
  const socket = useSocket();
  const [wfhData, setWfhData] = useState({ isWFH: false, location: '', reason: '', description: '' });

  // Refresh queue immediately when a DM-day hourly retry is due
  useEffect(() => {
    if (!socket) return;
    const handleDMRetry = ({ leadName, meetingAt }) => {
      queryClient.invalidateQueries(['leads', 'workflow']);
      const timeStr = new Date(meetingAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      addToast(`⏰ Retry: "${leadName}" — call again before meeting at ${timeStr}`, 'warning');
    };
    socket.on('lead:dm_retry', handleDMRetry);
    return () => socket.off('lead:dm_retry', handleDMRetry);
  }, [socket, queryClient, addToast]);

  // Refresh queue when a meeting confirmation task is pushed by cron
  useEffect(() => {
    if (!socket) return;
    const handleConfirmTask = ({ leadName, meetingAt, taskType }) => {
      queryClient.invalidateQueries(['leads', 'workflow']);
      const timeStr = new Date(meetingAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const label = taskType === '30m_vm_confirm'
        ? `⚡ 30-min check: Call "${leadName}" before virtual meeting at ${timeStr}`
        : `📅 Confirm tomorrow's meeting: "${leadName}" at ${timeStr}`;
      addToast(label, 'warning');
    };
    socket.on('lead:confirmation_task', handleConfirmTask);
    return () => socket.off('lead:confirmation_task', handleConfirmTask);
  }, [socket, queryClient, addToast]);

  // 1. Fetch Today's Attendance
  const { data: attendanceData, refetch: refetchAttendance } = useQuery({
    queryKey: ['attendance', 'today'],
    queryFn: () => attendanceApi.getTodayAttendance().then(res => res.data)
  });

  // 2. Fetch Dashboard Metrics
  const { data: dashData } = useQuery({
    queryKey: ['dashboard', 'executive'],
    queryFn: () => dashboardApi.getExecutiveDashboard().then(res => res.data)
  });

  // 3. Fetch Workflow Queue
  const { data: workflow, isLoading } = useQuery({
    queryKey: ['leads', 'workflow'],
    queryFn: () => leadsApi.getLeadQueue().then(res => res.data),
    enabled: !!attendanceData?.attendance?.workStartedAt && !attendanceData?.attendance?.workCompletedAt,
    refetchInterval: 30000
  });

  // Mutations
  const startWorkMutation = useMutation({
    mutationFn: attendanceApi.startWork,
    onSuccess: (res) => {
      const data = res?.data || res;
      if (data?.isLateLogin && data?.lateLoginMinutes) {
        addToast(
          `Late login: ${data.lateLoginMinutes} min past grace period — attendance may be marked half day.`,
          'warning'
        );
      } else {
        addToast("Workspace initialized. Let's make it count!", 'success');
      }
      refetchAttendance();
      queryClient.invalidateQueries(['leads', 'workflow']);
    }
  });

  const completeWorkMutation = useMutation({
    mutationFn: () => attendanceApi.completeWork(attendanceData?.attendance?._id),
    onSuccess: () => {
      addToast("Great work today! All logs synchronized.", "success");
      refetchAttendance();
      queryClient.invalidateQueries(['dashboard', 'executive']);
    }
  });

  // Derived
  const lead = workflow?.currentLead;
  const stats = dashData?.todayStats || {};
  const tasks = workflow?.taskSequence || [];
  const meetings = workflow?.todayMeetings || [];
  const activities = workflow?.activityFeed || [];
  const isWorking = !!attendanceData?.attendance?.workStartedAt && !attendanceData?.attendance?.workCompletedAt;
  const userName = user?.name || dashData?.user?.name || 'Executive';

  // Working state constants/flags (used both below and in the JSX)
  const CONFIRM_SUBSTATUS = ['pre_meeting_confirm', 'day_before_confirm', 'day_before_queued', '30m_confirm_queued'];
  const isConfirmTask = !!(lead?.subStatus && CONFIRM_SUBSTATUS.includes(lead.subStatus));
  const isVirtualLead = lead?.status === 'meeting_virtual';

  // Feedback modal state — must be here (before early returns) per Rules of Hooks
  const [feedbackModal, setFeedbackModal] = useState({ open: false, outcome: null });
  const openFeedback = (outcome) => setFeedbackModal({ open: true, outcome });
  const closeFeedback  = () => setFeedbackModal({ open: false, outcome: null });

  const handleLeadComplete = () => {
    queryClient.invalidateQueries(['leads', 'workflow']);
    queryClient.invalidateQueries(['dashboard', 'executive']);
  };

  // Per-lead interaction history — also must be at top level
  const { data: leadActivity } = useQuery({
    queryKey: ['lead-activity', lead?._id],
    queryFn: () => leadsApi.getLeadActivity(lead._id).then(r => r.data),
    enabled: !!lead?._id && !isConfirmTask,
    staleTime: 60 * 1000,
  });
  const recentHistory = leadActivity?.activities || [];

  // ─── STATE: Not Started ───
  if (!attendanceData?.attendance?.workStartedAt) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-10 animate-in">
        <div className="wizard-call-icon" style={{ background: 'linear-gradient(135deg, #D97706, #F59E0B)', marginBottom: 24 }}>💼</div>
        <h1 style={{ fontSize: 32, fontWeight: 900, letterSpacing: '-1px', marginBottom: 8 }}>Good Morning, {userName.split(' ')[0]}</h1>
        <p style={{ color: 'var(--text-muted)', maxWidth: 480, marginBottom: 32, fontSize: 14 }}>
          Your workspace is ready. Priority leads and scheduled meetings await your attention.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 40, width: '100%', maxWidth: 560 }}>
          <SummaryCard icon="📅" label="Meetings" count={stats.meetings || 0} color="#3B82F6" />
          <SummaryCard icon="🔥" label="Hot Pipeline" count={stats.hotPipelineCount || 0} color="#EF4444" />
          <SummaryCard icon="🌱" label="Assignments" count={stats.totalLeads || 0} color="#10B981" />
        </div>
        <div style={{ background: 'var(--surface2)', padding: 24, borderRadius: 20, width: '100%', maxWidth: 560, marginBottom: 32, border: '1px solid var(--border)' }}>
          <div className="flex items-center justify-between mb-4">
            <div className="text-sm font-bold">Working from home today?</div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" className="sr-only peer" checked={wfhData.isWFH} onChange={(e) => setWfhData({ ...wfhData, isWFH: e.target.checked })} />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange"></div>
            </label>
          </div>
          
          {wfhData.isWFH && (
            <div className="space-y-4 animate-in slide-in-from-top-2 duration-300">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-muted uppercase">Current Location</label>
                <input 
                  type="text" className="input bg-surface border-border/60" placeholder="Where are you working from?" 
                  value={wfhData.location} onChange={e => setWfhData({ ...wfhData, location: e.target.value })} 
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-muted uppercase">Reason</label>
                  <input 
                    type="text" className="input bg-surface border-border/60" placeholder="e.g. Travel, Health" 
                    value={wfhData.reason} onChange={e => setWfhData({ ...wfhData, reason: e.target.value })} 
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-muted uppercase">Work Description</label>
                  <input 
                    type="text" className="input bg-surface border-border/60" placeholder="What's the plan?" 
                    value={wfhData.description} onChange={e => setWfhData({ ...wfhData, description: e.target.value })} 
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        <button className="wizard-btn wizard-btn-orange" style={{ height: 52, padding: '0 48px', fontSize: 16, fontWeight: 800, borderRadius: 16 }}
          onClick={() => startWorkMutation.mutate(wfhData)} disabled={startWorkMutation.isPending}>
          {startWorkMutation.isPending ? 'INITIALIZING...' : '⚡ START MY WORK DAY'}
        </button>
      </div>
    );
  }

  // ─── STATE: Work Completed ───
  if (attendanceData?.attendance?.workCompletedAt) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-10 animate-in">
        <div className="wizard-complete-anim">
          <div style={{ fontSize: 64, marginBottom: 16 }}>🏆</div>
          <h1 style={{ fontSize: 32, fontWeight: 900, marginBottom: 8 }}>Great Work Today!</h1>
          <p style={{ color: 'var(--text-muted)', marginBottom: 24 }}>All logs are synchronized. See you tomorrow!</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, maxWidth: 400, margin: '0 auto' }}>
            <MiniStat label="Calls" value={stats.calls || 0} />
            <MiniStat label="Converted" value={stats.converted || 0} />
            <MiniStat label="Points" value={stats.points || 0} />
          </div>
        </div>
      </div>
    );
  }

  // ─── STATE: Working — Active Lead Card ───
  return (
    <div className="animate-in" style={{ animationDuration: '0.5s' }}>
      {/* Page Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 900, letterSpacing: '-0.5px' }}>Start My Work</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#10B981', animation: 'callPulse 2s infinite' }}></div>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)' }}>
              Session Active · {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}
              {attendanceData?.attendance?.isWFH && (
                <span className="ml-3 px-2 py-0.5 bg-orange/10 text-orange rounded-full text-[10px] uppercase font-black">Working From Home</span>
              )}
            </span>
          </div>
        </div>
        <button className="wizard-btn wizard-btn-secondary" onClick={() => completeWorkMutation.mutate()} disabled={completeWorkMutation.isPending}>
          {completeWorkMutation.isPending ? 'Completing...' : '✓ End Work Day'}
        </button>
      </div>

      {/* Top Metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 12, marginBottom: 20 }}>
        <MetricCard label="CONNECTED" value={`${stats.completedLeads || 0}/${stats.totalLeads || 0}`} color="#3B82F6" />
        <MetricCard label="REVENUE TODAY" value={stats.revenueToday ? `₹${(stats.revenueToday / 100000).toFixed(2)}L` : '₹0'} color="#059669" />
        <MetricCard label="HOT PIPELINE" value={stats.hotPipelineCount || 0} color="#DC2626" />
        <MetricCard label="CALLS" value={stats.calls || 0} color="#D97706" />
        <MetricCard label="CONVERSIONS" value={stats.converted || 0} color="#7C3AED" />
        <MetricCard
          label="ATTENDANCE"
          value={`${stats.completionPct || 0}%`}
          color={stats.completionPct < 50 ? '#DC2626' : '#0891B2'}
          sub={stats.completionPct < 50 ? '⚠️ Half-Day Payout' : null}
        />
        <MetricCard label="POINTS" value={stats.points || 0} color="#EF4444" />
      </div>

      {/* Main Layout: lead card (wide) + sidebar */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 20, alignItems: 'flex-start' }}>

        {/* LEFT: Active Lead Card */}
        <div>
          {isLoading ? (
            /* Loading skeleton */
            <div className="wizard-lead-card">
              <div className="wizard-lead-body" style={{ textAlign: 'center', padding: 60 }}>
                <div className="shimmer" style={{ width: 200, height: 24, borderRadius: 8, margin: '0 auto 12px' }}></div>
                <div className="shimmer" style={{ width: 300, height: 16, borderRadius: 8, margin: '0 auto' }}></div>
              </div>
            </div>
          ) : isConfirmTask ? (
            /* Meeting confirmation task — keep existing wizard */
            <LeadWizard lead={lead} onComplete={handleLeadComplete} queueLength={workflow?.queueLength || 0} currentIndex={1} />
          ) : lead ? (
            /* Normal lead — 2-col card matching design */
            <div className="wizard-lead-card">
              {/* Card header */}
              <div className="wizard-lead-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span className={`tag ${lead.status?.includes('meeting_virtual') ? 'tag-blue' : lead.status?.includes('meeting_direct') ? 'tag-amber' : 'tag-gray'}`} style={{ fontSize: 10 }}>
                    {lead.status?.includes('meeting') ? (lead.status.includes('virtual') ? '🎥 Virtual Meeting' : '🤝 Direct Meeting') : 'Call Lead'}
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>
                    TASK {(workflow?.queueLength || 1) - (workflow?.queueLength || 1) + 1} OF {workflow?.queueLength || 1}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  {lead.rnrCount > 0 && (
                    <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--amber)' }}>RNR ×{lead.rnrCount}</span>
                  )}
                  <button
                    className="btn-xs"
                    style={{ fontSize: 11, padding: '4px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface)', cursor: 'pointer', fontWeight: 600 }}
                    onClick={() => window.dispatchEvent(new CustomEvent('open-modal', { detail: { type: 'lead-history', leadId: lead._id, leadName: lead.company || lead.name } }))}
                  >
                    📋 Full History
                  </button>
                </div>
              </div>

              {/* 2-column body */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 260px', borderTop: 'none' }}>

                {/* LEFT panel: lead info + actions */}
                <div className="wizard-lead-body" style={{ borderRight: '1px solid var(--border)', paddingRight: 24 }}>
                  {/* Lead name & badges */}
                  <h2 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.5px', marginBottom: 8 }}>{lead.company || lead.name}</h2>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
                    {lead.priority === 'hot' && <span className="tag tag-red" style={{ fontSize: 10 }}>HOT Lead</span>}
                    {lead.industry && <span className="tag tag-gray" style={{ fontSize: 10 }}>{lead.industry}</span>}
                    {lead.source && <span className="tag tag-gray" style={{ fontSize: 10 }}>Ref: {lead.source}</span>}
                    {lead.meetingAt && (
                      <span className={`tag ${isVirtualLead ? 'tag-blue' : 'tag-amber'}`} style={{ fontSize: 10 }}>
                        {isVirtualLead ? '🎥 Virtual' : '📍 Direct'} · {new Date(lead.meetingAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    )}
                  </div>

                  {/* Client brief / notes */}
                  {lead.notes && (
                    <div style={{ padding: '12px 14px', background: 'var(--blue-light)', borderRadius: 10, borderLeft: '4px solid var(--blue)', marginBottom: 16 }}>
                      <div style={{ fontWeight: 700, color: 'var(--blue)', marginBottom: 4, fontSize: 13 }}>Client Brief</div>
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{lead.notes}</div>
                    </div>
                  )}

                  {/* Virtual meeting link */}
                  {isVirtualLead && lead.meetingLink && (
                    <div style={{ padding: '10px 14px', background: 'var(--surface2)', borderRadius: 8, border: '1px solid var(--border)', marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{lead.meetingLink}</span>
                      <a href={lead.meetingLink} target="_blank" rel="noopener noreferrer"
                        className="wizard-btn wizard-btn-primary" style={{ padding: '4px 12px', fontSize: 11, textDecoration: 'none' }}>
                        Join →
                      </a>
                    </div>
                  )}

                  {/* 2×2 Action buttons */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 8 }}>
                    {/* Top-left: Join Meeting (virtual) or Call Done */}
                    {isVirtualLead && lead.meetingLink ? (
                      <a
                        href={lead.meetingLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: '14px 10px', borderRadius: 12, border: '2px solid var(--blue)', background: 'var(--blue)', color: 'white', textDecoration: 'none', cursor: 'pointer', textAlign: 'center' }}
                      >
                        <span style={{ fontSize: 22 }}>🎥</span>
                        <strong style={{ fontSize: 12 }}>Join Meeting</strong>
                        <span style={{ fontSize: 10, opacity: 0.85 }}>Open in Zoom / Meet</span>
                      </a>
                    ) : (
                      <button
                        onClick={() => openFeedback('connected')}
                        style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: '14px 10px', borderRadius: 12, border: '2px solid var(--border)', background: 'var(--surface)', cursor: 'pointer' }}
                        className="btn-action-exec"
                      >
                        <span style={{ fontSize: 22 }}>📞</span>
                        <strong style={{ fontSize: 12 }}>Call Done</strong>
                        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>Log call outcome</span>
                      </button>
                    )}

                    {/* Top-right: Update Lead */}
                    <button
                      onClick={() => openFeedback(null)}
                      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: '14px 10px', borderRadius: 12, border: '2px solid var(--border)', background: 'var(--surface)', cursor: 'pointer' }}
                      className="btn-action-exec"
                    >
                      <span style={{ fontSize: 22 }}>✏️</span>
                      <strong style={{ fontSize: 12 }}>Update Lead</strong>
                      <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>Edit & set status</span>
                    </button>

                    {/* Bottom-left: No Reach (RNR) */}
                    <button
                      onClick={() => openFeedback('rnr')}
                      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: '14px 10px', borderRadius: 12, border: '2px solid var(--border)', background: 'var(--surface)', cursor: 'pointer' }}
                      className="btn-action-exec"
                    >
                      <span style={{ fontSize: 22 }}>📵</span>
                      <strong style={{ fontSize: 12 }}>No Reach (RNR)</strong>
                      <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>Retry Logic #{(lead.rnrCount || 0) + 1}</span>
                    </button>

                    {/* Bottom-right: Escalate */}
                    <button
                      onClick={() => openFeedback('escalate')}
                      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: '14px 10px', borderRadius: 12, border: '2px solid var(--border)', background: 'var(--surface)', cursor: 'pointer' }}
                      className="btn-action-exec"
                    >
                      <span style={{ fontSize: 22 }}>⚠️</span>
                      <strong style={{ fontSize: 12 }}>Escalate</strong>
                      <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>To Manager</span>
                    </button>
                  </div>
                </div>

                {/* RIGHT panel: history + lead details */}
                <div className="wizard-lead-body" style={{ paddingLeft: 20 }}>
                  {/* Interaction History */}
                  <div style={{ marginBottom: 20 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12, paddingBottom: 6, borderBottom: '1px solid var(--border)' }}>
                      Interaction History
                    </div>
                    <div style={{ position: 'relative', paddingLeft: 18 }}>
                      <div style={{ position: 'absolute', left: 4, top: 4, bottom: 4, width: 2, background: 'var(--border)' }} />
                      {recentHistory.length > 0 ? recentHistory.slice(0, 4).map((a, i) => (
                        <div key={i} style={{ position: 'relative', marginBottom: 14, fontSize: 12 }}>
                          <div style={{ position: 'absolute', left: -18, top: 3, width: 10, height: 10, borderRadius: '50%', background: i === 0 ? 'var(--blue)' : 'white', border: `2px solid ${i === 0 ? 'var(--blue)' : 'var(--border)'}` }} />
                          <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: 2 }}>
                            {new Date(a.createdAt || a.timestamp).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })},{' '}
                            {new Date(a.createdAt || a.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                          <div style={{ color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                            {a.action?.replace(/_/g, ' ')}
                            {a.note ? ` — ${a.note.slice(0, 55)}${a.note.length > 55 ? '…' : ''}` : ''}
                          </div>
                        </div>
                      )) : (
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>No activity yet for this lead.</div>
                      )}
                    </div>
                  </div>

                  {/* Lead Details */}
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10, paddingBottom: 6, borderBottom: '1px solid var(--border)' }}>
                      Lead Details
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 7, fontSize: 12, color: 'var(--text-secondary)' }}>
                      <div><b>Contact:</b> {lead.name}</div>
                      {lead.phone && <div><b>Phone:</b> {lead.phone}</div>}
                      {lead.email && <div><b>Email:</b> {lead.email}</div>}
                      {lead.district && <div><b>District:</b> {lead.district}</div>}
                      {lead.expectedRevenue > 0 && <div><b>Revenue Potential:</b> ₹{(lead.expectedRevenue / 100000).toFixed(1)}L / Yr</div>}
                    </div>
                  </div>

                  {/* Meeting details button */}
                  {lead.meetingAt && (
                    <button
                      style={{ width: '100%', padding: '8px 12px', fontSize: 12, fontWeight: 600, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', cursor: 'pointer' }}
                      onClick={() => openFeedback(isVirtualLead ? 'schedule_virtual' : 'direct_meeting')}
                    >
                      📅 Meeting Details & Reschedule
                    </button>
                  )}
                </div>
              </div>
            </div>
          ) : (
            /* No lead / queue empty */
            <div className="wizard-lead-card">
              <div className="wizard-lead-body" style={{ textAlign: 'center', padding: '60px 20px' }}>
                <div className="wizard-complete-anim">
                  <div style={{ fontSize: 56, marginBottom: 16 }}>✨</div>
                  <h2 style={{ fontSize: 24, fontWeight: 800, marginBottom: 8 }}>All Tasks Completed!</h2>
                  <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>Great work! Check your pipeline or take a break.</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* RIGHT: Queue + Meetings + Feed */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Task Queue */}
          <div className="wizard-sidebar-card">
            <div className="wizard-sidebar-header">
              Daily Task Sequence
              <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--blue)', cursor: 'pointer', marginLeft: 'auto' }}>View All</span>
            </div>
            {tasks.length > 0 ? tasks.slice(0, 6).map((t, i) => (
              <div key={t.id} className={`wizard-queue-item ${i === 0 ? 'current' : ''}`}>
                <div className="wizard-queue-idx">{t.index}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.name}</div>
                  <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                    {t.type} · {t.time ? new Date(t.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                  </div>
                </div>
                {t.priority === 'hot' && <span className="tag tag-red" style={{ fontSize: 8, padding: '2px 6px' }}>HOT</span>}
              </div>
            )) : (
              <div style={{ padding: 20, textAlign: 'center', fontSize: 13, color: 'var(--text-muted)' }}>No tasks in queue</div>
            )}
          </div>

          {/* Today's Meetings */}
          {meetings.length > 0 && (
            <div className="wizard-sidebar-card">
              <div className="wizard-sidebar-header">Today's Meetings</div>
              {meetings.slice(0, 3).map(m => (
                <div key={m.id} className="wizard-queue-item">
                  <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--blue)', minWidth: 48 }}>
                    {new Date(m.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, fontWeight: 700 }}>{m.name}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{m.type === 'Virtual' ? '🎥' : '📍'} {m.type}</div>
                  </div>
                  <span className={`tag ${m.type === 'Virtual' ? 'tag-blue' : 'tag-amber'}`} style={{ fontSize: 9 }}>
                    {m.status || 'Confirm'}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Live Activity Feed */}
          <div className="wizard-sidebar-card">
            <div className="wizard-sidebar-header">Live Activity Feed</div>
            {activities.length > 0 ? activities.slice(0, 4).map(a => (
              <div key={a.id} className="wizard-queue-item" style={{ gap: 10 }}>
                <div style={{ width: 30, height: 30, borderRadius: '50%', background: a.action === 'converted' ? 'var(--green-light)' : a.action?.includes('meeting') ? 'var(--amber-light)' : 'var(--surface2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0 }}>
                  {a.action === 'converted' ? '💰' : a.action?.includes('meeting') ? '📅' : a.action === 'called' ? '📞' : '⚡'}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 11, fontWeight: 700 }}>{a.leadName}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                    {a.action?.replace(/_/g, ' ')} · {new Date(a.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </div>
            )) : (
              <div style={{ padding: 16, textAlign: 'center', fontSize: 12, color: 'var(--text-muted)' }}>No activity yet today</div>
            )}
          </div>
        </div>
      </div>

      {/* Call Feedback Modal */}
      {lead && (
        <ExecCallFeedbackModal
          isOpen={feedbackModal.open}
          onClose={closeFeedback}
          lead={lead}
          initialOutcome={feedbackModal.outcome}
          onSuccess={handleLeadComplete}
        />
      )}
    </div>
  );
};

/* ─── Small helper components ─── */
const SummaryCard = ({ icon, label, count, color }) => (
  <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', padding: 20, borderRadius: 16, textAlign: 'center' }}>
    <div style={{ width: 40, height: 40, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, margin: '0 auto 10px', background: `${color}10`, color }}>{icon}</div>
    <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>{label}</div>
    <div style={{ fontSize: 24, fontWeight: 900 }}>{count}</div>
  </div>
);

const MiniStat = ({ label, value }) => (
  <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', padding: 16, borderRadius: 12, textAlign: 'center' }}>
    <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>{label}</div>
    <div style={{ fontSize: 22, fontWeight: 900 }}>{value}</div>
  </div>
);

const MetricCard = ({ label, value, color, sub }) => (
  <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', padding: '14px 16px', borderRadius: 14, borderTop: `3px solid ${color}` }}>
    <div style={{ fontSize: 9, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>{label}</div>
    <div style={{ fontSize: 20, fontWeight: 900, letterSpacing: '-0.5px' }}>{value}</div>
    {sub && <div style={{ fontSize: 10, fontWeight: 700, color, marginTop: 3 }}>{sub}</div>}
  </div>
);

export default MyWorkToday;
