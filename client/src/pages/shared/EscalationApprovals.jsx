import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { leadsApi } from '../../api/leadsApi';
import { Button, Avatar, Tag, Modal, DashboardSkeleton } from '../../components/ui';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../hooks/useAuth';
import { roleLabel } from '../../utils/roleLabel';

/**
 * Lead Escalation Approvals — one page shared by the Founder, State Manager and
 * Industry Manager dashboards.
 *
 * Escalating a lead no longer hands it over on its own (see
 * server/src/services/leadService.js). It stays in the escalator's book and waits
 * here for the manager one step above:
 *
 *   District Manager escalates -> Industry Manager approves
 *   Industry Manager escalates -> State Manager approves
 *   State Manager escalates    -> Founder approves
 *
 * Approving makes the lead the approver's own, which is the only way it enters
 * their Lead Management list. Rejecting sends it back down with a note and the
 * owner never changes. The page is identical for all three roles, so the only
 * thing that varies is who it says the escalations came from.
 */

/** Who escalates up to this role — used for the subtitle and the empty state. */
const SENDER_LABEL = {
  industry_manager: 'District Managers',
  state_manager: 'Industry Managers',
  founder: 'State Managers',
};

const PRIORITY_VARIANT = { hot: 'red', warm: 'amber', cold: 'blue' };

const fmtDate = (value) =>
  value ? new Date(value).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

const daysWaiting = (value) => {
  if (!value) return null;
  const days = Math.floor((Date.now() - new Date(value).getTime()) / 86400000);
  return days <= 0 ? 'today' : `${days}d ago`;
};

const EscalationApprovals = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { addToast } = useToast();
  const { user } = useAuth();
  const [rejecting, setRejecting] = useState(null); // the lead being sent back
  const [rejectionNote, setRejectionNote] = useState('');

  const { data: escalations = [], isLoading } = useQuery({
    queryKey: ['leads', 'escalations', 'pending'],
    queryFn: () => leadsApi.getPendingEscalations().then(res => res.data || []),
    staleTime: 60 * 1000,
    placeholderData: (prev) => prev,
  });

  const decide = useMutation({
    mutationFn: ({ id, decision, note }) => leadsApi.decideEscalation(id, decision, note),
    onSuccess: (_res, { decision }) => {
      // Approving changes the lead's owner, so every lead list, count and
      // dashboard figure on screen is now stale.
      queryClient.invalidateQueries({ queryKey: ['leads'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['dashboard'], exact: false });
      setRejecting(null);
      setRejectionNote('');
      addToast(
        decision === 'approved'
          ? 'Escalation approved — the lead is now yours.'
          : 'Escalation returned to its owner.',
        decision === 'approved' ? 'success' : 'warning'
      );
    },
    onError: (err) => {
      addToast(err.response?.data?.message || 'Could not record the decision', 'error');
    },
  });

  const senders = SENDER_LABEL[user?.role] || 'your team';

  if (isLoading && !escalations.length) return <DashboardSkeleton />;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-xl font-bold text-text-primary tracking-tight">Lead Escalation Approvals</h2>
          <p className="text-[16px] text-text-muted">
            Leads {senders} have escalated to you. A lead only enters your Lead Management
            list once you approve it.
          </p>
        </div>
        {escalations.length > 0 && (
          <Tag variant="amber" className="text-[11px] mt-1">
            {escalations.length} Awaiting Decision
          </Tag>
        )}
      </div>

      {escalations.length === 0 ? (
        <div className="bg-surface border border-border border-dashed rounded-2xl p-12 text-center">
          <div className="w-16 h-16 rounded-full bg-surface2 flex items-center justify-center mx-auto mb-4 text-2xl">⬆️</div>
          <p className="text-sm font-bold text-text-primary">Nothing waiting on you</p>
          <p className="text-[13px] text-text-muted mt-1">
            Escalations from {senders} will appear here for approval.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {escalations.map(lead => {
            // escalatedFrom is who sent it up. It falls back to the owner because
            // leads escalated before this flow existed never recorded a sender.
            const sender = lead.escalatedFrom || lead.owner;
            const busy = decide.isPending && decide.variables?.id === lead._id;
            return (
              <div key={lead._id} className="bg-surface border border-border rounded-2xl p-5 shadow-sm hover:shadow-md transition-all">
                <div className="flex justify-between items-start gap-3 mb-4">
                  <div className="min-w-0">
                    <button
                      onClick={() => navigate(`/leads/${lead._id}`)}
                      className="font-bold text-sm text-text-primary truncate hover:text-purple hover:underline underline-offset-2 text-left"
                    >
                      {lead.company || lead.name}
                    </button>
                    <p className="text-[11px] text-text-muted font-mono mt-0.5">{lead.leadId}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {lead.priority && (
                      <Tag variant={PRIORITY_VARIANT[lead.priority] || 'gray'} className="text-[9px] font-black">
                        {lead.priority}
                      </Tag>
                    )}
                    <Tag variant="purple" className="text-[9px] font-black">Escalated</Tag>
                  </div>
                </div>

                <div className="flex items-center gap-3 mb-4">
                  <Avatar name={sender?.name} size="md" />
                  <div className="min-w-0">
                    <p className="font-bold text-[13px] text-text-primary truncate">{sender?.name || 'Unknown'}</p>
                    <p className="text-[10px] text-purple font-bold uppercase tracking-tight">
                      {roleLabel(sender?.role)}
                      {sender?.district ? ` · ${sender.district}` : ''}
                      {sender?.industry ? ` · ${sender.industry}` : ''}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4 bg-surface2/50 rounded-xl p-4 mb-4 border border-border/50">
                  <div className="min-w-0">
                    <p className="text-[11px] font-bold text-text-muted uppercase mb-0.5">Contact</p>
                    <p className="text-[13px] font-semibold text-text-primary truncate">{lead.name}</p>
                    <p className="text-[12px] text-text-secondary">{lead.phone}</p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] font-bold text-text-muted uppercase mb-0.5">Region</p>
                    <p className="text-[13px] font-semibold text-text-primary truncate">{lead.district || lead.state || '—'}</p>
                    <p className="text-[12px] text-text-secondary truncate">{lead.industry || '—'}</p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] font-bold text-text-muted uppercase mb-0.5">Escalated</p>
                    <p className="text-[13px] font-semibold text-text-primary">{fmtDate(lead.escalatedAt || lead.updatedAt)}</p>
                    <p className="text-[12px] text-amber font-bold">{daysWaiting(lead.escalatedAt || lead.updatedAt)}</p>
                  </div>
                </div>

                <div className="mb-6 px-1">
                  <p className="text-[11px] font-bold text-text-muted uppercase mb-1">Reason for Escalation</p>
                  <p className="text-[14px] text-text-secondary leading-relaxed italic">
                    {lead.escalationNote ? `"${lead.escalationNote}"` : 'No reason was given.'}
                  </p>
                </div>

                <div className="flex gap-2">
                  <Button
                    className="flex-1 bg-accent text-white hover:bg-accent/90"
                    onClick={() => decide.mutate({ id: lead._id, decision: 'approved' })}
                    disabled={decide.isPending}
                    loading={busy && decide.variables?.decision === 'approved'}
                  >
                    Approve &amp; Take Over
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1 border-red/30 text-red hover:bg-red-light"
                    onClick={() => { setRejecting(lead); setRejectionNote(''); }}
                    disabled={decide.isPending}
                  >
                    Send Back
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {rejecting && (
        <Modal
          onClose={() => setRejecting(null)}
          title="Send the Lead Back"
          subtitle={`${rejecting.company || rejecting.name} stays with ${(rejecting.escalatedFrom || rejecting.owner)?.name || 'its current owner'}`}
          className="max-w-md"
        >
          <div className="p-8 space-y-5">
            <div className="space-y-1">
              <label className="form-label">Why are you sending it back?</label>
              <textarea
                className="textarea h-28"
                placeholder="Tell them what to do with this lead instead..."
                value={rejectionNote}
                onChange={(e) => setRejectionNote(e.target.value)}
              />
              <p className="text-[12px] text-text-muted">
                This note reaches them as a notification and stays on the lead&apos;s history.
              </p>
            </div>
            <div className="flex justify-end gap-3 pt-2 border-t border-border">
              <Button variant="outline" onClick={() => setRejecting(null)}>Cancel</Button>
              <Button
                variant="danger"
                loading={decide.isPending}
                onClick={() => decide.mutate({ id: rejecting._id, decision: 'rejected', note: rejectionNote })}
              >
                Send Back
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default EscalationApprovals;
