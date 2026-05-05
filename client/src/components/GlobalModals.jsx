import React, { useState, useEffect, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Modal, Button, Tag, FileUpload, Avatar } from './ui';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
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
import LeadHistoryModal from './modals/LeadHistoryModal';



const GlobalModals = () => {
  const queryClient = useQueryClient();
  const { addToast } = useToast();
  const { user: currentUser } = useAuth();
  const isExecutive = currentUser?.role === 'executive';
  const isStateManager = currentUser?.role === 'state_manager';
  const isIndustryManager = currentUser?.role === 'industry_manager';
  const [activeModal, setActiveModal] = useState(null);
  const [leadHistoryData, setLeadHistoryData] = useState({ leadId: null, leadName: '' });
  const [managers, setManagers] = useState([]);
  const [industryManagers, setIndustryManagers] = useState([]);
  const [founders, setFounders] = useState([]);
  const [executives, setExecutives] = useState([]);
  const [loading, setLoading] = useState(false);
  const [leaveHistoryUser, setLeaveHistoryUser] = useState(null);
  const [selectedLead, setSelectedLead] = useState(null);
  
  const getLeadFormDefaults = () => ({
    name: '', company: '', countryCode: '+91', phone: '', email: '',
    country: isStateManager || isIndustryManager ? 'India' : '',
    district: '',
    state: isStateManager ? (currentUser?.state || '') : '',
    // Fix: Region Type Filtering — added regionType field
    regionType: '',
    region: '',
    industry: isIndustryManager ? (currentUser?.industry || '') : '',
    leadSource: 'Direct', priority: 'Hot 🔥', managerId: '', ownerId: '', notes: '',
    revenueCategory: 'other',
    meetingAt: '',
    meetingType: 'direct',
    documents: []
  });

  const [leadFormData, setLeadFormData] = useState(getLeadFormDefaults);

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

  const [viewDocsUser, setViewDocsUser] = useState(null);
  const [pendingLeaves, setPendingLeaves] = useState([]);
  const [leaveAction, setLeaveAction] = useState({ id: '', reason: '' });
  const [incentiveForm, setIncentiveForm] = useState({ salaryId: '', amount: 0, note: '' });
  const [workingHours, setWorkingHours] = useState({
    normalStart: '09:30', normalEnd: '18:30',
    ramadanStart: '09:00', ramadanEnd: '17:30',
    ramadanFrom: '', ramadanTo: '',
    rules: { leaveThreshold: 30, halfDayThreshold: 70, delayedLoginHalfDay: true, earlyExitThresholdMinutes: 120 }
  });

  const [leaveFormData, setLeaveFormData] = useState({
    leaveType: 'sick', fromDate: '', toDate: '', reason: ''
  });
  const [selectedLeadIds, setSelectedLeadIds] = useState([]);
  const [targetExecutiveId, setTargetExecutiveId] = useState('');
  const [bulkAllocateStep, setBulkAllocateStep] = useState(1);
  const [unassignedLeads, setUnassignedLeads] = useState([]);
  const [escalateData, setEscalateData] = useState({ lead: null, reason: '', managerId: '' });
  const [targetState, setTargetState] = useState({
    userId: '',
    name: '',
    month: new Date().getMonth() + 1,
    year: new Date().getFullYear(),
    calls: 0,
    leads: 0,
    conversions: 0,
    revenue: 0
  });
  const [myLeads, setMyLeads] = useState([]);
  const [scheduleFormData, setScheduleFormData] = useState({
    leadId: '',
    meetingAt: '',
    meetingType: 'direct',
    notes: ''
  });

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

  const fetchMyLeads = async () => {
    try {
      const res = await leadsApi.getLeads({ limit: 100 });
      setMyLeads(res.data.leads || []);
    } catch (err) {
      addToast('Error fetching leads', 'error');
    }
  };

  const fetchUsers = async () => {
    try {
      const [usersRes, hierarchyRes] = await Promise.all([
        usersApi.getUsers(),
        usersApi.getHierarchy()
      ]);
      
      const allUsers = usersRes.data || [];
      setManagers(allUsers.filter(u => u.role === 'state_manager'));
      setIndustryManagers(allUsers.filter(u => u.role === 'industry_manager'));
      setFounders(allUsers.filter(u => u.role === 'founder'));
      setExecutives(allUsers.filter(u => u.role === 'executive'));
      setHierarchy(hierarchyRes.data || { stateManagers: [], industryManagers: [], executives: [] });
    } catch (err) {
      addToast('Error fetching users', 'error');
    }
  };

  const fetchPendingLeaves = async () => {
    try {
      const res = await leaveApi.getPendingLeaves();
      setPendingLeaves((res.data || []).filter((leave) =>
        leave.user?._id !== currentUser?._id
      ));
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

  const fetchWorkingHours = async () => {
    try {
      const { configApi } = await import('../api/configApi');
      const res = await configApi.getConfig('working-hours');
      if (res.data?.value) setWorkingHours(res.data.value);
    } catch (err) {
      addToast('Error fetching configuration', 'error');
    }
  };

  const handleOpenModal = useCallback((e) => {
    console.log('Open modal event received:', e.detail);
    
    let targetType = '';

    if (typeof e.detail === 'object') {
      targetType = e.detail.type;
      const data = e.detail;

      if (targetType === 'edit-incentive') {
        setIncentiveForm({ salaryId: data.salaryId, amount: 0, note: '' });
      } else if (targetType === 'create-exec') {
        if (data.editData) {
          setExecFormData({
            ...data.editData,
            dateOfJoining: data.editData.dateOfJoining ? new Date(data.editData.dateOfJoining).toISOString().split('T')[0] : '',
            role: data.editData.role === 'industry_manager' ? 'industry-manager' : data.editData.role
          });
        } else {
          const prefill = data.prefill || {};
          setExecFormData(prev => ({ 
            ...prev, 
            _id: undefined,
            role: prefill.role || data.role || 'industry-manager',
            name: '', email: '', phone: '', 
            state: prefill.state || '', 
            industry: prefill.industry || '', 
            reportingTo: prefill.reportingTo || '',
            dateOfJoining: '', basicSalary: '', aadhaarNumber: '', panNumber: '', documents: []
          }));
        }
      } else if (targetType === 'create-state-manager') {
        if (data.editData) {
          setManagerFormData({
            ...data.editData,
            doj: data.editData.dateOfJoining ? new Date(data.editData.dateOfJoining).toISOString().split('T')[0] : '',
            aadhaar: data.editData.aadhaarNumber,
            pan: data.editData.panNumber,
            documents: data.editData.documents || []
          });
        } else {
          setManagerFormData({
            name: '', email: '', phone: '', state: '', employmentType: 'Full Time',
            doj: '', basicSalary: '', normalStart: '09:30', ramadanStart: '09:00',
            aadhaar: '', pan: '', documents: []
          });
        }
      } else if (targetType === 'leave-history') {
        setLeaveHistoryUser(data.user);
      } else if (targetType === 'lead-history') {
        setLeadHistoryData({ leadId: data.leadId, leadName: data.leadName || '' });
      } else if (targetType === 'update-lead') {
        setSelectedLead(data.leadData);
      } else if (targetType === 'allocate-lead') {
        if (data.leadData) {
          setSelectedLead(data.leadData);
          targetType = 'allocate-single-lead';
        } else {
          setSelectedLead(null);
        }
      } else if (targetType === 'leave-approval') {
        setLeaveAction({ id: data.id, reason: '' });
      } else if (targetType === 'bulk-allocate') {
        setSelectedLeadIds([]);
        setTargetExecutiveId('');
        setBulkAllocateStep(1);
      } else if (targetType === 'escalate-lead') {
        setEscalateData({ lead: data.leadData, reason: '', managerId: '' });
      } else if (targetType === 'assign-target') {
        setTargetState({
          userId: data.executive._id,
          name: data.executive.name,
          month: new Date().getMonth() + 1,
          year: new Date().getFullYear(),
          calls: 0,
          leads: 0,
          conversions: 0,
          revenue: 0
        });
      } else if (targetType === 'view-docs') {
        setViewDocsUser(data.user);
      }
    } else {
      targetType = e.detail;
    }

    // Unified Alias Handling
    if (targetType === 'create-industry-manager') {
      setExecFormData(prev => ({ ...prev, role: 'industry-manager' }));
      targetType = 'create-exec';
    } else if (targetType === 'create-executive') {
      setExecFormData(prev => ({ ...prev, role: 'executive' }));
      targetType = 'create-exec';
    } else if (targetType === 'create-exec') {
      setExecFormData(prev => ({ ...prev, role: 'executive' }));
    }

    if (targetType) {
      setActiveModal(targetType);

      // Unified Data Fetching
      if (['add-lead', 'create-state-manager', 'create-exec', 'allocate-lead', 'allocate-single-lead', 'leave-approval', 'apply-leave', 'escalate-lead', 'bulk-allocate'].includes(targetType)) {
        fetchUsers();
      }
      if (targetType === 'leave-approval') fetchPendingLeaves();
      if (targetType === 'work-time') fetchWorkingHours();
      if (targetType === 'schedule-meeting') fetchMyLeads();
      if (targetType === 'bulk-allocate') {
        fetchUnassignedLeads();
      }
    }
  }, [fetchUsers, fetchPendingLeaves, fetchUnassignedLeads, fetchWorkingHours, fetchMyLeads]);

  useEffect(() => {
    window.addEventListener('open-modal', handleOpenModal);
    return () => window.removeEventListener('open-modal', handleOpenModal);
  }, [handleOpenModal]);

  const [hierarchy, setHierarchy] = useState({ stateManagers: [], industryManagers: [], executives: [] });

  const handleBulkAllocate = async () => {
    if (!targetExecutiveId) return addToast('Please select an executive', 'warning');
    setLoading(true);
    try {
      await leadsApi.bulkAllocate({
        leadIds: selectedLeadIds,
        assignedTo: targetExecutiveId
      });
      addToast(`${selectedLeadIds.length} leads allocated successfully!`, 'success');
      queryClient.invalidateQueries({ queryKey: ['leads'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['dashboard'], exact: false });
      queryClient.refetchQueries({ queryKey: ['leads'], exact: false, type: 'active' });
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
        phone: `${leadFormData.countryCode}${leadFormData.phone}`,
        // Executives always own the leads they create; backend enforces this too
        ...(isExecutive && { ownerId: currentUser._id })
      };
      await leadsApi.createLead(leadData);
      addToast('Lead added successfully!', 'success');
      setActiveModal(null);
      setLeadFormData(getLeadFormDefaults());
      queryClient.invalidateQueries({ queryKey: ['leads'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['dashboard'], exact: false });
      queryClient.refetchQueries({ queryKey: ['leads'], exact: false, type: 'active' });
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
      const payload = {
        ...managerFormData,
        dateOfJoining: managerFormData.doj || managerFormData.dateOfJoining || null,
        aadhaarNumber: managerFormData.aadhaar || managerFormData.aadhaarNumber || '',
        panNumber: managerFormData.pan || managerFormData.panNumber || '',
      };
      if (managerFormData._id) {
        await usersApi.updateUser(managerFormData._id, payload);
        addToast('State Manager updated successfully!', 'success');
      } else {
        await usersApi.createStateManager(payload);
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

  const handleEscalateSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await leadsApi.transitionLead(escalateData.lead._id, 'escalate', {
        escalateTo: escalateData.managerId,
        note: escalateData.reason
      });
      addToast('Lead escalated successfully!', 'success');
      setActiveModal(null);
      queryClient.invalidateQueries({ queryKey: ['leads'], exact: false });
      queryClient.refetchQueries({ queryKey: ['leads'], exact: false, type: 'active' });
    } catch (err) {
      addToast('Error escalating lead', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleScheduleMeetingSubmit = async (e) => {
    e.preventDefault();
    if (!scheduleFormData.leadId) return addToast('Please select a lead', 'warning');
    setLoading(true);
    try {
      await leadsApi.updateLead(scheduleFormData.leadId, {
        meetingAt: scheduleFormData.meetingAt,
        status: scheduleFormData.meetingType === 'virtual' ? 'meeting_virtual' : 'meeting_direct',
        notes: scheduleFormData.notes
      });
      addToast('Meeting scheduled successfully!', 'success');
      setActiveModal(null);
      setScheduleFormData({ leadId: '', meetingAt: '', meetingType: 'direct', notes: '' });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      // Refresh meetings list if we are on that page
      window.dispatchEvent(new CustomEvent('refresh-meetings'));
    } catch (err) {
      addToast('Error scheduling meeting', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleTargetSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await targetsApi.assignTarget(targetState);
      addToast('Target assigned successfully!', 'success');
      setActiveModal(null);
      queryClient.invalidateQueries({ queryKey: ['targets'] });
    } catch (err) {
      addToast(err.response?.data?.message || 'Error assigning target', 'error');
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
                <label className="form-label">Full Name <span className="text-red">*</span></label>
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
                {/* Fix: Region Type Filtering — pass regionType through LocationSelector */}
                <LocationSelector
                  value={{
                    country: leadFormData.country,
                    state: leadFormData.state,
                    district: leadFormData.district,
                    regionType: leadFormData.regionType,
                    region: leadFormData.region
                  }}
                  onChange={(loc) => setLeadFormData({
                    ...leadFormData,
                    country: loc.country,
                    state: loc.state,
                    district: loc.district,
                    regionType: loc.regionType,
                    region: loc.region
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
                <label className="form-label">Lead Source <span className="text-red">*</span></label>
                <select className="select" value={leadFormData.leadSource} onChange={(e)=>setLeadFormData({...leadFormData, leadSource: e.target.value})} required>
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
              <div className="space-y-2">
                <label className="form-label">Revenue Category</label>
                <select className="select" value={leadFormData.revenueCategory} onChange={(e)=>setLeadFormData({...leadFormData, revenueCategory: e.target.value})}>
                  <option value="partnership">Partnership</option>
                  <option value="shop_subscription">Shop Subscription</option>
                  <option value="delivery_subscription">Delivery Subscription</option>
                  <option value="distributor_subscription">Distributor Subscription</option>
                  <option value="manufacturer_subscription">Manufacturer Subscription</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>
          </div>

          {/* ALLOCATION SECTION — hidden for executives (auto-assigned to themselves) */}
          {!isExecutive && (
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
          )}

          {/* SCHEDULE MEETING SECTION */}
          <div className="space-y-6">
            <div className="flex items-center gap-4">
              <div className="text-[11px] font-bold text-[#1f2937] uppercase tracking-[0.2em] whitespace-nowrap">Schedule Meeting (Optional)</div>
              <div className="h-[1px] w-full bg-border"></div>
            </div>
            <div className="grid grid-cols-2 gap-x-10 gap-y-6">
              <div className="space-y-2">
                <label className="form-label">Meeting Date & Time</label>
                <input 
                  type="datetime-local" className="input" 
                  value={leadFormData.meetingAt} 
                  onChange={(e) => setLeadFormData({ ...leadFormData, meetingAt: e.target.value })} 
                />
              </div>
              <div className="space-y-2">
                <label className="form-label">Meeting Type</label>
                <select 
                  className="select" 
                  value={leadFormData.meetingType} 
                  onChange={(e) => setLeadFormData({ ...leadFormData, meetingType: e.target.value })}
                >
                  <option value="direct">Direct Visit</option>
                  <option value="virtual">Virtual Meeting</option>
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
                <input className="input" type="number" value={managerFormData.basicSalary} onChange={(e)=>setManagerFormData({...managerFormData, basicSalary: e.target.value})} placeholder="e.g. 35000" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="form-label">Aadhaar Number</label>
                <input className="input" type="text" value={managerFormData.aadhaar} onChange={(e)=>setManagerFormData({...managerFormData, aadhaar: e.target.value})} placeholder="XXXX XXXX XXXX" />
              </div>
              <div className="space-y-1">
                <label className="form-label">PAN Number</label>
                <input className="input uppercase" type="text" value={managerFormData.pan} onChange={(e)=>setManagerFormData({...managerFormData, pan: e.target.value})} placeholder="ABCDE1234F" />
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
              <label className="form-label">Industry</label>
              <select className="select" value={execFormData.industry} onChange={(e) => setExecFormData({...execFormData, industry: e.target.value})}>
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
              <label className="form-label">Date of Joining <span className="text-red">*</span></label>
              <input className="input" type="date" value={execFormData.dateOfJoining} onChange={(e) => setExecFormData({...execFormData, dateOfJoining: e.target.value})} required />
            </div>

            {/* Basic Salary */}
            <div className="space-y-2">
              <label className="form-label">Basic Salary (₹/month)</label>
              <input className="input" type="number" placeholder="e.g. 22000" value={execFormData.basicSalary} onChange={(e) => setExecFormData({...execFormData, basicSalary: e.target.value})} />
            </div>

            {/* Aadhaar Number */}
            <div className="space-y-2">
              <label className="form-label">Aadhaar Number</label>
              <input className="input" type="text" placeholder="XXXX XXXX XXXX" value={execFormData.aadhaarNumber} onChange={(e) => setExecFormData({...execFormData, aadhaarNumber: e.target.value})} />
            </div>

            {/* PAN Number */}
            <div className="space-y-2">
              <label className="form-label">PAN Number</label>
              <input className="input uppercase" type="text" placeholder="ABCDE1234F" value={execFormData.panNumber} onChange={(e) => setExecFormData({...execFormData, panNumber: e.target.value})} />
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

              <div className="flex items-center justify-between p-4 bg-surface2/30 rounded-xl border border-border">
                <span className="text-sm font-medium text-text-primary">Early exit threshold → <span className="font-bold">Half day</span> if left this many minutes before end time</span>
                <input
                  type="number"
                  className="w-16 bg-white border border-border rounded-lg px-2 py-1.5 text-center text-sm font-bold"
                  value={workingHours.rules.earlyExitThresholdMinutes ?? 120}
                  onChange={(e) => setWorkingHours({...workingHours, rules: {...workingHours.rules, earlyExitThresholdMinutes: Number(e.target.value)}})}
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
        title="Leave Policy · RoadMate Team"
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
      <LeadHistoryModal
        isOpen={activeModal === 'lead-history'}
        onClose={handleCloseModal}
        leadId={leadHistoryData.leadId}
        leadName={leadHistoryData.leadName}
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

      {/* VIEW / ATTACH DOCUMENTS MODAL */}
      <Modal
        isOpen={activeModal === 'view-docs'}
        title="Staff Documents"
        subtitle={viewDocsUser ? `${viewDocsUser.name} · ${viewDocsUser.industry || ''} ${viewDocsUser.state ? '· ' + viewDocsUser.state : ''}`.trim().replace(/·\s*$/, '') : ''}
        onClose={handleCloseModal}
      >
        {viewDocsUser && (
          <div className="space-y-6">
            {/* Identity Numbers */}
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-surface2/50 rounded-xl border border-border">
                <div className="text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1">Aadhaar Number</div>
                <div className="text-[14px] font-bold text-text-primary font-mono">{viewDocsUser.aadhaarNumber || <span className="text-text-muted font-normal text-[12px]">Not provided</span>}</div>
              </div>
              <div className="p-4 bg-surface2/50 rounded-xl border border-border">
                <div className="text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1">PAN Number</div>
                <div className="text-[14px] font-bold text-text-primary font-mono uppercase">{viewDocsUser.panNumber || <span className="text-text-muted font-normal text-[12px]">Not provided</span>}</div>
              </div>
            </div>

            {/* Existing Documents */}
            {viewDocsUser.documents?.length > 0 && (
              <div>
                <div className="text-[11px] font-bold text-text-muted uppercase tracking-wider mb-3">Attached Documents</div>
                <div className="space-y-2">
                  {viewDocsUser.documents.map((doc, i) => (
                    <div key={i} className="flex items-center justify-between p-3 bg-surface2/40 rounded-lg border border-border">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-blue/10 flex items-center justify-center">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
                        </div>
                        <div>
                          <div className="text-[12px] font-bold text-text-primary">{doc.name || 'Document'}</div>
                          {doc.size && <div className="text-[10px] text-text-muted">{(doc.size / 1024).toFixed(1)} KB</div>}
                        </div>
                      </div>
                      {doc.url && (
                        <a href={doc.url} target="_blank" rel="noopener noreferrer">
                          <Button size="xs" variant="outline" className="bg-white text-blue border-blue/20 font-bold text-[10px]">View</Button>
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Upload New Documents */}
            <div>
              <div className="text-[11px] font-bold text-text-muted uppercase tracking-wider mb-3">Attach Documents</div>
              <div className="grid grid-cols-2 gap-4">
                <FileUpload
                  folder="staff-docs"
                  entityId={viewDocsUser.email || viewDocsUser._id}
                  label="Upload Aadhaar Card"
                  onUploadComplete={async (file) => {
                    const doc = { ...file, name: 'Aadhaar Card' };
                    try {
                      await usersApi.addUserDocument(viewDocsUser._id, doc);
                      setViewDocsUser(prev => ({ ...prev, documents: [...(prev.documents || []), doc] }));
                      window.dispatchEvent(new CustomEvent('refresh-users'));
                    } catch {}
                  }}
                />
                <FileUpload
                  folder="staff-docs"
                  entityId={viewDocsUser.email || viewDocsUser._id}
                  label="Upload PAN Card"
                  onUploadComplete={async (file) => {
                    const doc = { ...file, name: 'PAN Card' };
                    try {
                      await usersApi.addUserDocument(viewDocsUser._id, doc);
                      setViewDocsUser(prev => ({ ...prev, documents: [...(prev.documents || []), doc] }));
                      window.dispatchEvent(new CustomEvent('refresh-users'));
                    } catch {}
                  }}
                />
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* ESCALATE LEAD MODAL */}
      <Modal
        isOpen={activeModal === 'escalate-lead'}
        title="Escalate Lead"
        subtitle="Forward this lead to a senior manager for review"
        onClose={handleCloseModal}
      >
        <form onSubmit={handleEscalateSubmit} className="space-y-6">
          <div className="space-y-4">
            <div className="space-y-1">
              <label className="form-label">Manager to Escalate To</label>
              <select 
                className="select" 
                value={escalateData.managerId} 
                onChange={(e) => setEscalateData({ ...escalateData, managerId: e.target.value })}
                required
              >
                <option value="">Select Manager</option>
                {isStateManager && founders.length > 0 && (
                  <optgroup label="Founder">
                    {founders.map(f => (
                      <option key={f._id} value={f._id}>{f.name} (Founder)</option>
                    ))}
                  </optgroup>
                )}
                {isIndustryManager && (
                  <>
                    {hierarchy.stateManagers.length > 0 && (
                      <optgroup label="State Managers">
                        {hierarchy.stateManagers.map(m => (
                          <option key={m._id} value={m._id}>{m.name} ({m.state})</option>
                        ))}
                      </optgroup>
                    )}
                    {founders.length > 0 && (
                      <optgroup label="Founder">
                        {founders.map(f => (
                          <option key={f._id} value={f._id}>{f.name} (Founder)</option>
                        ))}
                      </optgroup>
                    )}
                  </>
                )}
                {isExecutive && (
                  <>
                    {hierarchy.industryManagers.length > 0 && (
                      <optgroup label="Industry Managers">
                        {hierarchy.industryManagers.map(m => (
                          <option key={m._id} value={m._id}>{m.name} ({m.industry})</option>
                        ))}
                      </optgroup>
                    )}
                    {hierarchy.stateManagers.length > 0 && (
                      <optgroup label="State Managers">
                        {hierarchy.stateManagers.map(m => (
                          <option key={m._id} value={m._id}>{m.name} ({m.state})</option>
                        ))}
                      </optgroup>
                    )}
                    {founders.length > 0 && (
                      <optgroup label="Founder">
                        {founders.map(f => (
                          <option key={f._id} value={f._id}>{f.name} (Founder)</option>
                        ))}
                      </optgroup>
                    )}
                  </>
                )}
                {/* Fallback for Founder/Other roles */}
                {!isIndustryManager && !isExecutive && !isStateManager && managers.map(m => (
                  <option key={m._id} value={m._id}>{m.name} ({m.state})</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="form-label">Reason for Escalation</label>
              <textarea 
                className="textarea h-32" 
                placeholder="Explain why this lead needs senior management attention..."
                value={escalateData.reason}
                onChange={(e) => setEscalateData({ ...escalateData, reason: e.target.value })}
                required
              ></textarea>
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-border">
            <Button variant="outline" onClick={() => setActiveModal(null)}>Cancel</Button>
            <Button variant="primary" type="submit" loading={loading} className="bg-purple border-purple">Escalate Now</Button>
          </div>
        </form>
      </Modal>
      <AssignTargetModal
        isOpen={activeModal === 'assign-target'}
        onClose={handleCloseModal}
        targetState={targetState}
        setTargetState={setTargetState}
        onSubmit={handleTargetSubmit}
        loading={loading}
      />
      <ScheduleMeetingModal
        isOpen={activeModal === 'schedule-meeting'}
        onClose={handleCloseModal}
        formData={scheduleFormData}
        setFormData={setScheduleFormData}
        leads={myLeads}
        onSubmit={handleScheduleMeetingSubmit}
        loading={loading}
      />
    </>
  );
};

const ScheduleMeetingModal = ({ isOpen, onClose, formData, setFormData, leads, onSubmit, loading }) => {
  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Schedule Meeting"
      subtitle="Select an existing lead to book a new meeting"
      className="modal-md"
    >
      <form onSubmit={onSubmit} className="space-y-6">
        <div className="space-y-1">
          <label className="form-label">Select Lead</label>
          <select 
            className="select" 
            value={formData.leadId} 
            onChange={(e) => setFormData({ ...formData, leadId: e.target.value })}
            required
          >
            <option value="">-- Choose Lead --</option>
            {leads.map(l => (
              <option key={l._id} value={l._id}>{l.company || l.name} ({l.name})</option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="form-label">Meeting Date & Time</label>
            <input 
              type="datetime-local" className="input" 
              value={formData.meetingAt} 
              onChange={(e) => setFormData({ ...formData, meetingAt: e.target.value })} 
              required
            />
          </div>
          <div className="space-y-1">
            <label className="form-label">Meeting Type</label>
            <select 
              className="select" 
              value={formData.meetingType} 
              onChange={(e) => setFormData({ ...formData, meetingType: e.target.value })}
              required
            >
              <option value="direct">Direct Visit</option>
              <option value="virtual">Virtual Meeting</option>
            </select>
          </div>
        </div>

        <div className="space-y-1">
          <label className="form-label">Notes</label>
          <textarea 
            className="textarea" 
            placeholder="Add any specific notes for this meeting..."
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          />
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-border">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button variant="primary" type="submit" loading={loading} className="bg-orange border-orange">Schedule Now</Button>
        </div>
      </form>
    </Modal>
  );
};

const AssignTargetModal = ({ isOpen, onClose, targetState, setTargetState, onSubmit, loading }) => {
  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      title={`Set Monthly Target - ${targetState.name}`}
      subtitle="Define performance goals for the current month"
      onClose={onClose}
    >
      <form onSubmit={onSubmit} className="space-y-6">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="form-label">Total Calls</label>
            <input 
              type="number" className="input" 
              value={targetState.calls} 
              onChange={e => setTargetState({ ...targetState, calls: parseInt(e.target.value) || 0 })} 
              min="0"
            />
          </div>
          <div className="space-y-1">
            <label className="form-label">Leads to Generate</label>
            <input 
              type="number" className="input" 
              value={targetState.leads} 
              onChange={e => setTargetState({ ...targetState, leads: parseInt(e.target.value) || 0 })} 
              min="0"
            />
          </div>
          <div className="space-y-1">
            <label className="form-label">Conversions</label>
            <input 
              type="number" className="input" 
              value={targetState.conversions} 
              onChange={e => setTargetState({ ...targetState, conversions: parseInt(e.target.value) || 0 })} 
              min="0"
            />
          </div>
          <div className="space-y-1">
            <label className="form-label">Revenue Target (Lakhs)</label>
            <input 
              type="number" className="input" 
              value={targetState.revenue} 
              onChange={e => setTargetState({ ...targetState, revenue: parseInt(e.target.value) || 0 })} 
              min="0"
            />
          </div>
        </div>
        <div className="flex justify-end gap-3 pt-4 border-t border-border">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button variant="primary" type="submit" loading={loading} className="bg-purple border-purple">Assign Target</Button>
        </div>
      </form>
    </Modal>
  );
};

export default GlobalModals;
