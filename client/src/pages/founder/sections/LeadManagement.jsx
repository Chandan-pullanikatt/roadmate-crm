import React, { useState, useEffect } from 'react';
import { useQuery, keepPreviousData, useQueryClient } from '@tanstack/react-query';
import { useLocation } from 'react-router-dom';
import DashboardSkeleton from '../../../components/skeletons/DashboardSkeleton';
import { leadsApi } from '../../../api/leadsApi';
import { dashboardApi } from '../../../api/dashboardApi';
import { Avatar, Button, Tag } from '../../../components/ui';
import { useToast } from '../../../context/ToastContext';

const LeadManagement = () => {
  const queryClient = useQueryClient();
  const { addToast } = useToast();
  const location = useLocation();
  // Fix: Lead Pipeline Clickable Numbers — read status from URL param to set initial tab
  const [activeTab, setActiveTab] = useState(() => {
    const params = new URLSearchParams(location.search);
    return params.get('status') || 'all';
  });
  const [filterState, setFilterState] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [isExporting, setIsExporting] = useState(false);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setPage(1); // Reset to page 1 on search
    }, 350);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const { data: counts } = useQuery({
    queryKey: ['leads', 'counts'],
    queryFn: () => leadsApi.getCounts().then(res => res.data),
    staleTime: 5 * 60 * 1000
  });

  const { data: leadData, isLoading, isFetching } = useQuery({
    queryKey: ['leads', 'global', activeTab, filterState, debouncedSearch, page],
    queryFn: () => leadsApi.getLeads({ 
      status: activeTab === 'all' ? undefined : activeTab, 
      state: filterState === 'All' ? undefined : filterState,
      search: debouncedSearch,
      page,
      limit: 20
    }).then(res => res.data),
    staleTime: 5 * 60 * 1000,
    placeholderData: keepPreviousData
  });

  const openModal = (type, data = null) => {
    window.dispatchEvent(new CustomEvent('open-modal', { 
      detail: typeof type === 'string' ? { type, ...data } : type 
    }));
  };

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const res = await leadsApi.getLeads({
        status: activeTab === 'all' ? undefined : activeTab,
        state: filterState === 'All' ? undefined : filterState,
        search: debouncedSearch,
        limit: 9999
      });
      const leads = res.data.leads || [];
      
      if (leads.length === 0) {
        addToast('No leads to export', 'warning');
        return;
      }

      const headers = ['Lead Name', 'Company', 'Phone', 'Email', 'State', 'Status', 'Assigned To', 'Last Updated'];
      const rows = leads.map(l => [
        l.name,
        l.company || 'N/A',
        l.phone,
        l.email || 'N/A',
        l.state || 'N/A',
        l.status?.toUpperCase(),
        l.owner?.name || 'Unassigned',
        new Date(l.updatedAt).toLocaleDateString()
      ]);

      const csvContent = [headers, ...rows].map(r => r.join(',')).join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `leads-export-${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      addToast('Export successful', 'success');
    } catch (err) {
      addToast('Export failed', 'error');
    } finally {
      setIsExporting(false);
    }
  };

  if (isLoading) return <DashboardSkeleton />;

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

  return (
    <div className="animate-in fade-in duration-500">
      <div className="flex items-center gap-2 mb-4 text-[11px] font-bold uppercase tracking-widest text-text-muted">
        <span>Founder</span>
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
          <Button 
            variant="outline" 
            size="sm" 
            className="bg-white border-purple/20 text-purple font-bold hover:bg-purple/5" 
            onClick={() => openModal('bulk-allocate')}
          >
            Bulk Allocate
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            className="bg-white border-border font-bold hover:bg-surface2" 
            onClick={handleExport}
            loading={isExporting}
          >
            Export CSV
          </Button>
          <Button size="sm" className="bg-[#0f766e] hover:bg-[#0d645e] text-white border-none shadow-sm font-semibold" onClick={() => openModal('add-lead')}>+ Add Lead</Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-8">
        {tabs.map(tab => (
          <button 
            key={tab.id}
            onClick={() => { setActiveTab(tab.id); setPage(1); }}
            className={`px-5 py-2 rounded-xl text-[11px] font-bold uppercase tracking-wider transition-all border shadow-sm ${activeTab === tab.id ? 'bg-[#0f766e] text-white border-[#0f766e]' : 'bg-white text-text-muted border-border hover:border-blue/30'}`}
          >
            {tab.label} <span className={`ml-2 opacity-60 ${activeTab === tab.id ? 'text-white' : 'text-blue'}`}>{tab.count}</span>
          </button>
        ))}
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
               onChange={e => { setFilterState(e.target.value); setPage(1); }}
             >
               <option value="All">All States</option>
               {/* This is a simple list of states, could be fetched from API if needed */}
               <option>Telangana</option>
               <option>Maharashtra</option>
               <option>Karnataka</option>
               <option>Tamil Nadu</option>
               <option>Kerala</option>
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
                    <div className="text-[10px] text-text-muted mt-0.5">{(l._id ?? '').substring(0,8).toUpperCase()}</div>
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
                      variant={l.status === 'converted' ? 'green' : l.status === 'lost' ? 'red' : (l.status === 'meeting_virtual' || l.status === 'meeting_direct') ? 'blue' : 'amber'} 
                      label={l.status?.replace('_', ' ').toUpperCase() ?? 'UNKNOWN'} 
                    />
                  </td>
                  <td className="p-4 text-center text-[11px] text-text-muted font-mono">{new Date(l.updatedAt).toLocaleDateString()}</td>
                  <td className="p-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {/* Fix: Lead Pipeline — View Details button opens lead history */}
                      <Button size="xs" variant="outline" className="bg-white border-border shadow-sm text-text-muted font-bold px-3" onClick={() => openModal('lead-history', { leadId: l._id, leadName: l.company || l.name })}>View</Button>
                      <Button size="xs" variant="outline" className="bg-white border-border shadow-sm text-text-primary font-bold px-3" onClick={() => openModal('update-lead', { leadData: l })}>Update</Button>
                      <Button size="xs" variant="outline" className="bg-white border-blue/10 text-blue border-blue/20 shadow-sm font-bold px-3" onClick={() => openModal('allocate-lead', { leadData: l })}>Allocate</Button>
                    </div>
                  </td>
                </tr>
              ))}
              {leads.length === 0 && !isLoading && (
                 <tr><td colSpan="7" className="p-12 text-center text-text-muted italic normal-case">No leads matching your criteria.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex justify-between items-center p-5 border-t border-border bg-surface2/10">
          <div className="text-[11px] text-text-muted font-bold uppercase tracking-tight">
            Showing {((page - 1) * 20) + 1} - {Math.min(page * 20, total)} of {total} enterprise leads
          </div>
          <div className="flex gap-2">
            <Button 
              size="xs" 
              variant="outline" 
              className="bg-white border-border shadow-sm px-4"
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              Previous
            </Button>
            <Button 
              size="xs" 
              variant="outline" 
              className="bg-white border-border shadow-sm px-4"
              onClick={() => setPage(p => p + 1)}
              disabled={page >= totalPages}
            >
              Next
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LeadManagement;
