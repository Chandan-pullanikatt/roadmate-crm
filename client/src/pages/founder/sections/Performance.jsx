import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { dashboardApi } from '../../../api/dashboardApi';
import { Avatar, Button, Tag, DataTable } from '../../../components/ui';

const Performance = () => {
  const [viewType, setViewType] = useState('monthly');

  const { data: dashData, isLoading } = useQuery({
    queryKey: ['dashboard', 'founder', viewType],
    queryFn: () => dashboardApi.getFounderDashboard(viewType).then(res => res.data)
  });

  if (isLoading) return <div className="p-8 text-center text-text-muted">Analyzing platform performance...</div>;

  const stats = dashData?.stats || {};
  const managers = dashData?.stateManagers || [];

  const columns = [
    {
      header: 'Manager / Region',
      accessor: 'name',
      render: (val, row) => (
        <div className="flex items-center gap-3">
          <Avatar name={val} size="sm" className="av-state" />
          <div>
            <div className="font-bold text-[13px]">{val}</div>
            <div className="text-[10px] text-text-muted uppercase">📍 {row.state} Head</div>
          </div>
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
    { header: 'Leads', accessor: 'leadsCount', render: (val) => <span className="mono text-[11px] font-bold text-blue">{val || 0}</span>, align: 'right' },
    { header: 'Converted', accessor: 'conversionsTotal', render: (val) => <span className="mono text-[11px] font-bold text-accent">{val || 0}</span>, align: 'right' },
    { 
      header: 'Revenue', 
      accessor: 'revenue', 
      render: (val) => <span className="mono text-[11px] font-bold text-teal">₹{val?.toLocaleString() || '0'}</span>, 
      align: 'right' 
    },
    {
      header: 'Performance',
      accessor: 'completionPct',
      render: (val) => (
        <Tag variant={val >= 80 ? 'green' : val >= 50 ? 'amber' : 'red'} label={val >= 80 ? 'OPTIMAL' : val >= 50 ? 'STABLE' : 'CRITICAL'} />
      ),
      align: 'right'
    }
  ];

  return (
    <div className="animate-in fade-in duration-500">
      <div className="section-header">
        <div>
          <div className="section-title">Performance Analytics</div>
          <div className="section-sub">Enterprise-wide conversion tracking & regional office metrics</div>
        </div>
        <div className="flex bg-surface2 p-1 rounded-xl border border-border">
          {['daily', 'weekly', 'monthly', 'quarterly'].map(type => (
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
          <div className="stat-label">Avg Work Completion</div>
          <div className="stat-value text-green">{stats.attendancePct || 0}%</div>
          <div className="stat-delta">Cross-platform efficiency</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Leads reach rate</div>
          <div className="stat-value text-blue">{stats.reachRate || 0}%</div>
          <div className="stat-delta">Contact connectivity</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Meeting Rate</div>
          <div className="stat-value text-amber">{stats.meetingRate || 18.4}%</div>
          <div className="stat-delta">Leads → Meeting</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Conversion Rate</div>
          <div className="stat-value text-teal">{stats.conversionRate || 0}%</div>
          <div className="stat-delta">Platform average</div>
        </div>
      </div>

      <div className="card">
        <div className="card-header border-b border-border bg-surface2/10 flex justify-between items-center">
          <div className="section-title text-sm">State Office Leaderboard</div>
          <Button variant="outline" size="sm">Export Detailed Analytics</Button>
        </div>
        <DataTable columns={columns} data={managers} />
      </div>
    </div>
  );
};

export default Performance;
