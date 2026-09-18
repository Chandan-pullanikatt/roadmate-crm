import React, { useState, useMemo, useEffect } from 'react';
import { useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import DashboardSkeleton from '../../../components/skeletons/DashboardSkeleton';
import { dashboardApi } from '../../../api/dashboardApi';
import { leaveApi } from '../../../api/leaveApi';
import { Avatar, Button, Tag } from '../../../components/ui';
import { usePeriod, PeriodPicker } from '../../../components/LeadPipelinePanel';
import { ActiveFilter, matchesActiveFilter } from '../../../components/ActiveStatusControls';

const Executives = () => {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const handleRefresh = () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard', 'state-manager'] });
    };
    window.addEventListener('refresh-users', handleRefresh);
    return () => window.removeEventListener('refresh-users', handleRefresh);
  }, [queryClient]);

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

  const { data: pendingLeaves = [] } = useQuery({
    queryKey: ['leaves', 'pending'],
    queryFn: () => leaveApi.getPendingLeaves().then(r => r.data || []),
    staleTime: 2 * 60 * 1000,
  });

  const pendingLeaveMap = useMemo(() => {
    const map = {};
    pendingLeaves.forEach(l => {
      const uid = l.user?._id || l.user;
      if (uid) map[String(uid)] = (map[String(uid)] || 0) + 1;
    });
    return map;
  }, [pendingLeaves]);

  if (dashLoading) return <DashboardSkeleton />;

  const user = dashData?.user || {};
  const executives = dashData?.executivePerformance || [];

  const filteredExecs = executives.filter(e => {
    if (!matchesActiveFilter(e.user || e, showInactive)) return false;
    if (filterState !== 'All' && (e.state || user.state) !== filterState) return false;
    return !searchTerm ||
      e.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (e.district && e.district.toLowerCase().includes(searchTerm.toLowerCase()));
  });

  return (
    <div className="animate-in fade-in duration-500">
      {/* HEADER */}
      <div className="section-header mb-6">
        <div>
          <div className="section-title">District Managers · {user.state}</div>
          <div className="section-sub text-[13px]">All executives across industries - Performance overview</div>
        </div>
        <Button className="bg-blue text-white shadow-sm" size="sm" onClick={() => window.dispatchEvent(new CustomEvent('open-modal', { detail: { type: 'create-exec', role: 'executive' } }))}>+ Add District Manager</Button>
      </div>

      {/* PERFORMANCE TABLE — same columns as the Industry Managers page */}
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
            {[...new Set(executives.map(e => e.state || user.state).filter(Boolean))].map(st => (
              <option key={st} value={st}>{st}</option>
            ))}
          </select>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted text-xs">🔍</span>
            <input
              type="text"
              placeholder="Search name or district..."
              className="pl-9 pr-4 py-1.5 bg-surface2 border border-border rounded-lg text-[11px] font-bold focus:ring-2 focus:ring-blue/10 outline-none w-56 transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
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
              {filteredExecs.map((e) => {
                const workPct = e.workPct ?? e.completionPct ?? 0;
                const revenue = e.revenue || 0;
                const pending = pendingLeaveMap[String(e._id)] || 0;
                return (
                  <tr key={e._id} className="hover:bg-surface2/30 transition-colors group">
                    <td className="p-4 font-bold text-[13px] group-hover:text-blue transition-colors">
                      {e.name}
                      {e.district && <span className="block text-[10px] font-medium text-text-muted normal-case mt-0.5">{e.district}</span>}
                    </td>
                    <td className="p-4 text-center">
                      <span className="bg-blue/10 text-blue px-2 py-0.5 rounded text-[10px] font-bold">{e.state || user.state}</span>
                    </td>
                    <td className="p-4 text-[12px] text-text-secondary">{e.industry || '—'}</td>
                    <td className="p-4">
                      <div className="flex items-center gap-2 justify-center">
                        <div className="w-8 h-1.5 bg-surface2 rounded-full overflow-hidden">
                          <div className={`h-full ${workPct >= 80 ? 'bg-[#0f766e]' : workPct >= 60 ? 'bg-[#ea580c]' : 'bg-[#dc2626]'}`} style={{ width: `${workPct}%` }}></div>
                        </div>
                        <span className="font-bold text-[12px]">{workPct}%</span>
                      </div>
                    </td>
                    <td className="p-4 text-center text-[12px] font-mono">{e.calls || 0}</td>
                    <td className="p-4 text-center text-[12px] font-mono">{e.meetings || 0}</td>
                    <td className="p-4 text-center text-[12px] font-mono">{e.followups || 0}</td>
                    <td className="p-4 text-center text-[12px] font-mono font-bold text-blue">
                      {"₹"}{revenue >= 100000 ? (revenue / 100000).toFixed(1) + 'L' : revenue.toLocaleString()}
                    </td>
                    <td className="p-4 text-center text-[12px] font-mono">{e.leaves || 0}</td>
                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {pending > 0 && (
                          <span className="px-2 py-0.5 bg-red/10 text-red rounded-full text-[10px] font-bold border border-red/20 normal-case">
                            {pending} leave pending
                          </span>
                        )}
                        <Tag
                          variant={e.status === 'Active' ? 'green' : 'amber'}
                          label={(e.status || '').toUpperCase()}
                          className="font-black text-[9px] tracking-widest"
                        />
                        <Button
                          size="xs"
                          variant="outline"
                          className="bg-white border-border shadow-sm text-text-primary px-3 font-bold"
                          onClick={() => window.dispatchEvent(new CustomEvent('open-modal', { detail: { type: 'create-exec', editData: e.user || e } }))}
                        >
                          View Details
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filteredExecs.length === 0 && (
                <tr><td colSpan="10" className="p-12 text-center text-text-muted italic normal-case">No district managers match the current filters.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Executives;

