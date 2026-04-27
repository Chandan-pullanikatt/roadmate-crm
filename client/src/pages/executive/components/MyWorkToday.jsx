import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { attendanceApi } from '../../../api/attendanceApi';
import { leadsApi } from '../../../api/leadsApi';
import { dashboardApi } from '../../../api/dashboardApi';
import { Avatar, Button, Tag } from '../../../components/ui';
import { useToast } from '../../../context/ToastContext';

const MyWorkToday = () => {
  const queryClient = useQueryClient();
  const { addToast } = useToast();
  
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
    onSuccess: () => {
      addToast("Workspace initialized. Let's make it count!", "success");
      refetchAttendance();
      queryClient.invalidateQueries(['leads', 'workflow']);
    }
  });

  const transitionMutation = useMutation({
    mutationFn: (data) => leadsApi.transitionLead(workflow?.currentLead?._id, data.action, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['leads', 'workflow']);
      queryClient.invalidateQueries(['dashboard', 'executive']);
      addToast("Interaction logged successfully", "success");
    }
  });

  // Derived Data
  const lead = workflow?.currentLead;
  const stats = dashData?.todayStats || {};
  const activities = workflow?.activityFeed || [];
  const meetings = workflow?.todayMeetings || [];
  const tasks = workflow?.taskSequence || [];

  const isWorking = !!attendanceData?.attendance?.workStartedAt && !attendanceData?.attendance?.workCompletedAt;

  if (!attendanceData?.attendance?.workStartedAt) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-10 animate-in zoom-in duration-500">
        <div className="w-24 h-24 bg-[#FEF3C7] rounded-3xl flex items-center justify-center text-5xl mb-8">💼</div>
        <h1 className="text-4xl font-black tracking-tight mb-4">Good Morning, Mohan R.</h1>
        <p className="text-muted max-w-lg mb-10">Your workspace is calibrated. High-value meetings and priority leads are ready for your outreach.</p>
        
        <div className="grid grid-cols-3 gap-6 mb-12 w-full max-w-2xl">
          <StartSummaryCard icon="📅" label="Scheduled Meetings" count={stats.meetings || 0} color="#3B82F6" />
          <StartSummaryCard icon="🔥" label="Hot Pipeline" count={stats.hotPipelineCount || 0} color="#EF4444" />
          <StartSummaryCard icon="🌱" label="New Assignments" count={stats.totalLeads || 0} color="#10B981" />
        </div>

        <button 
          className="btn btn-primary bg-orange border-orange px-12 py-4 rounded-2xl font-black text-lg shadow-xl shadow-orange/20 hover:scale-105 transition-all"
          onClick={() => startWorkMutation.mutate()}
          disabled={startWorkMutation.isPending}
        >
          {startWorkMutation.isPending ? "INITIALIZING..." : "START MY WORK DAY"}
        </button>
      </div>
    );
  }

  if (attendanceData?.attendance?.workCompletedAt) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-10 animate-in zoom-in duration-500">
        <div className="w-24 h-24 bg-green-100 rounded-3xl flex items-center justify-center text-5xl mb-8">🏆</div>
        <h1 className="text-4xl font-black tracking-tight mb-4">Great Work Today!</h1>
        <p className="text-muted mb-10">Your targets for the day have been achieved. All logs are synchronized.</p>
        <div className="bg-surface border border-border p-6 rounded-2xl">
          <div className="text-sm font-bold text-muted uppercase mb-1">Points Earned Today</div>
          <div className="text-4xl font-black text-green-600">{stats.points || 0} PTS</div>
        </div>
      </div>
    );
  }

  return (
    <div className="work-dashboard-container animate-in fade-in duration-700">
      
      {/* 1. Page Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-black tracking-tight">Start My Work</h1>
          <div className="flex items-center gap-2 mt-1">
             <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
             <span className="text-xs font-bold text-muted">Session Active · {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}</span>
          </div>
        </div>
        <div className="flex gap-4">
          <div className="relative">
            <input type="text" placeholder="Search leads, tasks, meetings..." className="input pl-10 w-80" />
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 opacity-50">🔍</span>
          </div>
          <Button variant="primary" className="bg-orange border-orange font-black">+ New Lead</Button>
        </div>
      </div>

      {/* 2. Top Metrics Grid */}
      <div className="grid grid-cols-6 gap-4 mb-6">
        <WorkMetricCard label="CONNECTED / TARGET" value={`${stats.completedLeads || 0}/${stats.totalLeads || 50}`} sub="44% progress" color="#3B82F6" />
        <WorkMetricCard label="REVENUE TODAY" value={`₹${(stats.revenueToday / 100000).toFixed(2)}L`} sub="↑ ₹12k vs yesterday" color="#F59E0B" isCurrency />
        <WorkMetricCard label="HOT PIPELINE" value={stats.hotPipelineCount || 18} sub="High chance conversion" color="#B45309" />
        <WorkMetricCard label="CONVERSIONS" value={String(stats.converted || 0).padStart(2, '0')} sub={`Goal: ${stats.meetings || 5} today`} color="#8B5CF6" />
        <WorkMetricCard label="ATTENDANCE" value={`${stats.completionPct || 42}%`} sub="Half-Day Payout" color="#EF4444" statusIcon="⚠️" />
        <WorkMetricCard label="POINTS EARNED" value={stats.points || 840} sub="Next Tier: 1000" color="#D97706" />
      </div>

      {/* 3. Urgent Meeting Alert */}
      {lead?.status === 'meeting_direct' && (
        <div className="bg-[#FFFBEB] border border-[#FEF3C7] rounded-2xl p-4 mb-4 flex items-center gap-4 animate-in slide-in-from-top-4 duration-500">
          <div className="w-12 h-12 bg-orange/10 rounded-xl flex items-center justify-center text-2xl">🤝</div>
          <div className="flex-1">
            <div className="text-sm font-black text-[#92400E]">Direct Meeting — Confirm Today's Visit</div>
            <div className="text-xs text-[#B45309] font-medium">
              {lead.company} · Rahul Sharma · Today {new Date(lead.meetingAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} · {lead.city || 'Andheri East, Mumbai'}
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="primary" className="bg-orange border-orange font-bold">Confirm Visit ✓</Button>
            <Button size="sm" variant="outline" className="font-bold">Details</Button>
          </div>
        </div>
      )}



      {/* 4. Main Work Area */}
      <div className="work-main-layout">
        
        {/* Left Column: Active Task */}
        <div className="space-y-6">
          <div className="workflow-card-v3">
            <div className="wf-header-v3">
              <div className="flex items-center gap-4">
                 <div className="bg-blue-50 text-blue-600 px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest">
                   {lead?.status === 'meeting_virtual' ? 'Virtual Meeting' : 'Active Prospect'}
                 </div>
                 <div className="text-[10px] font-bold text-muted uppercase tracking-widest">TASK 14 OF 42 (SEQ #104)</div>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-[10px] font-black text-blue-600 animate-pulse">HAPPENING NOW</span>
                <button className="text-[10px] font-bold text-muted flex items-center gap-1 hover:text-text-primary transition-colors">
                  📄 Full History
                </button>
              </div>
            </div>

            <div className="wf-content-v3">
              {lead ? (
                <>
                  <div className="flex justify-between items-start">
                    <div>
                      <h2 className="text-3xl font-black tracking-tight mb-3">{lead.company || lead.name}</h2>
                      <div className="flex gap-2">
                        <Tag label="HOT LEAD" variant="red" />
                        <Tag label={lead.industry?.toUpperCase() || 'GENERAL'} variant="neutral" />
                        <Tag label={`REF: ${lead.leadSource?.toUpperCase() || 'PORTAL'}`} variant="neutral" />
                        <Tag label={`VIRTUAL - ${new Date(lead.meetingAt || Date.now()).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`} variant="blue" />
                      </div>
                    </div>
                  </div>

                  <div className="client-brief-box">
                    <div className="text-[10px] font-black text-blue-700 uppercase tracking-widest mb-2">Lead Information & Notes</div>
                    <p className="text-xs text-blue-900 font-medium leading-relaxed">
                      {lead.notes || 'No notes available for this lead.'}
                    </p>
                  </div>

                  <div className="bg-surface2/50 border border-border p-4 rounded-2xl mt-4 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center text-sm">👔</div>
                      <div className="text-xs font-bold">Meeting also scheduled with State Manager — <span className="text-blue-600">Vikram Singh</span> on Apr 22</div>
                    </div>
                    <button className="text-[10px] font-black uppercase text-muted hover:text-text-primary">View Full History</button>
                  </div>

                  <div className="action-hub-v3">
                    <button 
                      className={`action-btn-v3 ${lead.status === 'meeting_virtual' ? 'active' : ''}`}
                      onClick={() => lead.meetingLink && window.open(lead.meetingLink, '_blank')}
                    >
                      <span className="icon">🎥</span>
                      <span className="label">Join Meeting</span>
                      <span className="sub">{lead.meetingLink ? new URL(lead.meetingLink).hostname : 'No link set'}</span>
                    </button>
                    <button className="action-btn-v3" onClick={() => transitionMutation.mutate({ action: 'set_feedback', nextAction: 'followup' })}>
                      <span className="icon">📝</span>
                      <span className="label">Update Lead</span>
                      <span className="sub">Edit & set status</span>
                    </button>
                    <button className="action-btn-v3" onClick={() => transitionMutation.mutate({ action: 'mark_rnr' })}>
                      <span className="icon">📵</span>
                      <span className="label">No Reach (RNR)</span>
                      <span className="sub">Retry Logic #1</span>
                    </button>
                    <button className="action-btn-v3" onClick={() => transitionMutation.mutate({ action: 'escalate' })}>
                      <span className="icon">⚠️</span>
                      <span className="label">Escalate</span>
                      <span className="sub">To Manager</span>
                    </button>
                  </div>
                </>
              ) : (
                <div className="text-center py-20">
                  <div className="text-5xl mb-4">✨</div>
                  <h3 className="text-xl font-black">All Tasks Completed!</h3>
                  <p className="text-muted">Take a break or check your long-term pipeline.</p>
                </div>
              )}
            </div>
          </div>

          {/* Interaction History Sidebar inside left column */}
          <div className="bg-white border border-border rounded-24 p-6">
             <div className="text-[10px] font-black text-muted uppercase tracking-widest mb-6">Interaction History</div>
             <div className="space-y-6">
                {activities && activities.length > 0 ? activities.slice(0, 3).map((act, i) => (
                  <div key={act._id || i} className="relative pl-6 border-l-2 border-border pb-2">
                    <div className="absolute -left-[7px] top-0 w-3 h-3 rounded-full bg-blue-500 border-2 border-white"></div>
                    <div className="text-[11px] font-black mb-1">{new Date(act.createdAt || act.time).toLocaleString()}</div>
                    <p className="text-xs text-muted font-medium leading-relaxed">
                      {act.comment || act.note || (act.action === 'called' ? 'Pre-confirmation call logged.' : 'Interaction logged.')}
                    </p>
                  </div>
                )) : (
                  <div className="text-xs text-muted font-medium italic">No recent activities found.</div>
                )}
             </div>
             
             <div className="mt-8 pt-6 border-t border-border">
                <div className="text-[10px] font-black text-muted uppercase tracking-widest mb-4">Lead Details</div>
                <div className="space-y-3">
                  <DetailRow label="Contact" value="Amit Jain (MD)" />
                  <DetailRow label="Email" value={lead?.email || 'amit.j@arjunexports.in'} />
                  <DetailRow label="Location" value={lead?.city || 'Worli, Mumbai'} />
                  <DetailRow label="GST" value="27AAAC..." />
                  <DetailRow label="Revenue Potential" value={`₹${(lead?.expectedRevenue / 100000).toFixed(1) || 3.2}L / Yr`} />
                </div>
                <button className="w-full mt-6 py-3 border border-border rounded-xl text-[10px] font-black uppercase hover:bg-surface transition-colors">
                   📋 Meeting Details & Reschedule
                </button>
             </div>
          </div>
        </div>

        {/* Right Column: Sequences & Feed */}
        <div className="space-y-6">
          
          {/* Daily Task Sequence */}
          <div className="task-seq-card shadow-sm">
            <div className="flex justify-between items-center mb-6">
              <div className="text-[11px] font-black tracking-widest uppercase">Daily Task Sequence</div>
              <button className="text-[10px] font-bold text-blue-600 hover:underline">View All Meetings</button>
            </div>
            <div className="space-y-1">
              {tasks.map((task, i) => (
                <div key={task.id} className={`task-item-v3 ${i === 0 ? 'active' : ''}`}>
                  <div className="task-idx-v3">{task.index}</div>
                  <div className="flex-1">
                    <div className="text-sm font-black tracking-tight">{task.name}</div>
                    <div className="text-[10px] font-bold text-muted uppercase mt-0.5">{task.type} · {new Date(task.time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
                  </div>
                  {i === 1 && <span className="text-[8px] font-black bg-orange/10 text-orange-700 px-1.5 py-0.5 rounded border border-orange/20">CONFIRM</span>}
                  {i === 2 && <span className="text-[8px] font-black bg-blue/10 text-blue-700 px-1.5 py-0.5 rounded border border-blue/20">FRESH</span>}
                </div>
              ))}
            </div>
          </div>

          {/* Today's Meetings */}
          <div className="task-seq-card shadow-sm">
            <div className="flex justify-between items-center mb-6">
              <div className="text-[11px] font-black tracking-widest uppercase">Today's Meetings</div>
              <button className="text-[10px] font-bold text-blue-600 hover:underline">All →</button>
            </div>
            <div className="space-y-2">
              {meetings.map(m => (
                <div key={m.id} className="meeting-row-v3">
                  <div className="meeting-time-v3">
                    <span className="time">{new Date(m.time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}).split(' ')[0]}</span>
                    <span className="period">{new Date(m.time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}).split(' ')[1]}</span>
                  </div>
                  <div className="flex-1">
                    <div className="text-xs font-black tracking-tight">{m.name}</div>
                    <div className="text-[9px] font-bold text-muted flex items-center gap-1 mt-0.5">
                      {m.type === 'Virtual' ? '🎥' : '📍'} {m.type} · {m.location}
                    </div>
                  </div>
                  <div className={`status-badge-v3 ${m.status.toLowerCase()}`}>{m.status}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Live Activity Feed */}
          <div className="px-2">
            <div className="text-[11px] font-black tracking-widest uppercase mb-6">Live Activity Feed</div>
            <div className="space-y-6">
              {activities.map(act => (
                <div key={act.id} className="flex gap-4">
                  <div className={`w-8 h-8 shrink-0 rounded-xl flex items-center justify-center text-sm shadow-sm ${act.action === 'converted' ? 'bg-green-100 text-green-700' : act.action.includes('meeting') ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'}`}>
                    {act.action === 'converted' ? '🤝' : act.action.includes('meeting') ? '📅' : '⚠️'}
                  </div>
                  <div>
                    <div className="text-[11px] font-bold leading-snug">
                      <span className="font-black">{act.action === 'converted' ? 'Converted!' : act.action === 'meeting_scheduled' ? 'Scheduled' : 'RNR:'}</span> {act.leadName} {act.action === 'converted' ? 'signed E-Agreement.' : act.action === 'meeting_scheduled' ? 'meet for Tomorrow 10am.' : 'ignored 3rd call attempt.'}
                    </div>
                    <div className="text-[10px] font-bold text-muted mt-1 uppercase tracking-tight">{new Date(act.time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} ago</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

const StartSummaryCard = ({ icon, label, count, color }) => (
  <div className="bg-surface border border-border p-5 rounded-2xl flex flex-col items-center">
    <div className="w-10 h-10 rounded-full flex items-center justify-center text-xl mb-3" style={{ background: `${color}10`, color }}>{icon}</div>
    <div className="text-[10px] font-black text-muted uppercase mb-1 tracking-widest">{label}</div>
    <div className="text-2xl font-black">{count}</div>
  </div>
);

const WorkMetricCard = ({ label, value, sub, color, isCurrency, statusIcon }) => (
  <div className="bg-white border border-border p-4 rounded-2xl shadow-sm relative overflow-hidden" style={{ borderTop: `3px solid ${color}` }}>
    <div className="text-[8px] font-black text-muted uppercase tracking-[0.15em] mb-2">{label}</div>
    <div className="text-xl font-black tracking-tighter flex items-baseline gap-1">
      {value}
    </div>
    <div className="text-[9px] font-bold mt-1.5 flex items-center gap-1" style={{ color: statusIcon ? '#EF4444' : color }}>
      {statusIcon && <span>{statusIcon}</span>}
      {sub}
    </div>
  </div>
);

const DetailRow = ({ label, value }) => (
  <div className="flex justify-between items-center text-[11px] py-1">
    <span className="font-bold text-muted">{label}:</span>
    <span className="font-black text-right">{value}</span>
  </div>
);

const DemoBtn = ({ icon, label, onClick }) => (
  <button 
    className="bg-white border border-border px-3 py-1.5 rounded-lg text-[10px] font-bold text-muted flex items-center gap-2 hover:border-accent hover:text-text-primary transition-all shadow-sm"
    onClick={onClick}
  >
    <span>{icon}</span>
    <span>{label}</span>
  </button>
);

export default MyWorkToday;
