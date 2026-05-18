import React, { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Modal } from '../../../components/ui';
import { leadsApi } from '../../../api/leadsApi';
import { usersApi } from '../../../api/usersApi';
import { useToast } from '../../../context/ToastContext';

const OUTCOMES = [
  { id: 'connected',               icon: '✅', label: 'Connected',             color: '#1C6A4E', bg: '#E8F4EF', border: '#6EE7B7' },
  { id: 'followup',                icon: '📞', label: 'Follow-up',             color: '#B45309', bg: '#FEF3C7', border: '#FCD34D' },
  { id: 'schedule_virtual',        icon: '🎥', label: 'Virtual Meeting',       color: '#2563EB', bg: '#EFF4FF', border: '#BFDBFE' },
  { id: 'direct_meeting',          icon: '🏢', label: 'Direct Meeting',        color: '#0891B2', bg: '#ECFEFF', border: '#A5F3FC' },
  { id: 'rnr',                     icon: '📵', label: 'RNR',                   color: '#DC2626', bg: '#FEF2F2', border: '#FECACA' },
  { id: 'converted',               icon: '🤝', label: 'Converted',             color: '#059669', bg: '#ECFDF5', border: '#6EE7B7' },
  { id: 'blocking_amount_received', icon: '💰', label: 'Blocking Amount',       color: '#059669', bg: '#ECFDF5', border: '#6EE7B7' },
  { id: 'full_amount_received',    icon: '✅', label: 'Full Amount Received',   color: '#065F46', bg: '#D1FAE5', border: '#6EE7B7' },
  { id: 'agreement_signed',        icon: '📝', label: 'Agreement Signed',      color: '#7C3AED', bg: '#F5F3FF', border: '#C4B5FD' },
  { id: 'not_interested',          icon: '✗',  label: 'Not Interested',        color: '#9B1C1C', bg: '#FEF2F2', border: '#FECACA' },
  { id: 'escalate',                icon: '⬆️', label: 'Escalate',              color: '#7C3AED', bg: '#F5F3FF', border: '#C4B5FD' },
];

const PAYMENT_IDS = new Set(['blocking_amount_received', 'full_amount_received', 'agreement_signed']);

const TIME_SLOTS = ['Morning (9–11 AM)', 'Afternoon (1–3 PM)', 'Evening (4–6 PM)'];

const ExecCallFeedbackModal = ({ isOpen, onClose, lead, initialOutcome = null, onSuccess }) => {
  const queryClient = useQueryClient();
  const { addToast } = useToast();

  const [selectedOutcome, setSelectedOutcome] = useState(initialOutcome);
  const [notes, setNotes]                     = useState('');
  const [strategyNote, setStrategyNote]       = useState('');
  const [followUpDate, setFollowUpDate]       = useState('');
  const [followUpTime, setFollowUpTime]       = useState(TIME_SLOTS[0]);
  const [isCustomDate, setIsCustomDate]       = useState(false);
  const [customDate, setCustomDate]           = useState('');
  const [customReason, setCustomReason]       = useState('');
  const [meetingDate, setMeetingDate]         = useState('');
  const [meetingTime, setMeetingTime]         = useState('');
  const [meetingLink, setMeetingLink]         = useState('');
  const [inviteeId, setInviteeId]             = useState('');
  const [escalateTo, setEscalateTo]           = useState('');
  const [escalateReason, setEscalateReason]   = useState('');

  useEffect(() => {
    setSelectedOutcome(initialOutcome);
  }, [initialOutcome, isOpen]);

  const { data: suggestedDates } = useQuery({
    queryKey: ['suggested-dates'],
    queryFn: () => leadsApi.getSuggestedDates().then(r => r.data),
    enabled: isOpen && selectedOutcome === 'followup',
  });

  const { data: hierarchy } = useQuery({
    queryKey: ['hierarchy'],
    queryFn: () => usersApi.getHierarchy().then(r => r.data),
    enabled: isOpen && (selectedOutcome === 'schedule_virtual' || selectedOutcome === 'direct_meeting' || selectedOutcome === 'escalate'),
  });

  const transitionMutation = useMutation({
    mutationFn: (data) => leadsApi.transitionLead(lead._id, data.action, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['leads', 'workflow']);
      queryClient.invalidateQueries(['dashboard', 'executive']);
    },
  });

  const reset = () => {
    setNotes(''); setStrategyNote(''); setFollowUpDate(''); setCustomDate('');
    setCustomReason(''); setIsCustomDate(false); setMeetingDate(''); setMeetingTime('');
    setMeetingLink(''); setInviteeId(''); setEscalateTo(''); setEscalateReason('');
  };

  const handleClose = () => { reset(); onClose(); };

  const handleSubmit = async () => {
    if (!selectedOutcome) { addToast('Please select a call outcome first', 'warning'); return; }

    try {
      if (selectedOutcome === 'connected') {
        await transitionMutation.mutateAsync({ action: 'mark_called' });
        addToast('Call logged as connected.', 'success');

      } else if (selectedOutcome === 'rnr') {
        await transitionMutation.mutateAsync({ action: 'mark_rnr' });
        addToast(`RNR logged (attempt #${(lead?.rnrCount || 0) + 1}). Auto-retry scheduled.`, 'warning');

      } else if (selectedOutcome === 'followup') {
        await transitionMutation.mutateAsync({ action: 'set_feedback', nextAction: 'followup', note: notes });
        const dateVal = isCustomDate ? customDate : followUpDate;
        if (dateVal) {
          await transitionMutation.mutateAsync({
            action: 'set_followup_date',
            followUpDate: dateVal,
            followUpTime,
            isCustom: isCustomDate,
            customReason: isCustomDate ? customReason : undefined,
          });
        }
        addToast('Follow-up scheduled.', 'success');

      } else if (selectedOutcome === 'schedule_virtual') {
        if (!meetingDate) { addToast('Please set a meeting date', 'warning'); return; }
        if (!meetingLink) { addToast('Please add a meeting link', 'warning'); return; }
        await transitionMutation.mutateAsync({
          action: 'set_feedback',
          nextAction: 'schedule_virtual',
          note: notes,
          meetingAt: `${meetingDate}T${meetingTime || '10:00'}`,
          meetingLink,
          ...(inviteeId ? { meetingInvitees: [inviteeId] } : {}),
        });
        addToast('Virtual meeting scheduled!', 'success');

      } else if (selectedOutcome === 'direct_meeting') {
        if (!meetingDate) { addToast('Please set a meeting date', 'warning'); return; }
        await transitionMutation.mutateAsync({
          action: 'set_feedback',
          nextAction: 'direct_meeting',
          note: notes,
          meetingAt: `${meetingDate}T${meetingTime || '10:00'}`,
          ...(inviteeId ? { meetingInvitees: [inviteeId] } : {}),
        });
        addToast('Direct meeting scheduled!', 'success');

      } else if (selectedOutcome === 'converted') {
        await transitionMutation.mutateAsync({
          action: 'set_feedback',
          nextAction: 'converted',
          note: notes,
          strategyNote: strategyNote || notes,
        });
        addToast('🎉 Lead Converted! Great work!', 'success');

      } else if (PAYMENT_IDS.has(selectedOutcome)) {
        await transitionMutation.mutateAsync({ action: 'set_feedback', nextAction: selectedOutcome, note: notes });
        const labels = {
          blocking_amount_received: '💰 Blocking amount received!',
          full_amount_received:     '✅ Full amount received!',
          agreement_signed:         '📝 Agreement signed!',
        };
        addToast(labels[selectedOutcome], 'success');

      } else if (selectedOutcome === 'not_interested') {
        await transitionMutation.mutateAsync({
          action: 'set_feedback',
          nextAction: 'not_interested',
          note: notes,
          strategyNote: strategyNote || notes,
        });
        addToast('Lead marked as Not Interested.', 'warning');

      } else if (selectedOutcome === 'escalate') {
        if (!escalateTo) { addToast('Please select a manager to escalate to', 'warning'); return; }
        await transitionMutation.mutateAsync({
          action: 'escalate',
          escalateTo,
          note: notes + (escalateReason ? `\n\nEscalation reason: ${escalateReason}` : ''),
        });
        addToast('Lead escalated to manager.', 'success');
      }

      handleClose();
      if (onSuccess) onSuccess();
    } catch (err) {
      addToast('Failed to save: ' + (err?.response?.data?.message || err?.message || 'Unknown error'), 'error');
    }
  };

  const managerOptions = [
    ...(hierarchy?.industryManagers?.map(u => ({ id: u._id, label: `${u.name} (Industry Manager)` })) || []),
    ...(hierarchy?.stateManagers?.map(u => ({ id: u._id, label: `${u.name} (State Manager)` })) || []),
  ];

  const isMeetingType = selectedOutcome === 'schedule_virtual' || selectedOutcome === 'direct_meeting';
  const needsStrategy = selectedOutcome === 'converted' || selectedOutcome === 'not_interested';
  const inp = 'w-full px-3 py-2.5 text-sm border border-border rounded-xl focus:border-orange focus:ring-2 focus:ring-orange/10 outline-none transition-all bg-white';
  const lbl = 'block text-xs font-bold text-text-secondary mb-1.5';

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Call Feedback"
      subtitle="Log outcome · Set next action"
      className="max-w-lg"
    >
      <div className="space-y-5">
        {/* Lead context */}
        <div className="bg-surface2 px-4 py-3 rounded-xl text-sm">
          <strong className="text-text-primary">{lead?.company || lead?.name}</strong>
          {lead?.name && <span className="text-text-muted"> · {lead.name}</span>}
          {lead?.district && <span className="text-text-muted"> · {lead.district}</span>}
          {lead?.rnrCount > 0 && <span className="ml-2 text-[10px] font-bold text-amber bg-amber-light px-2 py-0.5 rounded-full">RNR ×{lead.rnrCount}</span>}
        </div>

        {/* Outcome chips */}
        <div>
          <label className={lbl}>Call Outcome</label>
          <div className="flex flex-wrap gap-2">
            {OUTCOMES.map(o => (
              <button
                key={o.id}
                onClick={() => setSelectedOutcome(o.id)}
                style={{
                  background: selectedOutcome === o.id ? o.bg : 'var(--surface)',
                  color: selectedOutcome === o.id ? o.color : 'var(--text-secondary)',
                  border: `1.5px solid ${selectedOutcome === o.id ? o.border : 'var(--border)'}`,
                  fontWeight: selectedOutcome === o.id ? 700 : 500,
                }}
                className="px-3 py-1.5 rounded-lg text-xs cursor-pointer transition-all hover:opacity-90"
              >
                {o.icon} {o.label}
              </button>
            ))}
          </div>
        </div>

        {/* Notes — always shown */}
        <div>
          <label className={lbl}>Feedback / Important Notes</label>
          <textarea
            className={`${inp} resize-none`}
            rows={3}
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="What happened in this call? Key points from conversation…"
          />
        </div>

        {/* Follow-up section */}
        {selectedOutcome === 'followup' && (
          <div className="space-y-3 p-4 bg-amber-light/20 border border-amber/20 rounded-xl animate-in slide-in-from-top-2 duration-200">
            <label className={lbl + ' text-amber'}>📅 Follow-up Details</label>
            {!isCustomDate && suggestedDates?.dates?.length > 0 && (
              <div>
                <div className="text-[10px] font-bold text-text-muted uppercase tracking-wider mb-2">Suggested Dates</div>
                <div className="flex flex-wrap gap-2">
                  {suggestedDates.dates.map(d => (
                    <button
                      key={d.value}
                      onClick={() => setFollowUpDate(d.value)}
                      style={{
                        background: followUpDate === d.value ? 'var(--amber)' : 'var(--surface)',
                        color: followUpDate === d.value ? 'white' : 'var(--text-secondary)',
                        border: `1.5px solid ${followUpDate === d.value ? 'var(--amber)' : 'var(--border)'}`,
                      }}
                      className="px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-all"
                    >
                      {d.label}
                    </button>
                  ))}
                  <button
                    onClick={() => setIsCustomDate(true)}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold border border-dashed border-border text-text-muted hover:border-amber hover:text-amber cursor-pointer transition-all"
                  >
                    + Custom Date
                  </button>
                </div>
              </div>
            )}
            {isCustomDate && (
              <div className="space-y-3">
                <div>
                  <label className={lbl}>Reason for Custom Date</label>
                  <input className={inp} placeholder="Reason required for custom dates…" value={customReason} onChange={e => setCustomReason(e.target.value)} />
                </div>
                <div>
                  <label className={lbl}>Custom Date</label>
                  <input type="date" className={inp} value={customDate} onChange={e => setCustomDate(e.target.value)} />
                </div>
                <button onClick={() => setIsCustomDate(false)} className="text-xs text-text-muted hover:text-text-primary cursor-pointer">← Back to suggestions</button>
              </div>
            )}
            <div>
              <label className={lbl}>Preferred Time</label>
              <select className={inp} value={followUpTime} onChange={e => setFollowUpTime(e.target.value)}>
                {TIME_SLOTS.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
          </div>
        )}

        {/* Meeting section (virtual or direct) */}
        {isMeetingType && (
          <div className="space-y-3 p-4 bg-blue-light/20 border border-blue/20 rounded-xl animate-in slide-in-from-top-2 duration-200">
            <label className={lbl + ' text-blue'}>
              {selectedOutcome === 'schedule_virtual' ? '🎥 Virtual Meeting Details' : '🏢 Direct Meeting Details'}
            </label>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={lbl}>Meeting Date *</label>
                <input type="date" className={inp} value={meetingDate} onChange={e => setMeetingDate(e.target.value)} />
              </div>
              <div>
                <label className={lbl}>Meeting Time</label>
                <input type="time" className={inp} value={meetingTime} onChange={e => setMeetingTime(e.target.value)} />
              </div>
            </div>
            {selectedOutcome === 'schedule_virtual' && (
              <div>
                <label className={lbl}>Meeting Link (Zoom / Google Meet) *</label>
                <input className={inp} placeholder="https://zoom.us/j/..." value={meetingLink} onChange={e => setMeetingLink(e.target.value)} />
              </div>
            )}
            {managerOptions.length > 0 && (
              <div>
                <label className={lbl}>Invite Manager (Optional)</label>
                <select className={inp} value={inviteeId} onChange={e => setInviteeId(e.target.value)}>
                  <option value="">No Manager Invited</option>
                  {managerOptions.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
                </select>
              </div>
            )}
          </div>
        )}

        {/* Converted / Not Interested — strategy */}
        {needsStrategy && (
          <div className={`space-y-2 p-4 rounded-xl animate-in slide-in-from-top-2 duration-200 ${selectedOutcome === 'converted' ? 'bg-green/5 border border-green/20' : 'bg-red-light/20 border border-red/20'}`}>
            <label className={`${lbl} ${selectedOutcome === 'converted' ? 'text-green' : 'text-red'}`}>
              {selectedOutcome === 'converted' ? '🏆 Winning Strategy Used' : '💡 How to convert this objection in future?'}
            </label>
            <textarea
              className={`${inp} resize-none`}
              rows={3}
              value={strategyNote}
              onChange={e => setStrategyNote(e.target.value)}
              placeholder={selectedOutcome === 'converted' ? 'What approach closed this deal? Helps the whole team…' : 'Strategy to convert similar objections in the future…'}
            />
          </div>
        )}

        {/* Escalate section */}
        {selectedOutcome === 'escalate' && (
          <div className="space-y-3 p-4 bg-purple-light/20 border border-purple/20 rounded-xl animate-in slide-in-from-top-2 duration-200">
            <label className={lbl + ' text-purple'}>⬆️ Escalate to Manager</label>
            {managerOptions.length > 0 ? (
              <div>
                <label className={lbl}>Select Manager *</label>
                <select className={inp} value={escalateTo} onChange={e => setEscalateTo(e.target.value)}>
                  <option value="">— Select manager —</option>
                  {managerOptions.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
                </select>
              </div>
            ) : (
              <p className="text-xs text-text-muted italic">No managers found in your hierarchy.</p>
            )}
            <div>
              <label className={lbl}>Escalation Reason (Optional)</label>
              <textarea
                className={`${inp} resize-none`}
                rows={2}
                value={escalateReason}
                onChange={e => setEscalateReason(e.target.value)}
                placeholder="Why does this lead need manager attention?"
              />
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 pt-2 border-t border-border">
          <button onClick={handleClose} className="px-5 py-2.5 rounded-xl border border-border text-sm font-bold text-text-secondary hover:bg-surface2 transition-all">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={transitionMutation.isPending}
            className="px-6 py-2.5 rounded-xl bg-[#B45309] text-white text-sm font-bold hover:bg-[#92400E] transition-all shadow-lg shadow-orange/20 disabled:opacity-50"
          >
            {transitionMutation.isPending ? 'Saving…' : 'Submit & Next Lead →'}
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default ExecCallFeedbackModal;
