import React, { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Tag, Avatar, DashboardSkeleton } from '../../../components/ui';
import { leadsApi } from '../../../api/leadsApi';
import { usersApi } from '../../../api/usersApi';
import { dashboardApi } from '../../../api/dashboardApi';
import { useToast } from '../../../context/ToastContext';
import ExecCallFeedbackModal from '../../executive/components/ExecCallFeedbackModal';

const statusColor = (type) => {
  if (!type) return 'var(--purple)';
  if (type === 'Meeting') return 'var(--teal)';
  if (type === 'Follow-up') return 'var(--purple)';
  if (type === 'New Lead') return 'var(--amber)';
  return 'var(--red)';
};

const tagVariant = (type) => {
  if (type === 'Meeting') return 'tag-teal';
  if (type === 'Follow-up') return 'tag-purple';
  if (type === 'New Lead') return 'tag-amber';
  return 'tag-red';
};

const LeadFlow = () => {
  const queryClient = useQueryClient();
  const { addToast } = useToast();
  const [selectedExecId, setSelectedExecId] = useState('');
  const [feedbackModal, setFeedbackModal] = useState({ open: false, outcome: null });

  const { data: dashData, isLoading: dashLoading } = useQuery({
    queryKey: ['dashboard', 'industry-manager'],
    queryFn: () => dashboardApi.getIndustryManagerDashboard().then(res => res.data),
    staleTime: 5 * 60 * 1000,
    placeholderData: (prev) => prev
  });

  const { data: executives, isLoading: execsLoading } = useQuery({
    queryKey: ['users', 'executives-monitoring'],
    queryFn: () => usersApi.getUsers({ role: 'executive' }).then(res => res.data),
    staleTime: 5 * 60 * 1000,
    placeholderData: (prev) => prev
  });

  // Default to first executive once list loads
  useEffect(() => {
    if (!selectedExecId && executives?.length) {
      setSelectedExecId(executives[0]._id);
    }
  }, [executives, selectedExecId]);

  const { data: queueData, isLoading: queueLoading } = useQuery({
    queryKey: ['leads', 'monitoring-queue', selectedExecId],
    queryFn: () => leadsApi.getLeadQueue(selectedExecId).then(res => res.data),
    enabled: !!selectedExecId,
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000
  });

  const currentLead = queueData?.currentLead || null;
  const taskSequence = queueData?.taskSequence || [];
  const selectedExec = executives?.find(e => e._id === selectedExecId);
  const userInfo = dashData?.user || {};

  const openFeedback = (outcome) => setFeedbackModal({ open: true, outcome });
  const closeFeedback = () => setFeedbackModal({ open: false, outcome: null });

  const handleActionSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ['leads', 'monitoring-queue', selectedExecId] });
    addToast('Action recorded successfully', 'success');
    closeFeedback();
  };

  // Task flow steps derived from current lead state
  const rnr = currentLead?.rnrCount || 0;
  const st = currentLead?.status || '';
  const steps = [
    {
      num: 1,
      label: 'Call Initiated',
      sub: currentLead ? 'First contact attempted' : 'Waiting for lead',
      done: !!currentLead
    },
    {
      num: 2,
      label: 'RNR Marked · Re-queued PM',
      sub: rnr >= 1 ? `${rnr} RNR(s) logged` : 'No RNR yet',
      done: rnr >= 1
    },
    {
      num: 3,
      label: '2nd Call Attempt',
      sub: rnr >= 2 ? 'Completed' : rnr === 1 ? 'In progress' : 'Pending',
      done: rnr >= 2,
      active: rnr === 1
    },
    {
      num: 4,
      label: 'Feedback & Follow-up Date',
      sub: st === 'followup' ? 'Follow-up scheduled' : 'Pending',
      done: st === 'followup' || st.includes('meeting')
    },
    {
      num: 5,
      label: 'Meeting / Conversion',
      sub: st.includes('meeting') ? 'Meeting scheduled' : st === 'converted' ? 'Converted!' : 'Pending',
      done: st.includes('meeting') || st === 'converted'
    }
  ];

  if ((dashLoading || execsLoading) && !dashData) return <DashboardSkeleton />;

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-12">

      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Lead Task Flow</h1>
          <p className="text-sm text-text-muted">One-by-one task delivery system · RNR auto-reallocation rules</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-3 bg-white p-2 rounded-2xl border border-border/60 shadow-sm">
            <div className="pr-2 pl-4">
              <div className="text-[10px] font-bold text-text-muted uppercase tracking-tight">Monitoring</div>
              <div className="text-sm font-bold text-purple">
                {selectedExecId ? '1 Active Session' : 'No Session'}
              </div>
            </div>
            <div className="h-8 w-px bg-border/60" />
            <div className="bg-surface2 border border-border rounded-xl p-1 flex mr-1">
              <select
                className="bg-transparent border-none text-[11px] font-bold px-4 py-2 outline-none cursor-pointer"
                value={selectedExecId}
                onChange={e => setSelectedExecId(e.target.value)}
              >
                <option value="">Select Executive</option>
                {executives?.map(e => (
                  <option key={e._id} value={e._id}>{e.name} ({e.district})</option>
                ))}
              </select>
            </div>
          </div>
          {currentLead && (
            <Tag variant="purple" label={`Active Lead: ${currentLead.leadId || currentLead._id?.slice(-6)}`} className="font-black px-4" />
          )}
          <Avatar name={userInfo.name} size="md" className="border-2 border-purple/10" />
        </div>
      </div>

      {/* Sub Header */}
      <div className="bg-surface1 border border-border/40 rounded-2xl p-4 flex items-center justify-between gap-4 shadow-sm">
        <div>
          <h2 className="text-lg font-bold">Lead Task Flow · {userInfo.industry}</h2>
          <p className="text-xs text-text-muted">
            {selectedExec ? `Shadowing ${selectedExec.name} · ${selectedExec.district}` : 'Select an executive to begin monitoring'}
          </p>
        </div>
        {selectedExec && (
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${queueLoading ? 'bg-amber animate-pulse' : 'bg-green animate-pulse'}`} />
            <span className="text-xs font-bold text-text-muted uppercase tracking-tight">
              {queueLoading ? 'Syncing...' : 'Live'}
            </span>
          </div>
        )}
      </div>

      {!selectedExecId ? (
        <div className="p-32 text-center border-2 border-dashed border-border/30 rounded-[3rem] bg-surface2/30 animate-in zoom-in-95 duration-700">
          <div className="w-24 h-24 bg-white rounded-[2rem] flex items-center justify-center text-4xl shadow-xl shadow-purple/5 border border-purple/10 mx-auto mb-8">
            👁️‍🗨️
          </div>
          <h3 className="text-2xl font-black text-text-primary tracking-tight">Monitor Active Execution</h3>
          <p className="text-sm text-text-muted max-w-sm mx-auto mt-4 font-medium leading-relaxed">
            Select a District Executive from the monitor control above to shadow their current lead processing workflow.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* ── LEFT COLUMN ── */}
          <div className="space-y-6">

            {/* Current Lead Card */}
            <div className="card shadow-sm border-border/40">
              <div className="card-header border-b border-border/40 px-6 py-4 flex items-center justify-between">
                <div className="text-sm font-black uppercase tracking-widest text-text-muted">
                  Current Lead · {currentLead?.leadId || (queueLoading ? '…' : 'No Active Lead')}
                </div>
                {currentLead && (
                  <Tag
                    variant={currentLead.priority === 'hot' ? 'red' : 'blue'}
                    label={currentLead.priority?.toUpperCase() || 'NORMAL'}
                    className="font-black px-3"
                  />
                )}
              </div>

              <div className="card-body px-6 py-6">
                {queueLoading ? (
                  <div className="py-10 text-center text-sm text-text-muted italic">Loading queue...</div>
                ) : !currentLead ? (
                  <div className="py-10 text-center">
                    <div className="text-4xl mb-3 opacity-20">🧊</div>
                    <p className="text-sm text-text-muted font-bold italic">Executive is idle or queue is empty</p>
                  </div>
                ) : (
                  <>
                    {/* Lead identity */}
                    <div className="mb-5">
                      <div className="text-base font-bold text-text-primary mb-1">{currentLead.company || currentLead.name}</div>
                      <div className="text-[12.5px] text-text-muted">Contact: {currentLead.name} · {currentLead.phone}</div>
                      <div className="text-[12.5px] text-text-muted">
                        District: {currentLead.district}
                        {selectedExec && ` · Assigned: ${selectedExec.name}`}
                      </div>
                    </div>

                    {/* Info grid */}
                    <div className="grid grid-cols-2 gap-3 text-[12.5px] mb-5">
                      <div>
                        <span className="text-text-muted">Last Action: </span>
                        <span className="font-medium">{currentLead.lastAction?.replace(/_/g, ' ') || 'Call — No answer'}</span>
                      </div>
                      <div>
                        <span className="text-text-muted">RNR Count: </span>
                        <span className={`font-bold ${currentLead.rnrCount > 0 ? 'text-amber' : 'text-text-primary'}`}>
                          {currentLead.rnrCount || 0}/3
                        </span>
                      </div>
                      <div>
                        <span className="text-text-muted">Assigned: </span>
                        <span className="font-medium">
                          {currentLead.createdAt
                            ? new Date(currentLead.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
                            : '—'}
                        </span>
                      </div>
                      <div>
                        <span className="text-text-muted">Next Action: </span>
                        <span className="font-medium">
                          {currentLead.nextActionAt
                            ? new Date(currentLead.nextActionAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
                            : currentLead.status === 'followup' ? 'Follow-up today' : 'Pending'}
                        </span>
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => openFeedback('connected')}
                        className="btn btn-sm px-4 py-1.5 rounded-lg bg-green/10 text-green border border-green/20 text-[11px] font-bold hover:bg-green hover:text-white transition-all"
                      >
                        ✓ Call Completed
                      </button>
                      <button
                        onClick={() => openFeedback('rnr')}
                        className="btn btn-sm px-4 py-1.5 rounded-lg bg-amber/10 text-amber border border-amber/20 text-[11px] font-bold hover:bg-amber hover:text-white transition-all"
                      >
                        📵 Mark RNR
                      </button>
                      <button
                        onClick={() => openFeedback('schedule_virtual')}
                        className="btn btn-sm px-4 py-1.5 rounded-lg bg-blue/10 text-blue border border-blue/20 text-[11px] font-bold hover:bg-blue hover:text-white transition-all"
                      >
                        📅 Schedule Meeting
                      </button>
                      <button
                        onClick={() => window.dispatchEvent(new CustomEvent('open-modal', { detail: { type: 'escalate-lead', leadId: currentLead._id, leadData: currentLead } }))}
                        className="btn btn-sm px-4 py-1.5 rounded-lg bg-surface2 text-text-muted border border-border text-[11px] font-bold hover:bg-text-primary hover:text-white transition-all"
                      >
                        ⬆ Escalate
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* RNR Rules Card */}
            <div className="card border-border/40 shadow-sm">
              <div className="card-header border-b border-border/40 px-6 py-4">
                <div className="text-sm font-black uppercase tracking-widest text-text-muted">RNR Auto-Reallocation Rules</div>
              </div>
              <div className="card-body px-6 py-5 space-y-3 text-[12.5px] leading-relaxed text-text-secondary">
                <div>📵 <strong>1st RNR (New Lead):</strong> Lead re-queued for afternoon same day</div>
                <div>📵 <strong>2nd RNR (Afternoon):</strong> Comes as lead for next working day</div>
                <div>📵 <strong>3rd RNR (Next Day):</strong> Comes after 2 days at different time</div>
                <div>🔀 <strong>3–5 RNRs:</strong> Lead auto-allocated to another executive</div>
                <div>❌ <strong>Continued RNR:</strong> Lead placed as Lost Lead automatically</div>
              </div>
            </div>
          </div>

          {/* ── RIGHT COLUMN ── */}
          <div className="space-y-6">

            {/* Task Flow Steps */}
            <div className="card border-border/40 shadow-sm">
              <div className="card-header border-b border-border/40 px-6 py-4">
                <div className="text-sm font-black uppercase tracking-widest text-text-muted">Task Flow Steps</div>
              </div>
              <div className="card-body px-6 py-4 space-y-1">
                {steps.map((step) => (
                  <div key={step.num} className="flex items-center gap-4 py-3">
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-black flex-shrink-0"
                      style={{
                        background: step.done ? 'var(--accent)' : step.active ? 'var(--purple)' : 'var(--border)',
                        color: step.done || step.active ? 'white' : 'var(--text-muted)'
                      }}
                    >
                      {step.done ? '✓' : step.num}
                    </div>
                    <div>
                      <div
                        className="text-[13px] font-medium"
                        style={{ color: step.active ? 'var(--purple)' : step.done ? 'var(--text-primary)' : 'var(--text-muted)' }}
                      >
                        {step.label}
                      </div>
                      <div className="text-[11.5px] text-text-muted">{step.sub}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Today's Queue */}
            <div className="card border-border/40 shadow-sm overflow-hidden">
              <div className="card-header border-b border-border/40 px-6 py-4">
                <div className="text-sm font-black uppercase tracking-widest text-text-muted">
                  Today's Queue{selectedExec ? ` · ${selectedExec.name}` : ''}
                </div>
              </div>

              {queueLoading ? (
                <div className="py-10 text-center text-sm text-text-muted italic">Loading queue...</div>
              ) : taskSequence.length === 0 ? (
                <div className="py-10 text-center text-[11px] font-bold text-text-muted uppercase tracking-widest italic opacity-50">
                  No tasks in queue
                </div>
              ) : (
                <div className="divide-y divide-border/40">
                  {taskSequence.map((task, idx) => (
                    <div
                      key={task.id || idx}
                      className="flex items-center gap-3 px-6 py-3"
                    >
                      <div
                        className="w-2 h-2 rounded-full flex-shrink-0"
                        style={{ background: statusColor(task.type) }}
                      />
                      <div className="flex-1 text-[13px] font-medium text-text-primary truncate">
                        {task.type} — {task.name}
                      </div>
                      <span
                        className={`tag text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap ${tagVariant(task.type)}`}
                      >
                        {task.time
                          ? new Date(task.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                          : '—'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Call Feedback Modal — reused for IM actions */}
      {currentLead && (
        <ExecCallFeedbackModal
          isOpen={feedbackModal.open}
          onClose={closeFeedback}
          lead={currentLead}
          initialOutcome={feedbackModal.outcome}
          onSuccess={handleActionSuccess}
        />
      )}
    </div>
  );
};

export default LeadFlow;
