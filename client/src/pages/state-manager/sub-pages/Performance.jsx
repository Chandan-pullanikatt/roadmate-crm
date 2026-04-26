import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { dashboardApi } from '../../../api/dashboardApi';
import { Avatar, Button, Tag, DataTable } from '../../../components/ui';

const Performance = () => {
  const [viewType, setViewType] = useState('monthly');

  const { data: dashData, isLoading } = useQuery({
    queryKey: ['dashboard', 'state-manager', viewType],
    queryFn: () => dashboardApi.getStateManagerDashboard().then(res => res.data)
  });

  if (isLoading) return <div className="p-8 text-center text-text-muted">Analyzing team performance...</div>;

  const managers = dashData?.industryManagers || [];
  
  // Aggregate top performers (logic based on mock for now, but wired to dashData)
  const topRevenue = managers.sort((a, b) => (b.revenue || 0) - (a.revenue || 0))[0];
  const topCalls = managers.sort((a, b) => (b.callsToday || 0) - (a.callsToday || 0))[0];
  const topConv = managers.sort((a, b) => (b.conversionsTotal || 0) - (a.conversionsTotal || 0))[0];
  const topEfficiency = managers.sort((a, b) => (b.completionPct || 0) - (a.completionPct || 0))[0];

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
      header: 'Industry / District',
      accessor: 'industry',
      render: (val, row) => (
        <div>
          <div className="text-[13px] font-medium">{val}</div>
          <div className="text-[11px] text-text-muted">Kerala State</div>
        </div>
      )
    },
    {
      header: 'Work Efficiency',
      accessor: 'completionPct',
      render: (val) => (
        <div className="flex items-center gap-3">
          <div className="h-1.5 w-20 bg-surface2 rounded-full overflow-hidden border border-border">
            <div className={`h-full transition-all ${val >= 80 ? 'bg-accent' : val >= 50 ? 'bg-amber' : 'bg-red'}`} style={{ width: `${val || 0}%` }}></div>
          </div>
          <span className="text-[11px] mono font-bold">{val || 0}%</span>
        </div>
      )
    },
    { header: 'Calls', accessor: 'callsToday', render: (val) => <span className="mono text-[11px] font-bold text-blue">{val || 0}</span> },
    { header: 'Conv', accessor: 'conversionsTotal', render: (val) => <span className="mono text-[11px] font-bold text-accent">{val || 0}</span> },
    { 
      header: 'Revenue', 
      accessor: 'revenue', 
      render: (val) => <span className="mono text-[11px] font-bold text-teal">₹{val?.toLocaleString() || '0'}</span> 
    },
    {
      header: 'Status',
      accessor: 'completionPct',
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
          <div className="section-sub">Cross-industry performance comparison and leaderboard for {dashData?.user?.state}</div>
        </div>
        <div className="flex bg-surface2 p-1 rounded-xl border border-border">
          {['daily', 'weekly', 'monthly'].map(type => (
            <button 
              key={type}
              onClick={() => setViewType(type)}
              className={`px-6 py-1.5 text-[10px] font-bold uppercase tracking-widest rounded-lg transition-all ${viewType === type ? 'bg-surface text-purple shadow-sm' : 'text-text-muted hover:text-text-secondary'}`}
            >
              {type}
            </button>
          ))}
        </div>
      </div>

      <div className="stat-grid mb-6">
        <div className="stat-card">
          <div className="stat-label">Top Revenue</div>
          <div className="stat-value" style={{ color: 'var(--accent)' }}>₹{topRevenue?.revenue?.toLocaleString() || '0'}</div>
          <div className="stat-delta">{topRevenue?.name || 'N/A'} · {topRevenue?.industry}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Most Calls</div>
          <div className="stat-value" style={{ color: 'var(--blue)' }}>{topCalls?.callsToday || 0}</div>
          <div className="stat-delta">{topCalls?.name || 'N/A'} · {topCalls?.industry}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Most Converted</div>
          <div className="stat-value" style={{ color: 'var(--amber)' }}>{topConv?.conversionsTotal || 0}</div>
          <div className="stat-delta">{topConv?.name || 'N/A'} · {topConv?.industry}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Best Efficiency</div>
          <div className="stat-value" style={{ color: 'var(--teal)' }}>{topEfficiency?.completionPct || 0}%</div>
          <div className="stat-delta">{topEfficiency?.name || 'N/A'} · {topEfficiency?.industry}</div>
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
