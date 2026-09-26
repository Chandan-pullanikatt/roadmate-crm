import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import DashboardSkeleton from '../../../components/skeletons/DashboardSkeleton';
import { usersApi } from '../../../api/usersApi';
import { dashboardApi } from '../../../api/dashboardApi';
import { Button } from '../../../components/ui';
import { usePeriod, PeriodPicker } from '../../../components/LeadPipelinePanel';
import { ActiveFilter, matchesActiveFilter } from '../../../components/ActiveStatusControls';
import ManagerPerformanceTable from '../../../components/ManagerPerformanceTable';
import { toast } from 'react-hot-toast';

const IndustryManagers = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');

  const picker = usePeriod('week');
  const { period, value: periodValue } = picker;
  const [showInactive, setShowInactive] = useState(false);
  const [filterState, setFilterState] = useState('All');

  const { data: dashData, isLoading: dashLoading } = useQuery({
    queryKey: ['dashboard', 'state-manager', period, periodValue],
    queryFn: () => dashboardApi.getStateManagerDashboard({ period, value: periodValue || undefined }).then(res => res.data),
    staleTime: 5 * 60 * 1000,
    placeholderData: keepPreviousData
  });

  const { data: managersRaw, isLoading: managersLoading } = useQuery({
    queryKey: ['users', 'industry-managers'],
    queryFn: () => usersApi.getUsers({ role: 'industry_manager' }).then(res => res.data),
    staleTime: 5 * 60 * 1000,
    placeholderData: keepPreviousData
  });

  React.useEffect(() => {
    const handleRefresh = () => {
      queryClient.invalidateQueries({ queryKey: ['users', 'industry-managers'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard', 'state-manager'] });
    };
    window.addEventListener('refresh-users', handleRefresh);
    return () => window.removeEventListener('refresh-users', handleRefresh);
  }, [queryClient]);

  const escalateMutation = useMutation({
    mutationFn: (data) => toast.promise(Promise.resolve(), { loading: 'Escalating...', success: 'Escalated to Founder', error: 'Failed' }),
    onSuccess: () => {
      queryClient.invalidateQueries(['dashboard', 'state-manager']);
    }
  });

  if (dashLoading || managersLoading) return <DashboardSkeleton />;

  const stats = dashData?.stats || {};
  const user = dashData?.user || {};
  const managerPerformance = dashData?.industryManagers || [];
  const performanceById = new Map(managerPerformance.map(m => [String(m._id), m]));
  const performanceByIndustry = new Map(managerPerformance.map(m => [m.industry, m]));
  const managerRows = managersRaw?.length ? managersRaw : managerPerformance;
  const industryManagers = managerRows.map(manager => {
    const performance = performanceById.get(String(manager._id)) || performanceByIndustry.get(manager.industry) || {};

    return {
      ...manager,
      industry: manager.industry || performance.industry || '',
      leadsCount: performance.leadsCount ?? manager.leadsCount ?? 0,
      efficiency: performance.efficiency ?? manager.efficiency ?? 0,
      // Own attendance for the Work % column; `efficiency` is the team average.
      workPct: performance.workPct ?? manager.workPct ?? 0,
      periodLeads: performance.periodLeads ?? manager.periodLeads ?? 0,
      calls: performance.calls ?? manager.calls ?? 0,
      meetings: performance.meetings ?? manager.meetings ?? 0,
      directMeetings: performance.directMeetings ?? manager.directMeetings ?? 0,
      virtualMeetings: performance.virtualMeetings ?? manager.virtualMeetings ?? 0,
      blocking: performance.blocking ?? manager.blocking ?? 0,
      followups: performance.followups ?? manager.followups ?? 0,
      conversions: performance.conversions ?? manager.conversions ?? 0,
      revenue: performance.revenue ?? manager.revenue ?? 0,
      leaves: performance.leaves ?? manager.leaves ?? 0,
      districts: performance.districts ?? manager.districts ?? (manager.district ? 1 : 0)
    };
  });

  const filteredManagers = industryManagers.filter(m => {
    if (!matchesActiveFilter(m.user || m, showInactive)) return false;
    if (filterState !== 'All' && (m.state || user.state) !== filterState) return false;
    return !searchTerm || 
      (m.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (m.industry || '').toLowerCase().includes(searchTerm.toLowerCase());
  });

  return (
    <div className="animate-in fade-in duration-500">
      {/* HEADER */}
      <div className="section-header mb-6">
        <div>
          <div className="section-title">Industry State Managers · {user.state}</div>
          <div className="section-sub text-[13px]">All {stats.industryManagersCount || 0} industries · Click a row to open that manager's profile</div>
        </div>
        <Button className="bg-blue text-white shadow-sm" size="sm" onClick={() => window.dispatchEvent(new CustomEvent('open-modal', { detail: { type: 'create-exec', role: 'industry-manager' } }))}>+ Create Industry Manager</Button>
      </div>

      {/* PERFORMANCE TABLE — same columns as the Founder's Staff-by-Staff table */}
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
            {[...new Set(industryManagers.map(m => m.state || user.state).filter(Boolean))].map(st => (
              <option key={st} value={st}>{st}</option>
            ))}
          </select>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted text-[14px]">🔍</span>
            <input
              type="text"
              placeholder="Search name or industry..."
              className="pl-9 pr-4 py-1.5 bg-surface2 border border-border rounded-lg text-[11px] font-bold focus:ring-2 focus:ring-blue/10 outline-none w-56 transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
      </div>

      <ManagerPerformanceTable
        rows={filteredManagers}
        fallbackState={user.state}
        onRowClick={(m) => navigate(`/dashboard/executives/${m._id}`)}
        emptyMessage={`No industry managers assigned to ${user.state} portfolio.`}
        renderActions={(m) => (
          <>
            <Button
              size="2xs"
              variant="outline"
              className="bg-white border-border shadow-sm text-text-primary px-3 font-bold"
              onClick={() => window.dispatchEvent(new CustomEvent('open-modal', { detail: { type: 'create-exec', editData: m.user || m } }))}
            >
              View Details
            </Button>
            <Button
              size="2xs"
              variant="outline"
              className="bg-amber/5 border-amber/20 text-amber shadow-sm hover:bg-amber/10 px-3 font-bold"
              onClick={() => escalateMutation.mutate(m._id)}
            >
              Escalate
            </Button>
          </>
        )}
      />

    </div>
  );
};

export default IndustryManagers;
