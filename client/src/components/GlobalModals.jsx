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
    leadSource: 'Direct', priority: 'Hot 🔥', managerId: '', ownerId: '', notes: '',
    documents: []
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
  const [incentiveForm, setIncentiveForm] = useState({ salaryId: '', amount: 0, note: '' });
  const [workingHours, setWorkingHours] = useState({
    normalStart: '09:30', normalEnd: '18:30',
    ramadanStart: '09:00', ramadanEnd: '17:30',
    ramadanFrom: '', ramadanTo: '',
    rules: { leaveThreshold: 30, halfDayThreshold: 70, delayedLoginHalfDay: true }
  });

  useEffect(() => {
    const handleOpenModal = (e) => {
      if (typeof e.detail === 'object' && e.detail.type === 'edit-incentive') {
        setIncentiveForm({ salaryId: e.detail.salaryId, amount: 0, note: '' });
        setActiveModal('edit-incentive');
      } else {
        setActiveModal(e.detail);
        if (['add-lead', 'create-state-manager', 'create-exec', 'allocate-lead', 'leave-approval'].includes(e.detail)) fetchUsers();
        if (e.detail === 'work-time') fetchWorkingHours();
      }
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
        leadSource: 'Direct', priority: 'Hot 🔥', managerId: '', ownerId: '', notes: '',
        documents: []
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

  const handleIncentiveSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { dashboardApi } = await import('../api/dashboardApi');
      await dashboardApi.updateSalary(incentiveForm.salaryId, { 
        incentives: incentiveForm.amount, 
        incentiveNote: incentiveForm.note 
      });
      addToast('Incentive updated successfully!', 'success');
      setActiveModal(null);
      // Trigger a refresh of the attendance/salary query
      window.dispatchEvent(new CustomEvent('refresh-attendance'));
    } catch (err) {
      addToast('Error updating incentive', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchWorkingHours = async () => {
    try {
      const { configApi } = await import('../api/configApi');
      const res = await configApi.getConfig('working-hours');
      if (res.data?.value) setWorkingHours(res.data.value);
    } catch (err) {
      addToast('Error fetching configuration', 'error');
    }
  };

  const handleWorkingHoursSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { configApi } = await import('../api/configApi');
      await configApi.saveConfig({ key: 'working-hours', value: workingHours });
      addToast('Working hours updated successfully!', 'success');
      setActiveModal(null);
    } catch (err) {
      addToast('Error saving configuration', 'error');
    } finally {
      setLoading(false);
    }
  };

  if (!activeModal) return null;

  return (
    <>
      <Modal 
        isOpen={activeModal === 'add-lead'} 
        title="Add Lead" 
        subtitle="Enter a new lead into the CRM"
        onClose={() => setActiveModal(null)}
        className="modal-lg"
      >
        <form onSubmit={handleLeadSubmit} className="space-y-10 py-2">
          {/* LEAD INFORMATION SECTION */}
          <div className="space-y-6">
            <div className="flex items-center gap-4">
              <div className="text-[11px] font-bold text-[#1f2937] uppercase tracking-[0.2em] whitespace-nowrap">Lead Information</div>
              <div className="h-[1px] w-full bg-border"></div>
            </div>
            
            <div className="grid grid-cols-2 gap-x-10 gap-y-6">
              <div className="space-y-2">
                <label className="form-label">Full Name</label>
                <input className="input" type="text" value={leadFormData.name} onChange={(e)=>setLeadFormData({...leadFormData, name: e.target.value})} placeholder="Lead name" required />
              </div>
              <div className="space-y-2">
                <label className="form-label">Company / Business</label>
                <input className="input" type="text" value={leadFormData.company} onChange={(e)=>setLeadFormData({...leadFormData, company: e.target.value})} placeholder="Company name" />
              </div>
              
              <div className="space-y-2">
                <label className="form-label">Phone Number <span className="text-red">*</span></label>
                <div className="flex gap-3">
                  <div className="relative w-32 shrink-0">
                    <select className="select pl-4" value={leadFormData.countryCode} onChange={(e)=>setLeadFormData({...leadFormData, countryCode: e.target.value})}>
                      <option value="+91">🇮🇳 +91</option>
                      <option value="+971">🇦🇪 +971</option>
                      <option value="+1">🇺🇸 +1</option>
                    </select>
                  </div>
                  <input className="input flex-1" type="tel" value={leadFormData.phone} onChange={(e)=>setLeadFormData({...leadFormData, phone: e.target.value})} placeholder="XXXXX XXXXX" required />
                </div>
              </div>
              <div className="space-y-2">
                <label className="form-label">Email</label>
                <input className="input" type="email" value={leadFormData.email} onChange={(e)=>setLeadFormData({...leadFormData, email: e.target.value})} placeholder="email@example.com" />
              </div>

              <div className="space-y-2">
                <label className="form-label">Country</label>
                <select className="select" value={leadFormData.country} onChange={(e)=>setLeadFormData({...leadFormData, country: e.target.value, district: ''})}>
                  <option value="">Select Country</option>
                  {Object.keys(districtsByCountry).map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <label className="form-label">District</label>
                <select className="select" value={leadFormData.district} onChange={(e)=>setLeadFormData({...leadFormData, district: e.target.value})}>
                  <option value="">Select District</option>
                  {(districtsByCountry[leadFormData.country] || []).map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>

              <div className="space-y-2">
                <label className="form-label">State</label>
                <select className="select" value={leadFormData.state} onChange={(e)=>setLeadFormData({...leadFormData, state: e.target.value})}>
                  <option value="">Select State</option>
                  <option>Kerala</option>
                  <option>Telangana</option>
                  <option>Maharashtra</option>
                  <option>Karnataka</option>
                  <option>Tamil Nadu</option>
                  <option>Dubai</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="form-label">Industry</label>
                <select className="select" value={leadFormData.industry} onChange={(e)=>setLeadFormData({...leadFormData, industry: e.target.value})}>
                  <option value="">Select Industry</option>
                  <option>Automobile</option>
                  <option>Electronics</option>
                  <option>Real Estate</option>
                  <option>Technology</option>
                  <option>Finance</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="form-label">Lead Source</label>
                <select className="select" value={leadFormData.leadSource} onChange={(e)=>setLeadFormData({...leadFormData, leadSource: e.target.value})}>
                  <option>Direct</option>
                  <option>Referral</option>
                  <option>Campaign</option>
                  <option>Website</option>
                  <option>Cold Call</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="form-label">Lead Priority</label>
                <select className="select" value={leadFormData.priority} onChange={(e)=>setLeadFormData({...leadFormData, priority: e.target.value})}>
                  <option>Hot 🔥</option>
                  <option>Warm</option>
                  <option>Cold</option>
                </select>
              </div>
            </div>
          </div>

          {/* ALLOCATION SECTION */}
          <div className="space-y-6">
            <div className="flex items-center gap-4">
              <div className="text-[11px] font-bold text-[#1f2937] uppercase tracking-[0.2em] whitespace-nowrap">Allocation</div>
              <div className="h-[1px] w-full bg-border"></div>
            </div>
            <div className="grid grid-cols-2 gap-x-10 gap-y-6">
              <div className="space-y-2">
                <label className="form-label">Assign to State Manager</label>
                <select className="select" value={leadFormData.managerId} onChange={(e)=>setLeadFormData({...leadFormData, managerId: e.target.value})}>
                  <option value="">Select State Manager</option>
                  {managers.map(m => <option key={m._id} value={m._id}>{m.name}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <label className="form-label">Assign to Executive</label>
                <select className="select" value={leadFormData.ownerId} onChange={(e)=>setLeadFormData({...leadFormData, ownerId: e.target.value})}>
                  <option value="">Select Executive</option>
                  {executives.map(ex => <option key={ex._id} value={ex._id}>{ex.name}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* NOTES SECTION */}
          <div className="space-y-6">
            <div className="flex items-center gap-4">
              <div className="text-[11px] font-bold text-[#1f2937] uppercase tracking-[0.2em] whitespace-nowrap">Initial Notes</div>
              <div className="h-[1px] w-full bg-border"></div>
            </div>
            <textarea className="textarea" value={leadFormData.notes} onChange={(e)=>setLeadFormData({...leadFormData, notes: e.target.value})} placeholder="Any initial notes about this lead…"></textarea>
          </div>

          {/* DOCUMENTS SECTION */}
          <div className="space-y-6">
            <div className="flex items-center gap-4">
              <div className="text-[11px] font-bold text-[#1f2937] uppercase tracking-[0.2em] whitespace-nowrap">Attach Documents (optional)</div>
              <div className="h-[1px] w-full bg-border"></div>
            </div>
             <FileUpload 
                onUpload={(file) => setLeadFormData({...leadFormData, documents: [...leadFormData.documents, file]})}
                label="Click to upload lead documents"
                subtitle="PDF, JPG, PNG up to 10MB"
             />
          </div>

          <div className="flex justify-end gap-4 pt-6 border-t border-border mt-10">
            <button type="button" className="btn btn-outline px-10" onClick={() => setActiveModal(null)}>Cancel</button>
            <button type="submit" className="btn btn-primary px-10 bg-[#0f766e] border-[#0f766e]" disabled={loading}>
              {loading ? 'Saving...' : 'Save Lead'}
            </button>
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

      {/* EDIT INCENTIVE MODAL */}
      <Modal
        isOpen={activeModal === 'edit-incentive'}
        title="Edit Incentive"
        subtitle="Adjust performance incentives and add notes"
        onClose={() => setActiveModal(null)}
      >
        <form onSubmit={handleIncentiveSubmit} className="space-y-6">
          <div className="space-y-4">
             <div className="space-y-1">
                <label className="form-label">Incentive Amount (₹)</label>
                <input 
                  type="number" 
                  className="input" 
                  placeholder="e.g. 5000" 
                  value={incentiveForm.amount}
                  onChange={e => setIncentiveForm({...incentiveForm, amount: e.target.value})}
                  required 
                />
             </div>
             <div className="space-y-1">
                <label className="form-label">Incentive Note</label>
                <textarea 
                  className="textarea" 
                  placeholder="Reason for this incentive..."
                  value={incentiveForm.note}
                  onChange={e => setIncentiveForm({...incentiveForm, note: e.target.value})}
                ></textarea>
             </div>
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-border">
            <Button variant="outline" onClick={() => setActiveModal(null)}>Cancel</Button>
            <Button variant="primary" type="submit" loading={loading} className="bg-[#0f766e]">Save Changes</Button>
          </div>
        </form>
      </Modal>

      {/* WORKING HOURS CONFIGURATION MODAL */}
      <Modal
        isOpen={activeModal === 'work-time'}
        title="Working Hours Configuration"
        subtitle="Set normal and Ramadan start times · Affects attendance auto-marking"
        onClose={() => setActiveModal(null)}
        className="modal-lg"
      >
        <form onSubmit={handleWorkingHoursSubmit} className="space-y-8 py-2">
          {/* RAMADAN HOURS SECTION */}
          <div className="space-y-6">
            <div className="flex items-center gap-4">
              <div className="text-[11px] font-bold text-[#1f2937] uppercase tracking-[0.2em] whitespace-nowrap">Ramadan Working Hours</div>
              <div className="h-[1px] w-full bg-border"></div>
            </div>
            
            <div className="grid grid-cols-2 gap-x-10 gap-y-6">
              <div className="space-y-2">
                <label className="form-label">Start Time <span className="text-red">*</span></label>
                <input 
                  className="input" 
                  type="time" 
                  value={workingHours.ramadanStart} 
                  onChange={(e) => setWorkingHours({...workingHours, ramadanStart: e.target.value})} 
                  required 
                />
              </div>
              <div className="space-y-2">
                <label className="form-label">End Time</label>
                <input 
                  className="input" 
                  type="time" 
                  value={workingHours.ramadanEnd} 
                  onChange={(e) => setWorkingHours({...workingHours, ramadanEnd: e.target.value})} 
                />
              </div>
              
              <div className="space-y-2">
                <label className="form-label">Ramadan Period From</label>
                <input 
                  className="input" 
                  type="date" 
                  value={workingHours.ramadanFrom} 
                  onChange={(e) => setWorkingHours({...workingHours, ramadanFrom: e.target.value})} 
                />
              </div>
              <div className="space-y-2">
                <label className="form-label">Ramadan Period To</label>
                <input 
                  className="input" 
                  type="date" 
                  value={workingHours.ramadanTo} 
                  onChange={(e) => setWorkingHours({...workingHours, ramadanTo: e.target.value})} 
                />
              </div>
            </div>
          </div>

          {/* AUTO-ATTENDANCE RULES SECTION */}
          <div className="space-y-6">
            <div className="flex items-center gap-4">
              <div className="text-[11px] font-bold text-[#1f2937] uppercase tracking-[0.2em] whitespace-nowrap">Auto-Attendance Rules</div>
              <div className="h-[1px] w-full bg-border"></div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-surface2/30 rounded-xl border border-border">
                <span className="text-sm font-medium text-text-primary">Work completion below <span className="font-bold text-red">30%</span> of allotted tasks → Auto-mark as <span className="font-bold">Leave</span></span>
                <input 
                  type="number" 
                  className="w-16 bg-white border border-border rounded-lg px-2 py-1.5 text-center text-sm font-bold" 
                  value={workingHours.rules.leaveThreshold}
                  onChange={(e) => setWorkingHours({...workingHours, rules: {...workingHours.rules, leaveThreshold: Number(e.target.value)}})}
                />
              </div>

              <div className="flex items-center justify-between p-4 bg-surface2/30 rounded-xl border border-border">
                <span className="text-sm font-medium text-text-primary">Work completion below <span className="font-bold text-orange">70%</span> of allotted tasks → Auto-mark as <span className="font-bold">Half Day</span></span>
                <input 
                  type="number" 
                  className="w-16 bg-white border border-border rounded-lg px-2 py-1.5 text-center text-sm font-bold" 
                  value={workingHours.rules.halfDayThreshold}
                  onChange={(e) => setWorkingHours({...workingHours, rules: {...workingHours.rules, halfDayThreshold: Number(e.target.value)}})}
                />
              </div>

              <div className="flex items-center justify-between p-4 bg-surface2/30 rounded-xl border border-border">
                <span className="text-sm font-medium text-text-primary">Delayed login → <span className="font-bold">Half day</span> (based on time frame above)</span>
                <input 
                  type="checkbox" 
                  className="w-5 h-5 rounded accent-[#0f766e]" 
                  checked={workingHours.rules.delayedLoginHalfDay}
                  onChange={(e) => setWorkingHours({...workingHours, rules: {...workingHours.rules, delayedLoginHalfDay: e.target.checked}})}
                />
              </div>
            </div>

            <div className="p-4 bg-amber-light/30 border border-amber/20 rounded-xl flex gap-3 items-start">
               <span className="text-amber">⚠️</span>
               <div className="text-xs text-amber font-medium leading-relaxed">
                 End of day: staff must mark "Today Work Completed". Uncompleted work is auto-evaluated for leave/half-day.
               </div>
            </div>
          </div>

          <div className="flex justify-end gap-4 pt-6 border-t border-border mt-10">
            <button type="button" className="btn btn-outline px-10" onClick={() => setActiveModal(null)}>Cancel</button>
            <button type="submit" className="btn btn-primary px-10 bg-[#0f766e] border-[#0f766e]" disabled={loading}>
              {loading ? 'Saving...' : 'Save Working Hours'}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
};

export default GlobalModals;
