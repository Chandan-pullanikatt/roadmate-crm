import React, { useState, useMemo, useEffect } from 'react';
import { useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import DashboardSkeleton from '../../../components/skeletons/DashboardSkeleton';
import { dashboardApi } from '../../../api/dashboardApi';
import { leaveApi } from '../../../api/leaveApi';
import { Button, Tag } from '../../../components/ui';
import { usePeriod, PeriodPicker } from '../../../components/LeadPipelinePanel';
import { ActiveFilter, matchesActiveFilter } from '../../../components/ActiveStatusControls';
import ManagerPerformanceTable from '../../../components/ManagerPerformanceTable';

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
          <div className="section-sub text-[13px]">All district managers across industries - Performance overview</div>
        </div>
        <Button className="bg-blue text-white shadow-sm" size="sm" onClick={() => window.dispatchEvent(new CustomEvent('open-modal', { detail: { type: 'create-exec', role: 'executive' } }))}>+ Add District Manager</Button>
      </div>

      {/* PERFORMANCE TABLE — same columns as the Industry Managers page */}
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
            {[...new Set(executives.map(e => e.state || user.state).filter(Boolean))].map(st => (
              <option key={st} value={st}>{st}</option>
            ))}
          </select>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted text-[14px]">🔍</span>
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

      <ManagerPerformanceTable
        rows={filteredExecs}
        fallbackState={user.state}
        showDistrict
        emptyMessage="No district managers match the current filters."
        renderActions={(e) => {
          const pending = pendingLeaveMap[String(e._id)] || 0;
          return (
            <>
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
                size="2xs"
                variant="outline"
                className="bg-white border-border shadow-sm text-text-primary px-3 font-bold"
                onClick={() => window.dispatchEvent(new CustomEvent('open-modal', { detail: { type: 'create-exec', editData: e.user || e } }))}
              >
                View Details
              </Button>
            </>
          );
        }}
      />
    </div>
  );
};

export default Executives;

