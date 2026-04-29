import React, { useState, useEffect } from 'react';
import { Modal, Button } from '../ui';
import { useToast } from '../../context/ToastContext';
import { leadsApi } from '../../api/leadsApi';
import { useQueryClient } from '@tanstack/react-query';

const UpdateLeadModal = ({ isOpen, onClose, lead }) => {
  const { addToast } = useToast();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    status: 'new',
    nextActionAt: '',
    notes: '',
    expectedOnboarding: ''
  });

  useEffect(() => {
    if (lead) {
      setFormData({
        status: lead.status || 'new',
        nextActionAt: lead.nextActionAt ? new Date(lead.nextActionAt).toISOString().split('T')[0] : '',
        notes: lead.notes || '',
        expectedOnboarding: lead.expectedOnboarding ? new Date(lead.expectedOnboarding).toISOString().split('T')[0] : ''
      });
    }
  }, [lead]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      // Use the payload requested in the fix
      const payload = {
        status: formData.status,
        nextActionAt: formData.nextActionAt,
        convertedAt: formData.expectedOnboarding,
        notes: formData.notes
      };
      
      await leadsApi.updateLead(lead._id, payload);
      addToast('Lead updated successfully', 'success');
      
      // Invalidate both leads and counts
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['leads', 'counts'] });
      
      onClose();
    } catch (err) {
      addToast(err.response?.data?.message || 'Error updating lead', 'error');
    } finally {
      setLoading(false);
    }
  };

  if (!lead) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Update Lead: ${lead.name}`}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1">
          <label className="form-label">Status</label>
          <select 
            className="select" 
            value={formData.status} 
            onChange={(e) => setFormData({...formData, status: e.target.value})}
          >
            <option value="new">New</option>
            <option value="followup">Follow-up</option>
            <option value="meeting_virtual">Meeting</option>
            <option value="rnr">RNR</option>
            <option value="converted">Converted</option>
            <option value="lost">Lost</option>
          </select>
        </div>

        {(formData.status === 'followup' || formData.status === 'rnr') && (
          <div className="space-y-1 animate-in fade-in slide-in-from-top-1">
            <label className="form-label">Next Follow-up Date</label>
            <input 
              type="date" 
              className="input" 
              value={formData.nextActionAt} 
              onChange={(e) => setFormData({...formData, nextActionAt: e.target.value})} 
              required
            />
          </div>
        )}

        {formData.status === 'converted' && (
          <div className="space-y-1 animate-in fade-in slide-in-from-top-1">
            <label className="form-label">Expected Onboarding Date</label>
            <input 
              type="date" 
              className="input" 
              value={formData.expectedOnboarding} 
              onChange={(e) => setFormData({...formData, expectedOnboarding: e.target.value})} 
              required
            />
          </div>
        )}

        <div className="space-y-1">
          <label className="form-label">Notes / Last Action</label>
          <textarea 
            className="textarea" 
            placeholder="Describe the last interaction..." 
            value={formData.notes} 
            onChange={(e) => setFormData({...formData, notes: e.target.value})}
            required
          />
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-border mt-6">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button variant="primary" type="submit" loading={loading} className="bg-[#0f766e]">Update Lead</Button>
        </div>
      </form>
    </Modal>
  );
};

export default UpdateLeadModal;
