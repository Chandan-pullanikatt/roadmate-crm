import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { attendanceApi } from '../../../api/attendanceApi';
import { leadsApi } from '../../../api/leadsApi';
import { dashboardApi } from '../../../api/dashboardApi';
import { Button, Tag, Avatar, Modal } from '../../../components/ui';
import { useToast } from '../../../context/ToastContext';
import FileUpload from '../../../components/ui/FileUpload';

const MyWorkToday = () => {
  const queryClient = useQueryClient();
  const { addToast } = useToast();
  
  const [wfStep, setWfStep] = useState('action'); // action, feedback, followup-date, time-pref
  const [selectedAction, setSelectedAction] = useState(null);
  const [feedback, setFeedback] = useState('');
  const [strategyNote, setStrategyNote] = useState('');
  const [followUpDate, setFollowUpDate] = useState(null);
  const [customDateReason, setCustomDateReason] = useState('');
  const [selectedTime, setSelectedTime] = useState(null);
  
  const [showHistory, setShowHistory] = useState(false);
  const [showAttach, setShowAttach] = useState(false);
  const [historyData, setHistoryData] = useState([]);

  // Fetch today's work state (attendance)
  const { data: attendanceData, refetch: refetchAttendance } = useQuery({
    queryKey: ['attendance', 'today'],
    queryFn: () => attendanceApi.getTodayAttendance().then(res => res.data)
  });

  // Fetch dashboard summary for start screen counts
  const { data: dashboardData } = useQuery({
    queryKey: ['dashboard', 'executive'],
    queryFn: () => dashboardApi.getExecutiveDashboard().then(res => res.data),
    enabled: !attendanceData?.workStartedAt
  });

  // Fetch the current lead in queue
  const { data: queueData, isLoading: isLeadLoading } = useQuery({
    queryKey: ['leads', 'queue'],
    queryFn: () => leadsApi.getLeadQueue().then(res => res.data),
    enabled: !!attendanceData?.workStartedAt && !attendanceData?.workCompletedAt
  });

  // Fetch suggested follow-up dates
  const { data: suggestedDates } = useQuery({
    queryKey: ['leads', 'suggested-dates'],
    queryFn: () => leadsApi.getSuggestedDates().then(res => res.data),
    enabled: wfStep === 'followup-date'
  });

  // Start work mutation
  const startWorkMutation = useMutation({
    mutationFn: attendanceApi.startWork,
    onSuccess: () => {
      addToast("Work session started! Good luck.", "success");
      refetchAttendance();
    }
  });

  // Complete work mutation
  const completeWorkMutation = useMutation({
    mutationFn: () => attendanceApi.completeWork(attendanceData?._id),
    onSuccess: () => {
      addToast("Work day completed successfully!", "success");
      refetchAttendance();
    }
  });

  // Transition lead mutation
  const transitionLeadMutation = useMutation({
    mutationFn: (data) => leadsApi.transitionLead(queueData?.currentLead?._id, data.action, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['leads', 'queue']);
      queryClient.invalidateQueries(['attendance', 'today']);
      setWfStep('action');
      setSelectedAction(null);
      setFeedback('');
      setStrategyNote('');
      setSelectedTime(null);
      setFollowUpDate(null);
      addToast("Lead updated successfully", "success");
    },
    onError: (err) => {
      addToast(err.response?.data?.message || "Transition failed", "error");
    }
  });

  const handleCallAction = (action) => {
    setSelectedAction(action);
    if (action === 'rnr' || action === 'not-reachable') {
      transitionLeadMutation.mutate({ action });
    } else if (action === 'call-done') {
      setWfStep('feedback');
    } else if (action === 'direct-meeting') {
      window.dispatchEvent(new CustomEvent('open-modal', { detail: 'modal-strategy' }));
    }
  };

  const handleFeedbackSubmit = (nextAction) => {
    setFeedback(nextAction);
    if (nextAction === 'followup') {
      setWfStep('followup-date');
    } else if (nextAction === 'converted' || nextAction === 'not-interested' || nextAction === 'schedule-virtual') {
      window.dispatchEvent(new CustomEvent('open-modal', { detail: 'modal-strategy' }));
    }
  };

  const handleEscalate = async () => {
    if (window.confirm("Are you sure you want to escalate this lead to your manager?")) {
      transitionLeadMutation.mutate({ action: 'escalate' });
    }
  };

  const viewHistory = async () => {
    try {
      const res = await leadsApi.getLeadActivity(queueData.currentLead._id);
      setHistoryData(res.data);
      setShowHistory(true);
    } catch (err) {
      addToast("Failed to fetch history", "error");
    }
  };

  const onDocUpload = async (fileData) => {
    try {
      await leadsApi.addLeadDocument(queueData.currentLead._id, fileData);
      addToast("Document attached successfully", "success");
      setShowAttach(false);
    } catch (err) {
      addToast("Failed to save document metadata", "error");
    }
  };

  if (!attendanceData?.workStartedAt) {
    const stats = dashboardData?.todayStats || {};
    return (
      <div id="start-screen">
        <div className="start-screen">
          <div className="start-icon">⚡</div>
          <div className="start-title">Ready to start your day?</div>
          <div className="start-sub">Your leads will come one by one. First up: Direct Meetings → Virtual Meetings → Follow-ups (Hot first) → New Leads.</div>

          <div className="start-queue">
            <div className="queue-item"><div className="queue-dot" style={{background: 'var(--teal)'}}></div><span>🤝 Direct Meetings today</span><span className="queue-count">{stats.meetings || 0}</span></div>
            <div className="queue-item"><div className="queue-dot" style={{background: 'var(--blue)'}}></div><span>🎥 Scheduled Virtual Meetings</span><span className="queue-count">{stats.virtualMeetings || 0}</span></div>
            <div className="queue-item"><div className="queue-dot" style={{background: 'var(--red)'}}></div><span>🔥 Hot follow-ups</span><span className="queue-count">{stats.hotFollowups || 0}</span></div>
            <div className="queue-item"><div className="queue-dot" style={{background: 'var(--amber)'}}></div><span>🟡 Warm follow-ups</span><span className="queue-count">{stats.warmFollowups || 0}</span></div>
            <div className="queue-item"><div className="queue-dot" style={{background: 'var(--text-muted)'}}></div><span>📞 Call back / RNR retry</span><span className="queue-count">{stats.rnrRetry || 0}</span></div>
            <div className="queue-item"><div className="queue-dot" style={{background: 'var(--accent)'}}></div><span>🌱 New leads allotted</span><span className="queue-count">{stats.newLeads || 0}</span></div>
          </div>

          <button 
            className="btn btn-orange" 
            style={{fontSize: '15px', padding: '12px 36px', borderRadius: '10px'}} 
            onClick={() => startWorkMutation.mutate()}
            disabled={startWorkMutation.isLoading}
          >
            {startWorkMutation.isLoading ? "Starting..." : "▶ Start Today's Work"}
          </button>
        </div>
      </div>
    );
  }

  if (attendanceData?.workCompletedAt || !queueData?.currentLead) {
    return (
      <div id="done-screen">
        <div className="start-screen">
          <div className="start-icon">🎉</div>
          <div className="start-title">All done for today!</div>
          <div className="start-sub">Great work. You completed all {attendanceData?.totalLeads || 0} leads. Please mark your day as complete.</div>
          {!attendanceData?.workCompletedAt && (
            <button 
              className="btn btn-primary" 
              style={{fontSize: '15px', padding: '12px 36px', borderRadius: '10px'}} 
              onClick={() => completeWorkMutation.mutate()}
              disabled={completeWorkMutation.isLoading}
            >
              ✓ {completeWorkMutation.isLoading ? "Processing..." : "Mark Today Work Completed"}
            </button>
          )}
        </div>
      </div>
    );
  }

  const lead = queueData.currentLead;
  const leadNum = attendanceData.leadsDone + 1;
  const totalLeads = attendanceData.totalLeads;

  return (
    <div className="workflow-screen active">
      {/* History Modal */}
      {showHistory && (
        <Modal title={`Interaction History - ${lead.name}`} onClose={() => setShowHistory(false)}>
          <div className="p-4 space-y-4 max-h-[60vh] overflow-y-auto">
            {historyData.map((act, idx) => (
              <div key={idx} className="border-l-2 border-white/10 pl-4 py-1">
                <div className="text-xs text-gray-500">{new Date(act.createdAt).toLocaleString()}</div>
                <div className="text-sm font-medium text-gray-200">{act.action.toUpperCase()}</div>
                <div className="text-xs text-gray-400">{act.note}</div>
              </div>
            ))}
            {historyData.length === 0 && <div className="text-center text-gray-500 py-4">No history found</div>}
          </div>
        </Modal>
      )}

      {/* Attach Doc Modal */}
      {showAttach && (
        <Modal title={`Attach Document - ${lead.name}`} onClose={() => setShowAttach(false)}>
          <div className="p-6">
            <FileUpload 
              folder="leads" 
              entityId={lead._id} 
              onUploadComplete={onDocUpload} 
              label="Upload Document (PDF, Image)"
            />
          </div>
        </Modal>
      )}

      {/* Progress bar */}
      <div style={{display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px', flexWrap: 'wrap'}}>
        <div className="wf-progress" style={{flex: 1}}>
          {Array.from({length: Math.min(totalLeads, 15)}).map((_, i) => (
            <div key={i} className={`wf-dot ${i + 1 < leadNum ? 'done' : i + 1 === leadNum ? 'active' : ''}`}></div>
          ))}
          <div className="wf-label">{totalLeads > 15 ? `+${totalLeads - 15} more` : ''}</div>
        </div>
        <div style={{fontSize: '12px', color: 'var(--text-muted)', whiteSpace: 'nowrap'}}>Lead <span style={{fontWeight: 600, color: 'var(--orange)'}}>{leadNum}</span> of {totalLeads}</div>
      </div>

      {/* Current lead card */}
      <div className="lead-wf-card">
        <div className="lead-wf-header">
          <Avatar name={lead.name} className="lead-wf-avatar" />
          <div style={{flex: 1}}>
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start'}}>
              <div>
                <div className="lead-wf-name">{lead.name}</div>
                <div className="lead-wf-company">{lead.company} · {lead.industry}</div>
              </div>
              <Tag label={lead.priority.toUpperCase()} variant={lead.priority === 'hot' ? 'red' : lead.priority === 'warm' ? 'amber' : 'blue'} />
            </div>
            <div className="lead-wf-meta">
              <div className="lead-wf-meta-item">📞 {lead.phone}</div>
              <div className="lead-wf-meta-item">📍 {lead.city}, {lead.state}</div>
              {lead.rnrCount > 0 && (
                <div className={`rnr-badge count-${Math.min(lead.rnrCount, 3)}`}>📵 RNR: {lead.rnrCount} times</div>
              )}
            </div>
          </div>
        </div>

        {/* Step content */}
        <div className="step-body">
          {wfStep === 'action' && (
            <>
              <div className="step-question">{lead.status === 'new' ? '🌱 New Lead — Call Now' : '📞 Follow-up Call'}</div>
              <div className="step-hint">Call the lead and mark the outcome below. Next steps will appear automatically.</div>
              <div className="action-grid">
                <div className={`action-btn ${selectedAction === 'call-done' ? 'selected' : ''}`} onClick={() => handleCallAction('call-done')}>
                  <div className="action-icon">✅</div>
                  <div className="action-label">Call Completed</div>
                  <div className="action-sub">Connected & spoke</div>
                </div>
                <div className="action-btn" onClick={() => handleCallAction('rnr')}>
                  <div className="action-icon">📵</div>
                  <div className="action-label">RNR</div>
                  <div className="action-sub">No response</div>
                </div>
                <div className="action-btn" onClick={() => handleCallAction('not-reachable')}>
                  <div className="action-icon">🚫</div>
                  <div className="action-label">Not Reachable</div>
                  <div className="action-sub">Invalid / Switched off</div>
                </div>
                <div className="action-btn" onClick={() => handleCallAction('direct-meeting')}>
                  <div className="action-icon">🤝</div>
                  <div className="action-label">Direct Meeting</div>
                  <div className="action-sub">Visit in person</div>
                </div>
              </div>
            </>
          )}

          {wfStep === 'feedback' && (
            <>
              <div className="step-question">📝 Call Feedback</div>
              <div className="step-hint">What was the lead's response? What's the next action?</div>
              <div className="action-grid">
                <div className="action-btn" onClick={() => handleFeedbackSubmit('followup')}>
                  <div className="action-icon">🔄</div>
                  <div className="action-label">Follow-up</div>
                  <div className="action-sub">Set next call date</div>
                </div>
                <div className="action-btn" onClick={() => handleFeedbackSubmit('schedule-virtual')}>
                  <div className="action-icon">🎥</div>
                  <div className="action-label">Schedule Virtual Meeting</div>
                  <div className="action-sub">Book online call</div>
                </div>
                <div className="action-btn" onClick={() => handleFeedbackSubmit('converted')}>
                  <div className="action-icon">🎉</div>
                  <div className="action-label">Converted!</div>
                  <div className="action-sub">Lead onboarded</div>
                </div>
                <div className="action-btn" onClick={() => handleFeedbackSubmit('not-interested')}>
                  <div className="action-icon">❌</div>
                  <div className="action-label">Not Interested</div>
                  <div className="action-sub">Mark as lost</div>
                </div>
              </div>
              <div style={{marginTop: '14px'}}>
                <button className="btn btn-ghost btn-sm" onClick={() => setWfStep('action')}>← Back</button>
              </div>
            </>
          )}

          {wfStep === 'followup-date' && (
            <>
              <div className="step-question">📅 Set Follow-up Date</div>
              <div className="step-hint">Select the nearest available date. Custom dates require a reason.</div>
              <div className="date-grid">
                {suggestedDates?.map(d => (
                  <div 
                    key={d.date} 
                    className={`date-btn ${followUpDate === d.date ? 'selected' : ''}`}
                    onClick={() => { setFollowUpDate(d.date); setWfStep('time-pref'); }}
                  >
                    <div style={{fontSize: '10px', color: 'var(--text-muted)'}}>{d.day}</div>
                    <strong>{d.label}</strong>
                  </div>
                ))}
                <div className="date-btn custom" onClick={() => {
                  const custom = window.prompt("Enter follow-up date (YYYY-MM-DD):");
                  if (custom) {
                    setFollowUpDate(custom);
                    setWfStep('time-pref');
                  }
                }}>📅 Custom Date</div>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={() => setWfStep('feedback')}>← Back</button>
            </>
          )}

          {wfStep === 'time-pref' && (
            <>
              <div className="step-question">⏰ Preferred Time?</div>
              <div className="step-hint">Does the lead have a preferred time for the call?</div>
              <div className="time-grid">
                {['9:00 AM', '11:00 AM', '1:00 PM', '3:00 PM', '5:00 PM', 'Any Time'].map(t => (
                  <div 
                    key={t} 
                    className={`time-btn ${selectedTime === t ? 'selected' : ''}`}
                    onClick={() => {
                      setSelectedTime(t);
                      transitionLeadMutation.mutate({
                        action: 'set_followup',
                        followUpDate,
                        followUpTime: t,
                        notes: feedback
                      });
                    }}
                  >
                    {t}
                  </div>
                ))}
              </div>
              <button className="btn btn-ghost btn-sm" onClick={() => setWfStep('followup-date')}>← Back</button>
            </>
          )}
        </div>

        {/* Bottom action bar */}
        <div style={{padding: '14px 22px', background: 'var(--surface2)', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px'}}>
          <div style={{display: 'flex', gap: '8px', flexWrap: 'wrap'}}>
            <button className="escalate-btn" onClick={handleEscalate}>↑ Escalate to Manager</button>
            <button className="btn btn-ghost btn-sm" onClick={viewHistory}>📋 History</button>
            <button className="btn btn-ghost btn-sm" onClick={() => setShowAttach(true)}>📎 Attach Doc</button>
          </div>
          <div style={{fontSize: '12px', color: 'var(--text-muted)'}}>Last interaction: {lead.lastCallDate ? new Date(lead.lastCallDate).toLocaleDateString() : 'Never'}</div>
        </div>
      </div>
    </div>
  );
};

export default MyWorkToday;
