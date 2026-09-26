import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Tag, DashboardSkeleton } from '../../../components/ui';
import { dashboardApi } from '../../../api/dashboardApi';
import ManagerPerformanceTable from '../../../components/ManagerPerformanceTable';

const Performance = () => {
  const navigate = useNavigate();
  const { data: dashData, isLoading } = useQuery({
    queryKey: ['dashboard', 'industry-manager'],
    queryFn: () => dashboardApi.getIndustryManagerDashboard().then(res => res.data),
    staleTime: 5 * 60 * 1000,
    placeholderData: (prev) => prev
  });

  const executives = useMemo(() => dashData?.executivePerformance || [], [dashData]);
  const userInfo = dashData?.user || {};

  // Calculate Winners for Stat Cards
  const topPerformer = useMemo(() => {
    if (!executives.length) return null;
    return [...executives].sort((a, b) => b.converted - a.converted || b.completionPct - a.completionPct)[0];
  }, [executives]);

  const bestRevenue = useMemo(() => {
    if (!executives.length) return null;
    return [...executives].sort((a, b) => b.revenue - a.revenue)[0];
  }, [executives]);

  const mostCalls = useMemo(() => {
    if (!executives.length) return null;
    return [...executives].sort((a, b) => b.calls - a.calls)[0];
  }, [executives]);

  const mostFollowups = useMemo(() => {
    if (!executives.length) return null;
    return [...executives].sort((a, b) => b.followupsCount - a.followupsCount)[0];
  }, [executives]);

  const formatCurrency = (val) => {
    if (val >= 100000) return `₹${(val / 100000).toFixed(1)}L`;
    if (val >= 1000) return `₹${(val / 1000).toFixed(1)}K`;
    return `₹${val}`;
  };

  if (isLoading && !dashData) return <DashboardSkeleton />;

  return (
    <div className="space-y-6 animate-in fade-in duration-700 pb-12">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Staff Performance</h1>
          <p className="text-[16px] text-text-muted">Industry Manager · {userInfo.industry} · All district managers</p>
        </div>
      </div>

      {/* Sub Header */}
      <div className="bg-surface1 border border-border/40 rounded-2xl p-6 shadow-sm">
        <h2 className="text-lg font-bold">Staff Performance - {userInfo.industry} - {userInfo.state}</h2>
        <p className="text-[14px] text-text-muted">Work % · Leads · Direct &amp; Virtual Meetings · Blockings · Revenue</p>
      </div>

      {/* Top 4 Performance Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Top Performer */}
        <div className="card p-6 border-l-4 border-purple shadow-sm hover:shadow-md transition-shadow">
            <div className="text-[12px] font-bold text-text-muted uppercase tracking-widest mb-3">Top Performer</div>
            <div className="flex items-center gap-4">
                <div className="text-xl font-black text-purple">{topPerformer?.name || '—'}</div>
            </div>
            <div className="mt-2 text-[14px] font-bold text-text-muted">
                <span className="text-purple">{topPerformer?.completionPct || 0}% Work</span> · {topPerformer?.converted || 0} Conv.
            </div>
        </div>

        {/* Best Revenue */}
        <div className="card p-6 border-l-4 border-green shadow-sm hover:shadow-md transition-shadow">
            <div className="text-[12px] font-bold text-text-muted uppercase tracking-widest mb-3">Best Revenue</div>
            <div className="text-2xl font-black text-text-primary">{formatCurrency(bestRevenue?.revenue || 0)}</div>
            <div className="mt-2 text-[12px] font-bold text-text-muted">
                {bestRevenue?.name} · {bestRevenue?.district}
            </div>
        </div>

        {/* Most Calls */}
        <div className="card p-6 border-l-4 border-blue shadow-sm hover:shadow-md transition-shadow">
            <div className="text-[12px] font-bold text-text-muted uppercase tracking-widest mb-3">Most Calls</div>
            <div className="text-2xl font-black text-text-primary">{mostCalls?.calls || 0}</div>
            <div className="mt-2 text-[12px] font-bold text-text-muted">
                {mostCalls?.name} · {mostCalls?.district}
            </div>
        </div>

        {/* Most Follow-ups */}
        <div className="card p-6 border-l-4 border-amber shadow-sm hover:shadow-md transition-shadow">
            <div className="text-[12px] font-bold text-text-muted uppercase tracking-widest mb-3">Most Follow-ups</div>
            <div className="text-2xl font-black text-text-primary">{mostFollowups?.followupsCount || 0}</div>
            <div className="mt-2 text-[12px] font-bold text-text-muted">
                {mostFollowups?.name} · {mostFollowups?.district}
            </div>
        </div>
      </div>

      {/* Detail Table */}
      <div>
        <div className="text-[15px] font-bold text-text-primary mb-1">Staff-by-Staff Detail Report</div>
        <div className="text-[14px] text-text-muted mb-4">Click a column header to sort, a row to open that manager's profile</div>
        <ManagerPerformanceTable
          rows={executives}
          fallbackState={userInfo.state}
          showDistrict
          sortable
          onRowClick={(exec) => navigate(`/dashboard/executives/${exec._id}`)}
          emptyMessage="No district managers found"
          renderActions={(exec) => (
            <Tag
              variant={exec.isWorking ? 'green' : 'amber'}
              label={exec.isWorking ? 'Active' : 'On Leave'}
              className="text-[9px] font-black px-3 py-1 rounded-lg uppercase tracking-tighter"
            />
          )}
        />
      </div>
    </div>
  );
};

export default Performance;
