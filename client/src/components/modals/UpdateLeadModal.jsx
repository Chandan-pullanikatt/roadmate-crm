import React, { useState, useEffect } from 'react';
import { Modal, Button, FileUpload } from '../ui';
import { useToast } from '../../context/ToastContext';
import { leadsApi } from '../../api/leadsApi';
import { useQueryClient } from '@tanstack/react-query';

const digitsOnly = (value) => String(value ?? '').replace(/\D/g, '');

const PRIORITIES = [
  { id: 'hot',  icon: '🔥', label: 'Hot',  color: '#B45309', bg: '#FEF3C7', border: '#FCD34D', def: 'Interested, budget available, meeting done' },
  { id: 'warm', icon: '☀️', label: 'Warm', color: '#2563EB', bg: '#EFF4FF', border: '#BFDBFE', def: 'Interested but undecided' },
  { id: 'cold', icon: '❄️', label: 'Cold', color: '#6B7280', bg: '#F3F4F6', border: '#D1D5DB', def: 'Not ready / no response' },
];

const UpdateLeadModal = ({ isOpen, onClose, lead }) => {
  const { addToast } = useToast();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [priority, setPriority] = useState('warm');
  const [formData, setFormData] = useState({
    status: 'new',
    nextActionAt: '',
    notes: '',
    expectedOnboarding: '',
    actualRevenue: '',
    revenueCategory: 'other',
    meetingLink: '',
    documents: []
  });

  useEffect(() => {
    if (lead) {
      setPriority(lead.priority || 'warm');
      setFormData({
        status: lead.status || 'new',
        nextActionAt: lead.nextActionAt ? new Date(lead.nextActionAt).toISOString().split('T')[0] : '',
        notes: lead.notes || '',
        expectedOnboarding: lead.expectedOnboarding ? new Date(lead.expectedOnboarding).toISOString().split('T')[0] : '',
        actualRevenue: lead.actualRevenue || '',
        revenueCategory: lead.revenueCategory || 'other',
        meetingLink: lead.meetingLink || '',
        documents: lead.documents || []
      });
    }
  }, [lead]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = {
        status: formData.status,
        priority,
        nextActionAt: formData.nextActionAt,
        convertedAt: formData.expectedOnboarding,
        notes: formData.notes,
        actualRevenue: formData.actualRevenue,
        revenueCategory: formData.revenueCategory,
        meetingLink: formData.status === 'meeting_virtual' ? formData.meetingLink.trim() : lead.meetingLink || '',
        documents: formData.documents
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
            <option value="meeting_virtual">Virtual Meeting</option>
            <option value="meeting_direct">Direct Meeting</option>
            <option value="rnr">RNR</option>
            <option value="converted">Converted</option>
            <option value="blocking_amount_received">Blocking Amount Received</option>
            <option value="full_amount_received">Full Amount Received</option>
            <option value="agreement_signed">Agreement Signed</option>
            <option value="not_interested">Not Interested</option>
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

        {formData.status === 'meeting_virtual' && (
          <div className="space-y-1 animate-in fade-in slide-in-from-top-1">
            <label className="form-label">Meeting Link (Optional)</label>
            <input
              type="url"
              className="input"
              placeholder="https://meet.google.com/... or https://zoom.us/..."
              value={formData.meetingLink}
              onChange={(e) => setFormData({...formData, meetingLink: e.target.value})}
            />
          </div>
        )}

        {['converted', 'blocking_amount_received', 'full_amount_received', 'agreement_signed'].includes(formData.status) && (
          <div className="space-y-4 animate-in fade-in slide-in-from-top-1">
            <div className="space-y-1">
              <label className="form-label">Revenue Category</label>
              <select 
                className="select" 
                value={formData.revenueCategory} 
                onChange={(e) => setFormData({...formData, revenueCategory: e.target.value})}
                required
              >
                <option value="partnership">Partnership</option>
                <option value="shop_subscription">Shop Subscription</option>
                <option value="delivery_subscription">Delivery Subscription</option>
                <option value="distributor_subscription">Distributor Subscription</option>
                <option value="manufacturer_subscription">Manufacturer Subscription</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="form-label">Actual Revenue (\u20B9)</label>
              <input 
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                className="input" 
                placeholder="Enter conversion amount"
                value={formData.actualRevenue} 
                onChange={(e) => setFormData({...formData, actualRevenue: digitsOnly(e.target.value)})} 
                required
              />
            </div>
            <div className="space-y-1">
              <label className="form-label">Expected Onboarding Date</label>
              <input 
                type="date" 
                className="input" 
                value={formData.expectedOnboarding} 
                onChange={(e) => setFormData({...formData, expectedOnboarding: e.target.value})} 
                required
              />
            </div>
          </div>
        )}

        {/* Priority selector */}
        <div className="space-y-1.5">
          <label className="form-label">Lead Priority</label>
          <div className="flex gap-2">
            {PRIORITIES.map(p => (
              <div key={p.id} className="flex-1 relative group">
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
                <span className="absolute right-1.5 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-sky-500 text-white text-[9px] font-black flex items-center justify-center shadow-sm shadow-sky-300 cursor-default select-none">i</span>
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 w-44 bg-white border border-border rounded-xl shadow-lg px-3 py-2 text-[11px] text-text-secondary hidden group-hover:block pointer-events-none">
                  <span className="font-bold" style={{ color: p.color }}>{p.icon} {p.label}:</span> {p.def}
                </div>
              </div>
            ))}
          </div>
        </div>

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

        <div className="space-y-1">
          <label className="form-label">Attach Document (Optional)</label>
          <FileUpload 
            folder="lead-docs"
            entityId={lead._id}
            onUploadComplete={(file) => setFormData(prev => ({ ...prev, documents: [...prev.documents, file] }))}
          />
          {formData.documents.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2">
              {formData.documents.map((doc, idx) => (
                <div key={idx} className="text-[10px] bg-surface2 px-2 py-1 rounded border border-border flex items-center gap-2">
                  <span className="truncate max-w-[100px]">{doc.name}</span>
                  <button type="button" className="text-red hover:text-red-dark" onClick={() => setFormData(prev => ({ ...prev, documents: prev.documents.filter((_, i) => i !== idx) }))}>×</button>
                </div>
              ))}
            </div>
          )}
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
