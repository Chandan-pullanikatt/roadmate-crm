import React, { useState, useEffect } from 'react';
import { useQuery, keepPreviousData, useQueryClient } from '@tanstack/react-query';
import DashboardSkeleton from '../../../components/skeletons/DashboardSkeleton';
import { leadsApi } from '../../../api/leadsApi';
import { dashboardApi } from '../../../api/dashboardApi';
import { Button, Tag, DataTable } from '../../../components/ui';
import { useToast } from '../../../context/ToastContext';

const LeadManagement = () => {
  const queryClient = useQueryClient();
  const { addToast } = useToast();
  const [activeTab, setActiveTab] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [isExporting, setIsExporting] = useState(false);

  // Debounce search term
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setPage(1); // Reset to first page on search
    }, 350);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const { data: counts } = useQuery({
    queryKey: ['leads', 'counts'],
    queryFn: () => leadsApi.getCounts().then(res => res.data),
    staleTime: 5 * 60 * 1000
  });

  const { data: leadData, isLoading, isFetching } = useQuery({
    queryKey: ['leads', 'state-list', activeTab, debouncedSearch, page],
    queryFn: () => leadsApi.getLeads({ 
      status: activeTab === 'all' ? undefined : activeTab, 
      search: debouncedSearch,
      page,
      limit: 20
    }).then(res => res.data),
    staleTime: 5 * 60 * 1000,
    placeholderData: keepPreviousData
  });

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const res = await leadsApi.getLeads({
        status: activeTab === 'all' ? undefined : activeTab,
        search: debouncedSearch,
        limit: 9999
      });
      const leads = res.data.leads || [];
      
      if (leads.length === 0) {
        addToast('No leads to export', 'warning');
        return;
      }

      const headers = ['Lead ID', 'Lead Name', 'Company', 'Phone', 'Email', 'Status', 'Assigned To', 'Last Updated'];
      const rows = leads.map(l => [
        l.leadId || (l._id ?? '').substring(0,8).toUpperCase(),
        l.name,
        l.company || 'N/A',
        l.phone,
        l.email || 'N/A',
        l.status?.toUpperCase(),
        l.owner?.name || 'Unassigned',
        new Date(l.updatedAt).toLocaleDateString()
      ]);

      const csvContent = [headers, ...rows].map(r => r.join(',')).join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `state-leads-export-${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      addToast('Export successful', 'success');
    } catch (err) {
      addToast('Export failed', 'error');
    } finally {
      setIsExporting(false);
    }
  };

  const leads = leadData?.leads || [];
  const total = leadData?.total || 0;
  const totalPages = leadData?.totalPages || 1;

  const tabs = [
    { id: 'all', label: 'All', count: Object.values(counts || {}).reduce((a, b) => a + b, 0) },
    { id: 'new', label: 'New', count: counts?.new || 0 },
    { id: 'followup', label: 'Follow-up', count: counts?.followup || 0 },
    { id: 'meeting', label: 'Meeting', count: (counts?.meeting_virtual || 0) + (counts?.meeting_direct || 0) },
    { id: 'converted', label: 'Converted', count: counts?.converted || 0 },
    { id: 'lost', label: 'Lost', count: counts?.lost || 0 },
    { id: 'rnr', label: 'RNR', count: counts?.rnr || 0 }
  ];

  const openModal = (type, data = null) => {
    window.dispatchEvent(new CustomEvent('open-modal', { 
      detail: typeof type === 'string' ? { type, ...data } : type 
    }));
  };

  const columns = [
    {
      header: 'Lead ID',
      accessor: 'leadId',
      render: (val, row) => <span className="mono text-[10px] font-bold">{row.leadId || (row._id ?? '').substring(0,8).toUpperCase()}</span>
    },
    {
      header: 'Business Name',
      accessor: 'company',
      render: (val, row) => (
        <div>
          <div className="font-bold text-[13.5px]">{row.company || row.business || val}</div>
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
      render: (val) => <Tag variant={val === 'converted' ? 'green' : (val === 'meeting_virtual' || val === 'meeting_direct') ? 'blue' : (val === 'followup' || val === 'new') ? 'amber' : 'red'} label={val?.toUpperCase() ?? 'UNKNOWN'} /> 
    },
    {
      header: 'Age',
      accessor: 'createdAt',
      render: (val) => <span className="text-xs text-text-muted font-bold">{Math.floor((new Date() - new Date(val)) / (1000 * 60 * 60 * 24))}d</span>
    },
    {
      header: 'Action',
      accessor: '_id',
      render: (id, row) => (
        <div className="flex gap-2">
          <Button size="xs" variant="outline" className="font-bold px-3" onClick={() => openModal('update-lead', { leadData: row })}>Update</Button>
          <Button size="xs" variant="outline" className="text-purple border-purple/10 font-bold px-3" onClick={() => openModal('allocate-lead', { leadData: row })}>Allocate</Button>
        </div>
      ),
      align: 'right'
    }
  ];

  if (isLoading) return <DashboardSkeleton />;

  return (
    <div className="animate-in fade-in duration-500">
      <div className="section-header">
        <div>
          <div className="section-title">Lead Central Repository</div>
          <div className="section-sub">State-wide lead monitoring, allocation, and lifecycle tracking</div>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" size="sm" onClick={() => openModal('bulk-upload')}>⬆ Bulk Upload</Button>
          <Button variant="outline" size="sm" className="border-purple/20 text-purple font-bold" onClick={() => openModal('bulk-allocate')}>Bulk Allocate</Button>
          <Button variant="outline" size="sm" loading={isExporting} onClick={handleExport}>Export CSV</Button>
          <Button className="bg-[#0f766e] text-white" size="sm" onClick={() => openModal('add-lead')}>+ New Lead</Button>
        </div>
      </div>

      <div className="card">
        <div className="card-header border-b border-border flex justify-between items-center bg-surface2/10">
          <div className="flex gap-4 overflow-x-auto">
            {tabs.map(t => (
              <button 
                key={t.id}
                onClick={() => { setActiveTab(t.id); setPage(1); }}
                className={`text-[10px] font-bold uppercase tracking-wider pb-4 transition-all border-b-2 whitespace-nowrap ${activeTab === t.id ? 'border-purple text-purple' : 'border-transparent text-text-muted hover:text-text-primary'}`}
              >
                {t.label} <span className="ml-1 opacity-50">{t.count}</span>
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
          className={isFetching ? 'opacity-50 transition-opacity' : 'transition-opacity'}
          emptyMessage={debouncedSearch ? "No leads found for your search" : "No leads found in this category"}
        />

        <div className="flex justify-between items-center p-5 border-t border-border">
          <div className="text-xs text-text-muted font-bold uppercase tracking-tight">
             Showing {((page - 1) * 20) + 1} - {Math.min(page * 20, total)} of {total} state leads
          </div>
          <div className="flex gap-2">
            <Button size="xs" variant="outline" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Previous</Button>
            <Button size="xs" variant="outline" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Next</Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LeadManagement;
