import React, { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { leadsApi } from '../../../api/leadsApi';
import { usersApi } from '../../../api/usersApi';
import { useToast } from '../../../context/ToastContext';
import { FileUpload } from '../../../components/ui';

const STEPS = [
  { id: 'call', label: 'Call' },
  { id: 'outcome', label: 'Outcome' },
  { id: 'feedback', label: 'Feedback' },
  { id: 'schedule', label: 'Schedule' },
];

const OUTCOMES = [
  { id: 'followup', icon: '📅', label: 'Follow Up', sub: 'Schedule next call', color: '#3B82F6', bg: '#EFF6FF' },
  // 'Converted' is no longer chosen directly — a lead becomes Converted only
  // once Full Amount Received and Agreement Signed have both been recorded.
  { id: 'blocking_amount_received', icon: '💰', label: 'Blocking Amount', sub: 'Partial payment received', color: '#059669', bg: '#ECFDF5' },
  { id: 'full_amount_received', icon: '✅', label: 'Full Amount Received', sub: 'Complete payment collected', color: '#065F46', bg: '#D1FAE5' },
  { id: 'agreement_signed', icon: '📝', label: 'Agreement Signed', sub: 'Contract completed', color: '#7C3AED', bg: '#F5F3FF' },
  { id: 'not_interested', icon: '❌', label: 'Not Interested', sub: 'Lead declined', color: '#DC2626', bg: '#FEF2F2' },
  { id: 'rnr', icon: '📵', label: 'RNR / No Answer', sub: 'Auto-retry logic', color: '#D97706', bg: '#FFFBEB' },
  { id: 'schedule_virtual', icon: '🎥', label: 'Virtual Meeting', sub: 'Schedule online', color: '#7C3AED', bg: '#F5F3FF' },
  { id: 'direct_meeting', icon: '🏢', label: 'Direct Meeting', sub: 'In-person visit', color: '#0891B2', bg: '#ECFEFF' },
  { id: 'reschedule', icon: '🔄', label: 'Reschedule', sub: 'Change meeting time', color: '#0891B2', bg: '#ECFEFF' },
  { id: 'escalate', icon: '⬆️', label: 'Escalate', sub: 'Send to Manager', color: '#7C3AED', bg: '#F5F3FF' },
];

const PAYMENT_OUTCOMES = new Set(['blocking_amount_received', 'full_amount_received', 'agreement_signed']);

const LeadWizard = ({ lead, onComplete, queueLength, currentIndex }) => {
  const queryClient = useQueryClient();
  const { addToast } = useToast();
  
  const [step, setStep] = useState(0);
  const [outcome, setOutcome] = useState(null);
  const [feedback, setFeedback] = useState('');
  const [strategyNote, setStrategyNote] = useState('');
  const [selectedDate, setSelectedDate] = useState(null);
  const [showCustomDate, setShowCustomDate] = useState(false);
  const [customDate, setCustomDate] = useState('');
  const [customReason, setCustomReason] = useState('');
  const [customTime, setCustomTime] = useState('');
  const [meetingLink, setMeetingLink] = useState('');
  const [meetingDate, setMeetingDate] = useState('');
  const [meetingTime, setMeetingTime] = useState('');
  const [escalatedTo, setEscalatedTo] = useState(null);
  const [escalationReason, setEscalationReason] = useState('');
  const [inviteeId, setInviteeId] = useState('');
  const [documents, setDocuments] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch suggested dates
  const { data: suggestedDates } = useQuery({
    queryKey: ['suggested-dates'],
    queryFn: () => leadsApi.getSuggestedDates().then(r => r.data),
    enabled: step === 3 && (outcome === 'followup'),
  });

  // Fetch hierarchy for escalation & meeting invites
  const { data: hierarchy } = useQuery({
    queryKey: ['hierarchy'],
    queryFn: () => usersApi.getHierarchy().then(r => r.data),
    enabled: step === 3 && (outcome === 'escalate' || outcome === 'schedule_virtual' || outcome === 'direct_meeting' || outcome === 'reschedule')
  });

  // Reset on new lead
  useEffect(() => {
    setStep(0);
    setOutcome(null);
    setFeedback('');
    setStrategyNote('');
    setSelectedDate(null);
    setShowCustomDate(false);
    setCustomDate('');
    setCustomReason('');
    setCustomTime('');
    setMeetingLink('');
    setMeetingDate('');
    setMeetingTime('');
    setDocuments([]);
  }, [lead?._id]);

  const transitionMutation = useMutation({
    mutationFn: (data) => leadsApi.transitionLead(lead._id, data.action, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['leads', 'workflow']);
      queryClient.invalidateQueries(['dashboard', 'executive']);
    }
  });

  if (!lead) {
    return (
      <div className="wizard-lead-card">
        <div className="wizard-lead-body" style={{ textAlign: 'center', padding: '60px 20px' }}>
          <div className="wizard-complete-anim">
            <div style={{ fontSize: 56, marginBottom: 16 }}>✨</div>
            <h2 style={{ fontSize: 24, fontWeight: 800, marginBottom: 8 }}>All Tasks Completed!</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>Great work! Check your pipeline or take a break.</p>
          </div>
        </div>
      </div>
    );
  }

  // ── Meeting confirmation task: show dedicated UI instead of normal call flow
  const CONFIRM_SUBSTATUS = ['pre_meeting_confirm', 'day_before_confirm', 'day_before_queued', '30m_confirm_queued'];
  if (lead.subStatus && CONFIRM_SUBSTATUS.includes(lead.subStatus)) {
    return <MeetingConfirmCard lead={lead} onComplete={onComplete} />;
  }

  const handleCallDone = () => {
    transitionMutation.mutate({ action: 'mark_called' });
    setStep(1);
  };

  const handleOutcomeSelect = (id) => {
    setOutcome(id);
    if (id === 'rnr') {
      // RNR → submit immediately and go to next lead
      handleSubmitRNR();
    } else {
      setStep(2); // Go to feedback
    }
  };

  const handleSubmitRNR = async () => {
    setIsSubmitting(true);
    try {
      await transitionMutation.mutateAsync({ action: 'mark_rnr' });

      // Show a context-aware toast for DM-day vs normal RNR
      const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
      const todayEnd   = new Date(); todayEnd.setHours(23, 59, 59, 999);
      const meetingAt  = lead.meetingAt ? new Date(lead.meetingAt) : null;
      const isDMDay    = lead.status === 'meeting_direct' &&
                         meetingAt && meetingAt >= todayStart && meetingAt <= todayEnd;

      if (isDMDay) {
        const oneHourFromNow = new Date(Date.now() + 60 * 60 * 1000);
        const retryAt  = oneHourFromNow < meetingAt ? oneHourFromNow : meetingAt;
        const retryStr = retryAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const mtgStr   = meetingAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        addToast(`RNR logged. Next retry at ${retryStr} — meeting at ${mtgStr}.`, 'warning');
      } else {
        addToast(`Marked as RNR (attempt #${(lead.rnrCount || 0) + 1}). Auto-retry scheduled.`, 'warning');
      }

      onComplete();
    } catch { addToast('Failed to update', 'error'); }
    setIsSubmitting(false);
  };

  const handleFeedbackNext = () => {
    if (outcome === 'converted' || outcome === 'not_interested' || PAYMENT_OUTCOMES.has(outcome)) {
      handleFinalSubmit(); // No scheduling needed
    } else {
      setStep(3); // Go to scheduling
    }
  };

  const handleFinalSubmit = async () => {
    setIsSubmitting(true);
    try {
      const payload = { action: 'set_feedback', nextAction: outcome, note: feedback, documents };

      if (outcome === 'converted') {
        payload.strategyNote = strategyNote || feedback;
        await transitionMutation.mutateAsync(payload);
        addToast('🎉 Lead Converted! Strategy logged.', 'success');
      } else if (outcome === 'not_interested') {
        payload.strategyNote = strategyNote || feedback;
        await transitionMutation.mutateAsync(payload);
        addToast('Lead marked as Not Interested.', 'warning');
      } else if (PAYMENT_OUTCOMES.has(outcome)) {
        await transitionMutation.mutateAsync(payload);
        const PAYMENT_LABELS = {
          blocking_amount_received: '💰 Blocking amount received!',
          full_amount_received: '✅ Full amount received!',
          agreement_signed: '📝 Agreement signed — onboarding complete!',
        };
        addToast(PAYMENT_LABELS[outcome], 'success');
      } else if (outcome === 'followup') {
        await transitionMutation.mutateAsync(payload);
        const dateValue = showCustomDate ? customDate : selectedDate;
        if (dateValue) {
          await transitionMutation.mutateAsync({
            action: 'set_followup_date',
            followUpDate: dateValue,
            followUpTime: customTime || '10:00',
            isCustom: showCustomDate,
            customReason: customReason,
          });
        }
        addToast('Follow-up scheduled successfully!', 'success');
      } else if (outcome === 'schedule_virtual' || outcome === 'direct_meeting' || outcome === 'reschedule') {
        payload.meetingAt = `${meetingDate}T${meetingTime || '10:00'}`;
        if (outcome === 'schedule_virtual') payload.meetingLink = meetingLink;
        if (inviteeId) payload.meetingInvitees = [inviteeId];
        await transitionMutation.mutateAsync(payload);
        addToast(outcome === 'reschedule' ? 'Meeting rescheduled!' : 'Meeting scheduled!', 'success');
      } else if (outcome === 'escalate') {
        if (!escalatedTo) throw new Error('Please select a manager to escalate to');
        await transitionMutation.mutateAsync({
          action: 'escalate',
          escalateTo: escalatedTo,
          note: feedback + (escalationReason ? `\n\nReason: ${escalationReason}` : '')
        });
        addToast('Lead escalated to manager.', 'success');
      }

      onComplete();
    } catch (err) {
      addToast('Failed to save: ' + (err?.message || 'Unknown error'), 'error');
    }
    setIsSubmitting(false);
  };

  const canProceed = () => {
    if (step === 2) return feedback.trim().length > 0;
    if (step === 3) {
      if (outcome === 'followup') return selectedDate || (showCustomDate && customDate && customReason);
      if (outcome === 'schedule_virtual') return meetingDate && meetingLink;
      if (outcome === 'direct_meeting' || outcome === 'reschedule') return meetingDate;
      if (outcome === 'escalate') return escalatedTo;
      return true;
    }
    return true;
  };

  const getStepStatus = (idx) => {
    if (idx < step) return 'done';
    if (idx === step) return 'active';
    return '';
  };

  // Strategy prompt text
  const getStrategyPrompt = () => {
    if (outcome === 'converted') return 'What strategy helped you convert this lead?';
    if (outcome === 'not_interested') return 'How could this lead be converted in the future?';
    return 'Enter your call feedback and important notes';
  };

  return (
    <div className="wizard-lead-card">
      {/* Header with lead info */}
      <div className="wizard-lead-header">
        <div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <span className="tag tag-amber" style={{ fontSize: 10 }}>{lead.priority?.toUpperCase() || 'NEW'}</span>
            <span className="tag tag-gray" style={{ fontSize: 10 }}>{lead.industry?.toUpperCase() || 'GENERAL'}</span>
            {lead.rnrCount > 0 && <span className="tag tag-red" style={{ fontSize: 10 }}>RNR ×{lead.rnrCount}</span>}
          </div>
          <h2 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.5px' }}>{lead.company || lead.name}</h2>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
            {lead.name} · {lead.phone} · {lead.district || lead.state || ''}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            Lead {currentIndex} of {queueLength}
          </div>
          {lead.expectedRevenue > 0 && (
            <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--accent)', marginTop: 4 }}>
              ₹{(lead.expectedRevenue / 100000).toFixed(1)}L
            </div>
          )}
        </div>
      </div>

      {/* Stepper */}
      <div style={{ padding: '20px 28px 0' }}>
        <div className="wizard-stepper">
          {STEPS.map((s, i) => (
            <div key={s.id} className={`wizard-step ${getStepStatus(i)}`}>
              <div className="wizard-step-dot">{i < step ? '✓' : i + 1}</div>
              <span className="wizard-step-label">{s.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Step Content */}
      <div className="wizard-lead-body" key={step}>
        <div className="wizard-step-content">
          {step === 0 && <StepCall lead={lead} onCallDone={handleCallDone} />}
          {step === 1 && <StepOutcome onSelect={handleOutcomeSelect} />}
          {step === 2 && (
            <StepFeedback
              leadId={lead._id}
              outcome={outcome}
              prompt={getStrategyPrompt()}
              feedback={feedback}
              setFeedback={setFeedback}
              strategyNote={strategyNote}
              setStrategyNote={setStrategyNote}
              documents={documents}
              setDocuments={setDocuments}
            />
          )}
          {step === 3 && outcome === 'followup' && (
            <StepFollowUp
              suggestedDates={suggestedDates || []}
              selectedDate={selectedDate}
              setSelectedDate={setSelectedDate}
              showCustomDate={showCustomDate}
              setShowCustomDate={setShowCustomDate}
              customDate={customDate}
              setCustomDate={setCustomDate}
              customReason={customReason}
              setCustomReason={setCustomReason}
              customTime={customTime}
              setCustomTime={setCustomTime}
            />
          )}
          {step === 3 && (outcome === 'schedule_virtual' || outcome === 'direct_meeting' || outcome === 'reschedule') && (
            <StepMeeting
              type={outcome}
              meetingDate={meetingDate}
              setMeetingDate={setMeetingDate}
              meetingTime={meetingTime}
              setMeetingTime={setMeetingTime}
              meetingLink={meetingLink}
              setMeetingLink={setMeetingLink}
              managers={hierarchy?.industryManagers || []}
              inviteeId={inviteeId}
              setInviteeId={setInviteeId}
            />
          )}
          {step === 3 && outcome === 'escalate' && (
            <StepEscalate
              managers={hierarchy?.industryManagers || []}
              selectedId={escalatedTo}
              setSelectedId={setEscalatedTo}
              reason={escalationReason}
              setReason={setEscalationReason}
            />
          )}
        </div>
      </div>

      {/* Footer */}
      {step > 0 && (
        <div className="wizard-footer">
          <button className="wizard-btn wizard-btn-secondary" onClick={() => setStep(s => s - 1)} disabled={isSubmitting}>
            ← Back
          </button>
          <div style={{ display: 'flex', gap: 10 }}>
            {step === 2 && (outcome === 'converted' || outcome === 'not_interested' || PAYMENT_OUTCOMES.has(outcome)) && (
              <button className="wizard-btn wizard-btn-success" onClick={handleFinalSubmit} disabled={!canProceed() || isSubmitting}>
                {isSubmitting ? 'Saving...' :
                  outcome === 'converted' ? '🎉 Confirm Conversion' :
                  outcome === 'agreement_signed' ? '📝 Confirm Agreement' :
                  outcome === 'blocking_amount_received' ? '💰 Confirm Payment' :
                  outcome === 'full_amount_received' ? '✅ Confirm Full Payment' :
                  'Submit & Next Lead →'}
              </button>
            )}
            {step === 2 && outcome !== 'converted' && outcome !== 'not_interested' && !PAYMENT_OUTCOMES.has(outcome) && (
              <button className="wizard-btn wizard-btn-primary" onClick={handleFeedbackNext} disabled={!canProceed() || isSubmitting}>
                Next: Schedule →
              </button>
            )}
            {step === 3 && (
              <button className="wizard-btn wizard-btn-success" onClick={handleFinalSubmit} disabled={!canProceed() || isSubmitting}>
                {isSubmitting ? 'Saving...' : 'Confirm & Next Lead →'}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

/* ─── Sub-components for each step ─── */

const StepCall = ({ lead, onCallDone }) => {
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  const todayEnd   = new Date(); todayEnd.setHours(23, 59, 59, 999);
  const meetingAt  = lead.meetingAt ? new Date(lead.meetingAt) : null;
  const isDMDay    = lead.status === 'meeting_direct' &&
                     meetingAt && meetingAt >= todayStart && meetingAt <= todayEnd;

  return (
    <div className="wizard-call-prompt">
      {isDMDay && (
        <div style={{
          background: '#FFF7ED', border: '1px solid #FED7AA', borderRadius: 12,
          padding: '10px 16px', marginBottom: 16, display: 'flex', gap: 10, alignItems: 'center',
          maxWidth: 420, margin: '0 auto 16px'
        }}>
          <span style={{ fontSize: 18 }}>📍</span>
          <div style={{ fontSize: 12, color: '#C2410C', fontWeight: 600, lineHeight: 1.5 }}>
            Direct meeting today at{' '}
            <strong>{meetingAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</strong>.
            Confirm with the lead before meeting time.
            If RNR, retries every hour until then.
          </div>
        </div>
      )}
      <div className="wizard-call-icon">📞</div>
      <h3 style={{ fontSize: 20, fontWeight: 800, marginBottom: 6 }}>Call {lead.name}</h3>
      <p style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 6 }}>
        {lead.phone} · {lead.company || 'Private Client'}
      </p>
      {lead.notes && (
        <div style={{ background: 'var(--blue-light)', border: '1px solid #BFDBFE', borderRadius: 12, padding: '10px 14px', margin: '12px auto', maxWidth: 400, textAlign: 'left' }}>
          <div style={{ fontSize: 9, fontWeight: 800, color: 'var(--blue)', textTransform: 'uppercase', marginBottom: 2 }}>Previous Notes</div>
          <p style={{ fontSize: 12, color: '#1E40AF', lineHeight: 1.4 }}>{lead.notes}</p>
        </div>
      )}
      <button className="wizard-btn wizard-btn-primary" onClick={onCallDone} style={{ marginTop: 12, padding: '0 40px', height: 44 }}>
        ✓ Mark Call Completed
      </button>
    </div>
  );
};

const StepOutcome = ({ onSelect }) => (
  <div>
    <div style={{ marginBottom: 20 }}>
      <h3 style={{ fontSize: 16, fontWeight: 800, marginBottom: 4 }}>What's the outcome?</h3>
      <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Select what happened on this call</p>
    </div>
    <div className="wizard-outcomes">
      {OUTCOMES.map(o => (
        <button key={o.id} className="wizard-outcome-btn" onClick={() => onSelect(o.id)}>
          <div className="wizard-outcome-icon" style={{ background: o.bg, color: o.color }}>{o.icon}</div>
          <div className="wizard-outcome-label">{o.label}</div>
          <div className="wizard-outcome-sub">{o.sub}</div>
        </button>
      ))}
    </div>
  </div>
);

const StepFeedback = ({ leadId, outcome, prompt, feedback, setFeedback, strategyNote, setStrategyNote, documents, setDocuments }) => (
  <div className="wizard-feedback-form">
    <div style={{ marginBottom: 4 }}>
      <h3 style={{ fontSize: 16, fontWeight: 800, marginBottom: 4 }}>
        {outcome === 'converted' ? '🎉 Congratulations!' : outcome === 'not_interested' ? 'Capture Insights' : 'Call Feedback'}
      </h3>
      <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>{prompt}</p>
    </div>
    <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 20 }}>
      <div className="space-y-4">
        <div>
          <div className="wizard-field-label">Feedback & Important Notes *</div>
          <textarea className="wizard-textarea" placeholder="What was discussed? Key points from the call..." value={feedback} onChange={e => setFeedback(e.target.value)} autoFocus />
        </div>
        {(outcome === 'converted' || outcome === 'not_interested') && (
          <div>
            <div className="wizard-field-label">
              {outcome === 'converted' ? '🏆 Winning Strategy Used' : '💡 How could we convert similar leads?'}
            </div>
            <textarea className="wizard-textarea" style={{ minHeight: 80 }} placeholder={outcome === 'converted' ? 'What approach worked? This helps the team...' : 'If this situation arises again, how to manage?'} value={strategyNote} onChange={e => setStrategyNote(e.target.value)} />
          </div>
        )}
      </div>
      
      <div className="space-y-4">
        <div>
          <div className="wizard-field-label">Attach Document (Optional)</div>
          <FileUpload 
            folder="lead-docs"
            entityId={leadId}
            onUploadComplete={(file) => setDocuments(prev => [...prev, file])}
          />
          {documents.length > 0 && (
            <div className="mt-3 space-y-2">
              {documents.map((doc, idx) => (
                <div key={idx} className="flex items-center justify-between p-2 bg-surface2/50 rounded-lg border border-border text-[11px]">
                  <span className="truncate max-w-[120px] font-medium">{doc.name}</span>
                  <button className="text-red hover:text-red-dark" onClick={() => setDocuments(prev => prev.filter((_, i) => i !== idx))}>×</button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  </div>
);

const StepFollowUp = ({ suggestedDates, selectedDate, setSelectedDate, showCustomDate, setShowCustomDate, customDate, setCustomDate, customReason, setCustomReason, customTime, setCustomTime }) => (
  <div>
    <div style={{ marginBottom: 20 }}>
      <h3 style={{ fontSize: 16, fontWeight: 800, marginBottom: 4 }}>Schedule Follow-Up</h3>
      <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Pick a suggested date or choose your own</p>
    </div>
    <div className="wizard-dates">
      {(suggestedDates || []).map((d, i) => (
        <button key={d.value} className={`wizard-date-btn ${selectedDate === d.value && !showCustomDate ? 'selected' : ''}`} onClick={() => { setSelectedDate(d.value); setShowCustomDate(false); }}>
          <div className="date-icon">{selectedDate === d.value && !showCustomDate ? '✓' : '📅'}</div>
          <div>
            <div className="date-text">{d.label}</div>
            <div className="date-sub">{i === 0 ? 'Recommended — Next working day' : `${i + 1} days from now`}</div>
          </div>
        </button>
      ))}
    </div>
    <button className="wizard-custom-date-toggle" onClick={() => setShowCustomDate(!showCustomDate)}>
      {showCustomDate ? '↑ Use suggested dates' : '📆 Need a custom date?'}
    </button>
    {showCustomDate && (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '12px 0' }}>
        <div>
          <div className="wizard-field-label">Custom Date *</div>
          <input type="date" className="input" value={customDate} onChange={e => setCustomDate(e.target.value)} />
        </div>
        <div>
          <div className="wizard-field-label">Preferred Time</div>
          <input type="time" className="input" value={customTime} onChange={e => setCustomTime(e.target.value)} />
        </div>
        <div>
          <div className="wizard-field-label">Reason for custom date *</div>
          <textarea className="wizard-textarea" style={{ minHeight: 60 }} placeholder="Why do you need a specific date? (Required)" value={customReason} onChange={e => setCustomReason(e.target.value)} />
        </div>
      </div>
    )}
  </div>
);

const StepMeeting = ({ type, meetingDate, setMeetingDate, meetingTime, setMeetingTime, meetingLink, setMeetingLink, managers, inviteeId, setInviteeId }) => (
  <div className="wizard-feedback-form">
    <div style={{ marginBottom: 4 }}>
      <h3 style={{ fontSize: 16, fontWeight: 800, marginBottom: 4 }}>
        {type === 'schedule_virtual' ? '🎥 Schedule Virtual Meeting' : 
         type === 'reschedule' ? '🔄 Reschedule Meeting' : '🏢 Schedule Direct Meeting'}
      </h3>
      <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
        {type === 'reschedule' ? 'Select the new date and time for this meeting' : `Set the date, time${type === 'schedule_virtual' ? ' and meeting link' : ''}`}
      </p>
    </div>
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
      <div>
        <div className="wizard-field-label">Meeting Date *</div>
        <input type="date" className="input" value={meetingDate} onChange={e => setMeetingDate(e.target.value)} />
      </div>
      <div>
        <div className="wizard-field-label">Meeting Time</div>
        <input type="time" className="input" value={meetingTime} onChange={e => setMeetingTime(e.target.value)} />
      </div>
    </div>
    {type === 'schedule_virtual' && (
      <div>
        <div className="wizard-field-label">Meeting Link (Zoom / Google Meet) *</div>
        <input type="url" className="input" placeholder="https://zoom.us/j/..." value={meetingLink} onChange={e => setMeetingLink(e.target.value)} />
      </div>
    )}
    <div style={{ marginTop: 8 }}>
      <div className="wizard-field-label">Invite Manager (Optional)</div>
      <select className="select" value={inviteeId} onChange={e => setInviteeId(e.target.value)}>
        <option value="">No Manager Invited</option>
        {managers.map(m => <option key={m._id} value={m._id}>{m.name} ({m.role?.replace('_', ' ')})</option>)}
      </select>
      <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
        Manager will receive a real-time notification.
      </p>
    </div>
  </div>
);

const StepEscalate = ({ managers, selectedId, setSelectedId, reason, setReason }) => (
  <div className="wizard-feedback-form">
    <div style={{ marginBottom: 4 }}>
      <h3 style={{ fontSize: 16, fontWeight: 800, marginBottom: 4 }}>⬆️ Escalate to Manager</h3>
      <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Choose which manager should handle this lead</p>
    </div>
    <div style={{ display: 'grid', gap: 12, marginTop: 16 }}>
      {managers.length > 0 ? managers.map(m => (
        <button key={m._id} className={`wizard-date-btn ${selectedId === m._id ? 'selected' : ''}`} 
          style={{ textAlign: 'left', padding: '12px 16px' }}
          onClick={() => setSelectedId(m._id)}>
          <div className="date-icon">{selectedId === m._id ? '✓' : '👤'}</div>
          <div>
            <div className="date-text">{m.name}</div>
            <div className="date-sub">{m.role?.replace('_', ' ').toUpperCase()} · {m.industry}</div>
          </div>
        </button>
      )) : (
        <div style={{ padding: 20, textAlign: 'center', background: 'var(--surface)', borderRadius: 12, border: '1px dashed var(--border)' }}>
          <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>No direct managers found in your hierarchy.</p>
        </div>
      )}
    </div>
    <div style={{ marginTop: 20 }}>
      <div className="wizard-field-label">Escalation Context (Optional)</div>
      <textarea className="wizard-textarea" style={{ minHeight: 80 }} 
        placeholder="Provide additional details for the manager..." 
        value={reason} onChange={e => setReason(e.target.value)} />
    </div>
  </div>
);

/* ─── Meeting Confirmation Card ─────────────────────────────────────────── */

const MeetingConfirmCard = ({ lead, onComplete }) => {
  const queryClient = useQueryClient();
  const { addToast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showReschedule, setShowReschedule] = useState(false);
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleTime, setRescheduleTime] = useState('');

  const { mutateAsync } = useMutation({
    mutationFn: (data) => leadsApi.transitionLead(lead._id, data.action, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['leads', 'workflow']);
      queryClient.invalidateQueries(['dashboard', 'executive']);
    },
  });

  const isVM       = lead.status === 'meeting_virtual';
  const meetingAt  = lead.meetingAt ? new Date(lead.meetingAt) : null;
  const is30m      = lead.subStatus === '30m_confirm_queued';
  const isDayBefore = lead.subStatus === 'day_before_confirm' || lead.subStatus === 'day_before_queued';

  const taskLabel = is30m
    ? '⚡ Final Check — 30 Minutes to Meeting!'
    : isDayBefore
    ? "📅 Confirm Tomorrow's Meeting"
    : 'Confirm Meeting with Lead';

  const submit = async (action, payload = {}) => {
    setIsSubmitting(true);
    try {
      await mutateAsync({ action, ...payload });
      onComplete();
    } catch {
      addToast('Failed to save. Please try again.', 'error');
    }
    setIsSubmitting(false);
  };

  const handleConfirm = () => {
    submit('confirm_meeting', { note: `Meeting confirmed (${is30m ? '30-min check' : isDayBefore ? 'day-before' : 'initial'})` });
    addToast('Meeting confirmed ✓', 'success');
  };

  const handleRNR = () => {
    submit('mark_rnr');
    addToast('RNR logged. Lead will retry.', 'warning');
  };

  const handleReschedule = () => {
    if (!rescheduleDate) return;
    submit('set_feedback', {
      nextAction: 'reschedule',
      note: 'Rescheduled during confirmation call',
      meetingAt: `${rescheduleDate}T${rescheduleTime || '10:00'}`,
    });
    addToast('Meeting rescheduled!', 'success');
  };

  return (
    <div className="wizard-lead-card">
      {/* Header */}
      <div className="wizard-lead-header">
        <div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <span className={`tag ${isVM ? 'tag-blue' : 'tag-amber'}`} style={{ fontSize: 10 }}>
              {isVM ? '🎥 VIRTUAL' : '📍 DIRECT'}
            </span>
            {is30m && <span className="tag tag-red" style={{ fontSize: 10 }}>30 MIN!</span>}
          </div>
          <h2 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.5px' }}>{lead.company || lead.name}</h2>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
            {lead.name} · {lead.phone}
          </div>
        </div>
        {meetingAt && (
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Meeting</div>
            <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--accent)', marginTop: 4 }}>
              {meetingAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </div>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)' }}>
              {meetingAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>
        )}
      </div>

      {/* Body */}
      <div className="wizard-lead-body">
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div className="wizard-call-icon" style={{ background: 'linear-gradient(135deg, #3B82F6, #6366F1)' }}>
            {isVM ? '🎥' : '📍'}
          </div>
          <h3 style={{ fontSize: 17, fontWeight: 800, marginTop: 16, marginBottom: 6 }}>{taskLabel}</h3>
          <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            Call the lead to confirm this meeting will go ahead as planned.
          </p>
        </div>

        {/* VM meeting link */}
        {isVM && lead.meetingLink && (
          <div style={{ background: 'var(--blue-light)', border: '1px solid #BFDBFE', borderRadius: 12, padding: '10px 16px', marginBottom: 20 }}>
            <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--blue)', textTransform: 'uppercase', marginBottom: 4 }}>Meeting Link to Share</div>
            <a href={lead.meetingLink} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: 'var(--blue)', wordBreak: 'break-all' }}>
              {lead.meetingLink}
            </a>
          </div>
        )}

        {/* Inline reschedule form or main action buttons */}
        {showReschedule ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <h4 style={{ fontSize: 14, fontWeight: 800 }}>Pick a New Date & Time</h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <div className="wizard-field-label">New Date *</div>
                <input type="date" className="input" value={rescheduleDate} onChange={e => setRescheduleDate(e.target.value)} />
              </div>
              <div>
                <div className="wizard-field-label">New Time</div>
                <input type="time" className="input" value={rescheduleTime} onChange={e => setRescheduleTime(e.target.value)} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
              <button className="wizard-btn wizard-btn-secondary" style={{ flex: 1 }} onClick={() => setShowReschedule(false)} disabled={isSubmitting}>
                ← Back
              </button>
              <button className="wizard-btn wizard-btn-success" style={{ flex: 1 }} onClick={handleReschedule} disabled={!rescheduleDate || isSubmitting}>
                {isSubmitting ? 'Saving...' : 'Confirm Reschedule'}
              </button>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <button className="wizard-btn wizard-btn-success" onClick={handleConfirm} disabled={isSubmitting} style={{ height: 46 }}>
              {isSubmitting ? 'Saving...' : '✅ Meeting Confirmed'}
            </button>
            <button className="wizard-btn wizard-btn-secondary" onClick={() => setShowReschedule(true)} disabled={isSubmitting}>
              🔄 Need to Reschedule
            </button>
            <button className="wizard-btn wizard-btn-secondary" style={{ color: '#B91C1C' }} onClick={handleRNR} disabled={isSubmitting}>
              📵 Lead Not Reachable
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default LeadWizard;
