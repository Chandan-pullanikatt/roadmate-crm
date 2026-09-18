import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import DashboardSkeleton from '../../../components/skeletons/DashboardSkeleton';
import { usersApi } from '../../../api/usersApi';
import { dashboardApi } from '../../../api/dashboardApi';
import { Avatar, Button, Tag } from '../../../components/ui';
import { usePeriod, PeriodPicker } from '../../../components/LeadPipelinePanel';
import { ActiveFilter, matchesActiveFilter } from '../../../components/ActiveStatusControls';
import { toast } from 'react-hot-toast';

const IndustryManagers = () => {
  const queryClient = useQueryClient();
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
      calls: performance.calls ?? manager.calls ?? 0,
      meetings: performance.meetings ?? manager.meetings ?? 0,
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
          <div className="section-sub text-[13px]">All {stats.industryManagersCount || 0} industries - Full drill-in view</div>
        </div>
        <Button className="bg-blue text-white shadow-sm" size="sm" onClick={() => window.dispatchEvent(new CustomEvent('open-modal', { detail: { type: 'create-exec', role: 'industry-manager' } }))}>+ Create Industry Manager</Button>
      </div>

      {/* PERFORMANCE TABLE — same columns as the Founder's Staff-by-Staff table */}
      <div className="flex flex-wrap justify-between items-end gap-3 mb-4">
        <div>
          <div className="text-[15px] font-bold text-text-primary">Staff-by-Staff Performance</div>
          <div className="text-[14px] text-text-muted mt-0.5">Work %, Calls, Meetings, Follow-ups, Revenue and approved leave days for the selected period</div>
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

      <div className="card overflow-hidden mb-8 border border-border bg-white rounded-xl shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-[13px] uppercase tracking-wider font-bold text-text-muted">
            <thead>
              <tr className="bg-surface2/50 border-b border-border">
                <th className="p-4">Manager</th>
                <th className="p-4 text-center">State</th>
                <th className="p-4">Industry</th>
                <th className="p-4 text-center">Work %</th>
                <th className="p-4 text-center">Calls</th>
                <th className="p-4 text-center">Meetings</th>
                <th className="p-4 text-center">Follow-ups</th>
                <th className="p-4 text-center">Revenue</th>
                <th className="p-4 text-center">Leaves</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border normal-case font-medium text-text-primary">
              {filteredManagers.map((m) => {
                const workPct = m.workPct || 0;
                const revenue = m.revenue || 0;
                return (
                  <tr key={m._id} className="hover:bg-surface2/30 transition-colors group">
                    <td className="p-4 font-bold text-[13px] group-hover:text-blue transition-colors">{m.name}</td>
                    <td className="p-4 text-center">
                      <span className="bg-blue/10 text-blue px-2 py-0.5 rounded text-[10px] font-bold">{m.state || user.state}</span>
                    </td>
                    <td className="p-4 text-[14px] text-text-secondary">{m.industry || '—'}</td>
                    <td className="p-4">
                      <div className="flex items-center gap-2 justify-center">
                        <div className="w-8 h-1.5 bg-surface2 rounded-full overflow-hidden">
                          <div className={`h-full ${workPct >= 80 ? 'bg-[#0f766e]' : workPct >= 60 ? 'bg-[#ea580c]' : 'bg-[#dc2626]'}`} style={{ width: `${workPct}%` }}></div>
                        </div>
                        <span className="font-bold text-[12px]">{workPct}%</span>
                      </div>
                    </td>
                    <td className="p-4 text-center text-[12px] font-mono">{m.calls || 0}</td>
                    <td className="p-4 text-center text-[12px] font-mono">{m.meetings || 0}</td>
                    <td className="p-4 text-center text-[12px] font-mono">{m.followups || 0}</td>
                    <td className="p-4 text-center text-[12px] font-mono font-bold text-blue">
                      {"₹"}{revenue >= 100000 ? (revenue / 100000).toFixed(1) + 'L' : revenue.toLocaleString()}
                    </td>
                    <td className="p-4 text-center text-[12px] font-mono">{m.leaves || 0}</td>
                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          size="xs"
                          variant="outline"
                          className="bg-white border-border shadow-sm text-text-primary px-3 font-bold"
                          onClick={() => window.dispatchEvent(new CustomEvent('open-modal', { detail: { type: 'create-exec', editData: m.user || m } }))}
                        >
                          View Details
                        </Button>
                        <Button
                          size="xs"
                          variant="outline"
                          className="bg-amber/5 border-amber/20 text-amber shadow-sm hover:bg-amber/10 px-3 font-bold"
                          onClick={() => escalateMutation.mutate(m._id)}
                        >
                          Escalate
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filteredManagers.length === 0 && (
                <tr><td colSpan="10" className="p-12 text-center text-text-muted italic normal-case">No industry managers assigned to {user.state} portfolio.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};

export default IndustryManagers;
