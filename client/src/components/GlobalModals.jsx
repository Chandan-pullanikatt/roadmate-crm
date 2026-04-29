import React, { useState, useEffect, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Modal, Button, Tag, FileUpload, Avatar } from './ui';
import { useToast } from '../context/ToastContext';
import { leadsApi } from '../api/leadsApi';
import { usersApi } from '../api/usersApi';
import { leaveApi } from '../api/leaveApi';
import BulkUploadModal from './BulkUploadModal';
import ChangePasswordModal from './modals/ChangePasswordModal';
import LocationSelector from './common/LocationSelector';
import { State } from 'country-state-city';
import LeaveHistoryModal from './modals/LeaveHistoryModal';
import UpdateLeadModal from './modals/UpdateLeadModal';
import AllocateLeadModal from './modals/AllocateLeadModal';



const GlobalModals = () => {
  const queryClient = useQueryClient();
  const { addToast } = useToast();
  const [activeModal, setActiveModal] = useState(null);
  const [managers, setManagers] = useState([]);
  const [executives, setExecutives] = useState([]);
  const [loading, setLoading] = useState(false);
  const [leaveHistoryUser, setLeaveHistoryUser] = useState(null);
  const [selectedLead, setSelectedLead] = useState(null);
  
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
    role: 'industry-manager', 
    reportingTo: '', 
    name: '', 
    email: '',
    phone: '',
    state: '', 
    industry: '', 
    dateOfJoining: '', 
    basicSalary: '',
    aadhaarNumber: '', 
    panNumber: '', 
    documents: []
  });

  const [pendingLeaves, setPendingLeaves] = useState([]);
  const [leaveAction, setLeaveAction] = useState({ id: '', reason: '' });
  const [incentiveForm, setIncentiveForm] = useState({ salaryId: '', amount: 0, note: '' });
  const [workingHours, setWorkingHours] = useState({
    normalStart: '09:30', normalEnd: '18:30',
    ramadanStart: '09:00', ramadanEnd: '17:30',
    ramadanFrom: '', ramadanTo: '',
    rules: { leaveThreshold: 30, halfDayThreshold: 70, delayedLoginHalfDay: true }
  });

  const [leaveFormData, setLeaveFormData] = useState({
    leaveType: 'sick', fromDate: '', toDate: '', reason: ''
  });
  const [selectedLeadIds, setSelectedLeadIds] = useState([]);
  const [targetExecutiveId, setTargetExecutiveId] = useState('');
  const [bulkAllocateStep, setBulkAllocateStep] = useState(1);
  const [unassignedLeads, setUnassignedLeads] = useState([]);

  const handleLeaveSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await leaveApi.createLeave({
        type: leaveFormData.leaveType,
        fromDate: leaveFormData.fromDate,
        toDate: leaveFormData.toDate,
        reason: leaveFormData.reason
      });
      addToast('Leave application submitted!', 'success');
      setActiveModal(null);
      setLeaveFormData({ leaveType: 'sick', fromDate: '', toDate: '', reason: '' });
      queryClient.invalidateQueries({ queryKey: ['leaves'] });
      window.dispatchEvent(new CustomEvent('refresh-matrix'));
    } catch (err) {
      addToast(err.response?.data?.message || 'Error submitting leave', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleCloseModal = useCallback(() => {
    setActiveModal(null);
  }, []);

  const handleOpenModal = useCallback((e) => {
    console.log('Open modal event received:', e.detail);
    
    if (typeof e.detail === 'object') {
      if (e.detail.type === 'edit-incentive') {
        setIncentiveForm({ salaryId: e.detail.salaryId, amount: 0, note: '' });
        setActiveModal('edit-incentive');
      } else if (e.detail.type === 'create-exec') {
        if (e.detail.editData) {
          setExecFormData({
            ...e.detail.editData,
            dateOfJoining: e.detail.editData.dateOfJoining ? new Date(e.detail.editData.dateOfJoining).toISOString().split('T')[0] : '',
            role: e.detail.editData.role === 'industry_manager' ? 'industry-manager' : e.detail.editData.role
          });
        } else {
          setExecFormData(prev => ({ 
            ...prev, 
            _id: undefined,
            role: e.detail.role || 'industry-manager',
            name: '', email: '', phone: '', state: '', industry: '', 
            dateOfJoining: '', basicSalary: '', aadhaarNumber: '', panNumber: '', documents: []
          }));
        }
        setActiveModal('create-exec');
        fetchUsers();
      } else if (e.detail.type === 'create-state-manager') {
        if (e.detail.editData) {
          setManagerFormData({
            ...e.detail.editData,
            doj: e.detail.editData.dateOfJoining ? new Date(e.detail.editData.dateOfJoining).toISOString().split('T')[0] : '',
            aadhaar: e.detail.editData.aadhaarNumber,
            pan: e.detail.editData.panNumber,
            documents: e.detail.editData.documents || []
          });
        } else {
          setManagerFormData({
            name: '', email: '', phone: '', state: '', employmentType: 'Full Time',
            doj: '', basicSalary: '', normalStart: '09:30', ramadanStart: '09:00',
            aadhaar: '', pan: '', documents: []
          });
        }
        setActiveModal('create-state-manager');
        fetchUsers();
      } else if (e.detail.type === 'leave-history') {
        setLeaveHistoryUser(e.detail.user);
        setActiveModal('leave-history');
      } else if (e.detail.type === 'update-lead') {
        setSelectedLead(e.detail.leadData);
        setActiveModal('update-lead');
      } else if (e.detail.type === 'allocate-lead') {
        if (e.detail.leadData) {
          setSelectedLead(e.detail.leadData);
          setActiveModal('allocate-single-lead');
        } else {
          setSelectedLead(null);
          setActiveModal('allocate-lead');
          fetchUsers();
        }
      } else if (e.detail.type === 'leave-approval') {

        setLeaveAction({ id: e.detail.id, reason: '' });
        setActiveModal('leave-approval');
        fetchPendingLeaves();
      } else if (e.detail.type === 'bulk-allocate') {
        setSelectedLeadIds([]);
        setTargetExecutiveId('');
        setBulkAllocateStep(1);
        setActiveModal('bulk-allocate');
        fetchUnassignedLeads();
        fetchUsers();
      } else {
        setActiveModal(e.detail.type);
      }
    } else {
      // Handle string aliases
      let type = e.detail;
      if (type === 'create-industry-manager') {
        setExecFormData(prev => ({ ...prev, role: 'industry-manager' }));
        type = 'create-exec';
      } else if (type === 'create-executive') {
        setExecFormData(prev => ({ ...prev, role: 'executive' }));
        type = 'create-exec';
      } else if (type === 'create-exec') {
        // Keep default role from state
        setExecFormData(prev => ({ ...prev, role: 'executive' }));
      }

      setActiveModal(type);
      
      // Data fetching
      if (['add-lead', 'create-state-manager', 'create-exec', 'allocate-lead', 'leave-approval', 'apply-leave'].includes(type)) fetchUsers();
      if (type === 'leave-approval') fetchPendingLeaves();
      if (type === 'work-time') fetchWorkingHours();
    }
  }, []);

  useEffect(() => {
    window.addEventListener('open-modal', handleOpenModal);
    return () => window.removeEventListener('open-modal', handleOpenModal);
  }, [handleOpenModal]);

  const [industryManagers, setIndustryManagers] = useState([]);

  const fetchUsers = async () => {
    try {
      const res = await usersApi.getUsers();
      const allUsers = res.data || [];
      setManagers(allUsers.filter(u => u.role === 'state_manager'));
      setIndustryManagers(allUsers.filter(u => u.role === 'industry_manager'));
      setExecutives(allUsers.filter(u => u.role === 'executive'));
    } catch (err) {
      addToast('Error fetching users', 'error');
    }
  };

  const fetchPendingLeaves = async () => {
    try {
      const res = await leaveApi.getLeaves();
      setPendingLeaves((res.data || []).filter((leave) => leave.status === 'pending'));
    } catch (err) {
      addToast('Error fetching leave requests', 'error');
    }
  };

  const fetchUnassignedLeads = async () => {
    setLoading(true);
    try {
      const res = await leadsApi.getLeads({ owner: 'unassigned', limit: 100 });
      setUnassignedLeads(res.data.leads || []);
    } catch (err) {
      addToast('Error fetching unassigned leads', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleBulkAllocate = async () => {
    if (!targetExecutiveId) return addToast('Please select an executive', 'warning');
    setLoading(true);
    try {
      await leadsApi.bulkAllocate({
        leadIds: selectedLeadIds,
        assignedTo: targetExecutiveId
      });
      addToast(`${selectedLeadIds.length} leads allocated successfully!`, 'success');
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      setActiveModal(null);
      setSelectedLeadIds([]);
      setTargetExecutiveId('');
      setBulkAllocateStep(1);
    } catch (err) {
      addToast(err.response?.data?.message || 'Error in bulk allocation', 'error');
    } finally {
      setLoading(false);
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
      if (managerFormData._id) {
        await usersApi.updateUser(managerFormData._id, managerFormData);
        addToast('State Manager updated successfully!', 'success');
      } else {
        await usersApi.createStateManager(managerFormData);
        addToast('State Manager created successfully!', 'success');
      }
      setActiveModal(null);
      window.dispatchEvent(new CustomEvent('refresh-users'));
    } catch (err) {
      addToast(err.response?.data?.message || 'Error saving manager', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleExecSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const isEdit = !!execFormData._id;
      if (isEdit) {
        await usersApi.updateUser(execFormData._id, execFormData);
        addToast('Account updated successfully!', 'success');
      } else {
        if (execFormData.role === 'industry-manager') {
          await usersApi.createIndustryManager(execFormData);
        } else {
          await usersApi.createExecutive(execFormData);
        }
        addToast('Account created successfully!', 'success');
      }
      setActiveModal(null);
      setExecFormData({
        role: 'industry-manager', 
        reportingTo: '', 
        name: '', 
        email: '',
        phone: '',
        state: '', 
        industry: '', 
        dateOfJoining: '', 
        basicSalary: '',
        aadhaarNumber: '', 
        panNumber: '', 
        documents: []
      });
      window.dispatchEvent(new CustomEvent('refresh-users'));
      window.dispatchEvent(new CustomEvent('refresh-matrix')); // For attendance/overview
    } catch (err) {
      addToast(err.response?.data?.message || 'Error saving account', 'error');
    } finally {
      setLoading(false);
    }
  };


  const handleLeaveAction = async (id, status) => {
    try {
      if (status === 'approve') await leaveApi.approveLeave(id);
      else await leaveApi.rejectLeave(id, { approvalNote: leaveAction.reason });
      addToast(`Leave ${status}d successfully!`, 'success');
      setLeaveAction({ id: '', reason: '' });
      queryClient.invalidateQueries({ queryKey: ['leaves'] });
      await fetchPendingLeaves();
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
        onClose={handleCloseModal}
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

              <div className="col-span-2">
                <LocationSelector 
                  value={{ 
                    country: leadFormData.country, 
                    state: leadFormData.state, 
                    district: leadFormData.district 
                  }}
                  onChange={(loc) => setLeadFormData({ 
                    ...leadFormData, 
                    country: loc.country, 
                    state: loc.state, 
                    district: loc.district 
                  })}
                  required
                />
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
                folder="lead-documents"
                entityId={leadFormData.ownerId || 'unallocated'}
                onUploadComplete={(file) => setLeadFormData({...leadFormData, documents: [...leadFormData.documents, file]})}
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
      <BulkUploadModal 
        isOpen={activeModal === 'bulk-upload'}
        onClose={handleCloseModal}
      />

      {/* CREATE STATE MANAGER MODAL */}
      <Modal 
        isOpen={activeModal === 'create-state-manager'} 
        title={managerFormData._id ? "Edit State Manager" : "Create State Manager"} 
        subtitle={managerFormData._id ? "Update regional head profile information" : "Add a new state regional manager"}
        onClose={handleCloseModal}
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

            <div className="space-y-1">
              <label className="form-label">Email</label>
              <input className="input" type="email" value={managerFormData.email} onChange={(e)=>setManagerFormData({...managerFormData, email: e.target.value})} placeholder="manager@company.com" required />
            </div>

            <div className="pt-2">
              <LocationSelector 
                value={{ 
                  country: managerFormData.country || 'India', 
                  state: managerFormData.state, 
                  district: managerFormData.district 
                }}
                onChange={(loc) => setManagerFormData({ 
                  ...managerFormData, 
                  country: loc.country, 
                  state: loc.state, 
                  district: loc.district 
                })}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="form-label">Date of Joining</label>
                <input className="input" type="date" value={managerFormData.doj} onChange={(e)=>setManagerFormData({...managerFormData, doj: e.target.value})} required />
              </div>
              <div className="space-y-1">
                <label className="form-label">Basic Salary ({"\u20B9"})</label>
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
              folder="staff-documents"
              entityId={managerFormData.email || managerFormData.phone || 'state-manager'}
              onUploadComplete={(file) => setManagerFormData({...managerFormData, documents: [...managerFormData.documents, file]})}
              label="Upload Identity & Agreement"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button variant="outline" onClick={() => setActiveModal(null)}>Cancel</Button>
            <Button variant="primary" type="submit" loading={loading}>
              {managerFormData._id ? "Save Changes" : "Create Manager"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* BULK ALLOCATE LEAD MODAL */}
      <Modal 
        isOpen={activeModal === 'bulk-allocate'} 
        title="Bulk Allocate Leads" 
        subtitle={bulkAllocateStep === 1 ? "Select leads to allocate" : "Select target executive"}
        onClose={handleCloseModal}
        className="modal-lg"
      >
        <div className="space-y-6">
          {bulkAllocateStep === 1 ? (
            <>
              <div className="p-4 bg-amber-light/30 border border-amber/20 rounded-2xl flex gap-3 items-start">
                <span className="text-amber text-lg">⚠️</span>
                <div className="text-xs text-text-secondary leading-relaxed">
                  <span className="font-bold text-amber">{unassignedLeads.length} leads</span> are currently unallocated. 
                  Select the leads you want to assign to an executive.
                </div>
              </div>

              <div className="border border-border rounded-2xl overflow-hidden bg-surface2/30">
                <div className="p-3 border-b border-border bg-surface flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <input 
                      type="checkbox" 
                      className="w-4 h-4 rounded accent-[#0f766e]" 
                      checked={unassignedLeads.length > 0 && selectedLeadIds.length === unassignedLeads.length}
                      onChange={(e) => {
                        if (e.target.checked) setSelectedLeadIds(unassignedLeads.map(l => l._id));
                        else setSelectedLeadIds([]);
                      }}
                    />
                    <span className="text-xs font-bold uppercase tracking-wider">Select All Unallocated</span>
                  </div>
                  <span className="text-[10px] font-bold text-text-muted">{selectedLeadIds.length} Selected</span>
                </div>
                <div className="max-h-80 overflow-y-auto divide-y divide-border/50">
                  {unassignedLeads.map(lead => (
                    <div 
                      key={lead._id} 
                      className={`p-3 flex items-center gap-3 transition-colors cursor-pointer hover:bg-white ${selectedLeadIds.includes(lead._id) ? 'bg-white' : ''}`}
                      onClick={() => {
                        if (selectedLeadIds.includes(lead._id)) setSelectedLeadIds(selectedLeadIds.filter(id => id !== lead._id));
                        else setSelectedLeadIds([...selectedLeadIds, lead._id]);
                      }}
                    >
                      <input 
                        type="checkbox" 
                        className="w-4 h-4 rounded accent-[#0f766e]" 
                        checked={selectedLeadIds.includes(lead._id)}
                        onChange={() => {}} // Handled by div onClick
                      />
                      <div className="flex-1">
                        <div className="text-sm font-bold text-text-primary">{lead.company || lead.name}</div>
                        <div className="text-[10px] text-text-muted">{lead.name} · {lead.industry} · {lead.state}</div>
                      </div>
                    </div>
                  ))}
                  {unassignedLeads.length === 0 && (
                    <div className="p-8 text-center text-text-muted italic">No unallocated leads found.</div>
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-border mt-6">
                <Button variant="outline" onClick={() => setActiveModal(null)}>Cancel</Button>
                <Button 
                  variant="primary" 
                  disabled={selectedLeadIds.length === 0} 
                  onClick={() => setBulkAllocateStep(2)}
                  className="bg-[#0f766e]"
                >
                  Next: Select Executive →
                </Button>
              </div>
            </>
          ) : (
            <>
              <div className="p-4 bg-blue/5 border border-blue/10 rounded-2xl">
                <div className="text-[11px] font-bold text-blue uppercase tracking-widest mb-1">Allocation Summary</div>
                <div className="text-sm font-medium">Allocating <span className="font-bold text-blue">{selectedLeadIds.length}</span> selected leads.</div>
              </div>

              <div className="space-y-2">
                <label className="form-label">Assign To Executive</label>
                <select 
                  className="select" 
                  value={targetExecutiveId} 
                  onChange={(e) => setTargetExecutiveId(e.target.value)}
                >
                  <option value="">Select Staff</option>
                  <optgroup label="Executives">
                    {executives.map(e => <option key={e._id} value={e._id}>{e.name} ({e.state})</option>)}
                  </optgroup>
                  <optgroup label="Industry Managers">
                    {industryManagers.map(m => <option key={m._id} value={m._id}>{m.name} ({m.industry})</option>)}
                  </optgroup>
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-border mt-6">
                <Button variant="outline" onClick={() => setBulkAllocateStep(1)}>← Back to Selection</Button>
                <Button 
                  variant="primary" 
                  loading={loading} 
                  disabled={!targetExecutiveId} 
                  onClick={handleBulkAllocate}
                  className="bg-[#0f766e]"
                >
                  Confirm & Allocate
                </Button>
              </div>
            </>
          )}
        </div>
      </Modal>

      {/* CREATE EXECUTIVE MODAL */}
      <Modal 
        isOpen={activeModal === 'create-exec'} 
        title={execFormData._id ? "Edit Account" : "Create Executive / Industry Manager"} 
        subtitle={execFormData._id ? "Update staff account information" : "Add new staff account with role assignment"}
        onClose={handleCloseModal}
        className="modal-lg"
      >

        <form onSubmit={handleExecSubmit} className="space-y-8 py-2">
          <div className="grid grid-cols-2 gap-x-10 gap-y-6">
            {/* Role */}
            <div className="space-y-2">
              <label className="form-label">Role <span className="text-red">*</span></label>
              <select className="select" value={execFormData.role} onChange={(e) => setExecFormData({...execFormData, role: e.target.value})} required>
                <option value="industry-manager">Industry State Manager</option>
                <option value="executive">District Executive</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="form-label">Reports To</label>
              <select className="select" value={execFormData.reportingTo} onChange={(e) => setExecFormData({...execFormData, reportingTo: e.target.value})}>
                <option value="">Select Manager</option>
                <optgroup label="State Managers">
                  {managers.map(m => <option key={m._id} value={m._id}>{m.name} ({m.state})</option>)}
                </optgroup>
                <optgroup label="Industry Managers">
                  {industryManagers.map(m => <option key={m._id} value={m._id}>{m.name} ({m.industry} · {m.state})</option>)}
                </optgroup>
              </select>
            </div>

            {/* Full Name */}
            <div className="space-y-2">
              <label className="form-label">Full Name <span className="text-red">*</span></label>
              <input className="input" type="text" placeholder="Full name" value={execFormData.name} onChange={(e) => setExecFormData({...execFormData, name: e.target.value})} required />
            </div>

            {/* Phone */}
            <div className="space-y-2">
              <label className="form-label">Phone <span className="text-red">*</span></label>
              <input className="input" type="tel" placeholder="+91 XXXXX XXXXX" value={execFormData.phone} onChange={(e) => setExecFormData({...execFormData, phone: e.target.value})} required />
            </div>

            {/* Email */}
            <div className="space-y-2">
              <label className="form-label">Email <span className="text-red">*</span></label>
              <input className="input" type="email" placeholder="email@company.com" value={execFormData.email} onChange={(e) => setExecFormData({...execFormData, email: e.target.value})} required />
            </div>

            {/* State */}
            <div className="space-y-2">
              <label className="form-label">State <span className="text-red">*</span></label>
              <select className="select" value={execFormData.state} onChange={(e) => setExecFormData({...execFormData, state: e.target.value})} required>
                <option value="">Select State</option>
                {State.getStatesOfCountry('IN').map(s => (
                  <option key={s.isoCode} value={s.name}>{s.name}</option>
                ))}
              </select>
            </div>

            {/* Industry */}
            <div className="space-y-2">
              <label className="form-label">Industry <span className="text-red">*</span></label>
              <select className="select" value={execFormData.industry} onChange={(e) => setExecFormData({...execFormData, industry: e.target.value})} required>
                <option value="">Select Industry</option>
                <option>Automobile</option>
                <option>Electronics</option>
                <option>Real Estate</option>
                <option>Technology</option>
                <option>Finance</option>
                <option>Other</option>
              </select>
            </div>

            {/* Date of Joining */}
            <div className="space-y-2">
              <label className="form-label">Date of Joining</label>
              <input className="input" type="date" value={execFormData.dateOfJoining} onChange={(e) => setExecFormData({...execFormData, dateOfJoining: e.target.value})} />
            </div>

            {/* Basic Salary */}
            <div className="space-y-2">
              <label className="form-label">Basic Salary (₹/month)</label>
              <input className="input" type="number" placeholder="e.g. 22000" value={execFormData.basicSalary} onChange={(e) => setExecFormData({...execFormData, basicSalary: e.target.value})} />
            </div>

            {/* Aadhaar Number */}
            <div className="space-y-2">
              <label className="form-label">Aadhaar Number <span className="text-red">*</span></label>
              <input className="input" type="text" placeholder="XXXX XXXX XXXX" value={execFormData.aadhaarNumber} onChange={(e) => setExecFormData({...execFormData, aadhaarNumber: e.target.value})} required />
            </div>

            {/* PAN Number */}
            <div className="space-y-2">
              <label className="form-label">PAN Number <span className="text-red">*</span></label>
              <input className="input uppercase" type="text" placeholder="ABCDE1234F" value={execFormData.panNumber} onChange={(e) => setExecFormData({...execFormData, panNumber: e.target.value})} required />
            </div>

            {/* Document Uploads */}
            <div className="col-span-2 grid grid-cols-2 gap-6">
              <FileUpload 
                folder="staff-docs"
                entityId={execFormData.email || 'exec-aadhaar'}
                onUploadComplete={(file) => setExecFormData(prev => ({...prev, documents: [...prev.documents, {...file, name: 'Aadhaar Card'}]}))}
                label="Upload Aadhaar"
              />
              <FileUpload 
                folder="staff-docs"
                entityId={execFormData.email || 'exec-pan'}
                onUploadComplete={(file) => setExecFormData(prev => ({...prev, documents: [...prev.documents, {...file, name: 'PAN Card'}]}))}
                label="Upload PAN Card"
              />
            </div>
          </div>

          <div className="flex justify-end gap-4 pt-6 border-t border-border mt-10">
            <Button variant="outline" className="px-10" onClick={() => setActiveModal(null)}>Cancel</Button>
            <Button type="submit" className="px-10 bg-[#0f766e] border-[#0f766e]" loading={loading}>
              {execFormData._id ? "Save Changes" : "Create Account"}
            </Button>
          </div>

        </form>
      </Modal>

      {/* LEAVE APPROVAL MODAL */}
      <Modal 
        isOpen={activeModal === 'leave-approval-legacy'} 
        title="Leave Approvals" 
        onClose={handleCloseModal}
      >
        <div className="space-y-4">
          <div className="text-xs font-bold text-accent uppercase tracking-widest mb-2">Pending Requests</div>
          
          {/* Legacy leave request preview retained only for layout reference */}
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
                <Button size="sm" variant="primary" className="flex-1" onClick={() => handleLeaveAction(leaveAction.id || '', 'approve')}>Approve</Button>
                <Button size="sm" variant="outline" className="flex-1 text-red hover:bg-red-light" onClick={() => handleLeaveAction(leaveAction.id || '', 'reject')}>Reject</Button>
              </div>
            </div>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={activeModal === 'leave-approval'}
        title="Leave Approvals"
        onClose={handleCloseModal}
      >
        <div className="space-y-4">
          <div className="text-xs font-bold text-accent uppercase tracking-widest mb-2">Pending Requests</div>
          {pendingLeaves.length === 0 ? (
            <div className="p-5 rounded-2xl bg-surface2/30 border border-border text-sm text-text-muted text-center">
              No pending leave requests right now.
            </div>
          ) : (
            pendingLeaves.map((leave) => (
              <div key={leave._id} className="p-5 rounded-2xl bg-surface2/30 border border-border space-y-4">
                <div className="flex items-center gap-3">
                  <Avatar name={leave.user?.name || 'Staff'} />
                  <div className="flex-1">
                    <div className="text-sm font-bold text-text-primary">{leave.user?.name}</div>
                    <div className="text-[10px] text-text-muted">
                      {[leave.user?.role?.replace(/_/g, ' '), leave.user?.state, leave.user?.industry].filter(Boolean).join(' · ')}
                    </div>
                  </div>
                  <Tag variant="amber">Pending</Tag>
                </div>

                <div className="grid grid-cols-2 gap-y-2 text-xs">
                  <div className="text-text-muted">Type: <span className="text-text-primary font-bold">{leave.type.replace(/_/g, ' ')}</span></div>
                  <div className="text-text-muted">Duration: <span className="text-text-primary font-bold">{leave.days} day{leave.days > 1 ? 's' : ''}</span></div>
                  <div className="text-text-muted">From: <span className="text-text-primary font-bold">{new Date(leave.fromDate).toLocaleDateString()}</span></div>
                  <div className="text-text-muted">To: <span className="text-text-primary font-bold">{new Date(leave.toDate).toLocaleDateString()}</span></div>
                </div>

                <div className="text-xs bg-white/50 p-3 rounded-xl border border-border/50 text-text-secondary leading-relaxed italic">
                  "{leave.reason}"
                </div>

                <div className="space-y-3 pt-2">
                  <textarea
                    className="textarea text-xs h-20"
                    placeholder="Add approval/rejection notes..."
                    value={leaveAction.id === leave._id ? leaveAction.reason : ''}
                    onChange={(e) => setLeaveAction({ id: leave._id, reason: e.target.value })}
                  />
                  <div className="flex gap-2">
                    <Button size="sm" variant="primary" className="flex-1" onClick={() => handleLeaveAction(leave._id, 'approve')}>Approve</Button>
                    <Button size="sm" variant="outline" className="flex-1 text-red hover:bg-red-light" onClick={() => handleLeaveAction(leave._id, 'reject')}>Reject</Button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </Modal>

      {/* EDIT INCENTIVE MODAL */}
      <Modal
        isOpen={activeModal === 'edit-incentive'}
        title="Edit Incentive"
        subtitle="Adjust performance incentives and add notes"
        onClose={handleCloseModal}
      >
        <form onSubmit={handleIncentiveSubmit} className="space-y-6">
          <div className="space-y-4">
             <div className="space-y-1">
                <label className="form-label">Incentive Amount ({"\u20B9"})</label>
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
        onClose={handleCloseModal}
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
      {/* APPLY LEAVE MODAL */}
      <Modal 
        isOpen={activeModal === 'apply-leave'} 
        title="Apply For Leave" 
        subtitle="Submit a leave request for manager approval"
        onClose={handleCloseModal}
      >
        <form onSubmit={handleLeaveSubmit} className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="form-label">Leave Type</label>
              <select 
                className="select" 
                value={leaveFormData.leaveType}
                onChange={(e) => setLeaveFormData({...leaveFormData, leaveType: e.target.value})}
                required
              >
                <option value="sick">Sick Leave</option>
                <option value="paid">Paid Leave</option>
                <option value="unpaid">Unpaid Leave</option>
                <option value="optional_holiday">Optional Holiday</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="form-label">Duration</label>
              <div className="flex items-center h-10 px-3 bg-surface2 rounded-lg border border-border text-xs font-bold text-muted">
                {leaveFormData.fromDate && leaveFormData.toDate ? 
                  `${Math.ceil((new Date(leaveFormData.toDate) - new Date(leaveFormData.fromDate)) / (1000 * 60 * 60 * 24)) + 1} Days` : 
                  'Select dates'
                }
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="form-label">From Date</label>
              <input 
                type="date" 
                className="input" 
                value={leaveFormData.fromDate}
                onChange={(e) => setLeaveFormData({...leaveFormData, fromDate: e.target.value})}
                required 
              />
            </div>
            <div className="space-y-1">
              <label className="form-label">To Date</label>
              <input 
                type="date" 
                className="input" 
                value={leaveFormData.toDate}
                onChange={(e) => setLeaveFormData({...leaveFormData, toDate: e.target.value})}
                required 
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="form-label">Reason</label>
            <textarea 
              className="textarea h-24" 
              placeholder="Provide a brief reason for your leave..."
              value={leaveFormData.reason}
              onChange={(e) => setLeaveFormData({...leaveFormData, reason: e.target.value})}
              required
            ></textarea>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-border">
            <Button variant="outline" onClick={() => setActiveModal(null)}>Cancel</Button>
            <Button variant="primary" type="submit" loading={loading} className="bg-orange border-orange">Submit Request</Button>
          </div>
        </form>
      </Modal>
      {/* LEAVE POLICY MODAL */}
      <Modal 
        isOpen={activeModal === 'leave-policy'} 
        title="Leave Policy · RoadMate CRM" 
        subtitle="Standard corporate policies for staff and management"
        onClose={handleCloseModal}
        className="modal-lg"
      >
        <div className="space-y-8 py-2">
          <div className="grid grid-cols-2 gap-8">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-blue/10 flex items-center justify-center text-blue text-sm">01</div>
                <div className="text-[13px] font-bold text-text-primary uppercase tracking-wider">Casual Leave (CL)</div>
              </div>
              <p className="text-xs text-text-muted leading-relaxed pl-11">
                12 days per calendar year. Maximum 2 days at a time. Requests must be submitted at least 48 hours in advance for approval.
              </p>
            </div>
            
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-purple/10 flex items-center justify-center text-purple text-sm">02</div>
                <div className="text-[13px] font-bold text-text-primary uppercase tracking-wider">Sick Leave (SL)</div>
              </div>
              <p className="text-xs text-text-muted leading-relaxed pl-11">
                8 days per calendar year. Medical certificate mandatory for any sick leave exceeding 2 consecutive days.
              </p>
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-amber/10 flex items-center justify-center text-amber text-sm">03</div>
                <div className="text-[13px] font-bold text-text-primary uppercase tracking-wider">Optional Holidays</div>
              </div>
              <p className="text-xs text-text-muted leading-relaxed pl-11">
                2 days per year from the approved list of religious/regional optional holidays. Subject to manager approval.
              </p>
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-red/10 flex items-center justify-center text-red text-sm">04</div>
                <div className="text-[13px] font-bold text-text-primary uppercase tracking-wider">Loss of Pay (LOP)</div>
              </div>
              <p className="text-xs text-text-muted leading-relaxed pl-11">
                Unapproved absence or leave exceeding the annual limit will result in pro-rata salary deduction.
              </p>
            </div>
          </div>

          <div className="p-5 bg-surface2/50 border border-border rounded-2xl">
             <div className="flex items-start gap-4">
                <div className="text-xl">💡</div>
                <div className="space-y-2">
                  <div className="text-sm font-bold text-text-primary">Approval Hierarchy</div>
                  <ul className="space-y-1.5 text-xs text-text-muted">
                    <li className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue"></span>
                      <span className="font-bold text-text-secondary">Executives</span> leaves are approved by Industry Managers.
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-purple"></span>
                      <span className="font-bold text-text-secondary">Industry Managers</span> leaves are approved by State Managers.
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-orange"></span>
                      <span className="font-bold text-text-secondary">State Managers</span> leaves are approved directly by the Founder.
                    </li>
                  </ul>
                </div>
             </div>
          </div>

          <div className="flex justify-end pt-4">
            <Button variant="primary" onClick={handleCloseModal} className="px-8">I Understand</Button>
          </div>
        </div>
      </Modal>
      <ChangePasswordModal 
        isOpen={activeModal === 'change-password'} 
        onClose={handleCloseModal} 
      />
      <LeaveHistoryModal 
        isOpen={activeModal === 'leave-history'} 
        onClose={handleCloseModal} 
        user={leaveHistoryUser}
      />
      <UpdateLeadModal 
        isOpen={activeModal === 'update-lead'} 
        onClose={handleCloseModal} 
        lead={selectedLead}
      />
      <AllocateLeadModal 
        isOpen={activeModal === 'allocate-single-lead'} 
        onClose={handleCloseModal} 
        lead={selectedLead}
      />
    </>
  );
};

export default GlobalModals;
