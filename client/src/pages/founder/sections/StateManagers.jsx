import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import DashboardSkeleton from '../../../components/skeletons/DashboardSkeleton';
import { usersApi } from '../../../api/usersApi';
import { dashboardApi } from '../../../api/dashboardApi';
import { Button } from '../../../components/ui';
import { usePeriod, PeriodPicker } from '../../../components/LeadPipelinePanel';
import { exportToCSV } from '../../../utils/exportUtils';
import { ActiveFilter, ActiveToggleButton, matchesActiveFilter } from '../../../components/ActiveStatusControls';
import ManagerPerformanceTable from '../../../components/ManagerPerformanceTable';

const EMPTY_PERF = { workPct: 0, leads: 0, periodLeads: 0, directMeetings: 0, virtualMeetings: 0, blocking: 0, revenue: 0 };

const StateManagers = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [filterState, setFilterState] = useState('All');
  const [showInactive, setShowInactive] = useState(false);
  const picker = usePeriod('today');
  const { period, value: periodValue } = picker;

  const { data: dashData } = useQuery({
    queryKey: ['dashboard', 'founder', period, periodValue],
    queryFn: () => dashboardApi.getFounderDashboard({ period, value: periodValue || undefined }).then(res => res.data),
    staleTime: 5 * 60 * 1000,
    placeholderData: keepPreviousData
  });

  const { data: managers, isLoading } = useQuery({
    queryKey: ['users', 'state-managers'],
    queryFn: () => usersApi.getUsers({ role: 'state_manager' }).then(res => res.data),
    staleTime: 5 * 60 * 1000,
    placeholderData: keepPreviousData
  });

  useEffect(() => {
    const handleRefreshUsers = () => {
      queryClient.invalidateQueries({ queryKey: ['users', 'state-managers'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard', 'founder'] });
    };

    window.addEventListener('refresh-users', handleRefreshUsers);
    return () => window.removeEventListener('refresh-users', handleRefreshUsers);
  }, [queryClient]);

  const openModal = (type, data = null) => {
    window.dispatchEvent(new CustomEvent('open-modal', {
      detail: typeof type === 'string' ? { type, ...data } : type
    }));
  };

  const handleDelete = async (id, name) => {
    if (window.confirm(`Are you sure you want to delete ${name}? This action cannot be undone.`)) {
      try {
        await usersApi.deleteUser(id);
        window.dispatchEvent(new CustomEvent('refresh-users'));
      } catch (err) {
        alert(err.response?.data?.message || 'Error deleting manager');
      }
    }
  };

  if (isLoading) return <DashboardSkeleton />;

  // Who is listed comes from the user list; the period filter only changes the numbers.
  const perfById = new Map((dashData?.stateManagersPerformance || []).map(p => [String(p._id), p]));
  const rows = (managers || [])
    .filter(u => matchesActiveFilter(u, showInactive))
    .filter(u => filterState === 'All' || u.state === filterState)
    .map(u => ({ ...EMPTY_PERF, ...perfById.get(String(u._id)), _id: u._id, name: u.name, state: u.state, industry: u.industry, user: u }));
  const periodText = period === 'today' ? 'Today' : periodValue;

  const handleExport = () => {
    exportToCSV(rows.map(m => ({
      'Manager Name': m.name,
      'State': m.state || '',
      'Industry': m.industry || '',
      'Period': periodText,
      'Work %': `${m.workPct}%`,
      'Leads': m.periodLeads,
      'Direct Meetings': m.directMeetings,
      'Virtual Meetings': m.virtualMeetings,
      'Blockings': m.blocking,
      'Revenue': m.revenue
    })), 'State_Managers_Report');
  };

  return (
    <div className="animate-in fade-in duration-500">
      <div className="flex items-center gap-2 mb-4 text-[13px] font-bold uppercase tracking-widest text-text-muted">
        <span>Founder</span>
        <span className="text-text-muted/30">›</span>
        <span className="text-text-primary">State Managers</span>
      </div>

      <div className="flex justify-between items-end mb-6">
        <div>
          <div className="text-[20px] font-bold text-text-primary">All State Managers</div>
          <div className="text-[14px] text-text-muted mt-1">Summary of each state manager's dashboard · Click row to drill in</div>
        </div>
        <div className="flex gap-2">
          <Button size="sm" className="bg-[#0f766e] hover:bg-[#0d645e] text-white border-none shadow-sm font-semibold" onClick={() => openModal('create-state-manager')}>+ State Manager</Button>
        </div>
      </div>

      <div className="flex flex-wrap justify-between items-end gap-3 mb-4">
        <div>
          <div className="text-[15px] font-bold text-text-primary">Staff-by-Staff Performance</div>
          <div className="text-[14px] text-text-muted mt-0.5">Work %, Leads, Direct & Virtual Meetings, Blockings and Revenue for the selected period</div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ActiveFilter showInactive={showInactive} onChange={setShowInactive} />
          <PeriodPicker {...picker} />
          <select
            className="bg-white border border-border rounded-xl px-3 py-1.5 text-[14px] font-bold text-text-secondary outline-none focus:border-blue shadow-sm"
            value={filterState}
            onChange={e => setFilterState(e.target.value)}
          >
            <option value="All">All States</option>
            {[...new Set((managers || []).map(m => m.state).filter(Boolean))].map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <Button variant="outline" size="sm" className="bg-white text-text-primary font-bold" onClick={handleExport}>Export</Button>
        </div>
      </div>

      <ManagerPerformanceTable
        rows={rows}
        onRowClick={(m) => navigate(`/dashboard/state-managers/${m._id}`)}
        emptyMessage={showInactive ? 'No inactive state managers.' : 'No state managers found.'}
        renderActions={(m) => (
          <>
            <Button size="2xs" variant="outline" className="bg-white border-border shadow-sm text-text-primary font-bold" onClick={() => openModal('create-state-manager', { editData: m.user })}>Edit</Button>
            <ActiveToggleButton user={m.user} compact />
            <Button size="2xs" variant="outline" className="bg-red/5 border-red/20 text-red shadow-sm hover:bg-red/10 font-bold" onClick={() => handleDelete(m._id, m.name)}>Delete</Button>
          </>
        )}
      />
    </div>
  );
};

export default StateManagers;
