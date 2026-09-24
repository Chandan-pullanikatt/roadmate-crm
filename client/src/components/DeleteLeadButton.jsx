import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Modal, Button } from './ui';
import { leadsApi } from '../api/leadsApi';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';

/**
 * Whether this user may delete this lead — the same rule routes/leads.js
 * enforces, repeated here only so the button is hidden rather than offered and
 * then refused. The server stays the authority.
 */
export const canDeleteLead = (user, lead) => {
  if (!user || !lead) return false;
  if (user.role === 'founder') return true;

  const me = String(user._id || '');
  const ownerId = String(lead.owner?._id || lead.owner || '');
  const mine = ownerId
    ? ownerId === me
    : String(lead.allocatedBy?._id || lead.allocatedBy || '') === me;
  if (!mine) return false;

  // Money already booked against the lead is a founder decision to erase.
  return !(lead.blockingAmount > 0 || lead.fullAmount > 0 || lead.status === 'converted');
};

const DeleteLeadButton = ({ lead, className = '', onDeleted }) => {
  const { user: currentUser } = useAuth();
  const { addToast } = useToast();
  const queryClient = useQueryClient();
  const [confirming, setConfirming] = useState(false);

  const deleteMutation = useMutation({
    mutationFn: () => leadsApi.deleteLead(lead._id),
    onSuccess: () => {
      addToast('Lead deleted.', 'success');
      setConfirming(false);
      queryClient.invalidateQueries({ queryKey: ['leads'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['dashboard'], exact: false });
      if (onDeleted) onDeleted(lead);
    },
    onError: (err) => {
      addToast(err?.response?.data?.message || 'Could not delete this lead.', 'error');
    },
  });

  if (!canDeleteLead(currentUser, lead)) return null;

  const label = lead.company || lead.name || lead.leadId || 'this lead';

  return (
    <>
      <Button
        size="2xs"
        variant="outline"
        className={`bg-red/5 border-red/20 text-red shadow-sm hover:bg-red/10 font-bold ${className}`}
        onClick={() => setConfirming(true)}
      >
        Delete
      </Button>

      <Modal
        isOpen={confirming}
        onClose={() => setConfirming(false)}
        title="Delete Lead"
        subtitle="This cannot be undone"
        className="max-w-md"
      >
        <div className="space-y-5">
          <div className="bg-surface2 px-4 py-3 rounded-xl text-sm">
            <strong className="text-text-primary">{label}</strong>
            {lead.leadId && <span className="text-text-muted"> · {lead.leadId}</span>}
            {lead.phone && <span className="text-text-muted"> · {lead.phone}</span>}
          </div>

          <div className="p-4 bg-red/5 border border-red/20 rounded-xl">
            <p className="text-sm text-text-primary leading-relaxed">
              Delete <strong>{label}</strong> permanently?
            </p>
            <p className="text-[14px] text-text-muted mt-2">
              Its call log, meetings and every other activity recorded against it are
              removed with it, so the figures it contributed to will change.
            </p>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2 border-t border-border">
            <button
              onClick={() => setConfirming(false)}
              className="px-5 py-2.5 rounded-xl border border-border text-[16px] font-bold text-text-secondary hover:bg-surface2 transition-all"
            >
              Cancel
            </button>
            <button
              onClick={() => deleteMutation.mutate()}
              disabled={deleteMutation.isPending}
              className="px-6 py-2.5 rounded-xl bg-red text-white text-sm font-bold hover:opacity-90 transition-all shadow-lg shadow-red/20 disabled:opacity-50"
            >
              {deleteMutation.isPending ? 'Deleting…' : 'Delete Lead'}
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
};

export default DeleteLeadButton;
