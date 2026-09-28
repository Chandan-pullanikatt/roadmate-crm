import React from 'react';
import { roleLabel } from '../../utils/roleLabel';
import { useQuery } from '@tanstack/react-query';
import { Modal } from '../ui';
import { leadsApi } from '../../api/leadsApi';

export const ACTION_META = {
  created:      { icon: '🌱', label: 'Lead Created',         color: '#059669' },
  called:       { icon: '📞', label: 'Called',               color: '#3B82F6' },
  rnr:          { icon: '📵', label: 'RNR / No Answer',      color: '#D97706' },
  followup_set: { icon: '📅', label: 'Follow-up Scheduled',  color: '#3B82F6' },
  meeting_scheduled: { icon: '🗓', label: 'Meeting Scheduled', color: '#7C3AED' },
  meeting_done: { icon: '✅', label: 'Meeting Completed',    color: '#059669' },
  meeting_confirmed: { icon: '📋', label: 'Meeting Confirmed', color: '#059669' },
  converted:    { icon: '🤝', label: 'Converted',            color: '#059669' },
  lost:         { icon: '❌', label: 'Marked Lost',          color: '#DC2626' },
  not_interested: { icon: '🚫', label: 'Not Interested',     color: '#DC2626' },
  escalated:    { icon: '⬆️', label: 'Escalated',           color: '#7C3AED' },
  escalation_approved: { icon: '✔️', label: 'Escalation Approved', color: '#059669' },
  escalation_rejected: { icon: '↩️', label: 'Escalation Returned', color: '#DC2626' },
  reallocated:  { icon: '🔄', label: 'Reallocated',          color: '#D97706' },
  note_added:   { icon: '📝', label: 'Note Added',           color: '#6B7280' },
  document_attached: { icon: '📎', label: 'Document Attached', color: '#6B7280' },
  updated:      { icon: '✏️', label: 'Updated',             color: '#6B7280' },
  blocking_amount_received: { icon: '💰', label: 'Blocking Amount Received', color: '#059669' },
  full_amount_received:     { icon: '✅', label: 'Full Amount Received',     color: '#065F46' },
  agreement_signed:         { icon: '📝', label: 'Agreement Signed',         color: '#7C3AED' },
  strategy_logged:          { icon: '🧭', label: 'Strategy Logged',          color: '#6B7280' },
};

/**
 * How the call behind an activity went, for records logged from a call feedback
 * screen. Every outcome is reached by picking up the phone first, so the
 * history reads "Call Connected · Follow-up Scheduled" rather than leaving the
 * call itself invisible behind its outcome.
 *
 * Activities logged before this stamp existed, and desk work that never
 * involved a call (edits, allocations, escalation decisions), carry no stamp
 * and render with no badge.
 */
export const CALL_META = {
  connected: { label: 'Call Connected', color: '#059669' },
  no_answer: { label: 'Call Not Answered', color: '#D97706' },
};

/**
 * Actions that can only have been reached by someone on a call, used to read
 * the history recorded before the stamp existed. It mirrors the server's
 * CALL_ACTIONS (constants/workActions.js), minus the two that are ambiguous
 * without the stamp:
 *   lost      - the auto-lost after RNR attempts run out is written by the
 *               system, not by a caller.
 *   converted - written automatically alongside a payment, so the payment
 *               record is the one that stands for the call.
 * Both are left unbadged rather than guessed at.
 */
const INFERRED_CALL = {
  called: 'connected',
  rnr: 'no_answer',
  followup_set: 'connected',
  meeting_scheduled: 'connected',
  meeting_confirmed: 'connected',
  meeting_done: 'connected',
  not_interested: 'connected',
  blocking_amount_received: 'connected',
  full_amount_received: 'connected',
  agreement_signed: 'connected',
};

export const callMeta = (activity) => {
  if (!activity) return null;
  // A stamped record says for itself how the call went. Anything older is read
  // from its action, and only when a person is on it -- a system-written record
  // stands for nobody's call.
  const stamped = activity.metadata?.call;
  if (stamped) return CALL_META[stamped] || null;
  if (!activity.performedBy) return null;
  return CALL_META[INFERRED_CALL[activity.action]] || null;
};

const LeadHistoryModal = ({ isOpen, onClose, leadId, leadName }) => {
  const { data: activities = [], isLoading } = useQuery({
    queryKey: ['lead-activity', leadId],
    queryFn: () => leadsApi.getLeadActivity(leadId).then(r => r.data),
    enabled: !!leadId && isOpen,
    staleTime: 60 * 1000,
  });

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Lead History`} subtitle={leadName || ''} className="modal-lg">
      {isLoading ? (
        <div className="py-12 text-center text-text-muted text-[16px]">Loading activity log...</div>
      ) : activities.length === 0 ? (
        <div className="py-12 text-center text-text-muted italic text-[16px]">No activity recorded for this lead yet.</div>
      ) : (
        <div className="relative">
          {/* Timeline line */}
          <div className="absolute left-5 top-0 bottom-0 w-px bg-border" />

          <div className="space-y-1 max-h-[520px] overflow-y-auto pr-2">
            {activities.map((a, idx) => {
              const meta = ACTION_META[a.action] || { icon: '⚡', label: a.action?.replace(/_/g, ' '), color: '#6B7280' };
              const call = callMeta(a);
              return (
                <div key={a._id || idx} className="flex gap-4 relative pl-12 py-3">
                  {/* Dot */}
                  <div
                    className="absolute left-3.5 top-4 w-3 h-3 rounded-full border-2 border-white shadow-sm"
                    style={{ background: meta.color }}
                  />

                  <div className="flex-1 bg-surface2/30 rounded-xl border border-border/60 px-4 py-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-base">{meta.icon}</span>
                        {call && (
                          <>
                            <span
                              className="text-[11px] font-bold px-1.5 py-0.5 rounded-md"
                              style={{ color: call.color, background: `${call.color}14` }}
                            >
                              📞 {call.label}
                            </span>
                            <span className="text-[12px] text-text-muted">·</span>
                          </>
                        )}
                        <span className="text-[13px] font-bold text-text-primary">{meta.label}</span>
                      </div>
                      <div className="text-[12px] font-bold text-text-muted whitespace-nowrap">
                        {new Date(a.createdAt).toLocaleString('en-US', {
                          month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                        })}
                      </div>
                    </div>

                    {a.note && (
                      <p className="text-[14px] text-text-secondary mt-1.5 leading-relaxed line-clamp-3">{a.note}</p>
                    )}

                    {a.performedBy?.name && (
                      <div className="text-[12px] text-text-muted mt-1.5 font-medium">
                        By {a.performedBy.name}
                        {a.performedBy.role && ` · ${roleLabel(a.performedBy.role)}`}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </Modal>
  );
};

export default LeadHistoryModal;
