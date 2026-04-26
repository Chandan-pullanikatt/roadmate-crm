import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { usersApi } from '../../../api/usersApi';
import { dashboardApi } from '../../../api/dashboardApi';
import { Avatar, Button, Tag, DataTable } from '../../../components/ui';

const DistrictExecutives = () => {
  const [viewType, setViewType] = useState('monthly');
  const [filterState, setFilterState] = useState('All');

  const { data: dashData } = useQuery({
    queryKey: ['dashboard', 'founder'],
    queryFn: () => dashboardApi.getFounderDashboard().then(res => res.data)
  });

  const { data: executives, isLoading } = useQuery({
    queryKey: ['users', 'executives-global'],
    queryFn: () => usersApi.getUsers({ role: 'executive' }).then(res => res.data)
  });

  const openModal = (id) => {
    window.dispatchEvent(new CustomEvent('open-modal', { detail: id }));
  };

  if (isLoading) return <div className="p-8 text-center text-text-muted">Analyzing field team performance...</div>;

  const stats = dashData?.stats || {};
  const filteredExecs = executives?.filter(e => filterState === 'All' || e.state === filterState);

  const columns = [
    {
      header: 'Executive',
      accessor: 'name',
      render: (val, row) => (
        <div className="flex items-center gap-3">
          <Avatar name={val} size="sm" />
          <span className="font-bold text-[14px]">{val}</span>
        </div>
      )
    },
    {
      header: 'State · Industry',
      accessor: 'state',
      render: (val, row) => (
        <div className="flex items-center gap-2">
          <Tag variant="blue" label={val} />
          <span className="text-[11px] text-text-muted font-medium">{row.industry}</span>
        </div>
      )
    },
    { header: 'Handling', accessor: 'leadsCount', render: (val) => <span className="mono text-[11px] font-bold">{val || 0}</span>, align: 'right' },
    { header: 'Connected', accessor: 'callsToday', render: (val) => <span className="mono text-[11px] font-bold text-blue">{val || 0}</span>, align: 'right' },
    { header: 'Converted', accessor: 'conversionsTotal', render: (val) => <span className="mono text-[11px] font-bold text-accent">{val || 0}</span>, align: 'right' },
    { 
      header: 'Revenue', 
      accessor: 'revenue', 
      render: (val) => <span className="mono text-[11px] font-bold text-teal">₹{val?.toLocaleString() || '0'}</span>, 
      align: 'right' 
    },
    {
      header: 'Work %',
      accessor: 'completionPct',
      render: (val) => (
        <div className="flex items-center gap-3">
          <div className="h-1.5 w-16 bg-surface2 rounded-full overflow-hidden border border-border">
            <div className={`h-full transition-all ${val >= 80 ? 'bg-accent' : val >= 50 ? 'bg-amber' : 'bg-red'}`} style={{ width: `${val || 0}%` }}></div>
          </div>
          <span className="text-[11px] mono font-bold">{val || 0}%</span>
        </div>
      ),
      align: 'right'
    },
    {
      header: 'Actions',
      accessor: '_id',
      render: (id) => (
        <div className="flex gap-2">
          <Button size="xs" variant="outline" onClick={() => openModal('create-exec')}>View</Button>
          <Button size="xs" variant="outline" onClick={() => openModal('create-exec')}>Edit</Button>
        </div>
      ),
      align: 'right'
    }
  ];

  return (
    <div className="animate-in fade-in duration-500">
      <div className="flex items-center gap-2 mb-4 text-[11px] font-bold uppercase tracking-widest text-text-muted">
        <span>FOUNDER</span>
        <span>/</span>
        <span className="text-text-primary">DISTRICT EXECUTIVES</span>
      </div>

      <div className="section-header">
        <div>
          <div className="section-title">District Executives</div>
          <div className="section-sub">Field execution monitoring · Lead conversion stats · Team efficiency</div>
        </div>
        <div className="flex gap-2">
          <Button className="bg-purple text-white" size="sm" onClick={() => openModal('create-exec')}>+ Create Executive</Button>
          <select 
            className="bg-surface border border-border rounded-lg px-4 py-1.5 text-xs outline-none focus:border-purple"
            value={filterState}
            onChange={e => setFilterState(e.target.value)}
          >
            <option value="All">All States</option>
            <option value="Kerala">Kerala</option>
            <option value="Tamil Nadu">Tamil Nadu</option>
            <option value="Karnataka">Karnataka</option>
          </select>
        </div>
      </div>

      <div className="stat-grid mb-6">
        <div className="stat-card">
          <div className="stat-label">Total Executives</div>
          <div className="stat-value text-orange">{executives?.length || 0}</div>
          <div className="stat-delta">Across all states</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Total Leads Handling</div>
          <div className="stat-value text-green">{stats.totalLeads || 0}</div>
          <div className="stat-delta">Active pipeline</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Reach Rate</div>
          <div className="stat-value text-teal">{stats.reachRate || 0}%</div>
          <div className="stat-delta">Call connectivity</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Platform Conv.</div>
          <div className="stat-value text-accent">{stats.conversionRate || 0}%</div>
          <div className="stat-delta">Closed successfully</div>
        </div>
      </div>

      <div className="section-header">
        <div>
          <div className="section-title">Executive Performance — {viewType.charAt(0).toUpperCase() + viewType.slice(1)} Report</div>
          <div className="section-sub">Detailed activity metrics for every field member</div>
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

      <div className="card">
        <DataTable columns={columns} data={filteredExecs || []} />
      </div>
    </div>
  );
};

export default DistrictExecutives;
