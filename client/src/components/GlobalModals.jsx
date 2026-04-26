import React, { useState, useEffect } from 'react';
import { Modal, Button, Tag, FileUpload, Avatar } from './ui';
import { useToast } from '../context/ToastContext';
import { leadsApi } from '../api/leadsApi';
import { usersApi } from '../api/usersApi';
import { leaveApi } from '../api/leaveApi';

const districtsByCountry = {
  'India': ['Hyderabad', 'Secunderabad', 'Warangal', 'Mumbai', 'Pune', 'Nagpur', 'Bengaluru', 'Mysuru', 'Chennai', 'Coimbatore', 'Ahmedabad', 'Surat', 'Delhi', 'Gurugram', 'Jaipur', 'Kochi'],
  'UAE': ['Dubai', 'Abu Dhabi', 'Sharjah', 'Ajman', 'Fujairah', 'Ras Al Khaimah'],
  'Saudi Arabia': ['Riyadh', 'Jeddah', 'Mecca', 'Medina', 'Dammam', 'Khobar'],
  'Singapore': ['Central Region', 'North Region', 'East Region', 'West Region', 'North-East Region'],
  'USA': ['New York', 'Los Angeles', 'Chicago', 'Houston', 'Phoenix', 'Philadelphia'],
  'UK': ['London', 'Birmingham', 'Manchester', 'Leeds', 'Glasgow', 'Liverpool'],
  'Australia': ['Sydney', 'Melbourne', 'Brisbane', 'Perth', 'Adelaide'],
  'Malaysia': ['Kuala Lumpur', 'Johor Bahru', 'Penang', 'Ipoh', 'Petaling Jaya'],
  'Germany': ['Berlin', 'Hamburg', 'Munich', 'Cologne', 'Frankfurt'],
  'Other': ['City / Region']
};

const GlobalModals = () => {
  const { addToast } = useToast();
  const [activeModal, setActiveModal] = useState(null);
  const [managers, setManagers] = useState([]);
  const [executives, setExecutives] = useState([]);
  const [loading, setLoading] = useState(false);
  
  const [leadFormData, setLeadFormData] = useState({
    name: '', company: '', countryCode: '+91', phone: '', email: '',
    country: '', district: '', state: '', industry: '',
    leadSource: 'Direct', priority: 'Hot 🔥', manager: '', owner: '', notes: ''
  });

  const [managerFormData, setManagerFormData] = useState({
    name: '', email: '', phone: '', state: '', employmentType: 'Full Time',
    doj: '', basicSalary: '', normalStart: '09:30', ramadanStart: '09:00',
    aadhaar: '', pan: '', documents: []
  });

  const [execFormData, setExecFormData] = useState({
    role: 'industry-manager', reportingTo: '', name: '', phone: '',
    state: '', industry: '', doj: '', basicSalary: '',
    aadhaar: '', pan: '', documents: []
  });

  const [leaveAction, setLeaveAction] = useState({ id: '', reason: '' });

  useEffect(() => {
    const handleOpenModal = (e) => {
      setActiveModal(e.detail);
      if (['add-lead', 'create-state-manager', 'create-exec', 'allocate-lead', 'leave-approval'].includes(e.detail)) fetchUsers();
    };
    window.addEventListener('open-modal', handleOpenModal);
    return () => window.removeEventListener('open-modal', handleOpenModal);
  }, []);

  const fetchUsers = async () => {
    try {
      const res = await usersApi.getUsers();
      setManagers(res.data.filter(u => u.role === 'state-manager'));
      setExecutives(res.data.filter(u => u.role === 'executive'));
    } catch (err) {
      addToast('Error fetching users', 'error');
    }
  };

  const handleLeadSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const leadData = {
        ...leadFormData,
        phone: `${leadFormData.countryCode}${leadFormData.phone}`
      };
      await leadsApi.createLead(leadData);
      addToast('Lead added successfully!', 'success');
      setActiveModal(null);
      setLeadFormData({
        name: '', company: '', countryCode: '+91', phone: '', email: '',
        country: '', district: '', state: '', industry: '',
        leadSource: 'Direct', priority: 'Hot 🔥', manager: '', owner: '', notes: ''
      });
    } catch (err) {
      addToast(err.response?.data?.message || 'Error adding lead', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleManagerSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await usersApi.createStateManager(managerFormData);
      addToast('State Manager created successfully!', 'success');
      setActiveModal(null);
    } catch (err) {
      addToast(err.response?.data?.message || 'Error creating manager', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleExecSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const role = execFormData.role === 'industry-manager' ? 'industry-manager' : 'executive';
      await usersApi.createUser({ ...execFormData, role });
      addToast('Account created successfully!', 'success');
      setActiveModal(null);
    } catch (err) {
      addToast(err.response?.data?.message || 'Error creating account', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleLeaveAction = async (id, status) => {
    try {
      if (status === 'approve') await leaveApi.approveLeave(id);
      else await leaveApi.rejectLeave(id, leaveAction.reason);
      addToast(`Leave ${status}d successfully!`, 'success');
      setActiveModal(null);
    } catch (err) {
      addToast('Error updating leave', 'error');
    }
  };

  if (!activeModal) return null;

  return (
    <>
      {/* ADD LEAD MODAL */}
      <Modal 
        isOpen={activeModal === 'add-lead'} 
        title="Add New Lead" 
        onClose={() => setActiveModal(null)}
      >
        <form onSubmit={handleLeadSubmit} className="space-y-6">
          <div className="space-y-4">
            <div className="text-xs font-bold text-accent uppercase tracking-widest">Lead Information</div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="form-label">Full Name</label>
                <input className="input" type="text" value={leadFormData.name} onChange={(e)=>setLeadFormData({...leadFormData, name: e.target.value})} placeholder="Lead name" required />
              </div>
              <div className="space-y-1">
                <label className="form-label">Company / Business</label>
                <input className="input" type="text" value={leadFormData.company} onChange={(e)=>setLeadFormData({...leadFormData, company: e.target.value})} placeholder="Company name" />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="form-label">Phone Number</label>
                <div className="flex gap-2">
                  <select className="select w-24 shrink-0" value={leadFormData.countryCode} onChange={(e)=>setLeadFormData({...leadFormData, countryCode: e.target.value})}>
                    <option value="+91">🇮🇳 +91</option>
                    <option value="+1">🇺🇸 +1</option>
                    <option value="+971">🇦🇪 +971</option>
                  </select>
                  <input className="input flex-1" type="tel" value={leadFormData.phone} onChange={(e)=>setLeadFormData({...leadFormData, phone: e.target.value})} placeholder="XXXXX XXXXX" required />
                </div>
              </div>
              <div className="space-y-1">
                <label className="form-label">Email Address</label>
                <input className="input" type="email" value={leadFormData.email} onChange={(e)=>setLeadFormData({...leadFormData, email: e.target.value})} placeholder="email@example.com" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="form-label">Country</label>
                <select className="select" value={leadFormData.country} onChange={(e)=>setLeadFormData({...leadFormData, country: e.target.value, district: ''})}>
                  <option value="">Select Country</option>
                  {Object.keys(districtsByCountry).map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="form-label">District</label>
                <select className="select" value={leadFormData.district} onChange={(e)=>setLeadFormData({...leadFormData, district: e.target.value})}>
                  <option value="">Select District</option>
                  {(districtsByCountry[leadFormData.country] || []).map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="form-label">Lead Source</label>
                <select className="select" value={leadFormData.leadSource} onChange={(e)=>setLeadFormData({...leadFormData, leadSource: e.target.value})}>
                  <option>Direct</option>
                  <option>Referral</option>
                  <option>Campaign</option>
                  <option>Website</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="form-label">Priority</label>
                <select className="select" value={leadFormData.priority} onChange={(e)=>setLeadFormData({...leadFormData, priority: e.target.value})}>
                  <option>Hot 🔥</option>
                  <option>Warm</option>
                  <option>Cold</option>
                </select>
              </div>
            </div>

            <div className="space-y-1">
              <label className="form-label">Initial Notes</label>
              <textarea className="textarea h-24" value={leadFormData.notes} onChange={(e)=>setLeadFormData({...leadFormData, notes: e.target.value})} placeholder="Any initial notes about this lead…"></textarea>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button variant="outline" onClick={() => setActiveModal(null)}>Cancel</Button>
            <Button variant="primary" type="submit" loading={loading}>Save Lead</Button>
          </div>
        </form>
      </Modal>

      {/* BULK UPLOAD MODAL */}
      <Modal 
        isOpen={activeModal === 'bulk-upload'} 
        title="Bulk Lead Upload" 
        onClose={() => setActiveModal(null)}
      >
        <div className="space-y-6">
          <div className="p-4 bg-blue-light/30 border border-blue/20 rounded-2xl flex gap-3 items-start">
            <span className="text-blue text-lg">ℹ️</span>
            <div className="text-xs text-text-secondary leading-relaxed">
              Required columns: <span className="font-bold">Name, Company, Phone, Email, State, Industry</span>.
              <br />
              <a href="#" className="text-blue font-bold hover:underline">Download CSV Template</a>
            </div>
          </div>

          <FileUpload 
            onUpload={(file) => addToast(`File ${file.name} uploaded!`, 'success')}
            accept=".csv,.xlsx"
            label="Upload your lead database"
          />

          <div className="space-y-1">
            <label className="form-label">Default Allocation</label>
            <select className="select">
              <option value="">Manually allocate after upload</option>
              <option>Auto-distribute to available managers</option>
            </select>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button variant="outline" onClick={() => setActiveModal(null)}>Cancel</Button>
            <Button variant="primary">Process Upload</Button>
          </div>
        </div>
      </Modal>

      {/* CREATE STATE MANAGER MODAL */}
      <Modal 
        isOpen={activeModal === 'create-state-manager'} 
        title="Create State Manager" 
        onClose={() => setActiveModal(null)}
      >
        <form onSubmit={handleManagerSubmit} className="space-y-6">
          <div className="space-y-4">
            <div className="text-xs font-bold text-accent uppercase tracking-widest">Personal & Employment</div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="form-label">Full Name</label>
                <input className="input" type="text" value={managerFormData.name} onChange={(e)=>setManagerFormData({...managerFormData, name: e.target.value})} placeholder="Full name" required />
              </div>
              <div className="space-y-1">
                <label className="form-label">Phone</label>
                <input className="input" type="tel" value={managerFormData.phone} onChange={(e)=>setManagerFormData({...managerFormData, phone: e.target.value})} placeholder="+91 XXXXX XXXXX" required />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="form-label">Email</label>
                <input className="input" type="email" value={managerFormData.email} onChange={(e)=>setManagerFormData({...managerFormData, email: e.target.value})} placeholder="manager@company.com" required />
              </div>
              <div className="space-y-1">
                <label className="form-label">State Jurisdiction</label>
                <select className="select" value={managerFormData.state} onChange={(e)=>setManagerFormData({...managerFormData, state: e.target.value})} required>
                  <option value="">Select State</option>
                  <option>Telangana</option>
                  <option>Maharashtra</option>
                  <option>Karnataka</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="form-label">Date of Joining</label>
                <input className="input" type="date" value={managerFormData.doj} onChange={(e)=>setManagerFormData({...managerFormData, doj: e.target.value})} required />
              </div>
              <div className="space-y-1">
                <label className="form-label">Basic Salary (₹)</label>
                <input className="input" type="number" value={managerFormData.basicSalary} onChange={(e)=>setManagerFormData({...managerFormData, basicSalary: e.target.value})} placeholder="e.g. 35000" required />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="form-label">Aadhaar Number</label>
                <input className="input" type="text" value={managerFormData.aadhaar} onChange={(e)=>setManagerFormData({...managerFormData, aadhaar: e.target.value})} placeholder="XXXX XXXX XXXX" required />
              </div>
              <div className="space-y-1">
                <label className="form-label">PAN Number</label>
                <input className="input uppercase" type="text" value={managerFormData.pan} onChange={(e)=>setManagerFormData({...managerFormData, pan: e.target.value})} placeholder="ABCDE1234F" required />
              </div>
            </div>

            <FileUpload 
              onUpload={(file) => setManagerFormData({...managerFormData, documents: [...managerFormData.documents, file]})}
              label="Upload Identity & Agreement"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button variant="outline" onClick={() => setActiveModal(null)}>Cancel</Button>
            <Button variant="primary" type="submit" loading={loading}>Create Manager</Button>
          </div>
        </form>
      </Modal>

      {/* ALLOCATE LEAD MODAL */}
      <Modal 
        isOpen={activeModal === 'allocate-lead'} 
        title="Allocate Leads" 
        onClose={() => setActiveModal(null)}
      >
        <div className="space-y-6">
          <div className="p-4 bg-amber-light/30 border border-amber/20 rounded-2xl flex gap-3 items-start">
            <span className="text-amber text-lg">⚠️</span>
            <div className="text-xs text-text-secondary leading-relaxed">
              <span className="font-bold text-amber">26 leads</span> are currently unallocated. 
              Assign them now to prevent auto-expiry or stagnation.
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="form-label">Filter by State</label>
              <select className="select">
                <option>All States</option>
                <option>Telangana</option>
                <option>Maharashtra</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="form-label">Assign To</label>
              <select className="select">
                <option value="">Select Staff</option>
                {managers.map(m => <option key={m._id} value={m._id}>{m.name} (Manager, {m.state})</option>)}
                {executives.map(e => <option key={e._id} value={e._id}>{e.name} (Exec, {e.state})</option>)}
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <label className="form-label">Select Leads (26 available)</label>
            <div className="border border-border rounded-2xl overflow-hidden max-h-48 overflow-y-auto bg-surface2/30">
              <div className="p-3 border-b border-border bg-surface flex items-center gap-3">
                <input type="checkbox" className="w-4 h-4 rounded accent-accent" />
                <span className="text-xs font-bold">Select All Unallocated</span>
              </div>
              {[1, 2, 3].map(i => (
                <div key={i} className="p-3 border-b border-border/50 flex items-center gap-3 hover:bg-white transition-colors cursor-pointer">
                  <input type="checkbox" className="w-4 h-4 rounded accent-accent" />
                  <div className="flex-1">
                    <div className="text-sm font-bold text-text-primary">Sample Lead {i}</div>
                    <div className="text-[10px] text-text-muted">Tech Corp · Industry · State</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button variant="outline" onClick={() => setActiveModal(null)}>Cancel</Button>
            <Button variant="primary">Allocate Selected</Button>
          </div>
        </div>
      </Modal>

      {/* CREATE EXECUTIVE MODAL */}
      <Modal 
        isOpen={activeModal === 'create-exec'} 
        title="Create Staff Account" 
        onClose={() => setActiveModal(null)}
      >
        <form onSubmit={handleExecSubmit} className="space-y-6">
          <div className="space-y-4">
            <div className="text-xs font-bold text-accent uppercase tracking-widest">Role & Assignment</div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="form-label">Designation</label>
                <select className="select" value={execFormData.role} onChange={(e) => setExecFormData({...execFormData, role: e.target.value})}>
                  <option value="industry-manager">Industry Manager</option>
                  <option value="executive">District Executive</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="form-label">Reporting To</label>
                <select className="select" value={execFormData.reportingTo} onChange={(e) => setExecFormData({...execFormData, reportingTo: e.target.value})}>
                  <option value="">Select Manager</option>
                  {managers.map(m => <option key={m._id} value={m._id}>{m.name} ({m.state})</option>)}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="form-label">Full Name</label>
                <input className="input" type="text" placeholder="Staff name" value={execFormData.name} onChange={(e) => setExecFormData({...execFormData, name: e.target.value})} required />
              </div>
              <div className="space-y-1">
                <label className="form-label">Phone Number</label>
                <input className="input" type="tel" placeholder="+91 XXXXX XXXXX" value={execFormData.phone} onChange={(e) => setExecFormData({...execFormData, phone: e.target.value})} required />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="form-label">Primary State</label>
                <select className="select" value={execFormData.state} onChange={(e) => setExecFormData({...execFormData, state: e.target.value})} required>
                  <option value="">Select State</option>
                  <option>Telangana</option>
                  <option>Maharashtra</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="form-label">Vertical / Industry</label>
                <select className="select" value={execFormData.industry} onChange={(e) => setExecFormData({...execFormData, industry: e.target.value})} required>
                  <option value="">Select Industry</option>
                  <option>Automobile</option>
                  <option>Electronics</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="form-label">Aadhaar Number</label>
                <input className="input" type="text" placeholder="XXXX XXXX XXXX" value={execFormData.aadhaar} onChange={(e) => setExecFormData({...execFormData, aadhaar: e.target.value})} required />
              </div>
              <div className="space-y-1">
                <label className="form-label">PAN Number</label>
                <input className="input uppercase" type="text" placeholder="ABCDE1234F" value={execFormData.pan} onChange={(e) => setExecFormData({...execFormData, pan: e.target.value})} required />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button variant="outline" onClick={() => setActiveModal(null)}>Cancel</Button>
            <Button variant="primary" type="submit" loading={loading}>Create Account</Button>
          </div>
        </form>
      </Modal>

      {/* LEAVE APPROVAL MODAL */}
      <Modal 
        isOpen={activeModal === 'leave-approval'} 
        title="Leave Approvals" 
        onClose={() => setActiveModal(null)}
      >
        <div className="space-y-4">
          <div className="text-xs font-bold text-accent uppercase tracking-widest mb-2">Pending Requests</div>
          
          {/* Sample leave request card */}
          <div className="p-5 rounded-2xl bg-surface2/30 border border-border space-y-4">
            <div className="flex items-center gap-3">
              <Avatar initials="RS" colorClass="state" />
              <div className="flex-1">
                <div className="text-sm font-bold text-text-primary">Rahul Sharma</div>
                <div className="text-[10px] text-text-muted">State Manager · Maharashtra</div>
              </div>
              <Tag variant="amber">Pending</Tag>
            </div>

            <div className="grid grid-cols-2 gap-y-2 text-xs">
              <div className="text-text-muted">Type: <span className="text-text-primary font-bold">Sick Leave</span></div>
              <div className="text-text-muted">Duration: <span className="text-text-primary font-bold">2 Days</span></div>
              <div className="text-text-muted">From: <span className="text-text-primary font-bold">Mar 28</span></div>
              <div className="text-text-muted">To: <span className="text-text-primary font-bold">Mar 29</span></div>
            </div>

            <div className="text-xs bg-white/50 p-3 rounded-xl border border-border/50 text-text-secondary leading-relaxed italic">
              "Fever and cold since last night, need rest for recovery."
            </div>

            <div className="space-y-3 pt-2">
              <textarea 
                className="textarea text-xs h-20" 
                placeholder="Add approval/rejection notes..."
                value={leaveAction.reason}
                onChange={(e) => setLeaveAction({...leaveAction, reason: e.target.value})}
              />
              <div className="flex gap-2">
                <Button size="sm" variant="primary" className="flex-1" onClick={() => handleLeaveAction('sample-id', 'approve')}>Approve</Button>
                <Button size="sm" variant="outline" className="flex-1 text-red hover:bg-red-light" onClick={() => handleLeaveAction('sample-id', 'reject')}>Reject</Button>
              </div>
            </div>
          </div>
        </div>
      </Modal>
    </>
  );
};

export default GlobalModals;
