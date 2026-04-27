import React, { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { leadsApi } from '../../../api/leadsApi';
import { useToast } from '../../../context/ToastContext';

const STEPS = [
  { id: 'call', label: 'Call' },
  { id: 'outcome', label: 'Outcome' },
  { id: 'feedback', label: 'Feedback' },
  { id: 'schedule', label: 'Schedule' },
];

const OUTCOMES = [
  { id: 'followup', icon: '📅', label: 'Follow Up', sub: 'Schedule next call', color: '#3B82F6', bg: '#EFF6FF' },
  { id: 'converted', icon: '🤝', label: 'Converted', sub: 'Deal closed!', color: '#059669', bg: '#ECFDF5' },
  { id: 'not_interested', icon: '❌', label: 'Not Interested', sub: 'Lead declined', color: '#DC2626', bg: '#FEF2F2' },
  { id: 'rnr', icon: '📵', label: 'RNR / No Answer', sub: 'Auto-retry logic', color: '#D97706', bg: '#FFFBEB' },
  { id: 'schedule_virtual', icon: '🎥', label: 'Virtual Meeting', sub: 'Schedule online', color: '#7C3AED', bg: '#F5F3FF' },
  { id: 'direct_meeting', icon: '🏢', label: 'Direct Meeting', sub: 'In-person visit', color: '#0891B2', bg: '#ECFEFF' },
];

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
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch suggested dates
  const { data: suggestedDates } = useQuery({
    queryKey: ['suggested-dates'],
    queryFn: () => leadsApi.getSuggestedDates().then(r => r.data),
    enabled: step === 3 && (outcome === 'followup'),
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
      addToast(`Marked as RNR (attempt #${(lead.rnrCount || 0) + 1}). Auto-retry scheduled.`, 'warning');
      onComplete();
    } catch { addToast('Failed to update', 'error'); }
    setIsSubmitting(false);
  };

  const handleFeedbackNext = () => {
    if (outcome === 'converted' || outcome === 'not_interested') {
      handleFinalSubmit(); // No scheduling needed
    } else {
      setStep(3); // Go to scheduling
    }
  };

  const handleFinalSubmit = async () => {
    setIsSubmitting(true);
    try {
      const payload = { action: 'set_feedback', nextAction: outcome, note: feedback };

      if (outcome === 'converted') {
        payload.strategyNote = strategyNote || feedback;
        await transitionMutation.mutateAsync(payload);
        addToast('🎉 Lead Converted! Strategy logged.', 'success');
      } else if (outcome === 'not_interested') {
        payload.strategyNote = strategyNote || feedback;
        await transitionMutation.mutateAsync(payload);
        addToast('Lead marked as Not Interested.', 'warning');
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
      } else if (outcome === 'schedule_virtual' || outcome === 'direct_meeting') {
        payload.meetingAt = `${meetingDate}T${meetingTime || '10:00'}`;
        if (outcome === 'schedule_virtual') payload.meetingLink = meetingLink;
        await transitionMutation.mutateAsync(payload);
        addToast('Meeting scheduled!', 'success');
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
      if (outcome === 'direct_meeting') return meetingDate;
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
              outcome={outcome}
              prompt={getStrategyPrompt()}
              feedback={feedback}
              setFeedback={setFeedback}
              strategyNote={strategyNote}
              setStrategyNote={setStrategyNote}
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
          {step === 3 && (outcome === 'schedule_virtual' || outcome === 'direct_meeting') && (
            <StepMeeting
              type={outcome}
              meetingDate={meetingDate}
              setMeetingDate={setMeetingDate}
              meetingTime={meetingTime}
              setMeetingTime={setMeetingTime}
              meetingLink={meetingLink}
              setMeetingLink={setMeetingLink}
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
            {step === 2 && (outcome === 'converted' || outcome === 'not_interested') && (
              <button className="wizard-btn wizard-btn-success" onClick={handleFinalSubmit} disabled={!canProceed() || isSubmitting}>
                {isSubmitting ? 'Saving...' : outcome === 'converted' ? '🎉 Confirm Conversion' : 'Submit & Next Lead →'}
              </button>
            )}
            {step === 2 && outcome !== 'converted' && outcome !== 'not_interested' && (
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

const StepCall = ({ lead, onCallDone }) => (
  <div className="wizard-call-prompt">
    <div className="wizard-call-icon">📞</div>
    <h3 style={{ fontSize: 20, fontWeight: 800, marginBottom: 6 }}>Call {lead.name}</h3>
    <p style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 6 }}>
      {lead.phone} · {lead.company || 'Private Client'}
    </p>
    {lead.notes && (
      <div style={{ background: 'var(--blue-light)', border: '1px solid #BFDBFE', borderRadius: 12, padding: '12px 16px', margin: '16px auto', maxWidth: 400, textAlign: 'left' }}>
        <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--blue)', textTransform: 'uppercase', marginBottom: 4 }}>Previous Notes</div>
        <p style={{ fontSize: 13, color: '#1E40AF' }}>{lead.notes}</p>
      </div>
    )}
    <button className="wizard-btn wizard-btn-primary" onClick={onCallDone} style={{ marginTop: 20, padding: '0 40px', height: 48 }}>
      ✓ Mark Call Completed
    </button>
  </div>
);

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

const StepFeedback = ({ outcome, prompt, feedback, setFeedback, strategyNote, setStrategyNote }) => (
  <div className="wizard-feedback-form">
    <div style={{ marginBottom: 4 }}>
      <h3 style={{ fontSize: 16, fontWeight: 800, marginBottom: 4 }}>
        {outcome === 'converted' ? '🎉 Congratulations!' : outcome === 'not_interested' ? 'Capture Insights' : 'Call Feedback'}
      </h3>
      <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>{prompt}</p>
    </div>
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

const StepMeeting = ({ type, meetingDate, setMeetingDate, meetingTime, setMeetingTime, meetingLink, setMeetingLink }) => (
  <div className="wizard-feedback-form">
    <div style={{ marginBottom: 4 }}>
      <h3 style={{ fontSize: 16, fontWeight: 800, marginBottom: 4 }}>
        {type === 'schedule_virtual' ? '🎥 Schedule Virtual Meeting' : '🏢 Schedule Direct Meeting'}
      </h3>
      <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Set the date, time{type === 'schedule_virtual' ? ' and meeting link' : ''}</p>
    </div>
    <div>
      <div className="wizard-field-label">Meeting Date *</div>
      <input type="date" className="input" value={meetingDate} onChange={e => setMeetingDate(e.target.value)} />
    </div>
    <div>
      <div className="wizard-field-label">Meeting Time</div>
      <input type="time" className="input" value={meetingTime} onChange={e => setMeetingTime(e.target.value)} />
    </div>
    {type === 'schedule_virtual' && (
      <div>
        <div className="wizard-field-label">Meeting Link (Zoom / Google Meet) *</div>
        <input type="url" className="input" placeholder="https://zoom.us/j/..." value={meetingLink} onChange={e => setMeetingLink(e.target.value)} />
      </div>
    )}
  </div>
);

export default LeadWizard;
