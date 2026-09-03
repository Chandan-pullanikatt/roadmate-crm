import React from 'react';
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
  reallocated:  { icon: '🔄', label: 'Reallocated',          color: '#D97706' },
  note_added:   { icon: '📝', label: 'Note Added',           color: '#6B7280' },
  document_attached: { icon: '📎', label: 'Document Attached', color: '#6B7280' },
  updated:      { icon: '✏️', label: 'Updated',             color: '#6B7280' },
  blocking_amount_received: { icon: '💰', label: 'Blocking Amount Received', color: '#059669' },
  full_amount_received:     { icon: '✅', label: 'Full Amount Received',     color: '#065F46' },
  agreement_signed:         { icon: '📝', label: 'Agreement Signed',         color: '#7C3AED' },
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
        <div className="py-12 text-center text-text-muted text-sm">Loading activity log...</div>
      ) : activities.length === 0 ? (
        <div className="py-12 text-center text-text-muted italic text-sm">No activity recorded for this lead yet.</div>
      ) : (
        <div className="relative">
          {/* Timeline line */}
          <div className="absolute left-5 top-0 bottom-0 w-px bg-border" />

          <div className="space-y-1 max-h-[520px] overflow-y-auto pr-2">
            {activities.map((a, idx) => {
              const meta = ACTION_META[a.action] || { icon: '⚡', label: a.action?.replace(/_/g, ' '), color: '#6B7280' };
              return (
                <div key={a._id || idx} className="flex gap-4 relative pl-12 py-3">
                  {/* Dot */}
                  <div
                    className="absolute left-3.5 top-4 w-3 h-3 rounded-full border-2 border-white shadow-sm"
                    style={{ background: meta.color }}
                  />

                  <div className="flex-1 bg-surface2/30 rounded-xl border border-border/60 px-4 py-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-base">{meta.icon}</span>
                        <span className="text-[13px] font-bold text-text-primary">{meta.label}</span>
                      </div>
                      <div className="text-[10px] font-bold text-text-muted whitespace-nowrap">
                        {new Date(a.createdAt).toLocaleString('en-US', {
                          month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                        })}
                      </div>
                    </div>

                    {a.note && (
                      <p className="text-xs text-text-secondary mt-1.5 leading-relaxed line-clamp-3">{a.note}</p>
                    )}

                    {a.performedBy?.name && (
                      <div className="text-[10px] text-text-muted mt-1.5 font-medium">
                        By {a.performedBy.name}
                        {a.performedBy.role && ` · ${a.performedBy.role.replace(/_/g, ' ')}`}
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
