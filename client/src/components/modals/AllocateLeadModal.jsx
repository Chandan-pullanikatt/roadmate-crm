import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Modal, Button } from '../ui';
import { useToast } from '../../context/ToastContext';
import { leadsApi } from '../../api/leadsApi';
import { usersApi } from '../../api/usersApi';

// Fix: Lead Allocation — State Manager Flow — hierarchical SM → IM → Executive selection
const AllocateLeadModal = ({ isOpen, onClose, lead }) => {
  const { addToast } = useToast();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [selectedStateManagerId, setSelectedStateManagerId] = useState('');
  const [selectedIndustryManagerId, setSelectedIndustryManagerId] = useState('');
  const [selectedExecutiveId, setSelectedExecutiveId] = useState('');

  // Step 1: load state managers for the lead's state
  const { data: stateManagers = [], isLoading: loadingSMs } = useQuery({
    queryKey: ['users', 'alloc-sms', lead?.state],
    queryFn: () => usersApi.getUsers({ role: 'state_manager', state: lead?.state }).then(r => r.data),
    enabled: isOpen && !!lead
  });

  // Step 2: load industry managers in the selected SM's state
  const selectedSM = stateManagers.find(m => m._id === selectedStateManagerId);
  const { data: industryManagers = [], isLoading: loadingIMs } = useQuery({
    queryKey: ['users', 'alloc-ims', selectedStateManagerId, selectedSM?.state],
    queryFn: () => usersApi.getUsers({ role: 'industry_manager', state: selectedSM?.state }).then(r => r.data),
    enabled: isOpen && !!selectedStateManagerId && !!selectedSM?.state
  });

  // Step 3: load executives under the selected industry manager
  const selectedIM = industryManagers.find(m => m._id === selectedIndustryManagerId);
  const { data: executives = [], isLoading: loadingExecs } = useQuery({
    queryKey: ['users', 'alloc-execs', selectedIndustryManagerId],
    queryFn: () => usersApi.getUsers({
      role: 'executive',
      state: selectedIM?.state || selectedSM?.state,
      reportingTo: selectedIndustryManagerId
    }).then(r => r.data),
    enabled: isOpen && !!selectedIndustryManagerId
  });

  const handleSmChange = (e) => {
    setSelectedStateManagerId(e.target.value);
    // Reset downstream when SM changes
    setSelectedIndustryManagerId('');
    setSelectedExecutiveId('');
  };

  const handleImChange = (e) => {
    setSelectedIndustryManagerId(e.target.value);
    // Reset executive when IM changes
    setSelectedExecutiveId('');
  };

  // Determine the final allocation target (most specific wins)
  const allocateToId = selectedExecutiveId || selectedIndustryManagerId || selectedStateManagerId;
  const allocateName =
    executives.find(e => e._id === selectedExecutiveId)?.name ||
    industryManagers.find(m => m._id === selectedIndustryManagerId)?.name ||
    stateManagers.find(m => m._id === selectedStateManagerId)?.name ||
    '';

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!allocateToId) return addToast('Please select at least a State Manager', 'warning');
    setLoading(true);
    try {
      await leadsApi.allocateLead(lead._id, allocateToId);
      addToast(`Lead allocated to ${allocateName}`, 'success');
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
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

  if (!lead) return null;

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Allocate Lead" subtitle="Assign through the hierarchy — Industry Manager and Executive are optional for direct SM allocation">
      {/* Lead info */}
      <div className="mb-6">
        <label className="text-[11px] font-bold text-text-muted uppercase tracking-wider mb-2 block">Target Lead</label>
        <div className="p-3 bg-surface2/50 rounded-xl border border-border flex items-center justify-between">
          <div>
            <span className="font-bold text-text-primary">{lead.company || lead.name}</span>
            {lead.company && <div className="text-[11px] text-text-muted mt-0.5">{lead.name}</div>}
          </div>
          <div className="flex gap-2">
            {lead.country && <span className="bg-purple/10 text-purple px-2 py-0.5 rounded text-[10px] font-bold uppercase">{lead.country}</span>}
            {lead.state && <span className="bg-blue/10 text-blue px-2 py-0.5 rounded text-[10px] font-bold uppercase">{lead.state}</span>}
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Step 1 — State Manager (required to initiate allocation) */}
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
              No state managers found{lead?.state ? ` for ${lead.state}` : ''}
            </p>
          )}
        </div>

        {/* Step 2 — Industry State Manager (optional — skipping allocates to SM directly) */}
        {selectedStateManagerId && (
          <div className="space-y-2">
            <label className="form-label">
              Industry State Manager
              <span className="ml-1 text-[10px] text-text-muted normal-case font-normal">
                (optional — skip to allocate directly to State Manager)
              </span>
            </label>
            <select
              className="select"
              value={selectedIndustryManagerId}
              onChange={handleImChange}
              disabled={loadingIMs}
            >
              <option value="">
                {loadingIMs ? 'Loading industry managers…' : '— Allocate directly to State Manager —'}
              </option>
              {industryManagers.map(m => (
                <option key={m._id} value={m._id}>{m.name} — {m.industry} · {m.state}</option>
              ))}
            </select>
          </div>
        )}

        {/* Step 3 — District Executive (optional — shown only after IM is selected) */}
        {selectedIndustryManagerId && (
          <div className="space-y-2">
            <label className="form-label">
              District Executive
              <span className="ml-1 text-[10px] text-text-muted normal-case font-normal">
                (optional — skip to allocate to Industry Manager)
              </span>
            </label>
            <select
              className="select"
              value={selectedExecutiveId}
              onChange={e => setSelectedExecutiveId(e.target.value)}
              disabled={loadingExecs}
            >
              <option value="">
                {loadingExecs ? 'Loading executives…' : '— Allocate to Industry Manager —'}
              </option>
              {executives.map(ex => (
                <option key={ex._id} value={ex._id}>{ex.name}</option>
              ))}
            </select>
            {!loadingExecs && executives.length === 0 && (
              <p className="text-[11px] text-text-muted font-medium mt-1">
                No executives found under this Industry Manager
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
            Allocate Lead
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export default AllocateLeadModal;
