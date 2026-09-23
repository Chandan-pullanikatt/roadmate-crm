import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Modal, Button, Tag, FileUpload, Avatar } from './ui';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import { leadsApi } from '../api/leadsApi';
import { usersApi } from '../api/usersApi';
import { leaveApi } from '../api/leaveApi';
import { targetsApi } from '../api/targetsApi';
import { LEAD_SOURCES } from '../constants/leadSources';
import { useIndustries, industryOptions } from '../hooks/useIndustries';
import { TARGET_METRICS, currentPeriodKey, periodLabel } from '../utils/targetPeriod';
import BulkUploadModal from './BulkUploadModal';
import ChangePasswordModal from './modals/ChangePasswordModal';
import LocationSelector from './common/LocationSelector';
import { State } from 'country-state-city';
import LeaveHistoryModal from './modals/LeaveHistoryModal';
import UpdateLeadModal from './modals/UpdateLeadModal';
import AllocateLeadModal from './modals/AllocateLeadModal';
import LeadHistoryModal from './modals/LeadHistoryModal';
import SendNotificationModal from './modals/SendNotificationModal';
import ViewLeadModal from './modals/ViewLeadModal';
import EditLeadDetailsModal from './modals/EditLeadDetailsModal';
import LeavePolicyModal from './modals/LeavePolicyModal';
import ConfirmTargetModal from './modals/ConfirmTargetModal';
import { PHONE_CODES, dialCodeFor } from '../data/phoneCodes';

const digitsOnly = (value) => String(value ?? '').replace(/\D/g, '');
const toDateInputValue = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};



const GlobalModals = () => {
  const queryClient = useQueryClient();
  const { addToast } = useToast();
  const { user: currentUser } = useAuth();
  const isExecutive = currentUser?.role === 'executive';
  const isStateManager = currentUser?.role === 'state_manager';
  const isIndustryManager = currentUser?.role === 'industry_manager';
  const isFounder = currentUser?.role === 'founder';
  const { industries } = useIndustries();
  const [activeModal, setActiveModal] = useState(null);
  const [leadHistoryData, setLeadHistoryData] = useState({ leadId: null, leadName: '' });
  const [managers, setManagers] = useState([]);
  const [industryManagers, setIndustryManagers] = useState([]);
  const [founders, setFounders] = useState([]);
  const [executives, setExecutives] = useState([]);
  const [loading, setLoading] = useState(false);
  const [leaveHistoryUser, setLeaveHistoryUser] = useState(null);
  const [selectedLead, setSelectedLead] = useState(null);
  const [viewLeadId, setViewLeadId] = useState(null);
  const [duplicateWarning, setDuplicateWarning] = useState(null); // existing lead when a duplicate is detected
  // Manage Industries lives outside activeModal so the founder can open it from
  // inside the create-account form without losing what they have typed.
  const [industryModalOpen, setIndustryModalOpen] = useState(false);
  const [industryDraft, setIndustryDraft] = useState([]);
  const [newIndustry, setNewIndustry] = useState('');
  
  const getLeadFormDefaults = () => ({
    name: '', phoneCountry: 'IN', phone: '', email: '',
    country: 'India',
    district: '',
    state: isStateManager ? (currentUser?.state || '') : '',
    // Fix: Region Type Filtering — added regionType field
    regionType: '',
    region: '',
    industry: isIndustryManager ? (currentUser?.industry || '') : '',
    leadSource: 'Direct', priority: 'Hot 🔥',
    // A state manager's own page allocates to their own name by default, so a
    // lead they add is theirs unless they hand it down to an IM or DM below.
    managerId: isStateManager ? (currentUser?._id || '') : '',
    industryManagerId: '', ownerId: '', notes: '',
    revenueCategory: 'other',
    meetingAt: '',
    meetingType: 'direct',
    meetingLink: '',
    documents: []
  });

  const [leadFormData, setLeadFormData] = useState(getLeadFormDefaults);

  // currentUser can arrive after the first render, and the defaults above are
  // only read once — so fill the state manager's own name in here too, without
  // overwriting a choice already made.
  useEffect(() => {
    if (!isStateManager || !currentUser?._id) return;
    setLeadFormData(prev => (prev.managerId ? prev : { ...prev, managerId: currentUser._id }));
  }, [isStateManager, currentUser?._id]);

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
    rules: { leaveBelowPct: 30, halfDayBelowPct: 60, lateMarkMinutes: 10, lateHalfDayMinutes: 30, earlyMarkMinutes: 15, earlyHalfDayMinutes: 60 }
  });

  const [leaveFormData, setLeaveFormData] = useState({
    leaveType: 'sick', fromDate: '', toDate: '', reason: ''
  });
  const [selectedLeadIds, setSelectedLeadIds] = useState([]);
  // leadId -> userId chosen for that lead in the bulk allocate modal
  const [leadAssignments, setLeadAssignments] = useState({});
  const [unassignedLeads, setUnassignedLeads] = useState([]);
  const [escalateData, setEscalateData] = useState({ lead: null, reason: '', managerId: '' });
  const emptyTargetState = (userId = '', name = '') => ({
    userId,
    name,
    period: 'monthly',
    directMeetings: 0,
    blocking: 0,
    conversions: 0
  });
  const [targetState, setTargetState] = useState(emptyTargetState);
  const [targetConfirm, setTargetConfirm] = useState(null);
  const [myLeads, setMyLeads] = useState([]);
  const [scheduleFormData, setScheduleFormData] = useState({
    leadId: '',
    meetingAt: '',
    meetingType: 'direct',
    meetingLink: '',
    notes: ''
  });

  const selectedLeadStateManager = useMemo(
    () => managers.find((m) => m._id === leadFormData.managerId),
    [managers, leadFormData.managerId]
  );

  const leadIndustryManagerOptions = useMemo(() => {
    if (!leadFormData.managerId) return [];
    return industryManagers.filter((m) => m.reportingTo === leadFormData.managerId);
  }, [industryManagers, leadFormData.managerId]);

  const leadExecutiveOptions = useMemo(() => {
    if (!leadFormData.industryManagerId) return [];
    return executives.filter((e) => e.reportingTo === leadFormData.industryManagerId);
  }, [executives, leadFormData.industryManagerId]);

  const handleLeaveSubmit = async (e) => {
    e.preventDefault();
    const today = toDateInputValue();
    if (!leaveFormData.fromDate || !leaveFormData.toDate) {
      return addToast('Please select leave dates', 'warning');
    }
    if (leaveFormData.fromDate < today || leaveFormData.toDate < today) {
      return addToast('Past dates cannot be selected for leave', 'warning');
    }
    if (leaveFormData.toDate < leaveFormData.fromDate) {
      return addToast('To Date must be the same as or after From Date', 'warning');
    }
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
      if (res.data?.value) {
        setWorkingHours(prev => ({
          ...prev,
          ...res.data.value,
          rules: { ...prev.rules, ...(res.data.value.rules || {}) }
        }));
      }
    } catch (err) {
      addToast('Error fetching configuration', 'error');
    }
  };

  const openIndustryManager = useCallback(() => {
    if (currentUser?.role !== 'founder') {
      addToast('Only the founder can edit the industry list.', 'warning');
      return;
    }
    setIndustryDraft(industries);
    setNewIndustry('');
    setIndustryModalOpen(true);
  }, [addToast, currentUser?.role, industries]);

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
            roleLocked: !!prefill.role,
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
      } else if (targetType === 'update-lead' || targetType === 'edit-lead-details') {
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
        setLeadAssignments({});
      } else if (targetType === 'escalate-lead') {
        setEscalateData({ lead: data.leadData, reason: '', managerId: '' });
      } else if (targetType === 'assign-target') {
        setTargetState(emptyTargetState(data.executive._id, data.executive.name));
      } else if (targetType === 'view-docs') {
        setViewDocsUser(data.user);
      } else if (targetType === 'view-lead') {
        setViewLeadId(data.leadId || data.leadData?._id || null);
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
    } else if (targetType === 'create-exec' && !execFormData.role) {
      setExecFormData(prev => ({ ...prev, role: 'executive' }));
    }

    if (targetType === 'manage-industries') {
      openIndustryManager();
      return;
    }

    if (targetType) {
      if (targetType === 'work-time' && currentUser?.role !== 'founder') {
        addToast('Only the founder can edit working hours.', 'warning');
        return;
      }
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
  }, [addToast, currentUser?.role, fetchUsers, fetchPendingLeaves, fetchUnassignedLeads, fetchWorkingHours, fetchMyLeads, openIndustryManager]);

  useEffect(() => {
    window.addEventListener('open-modal', handleOpenModal);
    return () => window.removeEventListener('open-modal', handleOpenModal);
  }, [handleOpenModal]);

  const [hierarchy, setHierarchy] = useState({ stateManagers: [], industryManagers: [], executives: [] });

  const handleBulkAllocate = async () => {
    const missing = selectedLeadIds.filter(id => !leadAssignments[id]);
    if (missing.length) return addToast(`Select a manager for ${missing.length} selected lead(s)`, 'warning');

    // The API takes one assignee per call, so group the selected leads by assignee.
    const groups = {};
    selectedLeadIds.forEach(id => {
      const assignee = leadAssignments[id];
      (groups[assignee] = groups[assignee] || []).push(id);
    });

    setLoading(true);
    try {
      await Promise.all(Object.entries(groups).map(([assignedTo, leadIds]) =>
        leadsApi.bulkAllocate({ leadIds, assignedTo })
      ));
      addToast(`${selectedLeadIds.length} leads allocated successfully!`, 'success');
      setActiveModal(null);
      setSelectedLeadIds([]);
      setLeadAssignments({});
    } catch (err) {
      addToast(err.response?.data?.message || 'Error in bulk allocation', 'error');
    } finally {
      // Refresh even on partial failure, since some groups may have succeeded.
      queryClient.invalidateQueries({ queryKey: ['leads'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['dashboard'], exact: false });
      queryClient.refetchQueries({ queryKey: ['leads'], exact: false, type: 'active' });
      if (activeModal === 'bulk-allocate') fetchUnassignedLeads();
      setLoading(false);
    }
  };

  const handleLeadSubmit = async (e, { confirmDuplicate = false } = {}) => {
    if (e) e.preventDefault();

    const digits = (leadFormData.phone || '').replace(/\D/g, '');
    const isIndian = leadFormData.phoneCountry === 'IN';
    if (isIndian ? !/^[6-9]\d{9}$/.test(digits) : (digits.length < 7 || digits.length > 15)) {
      addToast(
        isIndian
          ? 'Enter a valid 10-digit mobile number.'
          : 'Enter a valid mobile number (7-15 digits).',
        'error'
      );
      return;
    }

    setLoading(true);
    try {
      const allocationOwnerId = isExecutive
        ? currentUser._id
        : (leadFormData.ownerId || leadFormData.industryManagerId || leadFormData.managerId || '');
      const leadData = {
        ...leadFormData,
        phone: `${dialCodeFor(leadFormData.phoneCountry)}${leadFormData.phone}`,
        meetingLink: leadFormData.meetingType === 'virtual' ? leadFormData.meetingLink.trim() : '',
        ownerId: allocationOwnerId || undefined,
        confirmDuplicate
      };
      await leadsApi.createLead(leadData);
      addToast('Lead added successfully!', 'success');
      setActiveModal(null);
      setDuplicateWarning(null);
      setLeadFormData(getLeadFormDefaults());
      queryClient.invalidateQueries({ queryKey: ['leads'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['dashboard'], exact: false });
      queryClient.refetchQueries({ queryKey: ['leads'], exact: false, type: 'active' });
    } catch (err) {
      // A duplicate is a warning, not a rejection — show what already exists
      // and let the user decide whether to create it anyway.
      if (err.response?.status === 409 && err.response?.data?.duplicate) {
        setDuplicateWarning(err.response.data.existing);
      } else {
        addToast(err.response?.data?.message || 'Error adding lead', 'error');
      }
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

  const handleAddIndustry = () => {
    const name = newIndustry.trim();
    if (!name) return;
    if (industryDraft.some(i => i.toLowerCase() === name.toLowerCase())) {
      addToast(`"${name}" is already on the list.`, 'warning');
      return;
    }
    // "Others" stays last so it always reads as the catch-all.
    const others = industryDraft.filter(i => i.toLowerCase() === 'others' || i.toLowerCase() === 'other');
    const rest = industryDraft.filter(i => !others.includes(i));
    setIndustryDraft([...rest, name, ...others]);
    setNewIndustry('');
  };

  const handleRemoveIndustry = (name) => {
    setIndustryDraft(prev => prev.filter(i => i !== name));
  };

  const handleIndustriesSubmit = async (e) => {
    e.preventDefault();
    if (!industryDraft.length) {
      addToast('Keep at least one industry on the list.', 'warning');
      return;
    }
    setLoading(true);
    try {
      const { configApi } = await import('../api/configApi');
      await configApi.saveConfig({ key: 'industries', value: industryDraft });
      await queryClient.invalidateQueries({ queryKey: ['config', 'industries'] });
      addToast('Industry list updated successfully!', 'success');
      setIndustryModalOpen(false);
    } catch (err) {
      addToast(err.response?.data?.message || 'Error saving industry list', 'error');
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
        meetingLink: scheduleFormData.meetingType === 'virtual' ? scheduleFormData.meetingLink.trim() : '',
        notes: scheduleFormData.notes
      });
      addToast('Meeting scheduled successfully!', 'success');
      setActiveModal(null);
      setScheduleFormData({ leadId: '', meetingAt: '', meetingType: 'direct', meetingLink: '', notes: '' });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      // Refresh meetings list if we are on that page
      window.dispatchEvent(new CustomEvent('refresh-meetings'));
    } catch (err) {
      addToast('Error scheduling meeting', 'error');
    } finally {
      setLoading(false);
    }
  };

  // The server upserts, so saving can silently replace a target already set
  // for this period. Confirm first, showing what is about to change.
  const handleTargetSubmit = (e) => {
    e.preventDefault();
    const periodKey = currentPeriodKey(targetState.period);
    // Populated whenever the Targets page has been opened this session; the
    // modal falls back to a plain "will be replaced" note when it has not.
    const cached = queryClient.getQueryData(['targets', 'team', targetState.period, periodKey]);
    setTargetConfirm({
      periodKey,
      existing: Array.isArray(cached)
        ? cached.find(t => String(t.user?._id) === String(targetState.userId))
        : undefined,
    });
  };

  const confirmTargetSubmit = async () => {
    setLoading(true);
    try {
      await targetsApi.assignTarget({ ...targetState, periodKey: targetConfirm.periodKey });
      addToast('Target assigned successfully!', 'success');
      setTargetConfirm(null);
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
        {duplicateWarning && (
          <div className="mb-6 rounded-2xl border border-orange/40 bg-orange/5 p-5">
            <div className="text-sm font-bold text-text-primary mb-1">Possible duplicate lead</div>
            <div className="text-[15px] text-text-secondary mb-3">
              A lead with this mobile number already exists. You can still create this one.
            </div>
            <div className="rounded-xl bg-white border border-border p-3 text-[14px] text-text-secondary space-y-0.5">
              <div><span className="font-bold text-text-primary">{duplicateWarning.name}</span>{duplicateWarning.company ? ` · ${duplicateWarning.company}` : ''}</div>
              <div>{duplicateWarning.phone} · {String(duplicateWarning.status || '').replace(/_/g, ' ')}</div>
              <div>Owner: {duplicateWarning.owner}</div>
              {duplicateWarning.createdAt && (
                <div>Created: {new Date(duplicateWarning.createdAt).toLocaleDateString()}</div>
              )}
            </div>
            <div className="flex gap-3 mt-4">
              <Button
                type="button"
                variant="primary"
                disabled={loading}
                onClick={() => handleLeadSubmit(null, { confirmDuplicate: true })}
              >
                Create anyway
              </Button>
              <Button type="button" variant="secondary" onClick={() => setDuplicateWarning(null)}>
                Cancel
              </Button>
            </div>
          </div>
        )}
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
                <input className="input" type="text" value={leadFormData.name} onChange={(e)=>setLeadFormData({...leadFormData, name: e.target.value})} placeholder="Lead name" />
              </div>
              
              <div className="space-y-2">
                <label className="form-label">Phone Number <span className="text-red">*</span></label>
                <div className="flex gap-3">
                  <div className="relative w-40 shrink-0">
                    <select className="select pl-4" value={leadFormData.phoneCountry} onChange={(e)=>setLeadFormData({...leadFormData, phoneCountry: e.target.value})}>
                      {PHONE_CODES.map((c) => (
                        <option key={c.iso} value={c.iso}>{c.name} ({c.dialCode})</option>
                      ))}
                    </select>
                  </div>
                  <input
                    className="input flex-1"
                    type="tel"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={leadFormData.phoneCountry === 'IN' ? 10 : 15}
                    value={leadFormData.phone}
                    onChange={(e)=>setLeadFormData({
                      ...leadFormData,
                      phone: digitsOnly(e.target.value).slice(0, leadFormData.phoneCountry === 'IN' ? 10 : 15)
                    })}
                    placeholder="XXXXX XXXXX"
                    required
                  />
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
                />
              </div>
              <div className="space-y-2">
                <label className="form-label">Industry</label>
                <select className="select" value={leadFormData.industry} onChange={(e)=>setLeadFormData({...leadFormData, industry: e.target.value})}>
                  <option value="">Select Industry</option>
                  {industryOptions(industries, leadFormData.industry).map(name => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="form-label">Lead Source <span className="text-red">*</span></label>
                <select className="select" value={leadFormData.leadSource} onChange={(e)=>setLeadFormData({...leadFormData, leadSource: e.target.value})} required>
                  {LEAD_SOURCES.map((s) => (
                    <option key={s.prefix} value={s.label}>{s.label}</option>
                  ))}
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

            {isIndustryManager ? (
              /* Industry managers can assign to themselves or to their own executives */
              <div className="space-y-2">
                <label className="form-label">Assign To</label>
                <select
                  className="select"
                  value={leadFormData.ownerId}
                  onChange={(e) => setLeadFormData({ ...leadFormData, ownerId: e.target.value })}
                >
                  <option value="">Leave unassigned</option>
                  <option value={currentUser?._id}>
                    👤 Myself ({currentUser?.name})
                  </option>
                  {executives
                    .filter(ex => ex.reportingTo === currentUser?._id || ex.reportingTo?.toString() === currentUser?._id?.toString())
                    .map(ex => <option key={ex._id} value={ex._id}>{ex.name} ({ex.district || ex.state})</option>)}
                </select>
              </div>
            ) : (
              /* Founder / State Manager — full SM → IM → District Manager cascade */
              <div className="grid grid-cols-2 gap-x-10 gap-y-6">
                <div className="space-y-2">
                  <label className="form-label">Assign to State Manager</label>
                  <select
                    className="select"
                    value={leadFormData.managerId}
                    onChange={(e)=>setLeadFormData({
                      ...leadFormData,
                      managerId: e.target.value,
                      industryManagerId: '',
                      ownerId: ''
                    })}
                  >
                    <option value="">Select State Manager</option>
                    {managers
                      .filter(m => !leadFormData.state || m.state === leadFormData.state)
                      .map(m => <option key={m._id} value={m._id}>{m.name} ({m.state})</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="form-label">Assign to Industry Manager</label>
                  <select
                    className="select"
                    value={leadFormData.industryManagerId}
                    onChange={(e) => {
                      const selectedIM = leadIndustryManagerOptions.find(m => m._id === e.target.value);
                      setLeadFormData({
                        ...leadFormData,
                        industryManagerId: e.target.value,
                        // Auto-inherit industry from the selected IM so the lead is visible to them
                        industry: selectedIM?.industry || leadFormData.industry,
                        ownerId: ''
                      });
                    }}
                    disabled={!leadFormData.managerId}
                  >
                    <option value="">{leadFormData.managerId ? 'Select Industry Manager' : 'Select State Manager first'}</option>
                    {leadIndustryManagerOptions.map(m => <option key={m._id} value={m._id}>{m.name} ({m.industry})</option>)}
                  </select>
                  {leadFormData.managerId && leadIndustryManagerOptions.length === 0 && (
                    <p className="text-[11px] text-amber font-medium">No industry managers report to {selectedLeadStateManager?.name || 'this state manager'}.</p>
                  )}
                </div>
                <div className="space-y-2 col-span-2">
                  <label className="form-label">Assign to District Manager</label>
                  <select
                    className="select"
                    value={leadFormData.ownerId}
                    onChange={(e)=>setLeadFormData({...leadFormData, ownerId: e.target.value})}
                    disabled={!leadFormData.industryManagerId}
                  >
                    <option value="">{leadFormData.industryManagerId ? 'Select District Manager' : 'Select Industry Manager first'}</option>
                    {leadExecutiveOptions.map(ex => <option key={ex._id} value={ex._id}>{ex.name} ({ex.district || ex.state})</option>)}
                  </select>
                </div>
              </div>
            )}
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
                  onChange={(e) => setLeadFormData({ ...leadFormData, meetingType: e.target.value, meetingLink: e.target.value === 'virtual' ? leadFormData.meetingLink : '' })}
                >
                  <option value="direct">Direct Visit</option>
                  <option value="virtual">Virtual Meeting</option>
                </select>
              </div>
              {leadFormData.meetingType === 'virtual' && (
                <div className="space-y-2 col-span-2 animate-in fade-in slide-in-from-top-1">
                  <label className="form-label">Meeting Link (Optional)</label>
                  <input
                    type="url"
                    className="input"
                    value={leadFormData.meetingLink}
                    onChange={(e) => setLeadFormData({ ...leadFormData, meetingLink: e.target.value })}
                    placeholder="https://meet.google.com/... or https://zoom.us/..."
                  />
                </div>
              )}
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
                <input className="input" type="tel" inputMode="numeric" pattern="[0-9]*" value={managerFormData.phone} onChange={(e)=>setManagerFormData({...managerFormData, phone: digitsOnly(e.target.value)})} placeholder="91 XXXXX XXXXX" required />
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
                <input className="input" type="text" inputMode="numeric" pattern="[0-9]*" value={managerFormData.basicSalary} onChange={(e)=>setManagerFormData({...managerFormData, basicSalary: digitsOnly(e.target.value)})} placeholder="e.g. 35000" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="form-label">Aadhaar Number</label>
                <input className="input" type="text" inputMode="numeric" pattern="[0-9]*" value={managerFormData.aadhaar} onChange={(e)=>setManagerFormData({...managerFormData, aadhaar: digitsOnly(e.target.value)})} placeholder="XXXX XXXX XXXX" />
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
        subtitle="Select leads and choose a manager for each"
        onClose={handleCloseModal}
        className="modal-lg"
      >
        {(() => {
          const toggleLead = (id) => {
            if (selectedLeadIds.includes(id)) setSelectedLeadIds(selectedLeadIds.filter(x => x !== id));
            else setSelectedLeadIds([...selectedLeadIds, id]);
          };
          const assignLead = (id, userId) => {
            setLeadAssignments(prev => ({ ...prev, [id]: userId }));
            // Picking a manager for a lead implies the lead should be allocated.
            if (userId && !selectedLeadIds.includes(id)) setSelectedLeadIds(prev => [...prev, id]);
          };
          const assignAllSelected = (userId) => {
            if (!userId) return;
            setLeadAssignments(prev => {
              const next = { ...prev };
              selectedLeadIds.forEach(id => { next[id] = userId; });
              return next;
            });
          };
          const managerOptions = (
            <>
              {managers.length > 0 && (
                <optgroup label="State Managers">
                  {managers.map(m => <option key={m._id} value={m._id}>{m.name} ({m.state})</option>)}
                </optgroup>
              )}
              <optgroup label="Industry Managers">
                {industryManagers.map(m => <option key={m._id} value={m._id}>{m.name} ({m.industry})</option>)}
              </optgroup>
              <optgroup label="District Managers">
                {executives.map(e => <option key={e._id} value={e._id}>{e.name} ({e.state})</option>)}
              </optgroup>
            </>
          );
          const unassignedSelected = selectedLeadIds.filter(id => !leadAssignments[id]).length;

          return (
            <div className="space-y-6">
              <div className="p-4 bg-amber-light/30 border border-amber/20 rounded-2xl flex gap-3 items-start">
                <span className="text-amber text-lg">⚠️</span>
                <div className="text-[14px] text-text-secondary leading-relaxed">
                  <span className="font-bold text-amber">{unassignedLeads.length} leads</span> are currently unallocated. 
                  Select leads and pick a manager for each, or use "Assign selected to" to set them all at once.
                </div>
              </div>

              <div className="border border-border rounded-2xl overflow-hidden bg-surface2/30">
                <div className="p-3 border-b border-border bg-surface flex items-center justify-between gap-3 flex-wrap">
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
                    <span className="text-[12px] font-bold text-text-muted">· {selectedLeadIds.length} Selected</span>
                  </div>
                  <select
                    className="select !w-64 !py-1.5 text-[13px]"
                    value=""
                    disabled={selectedLeadIds.length === 0}
                    onChange={(e) => assignAllSelected(e.target.value)}
                  >
                    <option value="">Assign selected to…</option>
                    {managerOptions}
                  </select>
                </div>
                <div className="max-h-80 overflow-y-auto divide-y divide-border/50">
                  {unassignedLeads.map(lead => {
                    const isSelected = selectedLeadIds.includes(lead._id);
                    const needsManager = isSelected && !leadAssignments[lead._id];
                    return (
                      <div 
                        key={lead._id} 
                        className={`p-3 flex items-center gap-3 transition-colors cursor-pointer hover:bg-white ${isSelected ? 'bg-white' : ''}`}
                        onClick={() => toggleLead(lead._id)}
                      >
                        <input 
                          type="checkbox" 
                          className="w-4 h-4 rounded accent-[#0f766e]" 
                          checked={isSelected}
                          onChange={() => {}} // Handled by div onClick
                        />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-bold text-text-primary truncate">{lead.company || lead.name}</div>
                          <div className="text-[12px] text-text-muted truncate">
                            {[lead.name, lead.industry, lead.state].filter(Boolean).join(' · ')}
                          </div>
                        </div>
                        <select
                          className={`select !w-64 !py-1.5 text-[13px] ${needsManager ? '!border-amber' : ''}`}
                          value={leadAssignments[lead._id] || ''}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => assignLead(lead._id, e.target.value)}
                        >
                          <option value="">Select Manager</option>
                          {managerOptions}
                        </select>
                      </div>
                    );
                  })}
                  {unassignedLeads.length === 0 && (
                    <div className="p-8 text-center text-text-muted italic">No unallocated leads found.</div>
                  )}
                </div>
              </div>

              <div className="flex justify-end items-center gap-3 pt-4 border-t border-border mt-6">
                {unassignedSelected > 0 && (
                  <span className="text-[12px] text-amber font-semibold mr-auto">
                    {unassignedSelected} selected lead{unassignedSelected > 1 ? 's' : ''} still need a manager
                  </span>
                )}
                <Button variant="outline" onClick={() => setActiveModal(null)}>Cancel</Button>
                <Button 
                  variant="primary" 
                  loading={loading} 
                  disabled={selectedLeadIds.length === 0 || unassignedSelected > 0} 
                  onClick={handleBulkAllocate}
                  className="bg-[#0f766e]"
                >
                  Allocate {selectedLeadIds.length || ''} Lead{selectedLeadIds.length === 1 ? '' : 's'}
                </Button>
              </div>
            </div>
          );
        })()}
      </Modal>

      {/* CREATE EXECUTIVE MODAL */}
      <Modal
        isOpen={activeModal === 'create-exec'}
        title={
          execFormData._id
            ? "Edit Account"
            : execFormData.roleLocked && execFormData.role === 'executive'
              ? "Create District Manager"
              : "Create District Manager / Industry Manager"
        }
        subtitle={execFormData._id ? "Update staff account information" : "Add new District Manager account"}
        onClose={handleCloseModal}
        className="modal-lg"
      >

        <form onSubmit={handleExecSubmit} className="space-y-8 py-2">
          <div className="grid grid-cols-2 gap-x-10 gap-y-6">
            {/* Role — hidden when locked to a specific role (e.g. Industry Manager context) */}
            {!execFormData.roleLocked && (
            <div className="space-y-2">
              <label className="form-label">Role <span className="text-red">*</span></label>
              <select className="select" value={execFormData.role} onChange={(e) => setExecFormData({...execFormData, role: e.target.value})} required>
                <option value="industry-manager">Industry State Manager</option>
                <option value="executive">District Manager</option>
              </select>
            </div>
            )}

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
                <optgroup label="Founders">
                  {founders.map(f => <option key={f._id} value={f._id}>{f.name} (Founder)</option>)}
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
              <input className="input" type="tel" inputMode="numeric" pattern="[0-9]*" placeholder="91 XXXXX XXXXX" value={execFormData.phone} onChange={(e) => setExecFormData({...execFormData, phone: digitsOnly(e.target.value)})} required />
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
                {industryOptions(industries, execFormData.industry).map(name => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
              {isFounder && (
                <button
                  type="button"
                  className="text-[11px] font-bold text-[#0f766e] hover:underline"
                  onClick={openIndustryManager}
                >
                  + Add an industry
                </button>
              )}
            </div>

            {/* Date of Joining */}
            <div className="space-y-2">
              <label className="form-label">Date of Joining <span className="text-red">*</span></label>
              <input className="input" type="date" value={execFormData.dateOfJoining} onChange={(e) => setExecFormData({...execFormData, dateOfJoining: e.target.value})} required />
            </div>

            {/* Basic Salary */}
            <div className="space-y-2">
              <label className="form-label">Basic Salary (₹/month)</label>
              <input className="input" type="text" inputMode="numeric" pattern="[0-9]*" placeholder="e.g. 22000" value={execFormData.basicSalary} onChange={(e) => setExecFormData({...execFormData, basicSalary: digitsOnly(e.target.value)})} />
            </div>

            {/* Aadhaar Number */}
            <div className="space-y-2">
              <label className="form-label">Aadhaar Number</label>
              <input className="input" type="text" inputMode="numeric" pattern="[0-9]*" placeholder="XXXX XXXX XXXX" value={execFormData.aadhaarNumber} onChange={(e) => setExecFormData({...execFormData, aadhaarNumber: digitsOnly(e.target.value)})} />
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
                <div className="text-[12px] text-text-muted">State Manager · Maharashtra</div>
              </div>
              <Tag variant="amber">Pending</Tag>
            </div>

            <div className="grid grid-cols-2 gap-y-2 text-xs">
              <div className="text-text-muted">Type: <span className="text-text-primary font-bold">Sick Leave</span></div>
              <div className="text-text-muted">Duration: <span className="text-text-primary font-bold">2 Days</span></div>
              <div className="text-text-muted">From: <span className="text-text-primary font-bold">Mar 28</span></div>
              <div className="text-text-muted">To: <span className="text-text-primary font-bold">Mar 29</span></div>
            </div>

            <div className="text-[14px] bg-white/50 p-3 rounded-xl border border-border/50 text-text-secondary leading-relaxed italic">
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
            <div className="p-5 rounded-2xl bg-surface2/30 border border-border text-[16px] text-text-muted text-center">
              No pending leave requests right now.
            </div>
          ) : (
            pendingLeaves.map((leave) => (
              <div key={leave._id} className="p-5 rounded-2xl bg-surface2/30 border border-border space-y-4">
                <div className="flex items-center gap-3">
                  <Avatar name={leave.user?.name || 'Staff'} />
                  <div className="flex-1">
                    <div className="text-sm font-bold text-text-primary">{leave.user?.name}</div>
                    <div className="text-[12px] text-text-muted">
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

                <div className="text-[14px] bg-white/50 p-3 rounded-xl border border-border/50 text-text-secondary leading-relaxed italic">
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
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  className="input" 
                  placeholder="e.g. 5000" 
                  value={incentiveForm.amount}
                  onChange={e => setIncentiveForm({...incentiveForm, amount: digitsOnly(e.target.value)})}
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

      {/* MANAGE INDUSTRIES MODAL — founder only */}
      <Modal
        isOpen={industryModalOpen}
        title="Manage Industries"
        subtitle="These options fill the Industry dropdowns when creating accounts and leads"
        onClose={() => setIndustryModalOpen(false)}
        className="modal-lg"
      >
        <form onSubmit={handleIndustriesSubmit} className="space-y-8 py-2">
          <div className="space-y-3">
            {industryDraft.map(name => (
              <div key={name} className="flex items-center justify-between border border-border rounded-xl px-4 py-3">
                <span className="text-[14px] font-semibold text-text-primary">{name}</span>
                <button
                  type="button"
                  className="text-[11px] font-bold text-red hover:underline"
                  onClick={() => handleRemoveIndustry(name)}
                >
                  Remove
                </button>
              </div>
            ))}
            {!industryDraft.length && (
              <div className="text-[13px] text-text-muted">No industries yet — add one below.</div>
            )}
          </div>

          <div className="space-y-2">
            <label className="form-label">Add Industry</label>
            <div className="flex gap-3">
              <input
                className="input"
                type="text"
                placeholder="e.g. Pharmacy"
                value={newIndustry}
                onChange={(e) => setNewIndustry(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddIndustry(); } }}
              />
              <Button variant="outline" type="button" className="px-8 whitespace-nowrap" onClick={handleAddIndustry}>Add</Button>
            </div>
            <p className="text-[12px] text-text-muted">
              Removing an industry only takes it off the dropdown — accounts and leads already saved with it keep their value.
            </p>
          </div>

          <div className="flex justify-end gap-4 pt-6 border-t border-border">
            <Button variant="outline" className="px-10" onClick={() => setIndustryModalOpen(false)}>Cancel</Button>
            <Button type="submit" className="px-10 bg-[#0f766e] border-[#0f766e]" loading={loading}>Save Changes</Button>
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
          {/* NORMAL HOURS SECTION */}
          <div className="space-y-6">
            <div className="flex items-center gap-4">
              <div className="text-[11px] font-bold text-[#1f2937] uppercase tracking-[0.2em] whitespace-nowrap">Normal Working Hours</div>
              <div className="h-[1px] w-full bg-border"></div>
            </div>

            <div className="grid grid-cols-2 gap-x-10 gap-y-6">
              <div className="space-y-2">
                <label className="form-label">Start Time <span className="text-red">*</span></label>
                <input
                  className="input"
                  type="time"
                  value={workingHours.normalStart}
                  onChange={(e) => setWorkingHours({...workingHours, normalStart: e.target.value})}
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="form-label">End Time <span className="text-red">*</span></label>
                <input
                  className="input"
                  type="time"
                  value={workingHours.normalEnd}
                  onChange={(e) => setWorkingHours({...workingHours, normalEnd: e.target.value})}
                  required
                />
              </div>
            </div>
          </div>

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
              {[
                { key: 'leaveBelowPct', unit: '%', text: <>Work completion below this → <span className="font-bold text-red">Leave</span></> },
                { key: 'halfDayBelowPct', unit: '%', text: <>Work completion below this → <span className="font-bold text-orange">Half Day</span></> },
                { key: 'lateMarkMinutes', unit: 'min', text: <>Login this late (from start time) → <span className="font-bold">Late Coming</span> mark</> },
                { key: 'lateHalfDayMinutes', unit: 'min', text: <>Login this late (from start time) → <span className="font-bold text-orange">Half Day</span></> },
                { key: 'earlyMarkMinutes', unit: 'min', text: <>Leaving this early (before end time) → <span className="font-bold">Early Exit</span> mark</> },
                { key: 'earlyHalfDayMinutes', unit: 'min', text: <>Leaving this early (before end time) → <span className="font-bold text-orange">Half Day</span></> },
              ].map(({ key, unit, text }) => (
                <div key={key} className="flex items-center justify-between gap-4 p-4 bg-surface2/30 rounded-xl border border-border">
                  <span className="text-sm font-medium text-text-primary">{text}</span>
                  <div className="flex items-center gap-2 shrink-0">
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      className="w-16 bg-white border border-border rounded-lg px-2 py-1.5 text-center text-sm font-bold"
                      value={workingHours.rules[key] ?? ''}
                      onChange={(e) => setWorkingHours({...workingHours, rules: {...workingHours.rules, [key]: Number(digitsOnly(e.target.value))}})}
                    />
                    <span className="text-xs text-text-muted w-6">{unit}</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="p-4 bg-amber-light/30 border border-amber/20 rounded-xl flex gap-3 items-start">
               <span className="text-amber">⚠️</span>
               <div className="text-xs text-amber font-medium leading-relaxed">
                 End of day: staff must mark "Today Work Completed" (anyone who forgets is completed automatically at 11:59 PM). Unfinished work moves to the next working day. Working days exclude Sundays and the 2nd and 4th Saturday.
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
                min={toDateInputValue()}
                onChange={(e) => setLeaveFormData({
                  ...leaveFormData,
                  fromDate: e.target.value,
                  toDate: leaveFormData.toDate && leaveFormData.toDate < e.target.value ? '' : leaveFormData.toDate
                })}
                required 
              />
            </div>
            <div className="space-y-1">
              <label className="form-label">To Date</label>
              <input 
                type="date" 
                className="input" 
                value={leaveFormData.toDate}
                min={leaveFormData.fromDate || toDateInputValue()}
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
      <LeavePolicyModal
        isOpen={activeModal === 'leave-policy'}
        onClose={handleCloseModal}
      />
      <ChangePasswordModal 
        isOpen={activeModal === 'change-password'} 
        onClose={handleCloseModal} 
      />
      <SendNotificationModal
        isOpen={activeModal === 'send-notification'}
        onClose={handleCloseModal}
      />
      <ViewLeadModal
        isOpen={activeModal === 'view-lead'}
        onClose={handleCloseModal}
        leadId={viewLeadId}
        onEdit={(lead) => {
          setSelectedLead(lead);
          setActiveModal('update-lead');
        }}
        onEditDetails={isExecutive ? undefined : (lead) => {
          setSelectedLead(lead);
          setActiveModal('edit-lead-details');
        }}
      />
      <EditLeadDetailsModal
        isOpen={activeModal === 'edit-lead-details'}
        onClose={handleCloseModal}
        lead={selectedLead}
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
                <div className="text-[12px] font-bold text-text-muted uppercase tracking-wider mb-1">Aadhaar Number</div>
                <div className="text-[14px] font-bold text-text-primary font-mono">{viewDocsUser.aadhaarNumber || <span className="text-text-muted font-normal text-[14px]">Not provided</span>}</div>
              </div>
              <div className="p-4 bg-surface2/50 rounded-xl border border-border">
                <div className="text-[12px] font-bold text-text-muted uppercase tracking-wider mb-1">PAN Number</div>
                <div className="text-[14px] font-bold text-text-primary font-mono uppercase">{viewDocsUser.panNumber || <span className="text-text-muted font-normal text-[14px]">Not provided</span>}</div>
              </div>
            </div>

            {/* Existing Documents */}
            {viewDocsUser.documents?.length > 0 && (
              <div>
                <div className="text-[13px] font-bold text-text-muted uppercase tracking-wider mb-3">Attached Documents</div>
                <div className="space-y-2">
                  {viewDocsUser.documents.map((doc, i) => (
                    <div key={i} className="flex items-center justify-between p-3 bg-surface2/40 rounded-lg border border-border">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-blue/10 flex items-center justify-center">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
                        </div>
                        <div>
                          <div className="text-[12px] font-bold text-text-primary">{doc.name || 'Document'}</div>
                          {doc.size && <div className="text-[12px] text-text-muted">{(doc.size / 1024).toFixed(1)} KB</div>}
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
              <div className="text-[13px] font-bold text-text-muted uppercase tracking-wider mb-3">Attach Documents</div>
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
      <ConfirmTargetModal
        isOpen={!!targetConfirm}
        staffName={targetState.name}
        period={targetState.period}
        periodKey={targetConfirm?.periodKey}
        values={targetState}
        existing={targetConfirm?.existing}
        loading={loading}
        onConfirm={confirmTargetSubmit}
        onCancel={() => setTargetConfirm(null)}
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
              onChange={(e) => setFormData({ ...formData, meetingType: e.target.value, meetingLink: e.target.value === 'virtual' ? formData.meetingLink : '' })}
              required
            >
              <option value="direct">Direct Visit</option>
              <option value="virtual">Virtual Meeting</option>
            </select>
          </div>
        </div>

        {formData.meetingType === 'virtual' && (
          <div className="space-y-1 animate-in fade-in slide-in-from-top-1">
            <label className="form-label">Meeting Link (Optional)</label>
            <input
              type="url"
              className="input"
              placeholder="https://meet.google.com/... or https://zoom.us/..."
              value={formData.meetingLink || ''}
              onChange={(e) => setFormData({ ...formData, meetingLink: e.target.value })}
            />
          </div>
        )}

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
  const periodKey = currentPeriodKey(targetState.period);

  return (
    <Modal
      isOpen={isOpen}
      title={`Set Target - ${targetState.name}`}
      subtitle={`Define performance goals for ${targetState.period === 'weekly' ? 'this week' : 'this month'} (${periodLabel(targetState.period, periodKey)})`}
      onClose={onClose}
    >
      <form onSubmit={onSubmit} className="space-y-6">
        <div className="space-y-1">
          <label className="form-label">Target Period</label>
          <select
            className="select"
            value={targetState.period}
            onChange={e => setTargetState({ ...targetState, period: e.target.value })}
          >
            <option value="monthly">Monthly (this month)</option>
            <option value="weekly">Weekly (this week)</option>
          </select>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {TARGET_METRICS.map(({ key, label }) => (
            <div key={key} className="space-y-1">
              <label className="form-label">{label}</label>
              <input
                type="text" inputMode="numeric" pattern="[0-9]*" className="input"
                value={targetState[key]}
                onChange={e => setTargetState({ ...targetState, [key]: parseInt(digitsOnly(e.target.value)) || 0 })}
              />
            </div>
          ))}
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
