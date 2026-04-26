import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { leadsApi } from '../../../api/leadsApi';
import { dashboardApi } from '../../../api/dashboardApi';
import { Avatar, Button, Tag, DataTable } from '../../../components/ui';

const LeadManagement = () => {
  const [activeTab, setActiveTab] = useState('all');
  const [filterState, setFilterState] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');

  const { data: dashData } = useQuery({
    queryKey: ['dashboard', 'founder'],
    queryFn: () => dashboardApi.getFounderDashboard().then(res => res.data)
  });

  const { data: leadData, isLoading } = useQuery({
    queryKey: ['leads', 'global', activeTab, filterState, searchTerm],
    queryFn: () => leadsApi.getLeads({ 
      status: activeTab === 'all' ? undefined : activeTab, 
      state: filterState === 'All' ? undefined : filterState,
      search: searchTerm,
      limit: 15
    }).then(res => res.data)
  });

  const openModal = (id) => {
    window.dispatchEvent(new CustomEvent('open-modal', { detail: id }));
  };

  const stats = dashData?.stats || {};
  const pipeline = dashData?.pipeline || [];
  const leads = leadData?.leads || [];

  const columns = [
    {
      header: 'Lead Name',
      accessor: 'name',
      render: (val, row) => (
        <div>
          <div className="font-bold text-[13.5px]">{val}</div>
          <div className="text-[10px] text-text-muted">{row.leadId}</div>
        </div>
      )
    },
    { header: 'Company', accessor: 'company', render: (val) => <span className="text-[12.5px] font-medium">{val}</span> },
    { header: 'State', accessor: 'state', render: (val) => <Tag variant="blue" label={val} /> },
    { header: 'Assigned To', accessor: 'owner.name', render: (val) => <span className="text-[12.5px]">{val || 'Unassigned'}</span> },
    { 
      header: 'Status', 
      accessor: 'status', 
      render: (val) => <Tag variant={val === 'hot' ? 'red' : val === 'converted' ? 'green' : 'gray'} label={val.toUpperCase()} /> 
    },
    {
      header: 'Last Action',
      accessor: 'updatedAt',
      render: (val) => <span className="text-[11px] text-text-muted">{new Date(val).toLocaleDateString()}</span>
    },
    {
      header: 'Actions',
      accessor: '_id',
      render: (id) => (
        <div className="flex gap-2">
          <Button size="xs" variant="outline" onClick={() => openModal('add-lead')}>Update</Button>
          <Button size="xs" variant="outline" className="text-purple border-purple/10" onClick={() => openModal('allocate-lead')}>Allocate</Button>
        </div>
      ),
      align: 'right'
    }
  ];

  return (
    <div className="animate-in fade-in duration-500">
      <div className="section-header">
        <div>
          <div className="section-title">Global Lead Management</div>
          <div className="section-sub">Cross-state lead tracking · Allocation control · Lifecycle monitoring</div>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" size="sm" onClick={() => openModal('bulk-upload')}>Bulk Upload</Button>
          <Button variant="outline" size="sm" onClick={() => openModal('allocate-lead')}>Bulk Allocate</Button>
          <Button className="bg-purple text-white" size="sm" onClick={() => openModal('add-lead')}>+ Add Lead</Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-6">
        {['all', 'new', 'follow-up', 'meeting', 'hot', 'warm', 'rnr', 'converted', 'lost'].map(tab => {
          const count = pipeline.find(p => p.label.toLowerCase() === tab)?.count || 0;
          return (
            <button 
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-1.5 rounded-full text-[11px] font-bold uppercase tracking-wider transition-all border ${activeTab === tab ? 'bg-purple text-white border-purple' : 'bg-surface text-text-muted border-border hover:border-purple/30'}`}
            >
              {tab} ({tab === 'all' ? stats.totalLeads || 0 : count})
            </button>
          );
        })}
      </div>

      <div className="card">
        <div className="card-header border-b border-border bg-surface2/10 flex justify-between items-center">
          <div className="section-title text-sm">Enterprise Lead List</div>
          <div className="flex gap-4">
             <input 
               type="text" 
               placeholder="Search business or contact..." 
               className="bg-surface border border-border rounded-lg px-4 py-1.5 text-xs outline-none focus:border-purple w-64"
               value={searchTerm}
               onChange={e => setSearchTerm(e.target.value)}
             />
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
        
        <DataTable columns={columns} data={leads} isLoading={isLoading} />

        <div className="flex justify-between items-center p-5 border-t border-border">
          <div className="text-[11px] text-text-muted font-bold uppercase tracking-tight">Showing {leads.length} of {leadData?.total || 0} leads</div>
          <div className="flex gap-2">
            <Button size="xs" variant="outline">Previous</Button>
            <Button size="xs" variant="outline">Next</Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LeadManagement;
