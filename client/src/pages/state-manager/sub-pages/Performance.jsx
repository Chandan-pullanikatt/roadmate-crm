import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import DashboardSkeleton from '../../../components/skeletons/DashboardSkeleton';
import { dashboardApi } from '../../../api/dashboardApi';
import { Button, Tag } from '../../../components/ui';
import ManagerPerformanceTable from '../../../components/ManagerPerformanceTable';

const Performance = () => {
  const navigate = useNavigate();
  const { data: dashData, isLoading } = useQuery({
    queryKey: ['dashboard', 'state-manager'],
    queryFn: () => dashboardApi.getStateManagerDashboard().then(res => res.data),
    staleTime: 5 * 60 * 1000,
    placeholderData: keepPreviousData
  });

  if (isLoading) return <DashboardSkeleton />;

  const managers = dashData?.industryManagers || [];
  const user = dashData?.user || {};
  
  // Aggregate top performers
  const topRevenue = [...managers].sort((a, b) => (b.revenue || 0) - (a.revenue || 0))[0];
  const topCalls = [...managers].sort((a, b) => (b.calls || 0) - (a.calls || 0))[0];
  const topConv = [...managers].sort((a, b) => (b.conversions || 0) - (a.conversions || 0))[0];
  const topEfficiency = [...managers].sort((a, b) => (b.efficiency || 0) - (a.efficiency || 0))[0];

  return (
    <div className="animate-in fade-in duration-500">
      <div className="section-header">
        <div>
          <div className="section-title">Performance Analytics</div>
          <div className="section-sub">Cross-industry performance comparison and leaderboard for {user.state}</div>
        </div>
      </div>

      <div className="stat-grid mb-6">
        <div className="stat-card">
          <div className="stat-label">Top Revenue</div>
          <div className="stat-value" style={{ color: 'var(--accent)' }}>{"\u20B9"}{topRevenue?.revenue?.toLocaleString() || '0'}</div>
          <div className="stat-delta">{topRevenue?.name || 'N/A'} {"\u00B7"} {topRevenue?.industry}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Most Calls</div>
          <div className="stat-value" style={{ color: 'var(--blue)' }}>{topCalls?.calls || 0}</div>
          <div className="stat-delta">{topCalls?.name || 'N/A'} {"\u00B7"} {topCalls?.industry}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Most Converted</div>
          <div className="stat-value" style={{ color: 'var(--amber)' }}>{topConv?.conversions || 0}</div>
          <div className="stat-delta">{topConv?.name || 'N/A'} {"\u00B7"} {topConv?.industry}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Best Efficiency</div>
          <div className="stat-value" style={{ color: 'var(--teal)' }}>{topEfficiency?.efficiency || 0}%</div>
          <div className="stat-delta">{topEfficiency?.name || 'N/A'} {"\u00B7"} {topEfficiency?.industry}</div>
        </div>
      </div>

      <div className="flex flex-wrap justify-between items-end gap-3 mb-4">
        <div>
          <div className="text-[15px] font-bold text-text-primary">Team Performance Leaderboard</div>
          <div className="text-[14px] text-text-muted mt-0.5">Work %, Leads, Direct &amp; Virtual Meetings, Blockings and Revenue · click a column header to sort, a row to drill in</div>
        </div>
        <Button variant="outline" size="sm">Export Detailed CSV</Button>
      </div>

      <ManagerPerformanceTable
        rows={managers}
        fallbackState={user.state}
        sortable
        onRowClick={(m) => navigate(`/dashboard/executives/${m._id}`)}
        emptyMessage="No performance data available"
        renderActions={(m) => (
          <Tag
            variant={(m.efficiency || 0) >= 80 ? 'green' : (m.efficiency || 0) >= 50 ? 'amber' : 'red'}
            label={(m.efficiency || 0) >= 80 ? 'ON TRACK' : (m.efficiency || 0) >= 50 ? 'AVERAGE' : 'LOW'}
          />
        )}
      />
    </div>
  );
};

export default Performance;

