import React, { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery, keepPreviousData, useQueryClient } from '@tanstack/react-query';
import { leadsApi } from '../../../api/leadsApi';
import { useToast } from '../../../context/ToastContext';
import { Button, Tag } from '../../../components/ui';
import DeleteLeadButton from '../../../components/DeleteLeadButton';
import LeadSelectionBar, { LeadCheckbox } from '../../../components/leads/LeadSelectionBar';
import { useLeadSelection } from '../../../hooks/useLeadSelection';

const LeadList = () => {
  const queryClient = useQueryClient();
  const { addToast } = useToast();
  // Overview cards link here with ?status=, ?priority= and ?period=&value= so the
  // list matches the number that was clicked.
  const [searchParams, setSearchParams] = useSearchParams();
  const urlStatus = searchParams.get('status') || 'all';
  const urlPriority = searchParams.get('priority') || undefined;
  const urlPeriod = searchParams.get('period') || undefined;
  const urlValue = searchParams.get('value') || undefined;
  const [activeTab, setActiveTab] = useState(urlStatus);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    setActiveTab(urlStatus);
    setPage(1);
  }, [urlStatus]);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setPage(1);
    }, 350);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const { data: counts } = useQuery({
    queryKey: ['leads', 'counts'],
    queryFn: () => leadsApi.getCounts().then(res => res.data),
    staleTime: 5 * 60 * 1000
  });

  const { data: leadData, isLoading, isFetching } = useQuery({
    queryKey: ['leads', 'my-leads', activeTab, debouncedSearch, page, urlPriority, urlPeriod, urlValue],
    queryFn: () => leadsApi.getLeads({
      status: activeTab === 'all' ? undefined : activeTab,
      priority: urlPriority,
      period: urlPeriod,
      value: urlValue,
      search: debouncedSearch,
      page,
      limit: 20
    }).then(res => res.data),
    staleTime: 0,
    placeholderData: keepPreviousData
  });

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const res = await leadsApi.getLeads({
        status: activeTab === 'all' ? undefined : activeTab,
        priority: urlPriority,
        period: urlPeriod,
        value: urlValue,
        search: debouncedSearch,
        limit: 9999
      });
      const leads = res.data.leads || [];
      
      if (leads.length === 0) {
        addToast('No leads to export', 'warning');
        return;
      }

      const headers = ['Company', 'Lead Name', 'Phone', 'Email', 'Status', 'Last Contact'];
      const rows = leads.map(l => [
        l.company || 'N/A',
        l.name,
        l.phone,
        l.email || 'N/A',
        l.status?.toUpperCase(),
        new Date(l.updatedAt).toLocaleDateString()
      ]);

      const csvContent = [headers, ...rows].map(r => r.join(',')).join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `my-leads-export-${new Date().toISOString().split('T')[0]}.csv`;
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

  // Ticking rows is scoped to the page on screen, so anything that changes which
  // rows those are clears the selection.
  const selection = useLeadSelection(
    leads,
    [activeTab, debouncedSearch, page, urlPriority, urlPeriod, urlValue].join('|')
  );

  const tabs = [
    { id: 'all', label: 'All', count: counts?.total || 0 },
    { id: 'new', label: 'New', count: counts?.new || 0 },
    { id: 'followup', label: 'Follow-up', count: counts?.followup || 0 },
    { id: 'virtual_meeting', label: 'Virtual Meeting', count: counts?.meeting_virtual || 0 },
    { id: 'direct_meeting', label: 'Direct Meeting', count: counts?.meeting_direct || 0 },
    {
      id: 'converted',
      label: 'Converted',
      count: (counts?.converted || 0) + (counts?.blocking_amount_received || 0) + (counts?.full_amount_received || 0) + (counts?.agreement_signed || 0)
    },
    { id: 'lost', label: 'Lost', count: counts?.lost || 0 },
    { id: 'rnr', label: 'RNR', count: counts?.rnr || 0 }
  ];

  const tabIds = tabs.map(t => t.id);
  const extraFilters = [
    !tabIds.includes(activeTab) ? activeTab.replace(/_/g, ' ') : null,
    urlPriority ? `${urlPriority.replace(/,/g, ' / ')} priority` : null,
    urlPeriod ? (urlValue || urlPeriod) : null
  ].filter(Boolean);

  const clearUrlFilters = () => {
    const next = new URLSearchParams(searchParams);
    ['status', 'priority', 'period', 'value'].forEach(k => next.delete(k));
    setSearchParams(next);
    setActiveTab('all');
    setPage(1);
  };

  const openModal = (type, data = null) => {
    window.dispatchEvent(new CustomEvent('open-modal', { 
      detail: typeof type === 'string' ? { type, ...data } : type 
    }));
  };

  const formatLastContact = (dateStr) => {
    if (!dateStr) return 'Never';
    const date = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    return `${diffDays}d ago`;
  };

  return (
    <div className="leads-page animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* 1. Header Section */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">My Leads</h1>
          <p className="text-sm text-muted">Manage and track all your mapped opportunities</p>
        </div>
        <div className="flex gap-3">
          <div className="search-bar" style={{ width: '320px', background: 'var(--surface)' }}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <circle cx="6.5" cy="6.5" r="4" stroke="var(--text-muted)" strokeWidth="1.5"/>
              <path d="M11 11l2.5 2.5" stroke="var(--text-muted)" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            <input 
              placeholder="Search leads, tasks, meetings..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <button className="btn btn-orange btn-sm shadow-orange/10 font-bold px-5" onClick={() => openModal('add-lead')}>+ New Lead</button>
        </div>
      </div>

      {/* 2. Total Mapped Leads & Filters */}
      <div className="flex justify-between items-center mb-6 bg-surface p-4 rounded-xl border border-border shadow-sm">
        <div className="flex gap-3 overflow-x-auto">
          {tabs.map(tab => (
            <button 
              key={tab.id}
              onClick={() => { setActiveTab(tab.id); setPage(1); }}
              className={`filter-chip-v2 ${activeTab === tab.id ? 'active' : ''}`}
            >
              {tab.label} ({tab.count})
            </button>
          ))}
        </div>
        
        <div className="flex items-center gap-2 border-l border-border pl-4">
          <button className="btn btn-ghost btn-sm font-bold text-xs" onClick={handleExport} disabled={isExporting}>Export CSV</button>
          <button className="btn btn-orange btn-sm font-bold text-xs px-4" onClick={() => openModal('add-lead')}>+ Add Lead</button>
        </div>
      </div>

      {extraFilters.length > 0 && (
        <div className="flex items-center justify-between mb-4 px-4 py-2.5 rounded-xl border border-blue/20 bg-blue/5 text-[13px]">
          <span className="font-semibold text-text-secondary capitalize">Filtered: {extraFilters.join(' · ')}</span>
          <button className="text-blue font-bold text-xs underline" onClick={clearUrlFilters}>Clear filters</button>
        </div>
      )}

      {/* A District Manager is the bottom of the reporting tree: the only bulk move
          available is upward, so the bar offers Escalate and no Allocate. */}
      <LeadSelectionBar
        count={selection.count}
        canAllocate={false}
        onEscalate={() => openModal('escalate-leads', { leads: selection.selectedLeads })}
        onClear={selection.clear}
      />

      {/* 3. Lead Table */}
      <div className="table-container shadow-sm border border-border rounded-xl overflow-hidden">
        <table className="lead-list-table w-full">
          <thead>
            <tr className="bg-surface2/50 border-b border-border text-[12px] font-black uppercase tracking-widest text-text-muted">
              <th className="p-4 text-left w-10">
                <LeadCheckbox
                  label="Select all leads on this page"
                  checked={selection.allSelected}
                  indeterminate={selection.someSelected}
                  onChange={selection.toggleAll}
                />
              </th>
              <th className="p-4 text-left">Company / Name</th>
              <th className="p-4 text-left">Phone</th>
              <th className="p-4 text-center">Status</th>
              <th className="p-4 text-center">Last Contact</th>
              <th className="p-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {isLoading ? (
              <tr><td colSpan="6" className="text-center py-12 text-muted">Fetching leads...</td></tr>
            ) : leads.length === 0 ? (
              <tr><td colSpan="6" className="text-center py-12 text-muted italic">No leads found matching your criteria</td></tr>
            ) : leads.map(lead => (
              <tr key={lead._id} className={`transition-colors group ${selection.isSelected(lead._id) ? 'bg-amber/5' : 'hover:bg-surface'}`}>
                <td className="p-4">
                  <LeadCheckbox
                    label={`Select ${lead.name}`}
                    checked={selection.isSelected(lead._id)}
                    onChange={() => selection.toggle(lead._id)}
                  />
                </td>
                <td className="p-4">
                  {/* Same as every other lead list: the name opens the lead's own
                      page with its details and full history. */}
                  <Link
                    to={`/dashboard/leads/${lead._id}`}
                    title={`Open ${lead.name}`}
                    className="font-bold text-sm text-text-primary hover:text-orange hover:underline group-hover:text-orange transition-colors"
                  >
                    {lead.company || lead.name}
                  </Link>
                  <div className="text-[12px] text-text-muted">{lead.name}</div>
                </td>
                <td className="p-4 text-[14px] font-medium text-text-secondary">{lead.phone}</td>
                <td className="p-4 text-center">
                  <Tag
                    variant={
                      ['converted', 'blocking_amount_received', 'full_amount_received', 'agreement_signed'].includes(lead.status) ? 'green' :
                      (lead.status === 'meeting_virtual' || lead.status === 'meeting_direct') ? 'blue' :
                      (lead.status === 'followup' || lead.status === 'new') ? 'amber' : 'red'
                    }
                    label={
                      lead.status === 'blocking_amount_received' ? 'BLOCKING AMT' :
                      lead.status === 'full_amount_received' ? 'FULL AMT' :
                      lead.status === 'agreement_signed' ? 'AGREEMENT' :
                      lead.status?.replace(/_/g, ' ').toUpperCase() ?? 'NEW'
                    }
                  />
                </td>
                <td className="p-4 text-center text-[14px] text-text-muted font-bold">{formatLastContact(lead.updatedAt)}</td>
                <td className="p-4 text-right">
                  <div className="flex justify-end gap-2">
                    <Button size="2xs" variant="outline" className="font-bold" onClick={() => openModal('update-lead', { leadData: lead })}>Update</Button>
                    {/* A District Manager is the bottom of the reporting tree —
                        there is nobody to allocate down to, so the row offers the
                        upward move instead. */}
                    <Button size="2xs" variant="outline" className="text-amber border-amber/20 font-bold" onClick={() => openModal('escalate-lead', { leadData: lead })}>Escalate</Button>
                    {/* Renders only for leads this user is allowed to delete. */}
                    <DeleteLeadButton lead={lead} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex justify-between items-center mt-6 p-4 bg-surface rounded-xl border border-border shadow-sm">
        <div className="text-[13px] font-black text-text-muted uppercase tracking-widest">
           Showing {((page - 1) * 20) + 1} - {Math.min(page * 20, total)} of {total} leads
        </div>
        <div className="flex gap-2">
          <Button size="xs" variant="outline" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Previous</Button>
          <Button size="xs" variant="outline" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Next</Button>
        </div>
      </div>

    </div>
  );
};

export default LeadList;
