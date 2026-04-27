import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { leadsApi } from '../../../api/leadsApi';
import { dashboardApi } from '../../../api/dashboardApi';
import { Button, Tag, DataTable } from '../../../components/ui';

const LeadManagement = () => {
  const [activeTab, setActiveTab] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);

  const { data: dashData } = useQuery({
    queryKey: ['dashboard', 'state-manager'],
    queryFn: () => dashboardApi.getStateManagerDashboard().then(res => res.data)
  });

  const { data: leadData, isLoading } = useQuery({
    queryKey: ['leads', 'state-list', activeTab, searchTerm, page],
    queryFn: () => leadsApi.getLeads({ 
      status: activeTab === 'all' ? undefined : activeTab, 
      search: searchTerm,
      page,
      limit: 10
    }).then(res => res.data)
  });

  const stats = dashData?.stats || {};
  const pipelineData = dashData?.pipelineData || [];
  const leads = leadData?.leads || [];

  const tabs = [
    { id: 'all', label: 'All Leads' },
    { id: 'hot', label: 'Hot' },
    { id: 'converted', label: 'Converted' },
    { id: 'rnr', label: 'RNR' },
    { id: 'lost', label: 'Lost' }
  ];

  const columns = [
    {
      header: 'Lead ID',
      accessor: 'leadId',
      render: (val) => <span className="mono text-[10px] font-bold">{val}</span>
    },
    {
      header: 'Business Name',
      accessor: 'company',
      render: (val, row) => (
        <div>
          <div className="font-bold text-[13.5px]">{row.business || val}</div>
          <div className="text-[11px] text-text-muted mt-0.5">{row.name}</div>
        </div>
      )
    },
    { header: 'Industry', accessor: 'industry', render: (val) => <Tag variant="gray" label={val} /> },
    { header: 'District', accessor: 'district' },
    { header: 'Manager', accessor: 'owner', render: (val) => <span className="font-medium text-xs">{val?.name || 'Unassigned'}</span> },
    { 
      header: 'Status', 
      accessor: 'status', 
      render: (val) => <Tag variant={val === 'hot' ? 'red' : val === 'converted' ? 'green' : val === 'warm' ? 'amber' : 'gray'} label={val.toUpperCase()} /> 
    },
    {
      header: 'Age',
      accessor: 'createdAt',
      render: (val) => <span className="text-xs text-text-muted font-bold">{Math.floor((new Date() - new Date(val)) / (1000 * 60 * 60 * 24))}d</span>
    },
    {
      header: 'Action',
      accessor: '_id',
      render: (id) => <Button size="xs" variant="outline" onClick={() => {}}>Details</Button>,
      align: 'right'
    }
  ];

  return (
    <div className="animate-in fade-in duration-500">
      <div className="section-header">
        <div>
          <div className="section-title">Lead Central Repository</div>
          <div className="section-sub">State-wide lead monitoring, allocation, and lifecycle tracking</div>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" size="sm" onClick={() => window.dispatchEvent(new CustomEvent('open-modal', { detail: 'bulk-upload' }))}>⬆ Bulk Upload</Button>
          <Button className="bg-purple text-white" size="sm" onClick={() => window.dispatchEvent(new CustomEvent('open-modal', { detail: 'add-lead' }))}>+ New Lead</Button>
        </div>
      </div>

      <div className="stat-grid mb-6">
        <div className="stat-card">
          <div className="stat-label">Total Leads</div>
          <div className="stat-value" style={{ color: 'var(--blue)' }}>{stats.activeLeads || 0}</div>
          <div className="stat-delta">Across state pipeline</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Hot Leads</div>
          <div className="stat-value" style={{ color: 'var(--red)' }}>{pipelineData.find(f => f.status === 'hot')?.count || 0}</div>
          <div className="stat-delta">Priority contact</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Warm Leads</div>
          <div className="stat-value" style={{ color: 'var(--amber)' }}>{pipelineData.find(f => f.status === 'warm')?.count || 0}</div>
          <div className="stat-delta">Active follow-ups</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Converted</div>
          <div className="stat-value" style={{ color: 'var(--accent)' }}>{stats.convertedThisMonth || 0}</div>
          <div className="stat-delta text-accent">↑ This month</div>
        </div>
      </div>

      <div className="card">
        <div className="card-header border-b border-border flex justify-between items-center bg-surface2/10">
          <div className="flex gap-4">
            {tabs.map(t => (
              <button 
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                className={`text-xs font-bold uppercase tracking-wider pb-4 transition-all border-b-2 ${activeTab === t.id ? 'border-purple text-purple' : 'border-transparent text-text-muted hover:text-text-primary'}`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div className="flex gap-3 pb-4">
             <input 
               placeholder="Search business or manager..." 
               className="bg-surface border border-border rounded-lg px-4 py-1 text-xs outline-none focus:border-purple w-64 shadow-sm"
               value={searchTerm}
               onChange={e => setSearchTerm(e.target.value)}
             />
          </div>
        </div>
        
        <DataTable 
          columns={columns}
          data={leads}
          isLoading={isLoading}
          emptyMessage="No leads found in this category"
        />

        <div className="flex justify-between items-center p-5 border-t border-border">
          <div className="text-xs text-text-muted font-bold">Showing {leads.length} of {leadData?.total || 0} state leads</div>
          <div className="flex gap-2">
            <Button size="xs" variant="outline" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Previous</Button>
            <Button size="xs" variant="outline" disabled={leads.length < 10} onClick={() => setPage(p => p + 1)}>Next</Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LeadManagement;

