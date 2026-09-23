import React, { useEffect, useState } from 'react';
import { useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import DashboardSkeleton from '../../../components/skeletons/DashboardSkeleton';
import { dashboardApi } from '../../../api/dashboardApi';
import { usersApi } from '../../../api/usersApi';
import { Button } from '../../../components/ui';
import { usePeriod, PeriodPicker } from '../../../components/LeadPipelinePanel';
import { ActiveFilter, ActiveToggleButton, matchesActiveFilter } from '../../../components/ActiveStatusControls';
import ManagerPerformanceTable from '../../../components/ManagerPerformanceTable';

const EMPTY_PERF = { workPct: 0, leads: 0, periodLeads: 0, directMeetings: 0, virtualMeetings: 0, blocking: 0, revenue: 0 };

const DistrictExecutives = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [filterState, setFilterState] = useState('All');
  const [showInactive, setShowInactive] = useState(false);
  const picker = usePeriod('month');
  const { period, value: periodValue } = picker;

  const { data: dashData } = useQuery({
    queryKey: ['dashboard', 'founder', period, periodValue],
    queryFn: () => dashboardApi.getFounderDashboard({ period, value: periodValue || undefined }).then(res => res.data),
    staleTime: 5 * 60 * 1000,
    placeholderData: keepPreviousData
  });

  const { data: executives, isLoading } = useQuery({
    queryKey: ['users', 'district-managers'],
    queryFn: () => usersApi.getUsers({ role: 'executive' }).then(res => res.data),
    staleTime: 5 * 60 * 1000,
    placeholderData: keepPreviousData
  });

  useEffect(() => {
    const handleRefresh = () => {
      queryClient.invalidateQueries({ queryKey: ['users', 'district-managers'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard', 'founder'] });
    };
    window.addEventListener('refresh-users', handleRefresh);
    return () => window.removeEventListener('refresh-users', handleRefresh);
  }, [queryClient]);

  const openModal = (type, data = null) => {
    window.dispatchEvent(new CustomEvent('open-modal', { detail: { type, ...data } }));
  };

  const handleDelete = async (m) => {
    const warning = m.leads > 0 ? `\n\nWarning: This District Manager has ${m.leads} assigned leads that will become unallocated.` : '';
    if (window.confirm(`Are you sure you want to delete ${m.name}?${warning}`)) {
      try {
        await usersApi.deleteUser(m._id);
        window.dispatchEvent(new CustomEvent('refresh-users'));
      } catch (err) {
        alert(err.response?.data?.message || 'Error deleting District Manager');
      }
    }
  };

  if (isLoading) return <DashboardSkeleton />;

  // Who is listed comes from the user list; the period filter only changes the numbers.
  const perfById = new Map((dashData?.executivesPerformance || []).map(p => [String(p._id), p]));
  const activeExecs = (executives || []).filter(u => matchesActiveFilter(u, showInactive));
  const rows = activeExecs
    .filter(u => filterState === 'All' || u.state === filterState)
    .map(u => ({ ...EMPTY_PERF, ...perfById.get(String(u._id)), _id: u._id, name: u.name, state: u.state, industry: u.industry, user: u }));

  return (
    <div className="animate-in fade-in duration-500">
      <div className="flex items-center gap-2 mb-4 text-[13px] font-bold uppercase tracking-widest text-text-muted">
        <span>Founder</span>
        <span className="text-text-muted/30">›</span>
        <span className="text-text-primary">District Managers</span>
      </div>

      <div className="flex justify-between items-end mb-6">
        <div>
          <div className="text-[20px] font-bold text-text-primary">District Managers</div>
          <div className="text-[14px] text-text-muted mt-1">Performance summary · Lead handling · Attendance · Click row to drill in</div>
        </div>
        <div className="flex gap-2">
          <Button size="sm" className="bg-[#0f766e] hover:bg-[#0d645e] text-white border-none shadow-sm font-semibold" onClick={() => openModal('create-exec', { role: 'executive' })}>+ District Manager</Button>
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
            {[...new Set(activeExecs.map(e => e.state).filter(Boolean))].map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>

      <ManagerPerformanceTable
        rows={rows}
        onRowClick={(m) => navigate(`/dashboard/executives/${m._id}`)}
        emptyMessage={showInactive ? 'No inactive district managers.' : 'No district managers found.'}
        renderActions={(m) => (
          <>
            <Button size="2xs" variant="outline" className="bg-white border-border shadow-sm text-text-primary font-bold" onClick={() => openModal('create-exec', { editData: m.user })}>Edit</Button>
            <ActiveToggleButton user={m.user} compact />
            <Button size="2xs" variant="outline" className="bg-red/5 border-red/20 text-red shadow-sm hover:bg-red/10 font-bold" onClick={() => handleDelete(m)}>Delete</Button>
          </>
        )}
      />
    </div>
  );
};

export default DistrictExecutives;
