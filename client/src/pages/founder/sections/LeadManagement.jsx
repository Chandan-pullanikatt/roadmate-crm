import React, { useState, useEffect } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import DashboardSkeleton from '../../../components/skeletons/DashboardSkeleton';
import { leadsApi } from '../../../api/leadsApi';
import { dashboardApi } from '../../../api/dashboardApi';
import { Avatar, Button, Tag, DataTable } from '../../../components/ui';

const LeadManagement = () => {
  const [activeTab, setActiveTab] = useState('all');
  const [filterState, setFilterState] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
    }, 350);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const { data: dashData } = useQuery({
    queryKey: ['dashboard', 'founder'],
    queryFn: () => dashboardApi.getFounderDashboard().then(res => res.data),
    staleTime: 5 * 60 * 1000,
    placeholderData: keepPreviousData
  });

  const { data: leadData, isLoading, isFetching } = useQuery({
    queryKey: ['leads', 'global', activeTab, filterState, debouncedSearch],
    queryFn: () => leadsApi.getLeads({ 
      status: activeTab === 'all' ? undefined : activeTab, 
      state: filterState === 'All' ? undefined : filterState,
      search: debouncedSearch,
      limit: 15
    }).then(res => res.data),
    staleTime: 5 * 60 * 1000,
    placeholderData: keepPreviousData
  });

  const openModal = (type, data = null) => {
    window.dispatchEvent(new CustomEvent('open-modal', { 
      detail: typeof type === 'string' ? { type, ...data } : type 
    }));
  };

  if (isLoading) return <DashboardSkeleton />;

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
      render: (id, row) => (
        <div className="flex gap-2">
          <Button size="xs" variant="outline" onClick={() => openModal('update-lead', { leadData: row })}>Update</Button>
          <Button size="xs" variant="outline" className="text-purple border-purple/10" onClick={() => openModal('allocate-lead', { leadData: row })}>Allocate</Button>
        </div>
      ),
      align: 'right'
    }
  ];

  return (
    <div className="animate-in fade-in duration-500">
      <div className="flex items-center gap-2 mb-4 text-[11px] font-bold uppercase tracking-widest text-text-muted">
        <span className="hover:text-text-primary cursor-pointer transition-colors" onClick={() => {}}>Founder</span>
        <span className="text-text-muted/30">›</span>
        <span className="text-text-primary">Lead Management</span>
      </div>

      <div className="flex justify-between items-end mb-6">
        <div>
          <div className="text-[20px] font-bold text-text-primary">Global Lead Management</div>
          <div className="text-[12px] text-text-muted mt-1">Cross-state lead tracking · Allocation control · Lifecycle monitoring</div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="bg-white border-border" onClick={() => openModal('bulk-upload')}>Bulk Upload</Button>
          <Button variant="outline" size="sm" className="bg-white border-border" onClick={() => openModal('allocate-lead')}>Bulk Allocate</Button>
          <Button size="sm" className="bg-[#0f766e] hover:bg-[#0d645e] text-white border-none shadow-sm font-semibold" onClick={() => openModal('add-lead')}>+ Add Lead</Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-8">
        {['all', 'new', 'follow-up', 'meeting', 'negotiation', 'converted', 'lost'].map(tab => {
          const count = dashData?.pipelineStats?.find(p => p.label.toLowerCase() === tab)?.count || 0;
          return (
            <button 
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-5 py-2 rounded-xl text-[11px] font-bold uppercase tracking-wider transition-all border shadow-sm ${activeTab === tab ? 'bg-[#0f766e] text-white border-[#0f766e]' : 'bg-white text-text-muted border-border hover:border-blue/30'}`}
            >
              {tab} <span className={`ml-2 opacity-60 ${activeTab === tab ? 'text-white' : 'text-blue'}`}>{tab === 'all' ? stats.totalLeads || 0 : count}</span>
            </button>
          );
        })}
      </div>

      <div className="card overflow-hidden border border-border bg-white rounded-xl shadow-sm">
        <div className="card-header border-b border-border bg-white flex justify-between items-center px-5 py-4">
          <div className="text-[15px] font-bold text-text-primary">Enterprise Lead List</div>
          <div className="flex gap-3">
             <div className="relative">
               <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="11" cy="11" r="8"></circle><path d="M21 21l-4.35-4.35"></path></svg>
               <input 
                 type="text" 
                 placeholder="Search lead or business..." 
                 className="bg-surface2/50 border border-border rounded-lg pl-9 pr-4 py-1.5 text-[12px] outline-none focus:border-blue transition-colors w-64"
                 value={searchTerm}
                 onChange={e => setSearchTerm(e.target.value)}
               />
             </div>
             <select 
               className="bg-white border border-border rounded-lg px-4 py-1.5 text-[11px] font-bold uppercase tracking-wider outline-none focus:border-blue transition-colors min-w-[140px]"
               value={filterState}
               onChange={e => setFilterState(e.target.value)}
             >
               <option value="All">All States</option>
               {Array.from(new Set(leads.map(l => l.state))).filter(s=>s).map(s => <option key={s} value={s}>{s}</option>)}
             </select>
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-[11px] uppercase tracking-wider font-bold text-text-muted">
            <thead>
              <tr className="bg-surface2/50 border-b border-border">
                <th className="p-4">Lead Details</th>
                <th className="p-4">Company</th>
                <th className="p-4 text-center">State</th>
                <th className="p-4">Assigned To</th>
                <th className="p-4 text-center">Status</th>
                <th className="p-4 text-center">Last Updated</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border normal-case font-medium text-text-primary">
              {leads.map((l) => (
                <tr key={l._id} className="hover:bg-surface2/30 transition-colors group">
                  <td className="p-4">
                    <div className="font-bold text-[13.5px] group-hover:text-blue transition-colors">{l.name}</div>
                    <div className="text-[10px] text-text-muted mt-0.5">{l._id.substring(0,8).toUpperCase()}</div>
                  </td>
                  <td className="p-4 text-[12.5px] font-semibold text-text-secondary">{l.company || 'N/A'}</td>
                  <td className="p-4 text-center">
                    <span className="bg-blue/10 text-blue px-2 py-0.5 rounded text-[10px] font-bold">{l.state || 'N/A'}</span>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-2">
                       <div className="w-6 h-6 rounded-full bg-surface2 flex items-center justify-center text-[10px] font-bold">{l.owner?.name?.[0] || 'U'}</div>
                       <span className="text-[12.5px] font-medium">{l.owner?.name || 'Unassigned'}</span>
                    </div>
                  </td>
                  <td className="p-4 text-center">
                    <Tag 
                      variant={l.status === 'converted' ? 'green' : l.status === 'lost' ? 'red' : l.status === 'meeting' ? 'blue' : 'amber'} 
                      label={l.status.toUpperCase()} 
                    />
                  </td>
                  <td className="p-4 text-center text-[11px] text-text-muted font-mono">{new Date(l.updatedAt).toLocaleDateString()}</td>
                  <td className="p-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button size="xs" variant="outline" className="bg-white border-border shadow-sm text-text-primary font-bold px-3" onClick={() => openModal('update-lead', { leadData: l })}>Update</Button>
                      <Button size="xs" variant="outline" className="bg-white border-blue/10 text-blue border-blue/20 shadow-sm font-bold px-3" onClick={() => openModal('allocate-lead', { leadData: l })}>Allocate</Button>
                    </div>
                  </td>
                </tr>
              ))}
              {leads.length === 0 && (
                 <tr><td colSpan="7" className="p-12 text-center text-text-muted italic normal-case">No leads matching your criteria.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex justify-between items-center p-5 border-t border-border bg-surface2/10">
          <div className="text-[11px] text-text-muted font-bold uppercase tracking-tight">Showing {leads.length} of {leadData?.total || 0} enterprise leads</div>
          <div className="flex gap-2">
            <Button size="xs" variant="outline" className="bg-white border-border shadow-sm px-4">Previous</Button>
            <Button size="xs" variant="outline" className="bg-white border-border shadow-sm px-4">Next</Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LeadManagement;
