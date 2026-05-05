import React, { useState } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import DashboardSkeleton from '../../../components/skeletons/DashboardSkeleton';
import { dashboardApi } from '../../../api/dashboardApi';
import { Avatar, Button, Tag, DataTable } from '../../../components/ui';

const Performance = () => {
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

  const columns = [
    {
      header: 'Staff Name',
      accessor: 'name',
      render: (val, row) => (
        <div className="flex items-center gap-3">
          <Avatar name={val} size="sm" />
          <span className="font-bold text-[14px]">{val}</span>
        </div>
      )
    },
    {
      header: 'Industry / State',
      accessor: 'industry',
      render: (val, row) => (
        <div>
          <div className="text-[13px] font-medium">{val}</div>
          <div className="text-[11px] text-text-muted">{user.state} State</div>
        </div>
      )
    },
    {
      header: 'Work Efficiency',
      accessor: 'efficiency',
      render: (val) => (
        <div className="flex items-center gap-3">
          <div className="h-1.5 w-20 bg-surface2 rounded-full overflow-hidden border border-border">
            <div className={`h-full transition-all ${val >= 80 ? 'bg-accent' : val >= 50 ? 'bg-amber' : 'bg-red'}`} style={{ width: `${val || 0}%` }}></div>
          </div>
          <span className="text-[11px] mono font-bold">{val || 0}%</span>
        </div>
      )
    },
    { header: 'Calls', accessor: 'calls', render: (val) => <span className="mono text-[11px] font-bold text-blue">{val || 0}</span> },
    { header: 'Conv', accessor: 'conversions', render: (val) => <span className="mono text-[11px] font-bold text-accent">{val || 0}</span> },
    { 
      header: 'Revenue', 
      accessor: 'revenue', 
      render: (val) => <span className="mono text-[11px] font-bold text-teal">{"\u20B9"}{val?.toLocaleString() || '0'}</span> 
    },
    {
      header: 'Status',
      accessor: 'efficiency',
      render: (val) => (
        <Tag 
          variant={val >= 80 ? 'green' : val >= 50 ? 'amber' : 'red'} 
          label={val >= 80 ? 'ON TRACK' : val >= 50 ? 'AVERAGE' : 'LOW'} 
        />
      ),
      align: 'right'
    }
  ];

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

      <div className="card">
        <div className="card-header border-b border-border bg-surface2/10">
          <div className="section-title text-sm">Team Performance Leaderboard</div>
          <Button variant="outline" size="sm">Export Detailed CSV</Button>
        </div>
        
        <DataTable 
          columns={columns}
          data={managers}
          isLoading={isLoading}
          emptyMessage="No performance data available"
        />
      </div>
    </div>
  );
};

export default Performance;

