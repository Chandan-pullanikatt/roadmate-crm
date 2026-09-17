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

const EMPTY_PERF = { workPct: 0, calls: 0, meetings: 0, followups: 0, revenue: 0, leaves: 0 };

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
      'Calls': m.calls,
      'Meetings': m.meetings,
      'Follow-ups': m.followups,
      'Revenue': m.revenue,
      'Leave Days': m.leaves
    })), 'State_Managers_Report');
  };

  return (
    <div className="animate-in fade-in duration-500">
      <div className="flex items-center gap-2 mb-4 text-[11px] font-bold uppercase tracking-widest text-text-muted">
        <span>Founder</span>
        <span className="text-text-muted/30">›</span>
        <span className="text-text-primary">State Managers</span>
      </div>

      <div className="flex justify-between items-end mb-6">
        <div>
          <div className="text-[20px] font-bold text-text-primary">All State Managers</div>
          <div className="text-[12px] text-text-muted mt-1">Summary of each state manager's dashboard · Click row to drill in</div>
        </div>
        <div className="flex gap-2">
          <Button size="sm" className="bg-[#0f766e] hover:bg-[#0d645e] text-white border-none shadow-sm font-semibold" onClick={() => openModal('create-state-manager')}>+ State Manager</Button>
        </div>
      </div>

      <div className="flex flex-wrap justify-between items-end gap-3 mb-4">
        <div>
          <div className="text-[15px] font-bold text-text-primary">Staff-by-Staff Performance</div>
          <div className="text-[12px] text-text-muted mt-0.5">Work %, Calls, Meetings, Follow-ups, Revenue and approved leave days for the selected period</div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ActiveFilter showInactive={showInactive} onChange={setShowInactive} />
          <PeriodPicker {...picker} />
          <select
            className="bg-white border border-border rounded-xl px-3 py-1.5 text-[12px] font-bold text-text-secondary outline-none focus:border-blue shadow-sm"
            value={filterState}
            onChange={e => setFilterState(e.target.value)}
          >
            <option value="All">All States</option>
            {[...new Set((managers || []).map(m => m.state).filter(Boolean))].map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <Button variant="outline" size="sm" className="bg-white text-text-primary font-bold" onClick={handleExport}>Export</Button>
        </div>
      </div>

      <div className="card overflow-hidden mb-8 border border-border bg-white rounded-xl shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-[11px] uppercase tracking-wider font-bold text-text-muted">
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
              {rows.map(m => {
                const { user } = m;
                return (
                  <tr
                    key={m._id}
                    className="hover:bg-surface2/30 transition-colors cursor-pointer group"
                    onClick={() => navigate(`/dashboard/state-managers/${m._id}`)}
                  >
                    <td className="p-4 font-bold text-[13px] group-hover:text-blue transition-colors">{m.name}</td>
                    <td className="p-4 text-center">
                      {m.state && <span className="bg-blue/10 text-blue px-2 py-0.5 rounded text-[10px] font-bold">{m.state}</span>}
                    </td>
                    <td className="p-4 text-[12px] text-text-secondary">{m.industry || '—'}</td>
                    <td className="p-4">
                      <div className="flex items-center gap-2 justify-center">
                        <div className="w-8 h-1.5 bg-surface2 rounded-full overflow-hidden">
                          <div className={`h-full ${m.workPct >= 80 ? 'bg-[#0f766e]' : m.workPct >= 60 ? 'bg-[#ea580c]' : 'bg-[#dc2626]'}`} style={{ width: `${m.workPct}%` }}></div>
                        </div>
                        <span className="font-bold text-[12px]">{m.workPct}%</span>
                      </div>
                    </td>
                    <td className="p-4 text-center text-[12px] font-mono">{m.calls}</td>
                    <td className="p-4 text-center text-[12px] font-mono">{m.meetings}</td>
                    <td className="p-4 text-center text-[12px] font-mono">{m.followups}</td>
                    <td className="p-4 text-center text-[12px] font-mono font-bold text-blue">
                      ₹{m.revenue >= 100000 ? (m.revenue / 100000).toFixed(1) + 'L' : m.revenue.toLocaleString()}
                    </td>
                    <td className="p-4 text-center text-[12px] font-mono">{m.leaves}</td>
                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                        <Button size="xs" variant="outline" className="bg-white border-border shadow-sm text-text-primary px-3 font-bold" onClick={() => openModal('create-state-manager', { editData: user })}>Edit</Button>
                        <Button size="xs" variant="outline" className="bg-amber/5 border-amber/20 text-amber shadow-sm hover:bg-amber/10 px-3 font-bold" onClick={() => openModal('leave-history', { user })}>Leave</Button>
                        <ActiveToggleButton user={user} />
                        <Button size="xs" variant="outline" className="bg-red/5 border-red/20 text-red shadow-sm hover:bg-red/10 px-3 font-bold" onClick={() => handleDelete(m._id, m.name)}>Delete</Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {rows.length === 0 && (
                <tr><td colSpan="10" className="p-12 text-center text-text-muted italic normal-case">{showInactive ? 'No inactive state managers.' : 'No state managers found.'}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default StateManagers;
