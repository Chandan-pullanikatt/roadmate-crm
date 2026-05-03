import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Modal, Button } from '../ui';
import { useToast } from '../../context/ToastContext';
import { leadsApi } from '../../api/leadsApi';
import { usersApi } from '../../api/usersApi';

const AllocateLeadModal = ({ isOpen, onClose, lead }) => {
  const { addToast } = useToast();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [selectedExecutiveId, setSelectedExecutiveId] = useState('');

  const { data: executives, isLoading: loadingExecs } = useQuery({
    queryKey: ['executives', 'state', lead?.state],
    queryFn: () => usersApi.getUsers({ role: 'executive', state: lead?.state }).then(res => res.data),
    enabled: !!lead?.state && isOpen
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedExecutiveId) return addToast('Please select an executive', 'warning');
    setLoading(true);
    try {
      await leadsApi.allocateLead(lead._id, selectedExecutiveId);
      const execName = executives.find(e => e._id === selectedExecutiveId)?.name || 'Executive';
      addToast(`Lead allocated to ${execName}`, 'success');
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      onClose();
    } catch (err) {
      addToast(err.response?.data?.message || 'Error allocating lead', 'error');
    } finally {
      setLoading(false);
    }
  };

  if (!lead) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Allocate Lead">
      <div className="mb-6">
        <label className="text-[11px] font-bold text-text-muted uppercase tracking-wider mb-2 block">Target Lead</label>
        <div className="p-3 bg-surface2/50 rounded-xl border border-border flex items-center justify-between">
          <div>
            <span className="font-bold text-text-primary">{lead.company || lead.name}</span>
            {lead.company && <div className="text-[11px] text-text-muted mt-0.5">{lead.name}</div>}
          </div>
          <div className="flex gap-2">
            {lead.country && <span className="bg-purple/10 text-purple px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider">{lead.country}</span>}
            {lead.state && <span className="bg-blue/10 text-blue px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider">{lead.state}</span>}
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <label className="form-label">Assign to Executive</label>
          <select 
            className="select" 
            value={selectedExecutiveId} 
            onChange={(e) => setSelectedExecutiveId(e.target.value)}
            disabled={loadingExecs || !executives?.length}
          >
            <option value="">Select Executive</option>
            {executives?.map(ex => (
              <option key={ex._id} value={ex._id}>{ex.name}</option>
            ))}
          </select>
          {!loadingExecs && executives?.length === 0 && (
            <p className="text-[11px] text-red font-medium mt-1">No executives available for this state</p>
          )}
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-border mt-6">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button variant="primary" type="submit" loading={loading} disabled={!selectedExecutiveId} className="bg-[#0f766e]">Allocate Lead</Button>
        </div>
      </form>
    </Modal>
  );
};

export default AllocateLeadModal;
