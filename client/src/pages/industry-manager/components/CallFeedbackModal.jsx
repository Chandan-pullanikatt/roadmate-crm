import React, { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Modal } from '../../../components/ui';
import { leadsApi } from '../../../api/leadsApi';
import { usersApi } from '../../../api/usersApi';
import { useToast } from '../../../context/ToastContext';

const OUTCOMES = [
  { id: 'connected',    icon: '✅', label: 'Connected',        color: '#1C6A4E', bg: '#E8F4EF', border: '#6EE7B7' },
  { id: 'followup',     icon: '📞', label: 'Follow-up',        color: '#B45309', bg: '#FEF3C7', border: '#FCD34D' },
  { id: 'meeting',      icon: '🎥', label: 'Schedule Meeting', color: '#2563EB', bg: '#EFF4FF', border: '#BFDBFE' },
  { id: 'rnr',          icon: '📵', label: 'RNR',              color: '#DC2626', bg: '#FEF2F2', border: '#FECACA' },
  { id: 'converted',    icon: '🏆', label: 'Converted!',       color: '#7C3AED', bg: '#F5F3FF', border: '#C4B5FD' },
  { id: 'not_interested', icon: '✗', label: 'Not Interested',  color: '#9B1C1C', bg: '#FEF2F2', border: '#FECACA' },
];

const TIME_SLOTS = [
  'Morning (9–11 AM)',
  'Afternoon (1–3 PM)',
  'Evening (4–6 PM)',
];

const CallFeedbackModal = ({ isOpen, onClose, lead, initialOutcome = null, onSuccess }) => {
  const queryClient = useQueryClient();
  const { addToast } = useToast();

  const [selectedOutcome, setSelectedOutcome] = useState(initialOutcome);
  const [notes, setNotes] = useState('');
  const [followUpDate, setFollowUpDate] = useState('');
  const [followUpTime, setFollowUpTime] = useState(TIME_SLOTS[0]);
  const [isCustomDate, setIsCustomDate] = useState(false);
  const [customDate, setCustomDate] = useState('');
  const [customReason, setCustomReason] = useState('');
  const [meetingType, setMeetingType] = useState('direct');
  const [meetingDate, setMeetingDate] = useState('');
  const [meetingTime, setMeetingTime] = useState('');
  const [meetingLink, setMeetingLink] = useState('');
  const [inviteeId, setInviteeId] = useState('');
  const [strategyNote, setStrategyNote] = useState('');

  // Sync initialOutcome when it changes
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
    enabled: isOpen && selectedOutcome === 'meeting',
  });

  const transitionMutation = useMutation({
    mutationFn: (data) => leadsApi.transitionLead(lead._id, data.action, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['leads', 'personal-list']);
      queryClient.invalidateQueries(['dashboard', 'executive']);
    },
  });

  const handleClose = () => {
    setNotes('');
    setStrategyNote('');
    setFollowUpDate('');
    setCustomDate('');
    setCustomReason('');
    setIsCustomDate(false);
    setMeetingDate('');
    setMeetingTime('');
    setMeetingLink('');
    setInviteeId('');
    onClose();
  };

  const handleSubmit = async () => {
    if (!selectedOutcome) {
      addToast('Please select a call outcome first', 'warning');
      return;
    }

    try {
      if (selectedOutcome === 'connected') {
        await transitionMutation.mutateAsync({ action: 'mark_called' });
        addToast('Call logged as connected.', 'success');

      } else if (selectedOutcome === 'rnr') {
        await transitionMutation.mutateAsync({ action: 'mark_rnr' });
        addToast(`RNR logged (attempt #${(lead?.rnrCount || 0) + 1}). Auto-retry scheduled.`, 'warning');

      } else if (selectedOutcome === 'followup') {
        await transitionMutation.mutateAsync({ action: 'set_feedback', nextAction: 'followup', note: notes });
        const dateValue = isCustomDate ? customDate : followUpDate;
        if (dateValue) {
          await transitionMutation.mutateAsync({
            action: 'set_followup_date',
            followUpDate: dateValue,
            followUpTime,
            isCustom: isCustomDate,
            customReason: isCustomDate ? customReason : undefined,
          });
        }
        addToast('Follow-up scheduled.', 'success');

      } else if (selectedOutcome === 'meeting') {
        if (!meetingDate) { addToast('Please set a meeting date', 'warning'); return; }
        if (meetingType === 'virtual' && !meetingLink) { addToast('Please add a meeting link', 'warning'); return; }
        const nextAction = meetingType === 'virtual' ? 'schedule_virtual' : 'direct_meeting';
        const payload = {
          action: 'set_feedback',
          nextAction,
          note: notes,
          meetingAt: `${meetingDate}T${meetingTime || '10:00'}`,
        };
        if (meetingType === 'virtual') payload.meetingLink = meetingLink;
        if (inviteeId) payload.meetingInvitees = [inviteeId];
        await transitionMutation.mutateAsync(payload);
        addToast('Meeting scheduled!', 'success');

      } else if (selectedOutcome === 'converted') {
        await transitionMutation.mutateAsync({
          action: 'set_feedback',
          nextAction: 'converted',
          note: notes,
          strategyNote: strategyNote || notes,
        });
        addToast('🎉 Lead Converted! Great work!', 'success');

      } else if (selectedOutcome === 'not_interested') {
        await transitionMutation.mutateAsync({
          action: 'set_feedback',
          nextAction: 'not_interested',
          note: notes,
          strategyNote: strategyNote || notes,
        });
        addToast('Lead marked as Not Interested.', 'warning');
      }

      handleClose();
      if (onSuccess) onSuccess();
    } catch (err) {
      addToast('Failed to save: ' + (err?.response?.data?.message || err?.message || 'Unknown error'), 'error');
    }
  };

  const managerOptions = [
    ...(hierarchy?.stateManagers?.map(u => ({ id: u._id, label: `State Manager — ${u.name}` })) || []),
    ...(hierarchy?.founders?.map(u => ({ id: u._id, label: `Founder — ${u.name}` })) || []),
  ];

  const inp = 'w-full px-3 py-2.5 text-sm border border-border rounded-xl focus:border-purple focus:ring-2 focus:ring-purple/10 outline-none transition-all bg-white';
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
          <span className="text-text-muted"> · {lead?.name}{lead?.district ? ` · ${lead.district}` : ''}</span>
        </div>

        {/* Outcome chips */}
        <div>
          <label className={lbl}>Call Outcome</label>
          <div className="flex flex-wrap gap-2 mt-1">
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

        {/* Meeting section */}
        {selectedOutcome === 'meeting' && (
          <div className="space-y-3 p-4 bg-blue-light/20 border border-blue/20 rounded-xl animate-in slide-in-from-top-2 duration-200">
            <label className={lbl + ' text-blue'}>📅 Meeting Details</label>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={lbl}>Meeting Type</label>
                <select className={inp} value={meetingType} onChange={e => setMeetingType(e.target.value)}>
                  <option value="direct">Direct / Physical</option>
                  <option value="virtual">Virtual (Video Call)</option>
                </select>
              </div>
              <div>
                <label className={lbl}>Meeting Date</label>
                <input type="date" className={inp} value={meetingDate} onChange={e => setMeetingDate(e.target.value)} />
              </div>
            </div>
            <div>
              <label className={lbl}>Meeting Time</label>
              <input type="time" className={inp} value={meetingTime} onChange={e => setMeetingTime(e.target.value)} />
            </div>
            {meetingType === 'virtual' && (
              <div>
                <label className={lbl}>Meeting Link (Zoom / Meet)</label>
                <input className={inp} placeholder="Paste Zoom / Meet link…" value={meetingLink} onChange={e => setMeetingLink(e.target.value)} />
              </div>
            )}
            {managerOptions.length > 0 && (
              <div>
                <label className={lbl}>Invite Manager / State Head</label>
                <select className={inp} value={inviteeId} onChange={e => setInviteeId(e.target.value)}>
                  <option value="">None</option>
                  {managerOptions.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
                </select>
              </div>
            )}
          </div>
        )}

        {/* Converted section */}
        {selectedOutcome === 'converted' && (
          <div className="space-y-2 p-4 bg-green-light/20 border border-green/20 rounded-xl animate-in slide-in-from-top-2 duration-200">
            <label className={lbl + ' text-green'}>🏆 Conversion Strategy</label>
            <textarea
              className={`${inp} resize-none`}
              rows={3}
              value={strategyNote}
              onChange={e => setStrategyNote(e.target.value)}
              placeholder="What strategy helped you convert this lead?"
            />
          </div>
        )}

        {/* Not interested section */}
        {selectedOutcome === 'not_interested' && (
          <div className="space-y-2 p-4 bg-red-light/20 border border-red/20 rounded-xl animate-in slide-in-from-top-2 duration-200">
            <label className={lbl + ' text-red'}>If this happens again — how would you handle it?</label>
            <textarea
              className={`${inp} resize-none`}
              rows={3}
              value={strategyNote}
              onChange={e => setStrategyNote(e.target.value)}
              placeholder="Strategy to convert similar objections in the future…"
            />
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
            className="px-6 py-2.5 rounded-xl bg-purple text-white text-sm font-bold hover:opacity-90 transition-all shadow-lg shadow-purple/20 disabled:opacity-50"
          >
            {transitionMutation.isPending ? 'Saving…' : 'Submit & Load Next Lead'}
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default CallFeedbackModal;
