import React, { useEffect, useState } from 'react';
import { useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import DashboardSkeleton from '../../../components/skeletons/DashboardSkeleton';
import { dashboardApi } from '../../../api/dashboardApi';
import { usersApi } from '../../../api/usersApi';
import { Button } from '../../../components/ui';
import { usePeriod, PeriodPicker } from '../../../components/LeadPipelinePanel';

const EMPTY_PERF = { workPct: 0, leads: 0, periodLeads: 0, meetings: 0, blocking: 0, revenue: 0 };

const DistrictExecutives = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [filterState, setFilterState] = useState('All');
  const picker = usePeriod('today');
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
  const activeExecs = (executives || []).filter(u => u.isActive !== false);
  const rows = activeExecs
    .filter(u => filterState === 'All' || u.state === filterState)
    .map(u => ({ ...EMPTY_PERF, ...perfById.get(String(u._id)), _id: u._id, name: u.name, state: u.state, industry: u.industry, user: u }));

  return (
    <div className="animate-in fade-in duration-500">
      <div className="flex items-center gap-2 mb-4 text-[11px] font-bold uppercase tracking-widest text-text-muted">
        <span>Founder</span>
        <span className="text-text-muted/30">›</span>
        <span className="text-text-primary">District Managers</span>
      </div>

      <div className="flex justify-between items-end mb-6">
        <div>
          <div className="text-[20px] font-bold text-text-primary">District Managers</div>
          <div className="text-[12px] text-text-muted mt-1">Performance summary · Lead handling · Attendance · Click row to drill in</div>
        </div>
        <div className="flex gap-2">
          <Button size="sm" className="bg-[#0f766e] hover:bg-[#0d645e] text-white border-none shadow-sm font-semibold" onClick={() => openModal('create-exec', { role: 'executive' })}>+ District Manager</Button>
        </div>
      </div>

      <div className="flex flex-wrap justify-between items-end gap-3 mb-4">
        <div>
          <div className="text-[15px] font-bold text-text-primary">Staff-by-Staff Performance</div>
          <div className="text-[12px] text-text-muted mt-0.5">Work %, Leads, Meetings, Blockings and Revenue for the selected period</div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <PeriodPicker {...picker} />
          <select
            className="bg-white border border-border rounded-xl px-3 py-1.5 text-[12px] font-bold text-text-secondary outline-none focus:border-blue shadow-sm"
            value={filterState}
            onChange={e => setFilterState(e.target.value)}
          >
            <option value="All">All States</option>
            {[...new Set(activeExecs.map(e => e.state).filter(Boolean))].map(s => <option key={s} value={s}>{s}</option>)}
          </select>
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
                <th className="p-4 text-center">Leads</th>
                <th className="p-4 text-center">Meetings</th>
                <th className="p-4 text-center">Blockings</th>
                <th className="p-4 text-center">Revenue</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border normal-case font-medium text-text-primary">
              {rows.map(m => (
                <tr
                  key={m._id}
                  className="hover:bg-surface2/30 transition-colors cursor-pointer group"
                  onClick={() => navigate(`/dashboard/executives/${m._id}`)}
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
                  <td className="p-4 text-center text-[12px] font-mono">{m.periodLeads}</td>
                  <td className="p-4 text-center text-[12px] font-mono">{m.meetings}</td>
                  <td className="p-4 text-center text-[12px] font-mono">{m.blocking}</td>
                  <td className="p-4 text-center text-[12px] font-mono font-bold text-blue">
                    ₹{m.revenue >= 100000 ? (m.revenue / 100000).toFixed(1) + 'L' : m.revenue.toLocaleString()}
                  </td>
                  <td className="p-4 text-right">
                    <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                      <Button size="xs" variant="outline" className="bg-white border-border shadow-sm text-text-primary px-3 font-bold" onClick={() => openModal('create-exec', { editData: m.user })}>Edit</Button>
                      <Button size="xs" variant="outline" className="bg-amber/5 border-amber/20 text-amber shadow-sm hover:bg-amber/10 px-3 font-bold" onClick={() => openModal('leave-history', { user: m.user })}>Leave</Button>
                      <Button size="xs" variant="outline" className="bg-red/5 border-red/20 text-red shadow-sm hover:bg-red/10 px-3 font-bold" onClick={() => handleDelete(m)}>Delete</Button>
                    </div>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr><td colSpan="9" className="p-12 text-center text-text-muted italic normal-case">No district managers found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default DistrictExecutives;
