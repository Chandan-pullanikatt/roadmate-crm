import React, { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Modal } from '../../../components/ui';
import { leadsApi } from '../../../api/leadsApi';
import { usersApi } from '../../../api/usersApi';
import { useToast } from '../../../context/ToastContext';

const OUTCOMES = [
  { id: 'connected',               icon: '✅', label: 'Connected',          color: '#1C6A4E', bg: '#E8F4EF', border: '#6EE7B7' },
  { id: 'followup',                icon: '📞', label: 'Follow-up',          color: '#B45309', bg: '#FEF3C7', border: '#FCD34D' },
  { id: 'meeting',                 icon: '🎥', label: 'Schedule Meeting',   color: '#2563EB', bg: '#EFF4FF', border: '#BFDBFE' },
  { id: 'rnr',                     icon: '📵', label: 'RNR',                color: '#DC2626', bg: '#FEF2F2', border: '#FECACA' },
  { id: 'blocking_amount_received',icon: '💰', label: 'Blocking Amount',    color: '#D97706', bg: '#FFFBEB', border: '#FCD34D' },
  // 'Converted' is no longer chosen directly — a lead becomes Converted only
  // once Full Amount Received and Agreement Signed have both been recorded.
  { id: 'not_interested',          icon: '✗',  label: 'Not Interested',     color: '#9B1C1C', bg: '#FEF2F2', border: '#FECACA' },
];

const TIME_SLOTS = [
  'Morning (9–11 AM)',
  'Afternoon (1–3 PM)',
  'Evening (4–6 PM)',
];

const PRIORITIES = [
  { id: 'hot',  icon: '🔥', label: 'Hot',  color: '#B45309', bg: '#FEF3C7', border: '#FCD34D', def: 'Interested, budget available, meeting done' },
  { id: 'warm', icon: '☀️', label: 'Warm', color: '#2563EB', bg: '#EFF4FF', border: '#BFDBFE', def: 'Interested but undecided' },
  { id: 'cold', icon: '❄️', label: 'Cold', color: '#6B7280', bg: '#F3F4F6', border: '#D1D5DB', def: 'Not ready / no response' },
];

const CallFeedbackModal = ({ isOpen, onClose, lead, initialOutcome = null, onSuccess }) => {
  const queryClient = useQueryClient();
  const { addToast } = useToast();

  const [selectedOutcome, setSelectedOutcome] = useState(initialOutcome);
  const [priority, setPriority] = useState(null);
  const [notes, setNotes] = useState('');
  const [followUpDate, setFollowUpDate] = useState('');
  const [followUpTime, setFollowUpTime] = useState(TIME_SLOTS[0]);
  const [meetingType, setMeetingType] = useState('direct');
  const [meetingDate, setMeetingDate] = useState('');
  const [meetingTime, setMeetingTime] = useState('');
  const [meetingLink, setMeetingLink] = useState('');
  const [inviteeId, setInviteeId] = useState('');
  const [strategyNote, setStrategyNote] = useState('');
  const [activeTip, setActiveTip] = useState(null);

  // Sync outcome and priority when lead/modal opens
  useEffect(() => {
    setSelectedOutcome(initialOutcome);
    setPriority(lead?.priority || null);
  }, [initialOutcome, isOpen, lead]);

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
      queryClient.invalidateQueries({ queryKey: ['leads', 'personal-list'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard', 'executive'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard', 'industry-manager'] });
      queryClient.invalidateQueries({ queryKey: ['activities'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['lead-activity'] });
    },
  });

  const handleClose = () => {
    setNotes('');
    setStrategyNote('');
    setFollowUpDate('');
    setMeetingDate('');
    setMeetingTime('');
    setMeetingLink('');
    setInviteeId('');
    onClose();
  };

  const handleSubmit = async () => {
    if (!selectedOutcome) {
      addToast('Please select a call outcome first.', 'warning');
      return;
    }
    // RNR: priority and notes are optional
    if (selectedOutcome !== 'rnr') {
      if (!priority) {
        addToast('Please select a lead priority (Hot / Warm / Cold).', 'warning');
        return;
      }
      if (!notes.trim()) {
        addToast('Remarks are required — note what happened in this call.', 'warning');
        return;
      }
    }
    if (selectedOutcome === 'followup' && !followUpDate) {
      addToast('Please set a follow-up date.', 'warning');
      return;
    }

    try {
      if (selectedOutcome === 'connected') {
        await transitionMutation.mutateAsync({ action: 'mark_called', note: notes, priority });
        addToast('Call logged as connected.', 'success');

      } else if (selectedOutcome === 'rnr') {
        await transitionMutation.mutateAsync({ action: 'mark_rnr', note: notes || '', priority: priority || null });
        addToast(`RNR logged (attempt #${(lead?.rnrCount || 0) + 1}). Auto-retry scheduled.`, 'warning');

      } else if (selectedOutcome === 'followup') {
        await transitionMutation.mutateAsync({ action: 'set_feedback', nextAction: 'followup', note: notes, priority });
        await transitionMutation.mutateAsync({ action: 'set_followup_date', followUpDate, followUpTime });
        addToast('Follow-up scheduled.', 'success');

      } else if (selectedOutcome === 'meeting') {
        if (!meetingDate) { addToast('Please set a meeting date.', 'warning'); return; }
        if (meetingType === 'virtual' && !meetingLink) { addToast('Please add a meeting link.', 'warning'); return; }
        const nextAction = meetingType === 'virtual' ? 'schedule_virtual' : 'direct_meeting';
        const payload = {
          action: 'set_feedback',
          nextAction,
          note: notes,
          priority,
          meetingAt: `${meetingDate}T${meetingTime || '10:00'}`,
        };
        if (meetingType === 'virtual') payload.meetingLink = meetingLink;
        if (inviteeId) payload.meetingInvitees = [inviteeId];
        await transitionMutation.mutateAsync(payload);
        addToast('Meeting scheduled!', 'success');

      } else if (selectedOutcome === 'blocking_amount_received') {
        await transitionMutation.mutateAsync({
          action: 'set_feedback',
          nextAction: 'blocking_amount_received',
          note: notes,
          priority,
        });
        addToast('💰 Blocking amount received logged!', 'success');

      } else if (selectedOutcome === 'converted') {
        await transitionMutation.mutateAsync({
          action: 'set_feedback',
          nextAction: 'converted',
          note: notes,
          priority,
          strategyNote: strategyNote || notes,
        });
        addToast('🎉 Lead Converted! Great work!', 'success');

      } else if (selectedOutcome === 'not_interested') {
        await transitionMutation.mutateAsync({
          action: 'set_feedback',
          nextAction: 'not_interested',
          note: notes,
          priority,
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

  // Filter outcomes based on initial action
  const getAvailableOutcomes = () => {
    if (initialOutcome === 'connected') {
      // Call Done: exclude 'connected' and 'rnr', show only post-call outcomes
      return OUTCOMES.filter(o => !['connected', 'rnr'].includes(o.id));
    }
    return OUTCOMES;
  };

  const availableOutcomes = getAvailableOutcomes();

  // RNR confirmation modal: minimal UI
  if (initialOutcome === 'rnr' && isOpen) {
    return (
      <Modal
        isOpen={isOpen}
        onClose={handleClose}
        title="Ring Not Responded"
        subtitle="Confirm RNR status"
        className="max-w-md"
      >
        <div className="space-y-5">
          {/* Lead context */}
          <div className="bg-surface2 px-4 py-3 rounded-xl text-sm">
            <strong className="text-text-primary">{lead?.company || lead?.name}</strong>
            <span className="text-text-muted"> · {lead?.name}{lead?.district ? ` · ${lead.district}` : ''}</span>
          </div>

          {/* Message */}
          <div className="p-4 bg-red/5 border border-red/20 rounded-xl">
            <p className="text-sm text-text-primary leading-relaxed">
              📵 Mark this lead as <strong>RNR (Ring Not Responded)</strong>?
            </p>
            <p className="text-xs text-text-muted mt-2">
              The call will be logged, and the lead will be automatically re-queued for retry.
            </p>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 pt-2 border-t border-border">
            <button
              onClick={handleClose}
              className="px-5 py-2.5 rounded-xl border border-border text-sm font-bold text-text-secondary hover:bg-surface2 transition-all"
            >
              Cancel
            </button>
            <button
              onClick={async () => {
                try {
                  await transitionMutation.mutateAsync({ action: 'mark_rnr', note: '', priority: null });
                  addToast(`RNR logged (attempt #${(lead?.rnrCount || 0) + 1}). Auto-retry scheduled.`, 'warning');
                  handleClose();
                  if (onSuccess) onSuccess();
                } catch (err) {
                  addToast('Failed to save: ' + (err?.response?.data?.message || err?.message || 'Unknown error'), 'error');
                }
              }}
              disabled={transitionMutation.isPending}
              className="px-6 py-2.5 rounded-xl bg-red text-white text-sm font-bold hover:opacity-90 transition-all shadow-lg shadow-red/20 disabled:opacity-50"
            >
              {transitionMutation.isPending ? 'Submitting…' : 'Confirm RNR'}
            </button>
          </div>
        </div>
      </Modal>
    );
  }

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
            {availableOutcomes.map(o => (
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

        {/* Priority selector — hidden for RNR */}
        {selectedOutcome !== 'rnr' && (
        <div>
          <label className={lbl}>Lead Priority</label>
          <div className="flex gap-2">
            {PRIORITIES.map(p => (
              <div key={p.id} className="flex-1 relative">
                <button
                  type="button"
                  onClick={() => setPriority(p.id)}
                  style={{
                    background: priority === p.id ? p.bg : 'var(--surface)',
                    color: priority === p.id ? p.color : 'var(--text-secondary)',
                    border: `1.5px solid ${priority === p.id ? p.border : 'var(--border)'}`,
                    fontWeight: priority === p.id ? 700 : 500,
                  }}
                  className="w-full px-3 py-2 rounded-lg text-xs cursor-pointer transition-all hover:opacity-90 pr-6"
                >
                  {p.icon} {p.label}
                </button>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setActiveTip(activeTip === p.id ? null : p.id); }}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-sky-500 text-white text-[9px] font-black flex items-center justify-center shadow-sm shadow-sky-300 select-none hover:bg-sky-600 transition-colors"
                >
                  !
                </button>
                {activeTip === p.id && (
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 w-44 bg-white border border-border rounded-xl shadow-lg px-3 py-2 text-[11px] text-text-secondary">
                    <span className="font-bold" style={{ color: p.color }}>{p.icon} {p.label}:</span> {p.def}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
        )}

        {/* Notes — hidden for RNR */}
        {selectedOutcome !== 'rnr' && (
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
        )}

        {/* Follow-up section */}
        {selectedOutcome === 'followup' && (
          <div className="space-y-3 p-4 bg-amber-light/20 border border-amber/20 rounded-xl animate-in slide-in-from-top-2 duration-200">
            <label className={lbl + ' text-amber'}>📅 Follow-up Details</label>
            {suggestedDates?.dates?.length > 0 && (
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
                </div>
              </div>
            )}
            <div>
              <label className={lbl}>Follow-up Date</label>
              <input
                type="date"
                className={inp}
                value={followUpDate}
                min={new Date().toISOString().split('T')[0]}
                onChange={e => setFollowUpDate(e.target.value)}
              />
            </div>
            {followUpDate && (
              <div>
                <label className={lbl}>Preferred Time</label>
                <select className={inp} value={followUpTime} onChange={e => setFollowUpTime(e.target.value)}>
                  {TIME_SLOTS.map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
            )}
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
