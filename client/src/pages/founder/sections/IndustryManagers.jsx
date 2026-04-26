import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { usersApi } from '../../../api/usersApi';
import { dashboardApi } from '../../../api/dashboardApi';
import { Avatar, Button, Tag, DataTable } from '../../../components/ui';

const IndustryManagers = () => {
  const [viewType, setViewType] = useState('daily');
  const [filterState, setFilterState] = useState('All');
  const [filterIndustry, setFilterIndustry] = useState('All');

  const { data: dashData } = useQuery({
    queryKey: ['dashboard', 'founder'],
    queryFn: () => dashboardApi.getFounderDashboard().then(res => res.data)
  });

  const { data: managers, isLoading } = useQuery({
    queryKey: ['users', 'industry-managers-global'],
    queryFn: () => usersApi.getUsers({ role: 'industry-manager' }).then(res => res.data)
  });

  const openModal = (id) => {
    window.dispatchEvent(new CustomEvent('open-modal', { detail: id }));
  };

  if (isLoading) return <div className="p-8 text-center text-text-muted">Loading industry performance...</div>;

  const stats = dashData?.stats || {};
  const filteredManagers = managers?.filter(m => {
    const matchesState = filterState === 'All' || m.state === filterState;
    const matchesIndustry = filterIndustry === 'All' || m.industry === filterIndustry;
    return matchesState && matchesIndustry;
  });

  const columns = [
    {
      header: 'Manager',
      accessor: 'name',
      render: (val, row) => (
        <div className="flex items-center gap-3">
          <Avatar name={val} size="sm" />
          <span className="font-bold text-[14px]">{val}</span>
        </div>
      )
    },
    {
      header: 'State / Industry',
      accessor: 'state',
      render: (val, row) => (
        <div className="flex items-center gap-2">
          <Tag variant="blue" label={val} />
          <span className="text-[11px] text-text-muted font-medium">{row.industry}</span>
        </div>
      )
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
      )
    },
    { header: 'Calls', accessor: 'callsToday', render: (val) => <span className="mono text-[11px] font-bold text-blue">{val || 0}</span>, align: 'right' },
    { header: 'Meetings', accessor: 'meetingsTotal', render: (val) => <span className="mono text-[11px] font-bold text-teal">{val || 0}</span>, align: 'right' },
    { 
      header: 'Revenue', 
      accessor: 'revenue', 
      render: (val) => <span className="mono text-[11px] font-bold text-accent">₹{val?.toLocaleString() || '0'}</span>, 
      align: 'right' 
    },
    {
      header: 'Actions',
      accessor: '_id',
      render: (id) => (
        <div className="flex gap-2">
          <Button size="xs" variant="outline" onClick={() => openModal('create-exec')}>View</Button>
          <Button size="xs" variant="outline" className="text-amber border-amber/20" onClick={() => openModal('leave-approval')}>Leave</Button>
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
        <span className="text-text-primary">INDUSTRY STATE MANAGERS</span>
      </div>

      <div className="section-header">
        <div>
          <div className="section-title">Industry State Managers</div>
          <div className="section-sub">Enterprise summary across all state verticals · Regional management monitoring</div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => openModal('add-lead')}>Create Lead</Button>
          <Button className="bg-purple text-white" size="sm" onClick={() => openModal('create-exec')}>+ Industry Manager</Button>
        </div>
      </div>

      <div className="stat-grid mb-6">
        <div className="stat-card">
          <div className="stat-label">Total Managers</div>
          <div className="stat-value text-blue">{managers?.length || 0}</div>
          <div className="stat-delta">Across all states</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Active Leads</div>
          <div className="stat-value text-accent">{stats.totalLeads || 0}</div>
          <div className="stat-delta">Across industry verticals</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Enterprise Conv.</div>
          <div className="stat-value text-teal">{stats.conversionRate || 0}%</div>
          <div className="stat-delta">Platform average</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Leave Approvals</div>
          <div className="stat-value text-amber">{stats.pendingLeaves || 0}</div>
          <div className="stat-delta">Action required</div>
        </div>
      </div>

      <div className="section-header">
        <div>
          <div className="section-title">Staff-by-Staff Performance</div>
          <div className="section-sub">Granular performance tracking for industry heads</div>
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

      <div className="card mb-8">
        <div className="card-header border-b border-border bg-surface2/10 flex justify-between items-center">
           <div className="flex gap-4">
              <select className="bg-surface border border-border rounded-lg px-4 py-1.5 text-xs outline-none focus:border-purple" value={filterState} onChange={e => setFilterState(e.target.value)}>
                 <option value="All">All States</option>
                 <option value="Kerala">Kerala</option>
                 <option value="Tamil Nadu">Tamil Nadu</option>
                 <option value="Karnataka">Karnataka</option>
              </select>
              <select className="bg-surface border border-border rounded-lg px-4 py-1.5 text-xs outline-none focus:border-purple" value={filterIndustry} onChange={e => setFilterIndustry(e.target.value)}>
                 <option value="All">All Industries</option>
                 <option value="Automobile">Automobile</option>
                 <option value="Healthcare">Healthcare</option>
                 <option value="FMCG">FMCG</option>
                 <option value="Electronics">Electronics</option>
              </select>
           </div>
           <Button variant="outline" size="sm">Export CSV</Button>
        </div>
        <DataTable columns={columns} data={filteredManagers || []} />
      </div>

      <div className="section-header">
        <div>
          <div className="section-title">Compliance & Staff Documents</div>
          <div className="section-sub">Verify ID proofs, agreements, and training certificates</div>
        </div>
      </div>

      <div className="card">
        <div className="card-body p-0">
          {filteredManagers?.slice(0, 5).map((m, i) => (
            <div key={m._id} className="flex items-center gap-4 p-5 border-b last:border-0 hover:bg-surface2 transition-colors">
              <Avatar name={m.name} size="md" className="av-ind" />
              <div className="flex-1 min-w-0">
                <div className="text-[14px] font-bold">{m.name}</div>
                <div className="text-[11.5px] text-text-muted mt-0.5">{m.industry} · {m.state}</div>
              </div>
              <div className="flex gap-2">
                <Tag variant={m.documents?.aadhaar?.verified ? 'green' : 'amber'} label={m.documents?.aadhaar?.verified ? 'VERIFIED' : 'PENDING'} />
                <Button size="xs" variant="outline" onClick={() => openModal('create-exec')}>View Docs</Button>
                <Button size="xs" className="bg-purple text-white" onClick={() => openModal('create-exec')}>Upload</Button>
              </div>
            </div>
          ))}
          {filteredManagers?.length === 0 && <div className="p-12 text-center text-text-muted italic">No data found</div>}
        </div>
      </div>
    </div>
  );
};

export default IndustryManagers;
