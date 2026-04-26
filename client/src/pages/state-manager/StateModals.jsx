import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { usersApi } from '../../api/usersApi';
import { leadsApi } from '../../api/leadsApi';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../../components/ui';

const StateModals = ({ type, onClose }) => {
  const queryClient = useQueryClient();
  const { addToast } = useToast();
  const { user: currentUser } = useAuth();
  const [loading, setLoading] = useState(false);

  // Form states
  const [indMgrData, setIndMgrData] = useState({ name: '', email: '', phone: '', industry: 'Automobile', password: '' });
  const [leadData, setLeadData] = useState({ company: '', name: '', phone: '', industry: 'Automobile', district: 'Ernakulam', priority: 'warm' });

  const createIndMgrMutation = useMutation({
    mutationFn: (data) => usersApi.createIndustryManager({
      ...data,
      state: currentUser?.state,
      reportingTo: currentUser?._id
    }),
    onSuccess: () => {
      queryClient.invalidateQueries(['users', 'industry-managers']);
      addToast("Industry Manager created successfully", "success");
      onClose();
    },
    onError: (err) => {
      addToast(err.response?.data?.message || "Creation failed", "error");
    }
  });

  const createLeadMutation = useMutation({
    mutationFn: leadsApi.createLead,
    onSuccess: () => {
      queryClient.invalidateQueries(['leads', 'state-list']);
      addToast("Lead created successfully", "success");
      onClose();
    },
    onError: (err) => {
      addToast(err.response?.data?.message || "Failed to create lead", "error");
    }
  });

  const bulkUploadMutation = useMutation({
    mutationFn: leadsApi.bulkUpload,
    onSuccess: (res) => {
      queryClient.invalidateQueries(['leads', 'state-list']);
      addToast(`Successfully uploaded ${res.data.count} leads`, "success");
      onClose();
    }
  });

  const handleBulkFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setLoading(true);
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const text = evt.target.result;
        const lines = text.split('\n').filter(l => l.trim());
        const headers = lines[0].split(',').map(h => h.trim());
        const leads = lines.slice(1).map(line => {
          const values = line.split(',').map(v => v.trim());
          const lead = {};
          headers.forEach((header, i) => { lead[header] = values[i]; });
          return lead;
        });
        bulkUploadMutation.mutate(leads);
      } catch (err) {
        addToast("Invalid CSV format", "error");
      } finally {
        setLoading(false);
      }
    };
    reader.readAsText(file);
  };

  if (!type) return null;

  const renderModalContent = () => {
    switch (type) {
      case 'create-ind-mgr':
        return (
          <div className="modal">
            <div className="modal-header">
              <div>
                <div className="modal-title">Create Industry Manager</div>
                <div className="modal-sub">Assign a new manager to a specific industry in {currentUser?.state}</div>
              </div>
              <button className="modal-close" onClick={onClose}>&times;</button>
            </div>
            <form onSubmit={(e) => { e.preventDefault(); createIndMgrMutation.mutate(indMgrData); }}>
              <div className="modal-body">
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Full Name</label>
                    <input type="text" required className="form-input" placeholder="e.g. Arjun Nair" value={indMgrData.name} onChange={e => setIndMgrData({...indMgrData, name: e.target.value})} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Email ID</label>
                    <input type="email" required className="form-input" placeholder="arjun@roadmate.in" value={indMgrData.email} onChange={e => setIndMgrData({...indMgrData, email: e.target.value})} />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Phone Number</label>
                    <input type="text" required className="form-input" placeholder="+91 98765 43210" value={indMgrData.phone} onChange={e => setIndMgrData({...indMgrData, phone: e.target.value})} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Industry</label>
                    <select className="form-select" value={indMgrData.industry} onChange={e => setIndMgrData({...indMgrData, industry: e.target.value})}>
                      {['Automobile', 'Healthcare', 'FMCG', 'Electronics', 'Real Estate'].map(i => <option key={i} value={i}>{i}</option>)}
                    </select>
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Password</label>
                  <input type="text" required className="form-input" placeholder="Temporary password" value={indMgrData.password} onChange={e => setIndMgrData({...indMgrData, password: e.target.value})} />
                </div>
              </div>
              <div className="modal-footer">
                <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
                <Button type="submit" className="bg-purple text-white" disabled={createIndMgrMutation.isLoading}>
                  {createIndMgrMutation.isLoading ? "Creating..." : "Create Manager"}
                </Button>
              </div>
            </form>
          </div>
        );
      
      case 'bulk-upload':
        return (
          <div className="modal">
            <div className="modal-header">
              <div>
                <div className="modal-title">Bulk Upload Leads</div>
                <div className="modal-sub">Upload CSV file with lead details (Company, Name, Phone, District, Industry, Priority)</div>
              </div>
              <button className="modal-close" onClick={onClose}>&times;</button>
            </div>
            <div className="modal-body">
              <div style={{ border: '2px dashed var(--border)', borderRadius: 'var(--radius)', padding: '40px 20px', textAlign: 'center' }}>
                <div style={{ fontSize: '32px', marginBottom: '12px' }}>📁</div>
                <div className="section-title">Drag and drop file here</div>
                <div className="section-sub">or click to browse from your computer</div>
                <input type="file" style={{ display: 'none' }} id="bulk-file" accept=".csv" onChange={handleBulkFile} />
                <button className="btn btn-outline btn-sm" style={{ marginTop: '16px' }} onClick={() => document.getElementById('bulk-file').click()}>Choose CSV File</button>
              </div>
              <div style={{ marginTop: '16px', fontSize: '12px', color: 'var(--text-muted)' }}>
                Format: company, name, phone, district, industry, priority
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={onClose}>Cancel</button>
            </div>
          </div>
        );

      case 'new-lead':
        return (
          <div className="modal">
            <div className="modal-header">
              <div>
                <div className="modal-title">Add New Lead</div>
                <div className="modal-sub">Enter details for a single onboarding lead</div>
              </div>
              <button className="modal-close" onClick={onClose}>&times;</button>
            </div>
            <form onSubmit={(e) => { e.preventDefault(); createLeadMutation.mutate(leadData); }}>
              <div className="modal-body">
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Company Name</label>
                    <input type="text" required className="form-input" placeholder="e.g. Reliance Auto" value={leadData.company} onChange={e => setLeadData({...leadData, company: e.target.value})} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Contact Person</label>
                    <input type="text" required className="form-input" placeholder="e.g. Rajesh Kumar" value={leadData.name} onChange={e => setLeadData({...leadData, name: e.target.value})} />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Phone</label>
                    <input type="text" required className="form-input" placeholder="+91..." value={leadData.phone} onChange={e => setLeadData({...leadData, phone: e.target.value})} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Industry</label>
                    <select className="form-select" value={leadData.industry} onChange={e => setLeadData({...leadData, industry: e.target.value})}>
                      {['Automobile', 'Healthcare', 'FMCG', 'Electronics'].map(i => <option key={i} value={i}>{i}</option>)}
                    </select>
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">District</label>
                    <select className="form-select" value={leadData.district} onChange={e => setLeadData({...leadData, district: e.target.value})}>
                      {['Ernakulam', 'Thrissur', 'Kozhikode', 'Thiruvananthapuram'].map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Priority</label>
                    <select className="form-select" value={leadData.priority} onChange={e => setLeadData({...leadData, priority: e.target.value})}>
                      <option value="warm">Warm</option>
                      <option value="hot">Hot</option>
                      <option value="cold">Cold</option>
                    </select>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={onClose}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={createLeadMutation.isLoading}>
                  {createLeadMutation.isLoading ? "Saving..." : "Save Lead"}
                </button>
              </div>
            </form>
          </div>
        );

      case 'leave-policy':
        return (
          <div className="modal modal-lg">
            <div className="modal-header">
              <div>
                <div className="modal-title">Leave Policy · RoadMate CRM</div>
                <div className="modal-sub">Last updated: Jan 2026</div>
              </div>
              <button className="modal-close" onClick={onClose}>&times;</button>
            </div>
            <div className="modal-body">
              <div style={{ lineHeight: '1.6', fontSize: '13.5px' }}>
                <h4 style={{ marginBottom: '8px' }}>1. Casual Leave (CL)</h4>
                <p style={{ color: 'var(--text-secondary)', marginBottom: '16px' }}>12 days per year. Max 2 days at a time. Must be applied 2 days in advance.</p>
                
                <h4 style={{ marginBottom: '8px' }}>2. Sick Leave (SL)</h4>
                <p style={{ color: 'var(--text-secondary)', marginBottom: '16px' }}>8 days per year. Medical certificate required for more than 2 days.</p>
                
                <h4 style={{ marginBottom: '8px' }}>3. Optional Holiday</h4>
                <p style={{ color: 'var(--text-secondary)', marginBottom: '16px' }}>2 days per year from the approved list of optional holidays.</p>
                
                <div style={{ background: 'var(--surface2)', padding: '14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                  <strong>Important:</strong> All leave requests from Industry Managers must be approved by the State Manager. Executives' leaves are approved by Industry Managers but visible to State Managers.
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-primary" onClick={onClose}>Close</button>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="modal-overlay open" onClick={(e) => e.target.className.includes('modal-overlay') && onClose()}>
      {renderModalContent()}
    </div>
  );
};

export default StateModals;
