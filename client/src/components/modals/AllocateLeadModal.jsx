import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Modal, Button } from '../ui';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../hooks/useAuth';
import { leadsApi } from '../../api/leadsApi';
import { usersApi } from '../../api/usersApi';

// Fix: Lead Allocation — the form starts one level BELOW whoever opened it.
// A manager can only ever allocate down their own reporting tree, so asking them
// to pick their own level first was a dead step: a State Manager was made to
// choose a State Manager, then their Industry Manager, then the District Manager.
// Now the Founder picks SM → IM → DM, a State Manager picks IM → DM, an Industry
// Manager picks a DM, and a District Manager gets no allocation at all — the
// bottom of the tree escalates instead (Escalate action on the lead row).
//
// The same form allocates one lead from a row action and a set ticked in a lead
// list's selection bar -- the hierarchy steps are identical, so `leads` is simply
// the plural form of `lead` and the submit switches to the bulk endpoint.
const AllocateLeadModal = ({ isOpen, onClose, lead, leads = [] }) => {
  const { addToast } = useToast();
  const { user: currentUser } = useAuth();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [selectedStateManagerId, setSelectedStateManagerId] = useState('');
  const [selectedIndustryManagerId, setSelectedIndustryManagerId] = useState('');
  const [selectedExecutiveId, setSelectedExecutiveId] = useState('');

  const selectedLeads = leads.length ? leads : (lead ? [lead] : []);
  const isBulk = leads.length > 0;
  // The State Manager step narrows by the lead's state, which is only meaningful
  // when every selected lead shares one. A mixed selection lists every State
  // Manager rather than silently filtering to the first lead's state.
  const sharedState = selectedLeads.length && selectedLeads.every(l => l.state === selectedLeads[0].state)
    ? selectedLeads[0].state
    : undefined;

  const role = currentUser?.role;
  const isFounder = role === 'founder';
  const isStateManager = role === 'state_manager';
  const isIndustryManager = role === 'industry_manager';
  // District Managers (stored as 'executive') are the leaf of the tree.
  const canAllocate = isFounder || isStateManager || isIndustryManager;

  // Which steps this role is actually asked for.
  const showSmStep = isFounder;
  const showImStep = isFounder || isStateManager;
  const showDmStep = canAllocate;

  // The branch of the tree the next dropdown reads from. For a manager it is
  // themselves — that level is implied, not chosen.
  const branchSmId = isFounder ? selectedStateManagerId : (isStateManager ? currentUser?._id : '');
  const branchImId = isIndustryManager ? currentUser?._id : selectedIndustryManagerId;

  // Step 1 — state managers for the lead's state (Founder only)
  const { data: stateManagers = [], isLoading: loadingSMs } = useQuery({
    queryKey: ['users', 'alloc-sms', sharedState],
    queryFn: () => usersApi.getUsers({ role: 'state_manager', state: sharedState }).then(r => r.data),
    enabled: isOpen && selectedLeads.length > 0 && showSmStep
  });

  // Step 2 — industry managers reporting to the State Manager in play
  const { data: industryManagers = [], isLoading: loadingIMs } = useQuery({
    queryKey: ['users', 'alloc-ims', branchSmId],
    queryFn: () => usersApi.getUsers({ role: 'industry_manager', reportingTo: branchSmId }).then(r => r.data),
    enabled: isOpen && showImStep && !!branchSmId
  });

  // Step 3 — district managers reporting to the Industry Manager in play.
  // Filtered by the reporting tree only: industry/state on the user record is not
  // what ownership follows, and filtering on it drops legitimate team members.
  const { data: executives = [], isLoading: loadingExecs } = useQuery({
    queryKey: ['users', 'alloc-execs', branchImId],
    queryFn: () => usersApi.getUsers({ role: 'executive', reportingTo: branchImId }).then(r => r.data),
    enabled: isOpen && showDmStep && !!branchImId
  });

  const handleSmChange = (e) => {
    setSelectedStateManagerId(e.target.value);
    // Reset downstream when the branch changes
    setSelectedIndustryManagerId('');
    setSelectedExecutiveId('');
  };

  const handleImChange = (e) => {
    setSelectedIndustryManagerId(e.target.value);
    setSelectedExecutiveId('');
  };

  // Determine the final allocation target (most specific wins)
  const allocateToId = selectedExecutiveId || selectedIndustryManagerId || selectedStateManagerId;
  const allocateName =
    executives.find(e => e._id === selectedExecutiveId)?.name ||
    industryManagers.find(m => m._id === selectedIndustryManagerId)?.name ||
    stateManagers.find(m => m._id === selectedStateManagerId)?.name ||
    '';

  const firstStepLabel = isFounder ? 'State Manager' : isStateManager ? 'Industry Manager' : 'District Manager';

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!allocateToId) return addToast(`Please select ${isFounder ? 'at least a' : 'a'} ${firstStepLabel}`, 'warning');
    setLoading(true);
    try {
      if (isBulk) {
        const res = await leadsApi.bulkAllocate({
          leadIds: selectedLeads.map(l => l._id),
          assignedTo: allocateToId
        });
        const { updated = 0, skipped = 0 } = res.data || {};
        addToast(
          skipped
            ? `${updated} lead(s) allocated to ${allocateName} - ${skipped} skipped`
            : `${updated} lead(s) allocated to ${allocateName}`,
          skipped ? 'warning' : 'success'
        );
        // Tells the lead lists to drop their ticks -- the rows they were ticked
        // on have just moved.
        window.dispatchEvent(new CustomEvent('leads-bulk-action-done'));
      } else {
        await leadsApi.allocateLead(lead._id, allocateToId);
        addToast(`Lead allocated to ${allocateName}`, 'success');
      }
      queryClient.invalidateQueries({ queryKey: ['leads'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['dashboard'], exact: false });
      queryClient.refetchQueries({ queryKey: ['leads'], exact: false, type: 'active' });
      handleClose();
    } catch (err) {
      addToast(err.response?.data?.message || 'Error allocating lead', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setSelectedStateManagerId('');
    setSelectedIndustryManagerId('');
    setSelectedExecutiveId('');
    onClose();
  };

  if (!selectedLeads.length) return null;

  const title = isBulk
    ? `Allocate ${selectedLeads.length} Lead${selectedLeads.length === 1 ? '' : 's'}`
    : 'Allocate Lead';

  const subtitle = isFounder
    ? 'Assign through the hierarchy — Industry Manager and District Manager are optional for direct SM allocation'
    : isStateManager
      ? 'Assign to an Industry Manager in your team, or straight to one of their District Managers'
      : isIndustryManager
        ? 'Assign to a District Manager in your team'
        : 'District Managers escalate leads instead of allocating them';

  const leadInfo = (
    <div className="mb-6">
      <label className="text-[13px] font-bold text-text-muted uppercase tracking-wider mb-2 block">
        {isBulk ? `Target Leads (${selectedLeads.length})` : 'Target Lead'}
      </label>
      <div className={`rounded-xl border border-border bg-surface2/50 ${isBulk ? 'max-h-40 overflow-y-auto divide-y divide-border' : ''}`}>
        {selectedLeads.map(l => (
          <div key={l._id} className="p-3 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <span className="font-bold text-text-primary">{l.company || l.name}</span>
              {l.company && <div className="text-[13px] text-text-muted mt-0.5 truncate">{l.name}</div>}
            </div>
            <div className="flex gap-2 shrink-0">
              {l.country && <span className="bg-purple/10 text-purple px-2 py-0.5 rounded text-[10px] font-bold uppercase">{l.country}</span>}
              {l.state && <span className="bg-blue/10 text-blue px-2 py-0.5 rounded text-[10px] font-bold uppercase">{l.state}</span>}
            </div>
          </div>
        ))}
      </div>
      {/* A mixed-state selection cannot narrow the State Manager list, so say so
          rather than leaving the longer list unexplained. */}
      {isBulk && showSmStep && !sharedState && (
        <p className="text-[11px] text-text-muted font-medium mt-2">
          The selected leads span more than one state, so every State Manager is listed.
        </p>
      )}
    </div>
  );

  // A District Manager has nobody below them, so there is nothing to allocate to.
  if (!canAllocate) {
    return (
      <Modal isOpen={isOpen} onClose={handleClose} title={title} subtitle={subtitle}>
        {leadInfo}
        <div className="p-4 bg-amber-light/30 border border-amber/20 rounded-2xl flex gap-3 items-start">
          <span className="text-amber text-lg">⚠️</span>
          <div className="text-[14px] text-text-secondary leading-relaxed">
            You are at the bottom of the reporting tree, so {isBulk ? 'these leads cannot' : 'this lead cannot'} be
            allocated further. Use <span className="font-bold">Escalate</span> to send {isBulk ? 'them' : 'it'} up to
            your Industry Manager.
          </div>
        </div>
        <div className="flex justify-end gap-3 pt-4 border-t border-border mt-6">
          <Button variant="outline" onClick={handleClose}>Close</Button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={title} subtitle={subtitle}>
      {leadInfo}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Step 1 — State Manager (Founder only; a State Manager is their own branch) */}
        {showSmStep && (
          <div className="space-y-2">
            <label className="form-label">
              State Manager <span className="text-red">*</span>
            </label>
            <select
              className="select"
              value={selectedStateManagerId}
              onChange={handleSmChange}
              disabled={loadingSMs}
            >
              <option value="">
                {loadingSMs ? 'Loading state managers…' : 'Select State Manager'}
              </option>
              {stateManagers.map(m => (
                <option key={m._id} value={m._id}>{m.name} — {m.state}</option>
              ))}
            </select>
            {!loadingSMs && stateManagers.length === 0 && (
              <p className="text-[11px] text-amber font-medium mt-1">
                No state managers found{sharedState ? ` for ${sharedState}` : ''}
              </p>
            )}
          </div>
        )}

        {/* Step 2 — Industry Manager. Required for a State Manager (it is their
            first step), optional for the Founder, who may stop at the SM. */}
        {showImStep && !!branchSmId && (
          <div className="space-y-2">
            <label className="form-label">
              Industry Manager
              {isStateManager ? (
                <span className="text-red"> *</span>
              ) : (
                <span className="ml-1 text-[12px] text-text-muted normal-case font-normal">
                  (optional — skip to allocate directly to State Manager)
                </span>
              )}
            </label>
            <select
              className="select"
              value={selectedIndustryManagerId}
              onChange={handleImChange}
              disabled={loadingIMs}
            >
              <option value="">
                {loadingIMs
                  ? 'Loading industry managers…'
                  : isStateManager
                    ? 'Select Industry Manager'
                    : '— Allocate directly to State Manager —'}
              </option>
              {industryManagers.map(m => (
                <option key={m._id} value={m._id}>{m.name} — {m.industry} · {m.state}</option>
              ))}
            </select>
            {!loadingIMs && industryManagers.length === 0 && (
              <p className="text-[11px] text-amber font-medium mt-1">
                {isStateManager
                  ? 'No industry managers found in your team'
                  : 'No industry managers found under this State Manager'}
              </p>
            )}
          </div>
        )}

        {/* Step 3 — District Manager. Required for an Industry Manager (their only
            step), optional for everyone above, who may stop at the IM. */}
        {showDmStep && !!branchImId && (
          <div className="space-y-2">
            <label className="form-label">
              District Manager
              {isIndustryManager ? (
                <span className="text-red"> *</span>
              ) : (
                <span className="ml-1 text-[12px] text-text-muted normal-case font-normal">
                  (optional — skip to allocate to Industry Manager)
                </span>
              )}
            </label>
            <select
              className="select"
              value={selectedExecutiveId}
              onChange={e => setSelectedExecutiveId(e.target.value)}
              disabled={loadingExecs}
            >
              <option value="">
                {loadingExecs
                  ? 'Loading district managers…'
                  : isIndustryManager
                    ? 'Select District Manager'
                    : '— Allocate to Industry Manager —'}
              </option>
              {executives.map(ex => (
                <option key={ex._id} value={ex._id}>{ex.name}{ex.district ? ` — ${ex.district}` : ''}</option>
              ))}
            </select>
            {!loadingExecs && executives.length === 0 && (
              <p className="text-[13px] text-text-muted font-medium mt-1">
                {isIndustryManager
                  ? 'No district managers found in your team'
                  : 'No district managers found under this Industry Manager'}
              </p>
            )}
          </div>
        )}

        {/* Allocation summary badge */}
        {allocateToId && (
          <div className="p-3 bg-[#f0fdf4] rounded-xl border border-[#bbf7d0] flex items-center gap-3">
            <div className="w-6 h-6 rounded-full bg-[#16a34a] flex items-center justify-center text-white text-xs font-bold">✓</div>
            <div>
              <div className="text-[11px] font-bold text-[#166534] uppercase tracking-wider">Allocation Target</div>
              <div className="text-sm font-bold text-[#15803d]">{allocateName}</div>
            </div>
          </div>
        )}

        <div className="flex justify-end gap-3 pt-4 border-t border-border mt-6">
          <Button variant="outline" onClick={handleClose}>Cancel</Button>
          <Button
            variant="primary"
            type="submit"
            loading={loading}
            disabled={!allocateToId}
            className="bg-[#0f766e]"
          >
            {isBulk ? `Allocate ${selectedLeads.length} Lead${selectedLeads.length === 1 ? '' : 's'}` : 'Allocate Lead'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export default AllocateLeadModal;
