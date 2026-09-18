import React, { useState, useEffect } from 'react';
import { useQuery, keepPreviousData, useQueryClient } from '@tanstack/react-query';
import { useLocation } from 'react-router-dom';
import DashboardSkeleton from '../../components/skeletons/DashboardSkeleton';
import { leadsApi } from '../../api/leadsApi';
import { dashboardApi } from '../../api/dashboardApi';
import { Avatar, Button, Tag } from '../../components/ui';
import { useToast } from '../../context/ToastContext';
import { LEAD_STATUS_GROUPS, GROUP_ORDER, groupParam } from '../../constants/leadStatusGroups';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

// A period arriving from a Founder Summary card can be any of its tabs, but this
// page only offers a month picker. Anything else (a week, a quarter, a year) is
// still honoured and shown as a removable chip.
const periodLabelOf = (period, value) => {
  if (!period) return null;
  if (period === 'today') return 'Today';
  return value || period;
};

/**
 * The lead list, shared by the Founder and State Manager dashboards. Both render
 * the same filters, tabs, table and actions; only the rows differ, because the
 * API scopes every query to the caller's place in the reporting tree. Keeping one
 * component is what stops the two pages drifting apart again -- the State Manager
 * copy used to have its own hand-written tab set and no period or priority filter
 * at all.
 */
const LeadManagementPage = ({
  breadcrumbRoot = 'Founder',
  defaultTitle = 'Global Lead Management',
  subtitle = 'Cross-state lead tracking · Allocation control · Lifecycle monitoring',
  listTitle = 'Enterprise Lead List',
  footerNoun = 'enterprise leads',
  exportPrefix = 'leads-export',
  // Role-specific row actions. A State Manager can escalate a lead to the Founder;
  // the Founder has nobody to escalate to, so its page passes nothing.
  extraRowActions = null,
  // Default owner filter for routes that are scoped by definition -- the Industry
  // Manager has a "my leads" route ('self') and a "team leads" route ('team'). An
  // explicit ?owner= in the URL still wins, so drill-downs can widen the scope.
  defaultOwnerScope = '',
  // Hidden when a role has no use for it: every row on a state-scoped page is the
  // same state, so the column and its filter say nothing.
  showStateColumn = true,
} = {}) => {
  const queryClient = useQueryClient();
  const { addToast } = useToast();
  const location = useLocation();
  // Fix: Lead Pipeline Clickable Numbers — read status from URL param to set initial tab
  const [activeTab, setActiveTab] = useState(() => {
    const params = new URLSearchParams(location.search);
    return params.get('status') || 'all';
  });
  const [ownerFilter, setOwnerFilter] = useState(() => {
    const params = new URLSearchParams(location.search);
    return params.get('owner') || defaultOwnerScope;
  });
  // Set when a manager's own pipeline links here, so the page can say whose leads these are.
  const [ownerName, setOwnerName] = useState(() => {
    const params = new URLSearchParams(location.search);
    return params.get('ownerName') || '';
  });
  // Hot/Warm/Cold cards on the Founder pipeline link here with ?priority=
  const [priorityFilter, setPriorityFilter] = useState(() => {
    const params = new URLSearchParams(location.search);
    return params.get('priority') || '';
  });
  // The Total Leads card counts only leads created inside the period picked on the
  // Overview and hands that period over in the URL. Without this the list ignored it
  // and showed all time, so a card reading 47 opened onto 603 rows.
  const [period, setPeriod] = useState(() => {
    const params = new URLSearchParams(location.search);
    return params.get('period') || '';
  });
  const [periodValue, setPeriodValue] = useState(() => {
    const params = new URLSearchParams(location.search);
    return params.get('value') || '';
  });
  // Expected Onboarding links here with an open-statuses-only slice, and
  // Conversions windows on the conversion date rather than the creation date.
  const [excludeStatuses, setExcludeStatuses] = useState(() => {
    const params = new URLSearchParams(location.search);
    return params.get('excludeStatuses') || '';
  });
  const [dateField, setDateField] = useState(() => {
    const params = new URLSearchParams(location.search);
    return params.get('dateField') || '';
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

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    setActiveTab(params.get('status') || 'all');
    setOwnerFilter(params.get('owner') || defaultOwnerScope);
    setOwnerName(params.get('ownerName') || '');
    setPriorityFilter(params.get('priority') || '');
    setPeriod(params.get('period') || '');
    setPeriodValue(params.get('value') || '');
    setExcludeStatuses(params.get('excludeStatuses') || '');
    setDateField(params.get('dateField') || '');
    setPage(1);
  }, [location.search]);

  // Every query on this page shares one filter set. The tab counts used to ignore
  // the period entirely, so with September selected the rows were September's while
  // the tabs above them still read all-time totals.
  const baseFilters = {
    priority: priorityFilter || undefined,
    owner: ownerFilter || undefined,
    state: filterState === 'All' ? undefined : filterState,
    period: period || undefined,
    value: periodValue || undefined,
    excludeStatuses: excludeStatuses || undefined,
    dateField: dateField || undefined,
  };

  const { data: counts } = useQuery({
    queryKey: ['leads', 'counts', ownerFilter, priorityFilter, filterState, period, periodValue, excludeStatuses, dateField],
    queryFn: () => leadsApi.getCounts(baseFilters).then(res => res.data),
    staleTime: 5 * 60 * 1000
  });

  const { data: leadData, isLoading, isFetching } = useQuery({
    queryKey: ['leads', 'global', activeTab, filterState, ownerFilter, priorityFilter, period, periodValue, excludeStatuses, dateField, debouncedSearch, page],
    queryFn: () => leadsApi.getLeads({
      ...baseFilters,
      status: activeTab === 'all' ? undefined : activeTab,
      search: debouncedSearch,
      page,
      limit: 20
    }).then(res => res.data),
    staleTime: 5 * 60 * 1000,
    placeholderData: keepPreviousData
  });

  // Picking a month is a change to what is being listed, so go back to page 1 --
  // otherwise a filter applied on page 8 lands on an empty page.
  const applyPeriod = (nextPeriod, nextValue) => {
    setPeriod(nextPeriod);
    setPeriodValue(nextValue);
    // The month picker means "created in", so drop a conversion-date window that
    // arrived from a card rather than silently applying it to the wrong field.
    setDateField('');
    setPage(1);
  };

  const periodLabel = periodLabelOf(period, periodValue);

  const openModal = (type, data = null) => {
    window.dispatchEvent(new CustomEvent('open-modal', { 
      detail: typeof type === 'string' ? { type, ...data } : type 
    }));
  };

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const res = await leadsApi.getLeads({
        ...baseFilters,
        status: activeTab === 'all' ? undefined : activeTab,
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
      a.download = `${exportPrefix}-${new Date().toISOString().split('T')[0]}.csv`;
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

  // Tabs come from the canonical status groups so every status lands in exactly
  // one tab, the counts add up to All, and each tab matches the pipeline card
  // that links to it. The hardcoded list this replaces had no Blocking, Full
  // Amount Received or Escalated tab at all, and counted only 'followup' of the
  // Follow-up group and only 'lost' of the Lost group — which is why the list
  // read 418/81 where the Overview read 603/94 (QA BUG-004/005/010).
  const tabs = [
    { id: 'all', label: 'All', count: counts?.total || 0 },
    ...GROUP_ORDER.map(label => ({
      id: groupParam(label),
      label,
      count: LEAD_STATUS_GROUPS[label].reduce((sum, st) => sum + (counts?.[st] || 0), 0),
    })),
  ];

  return (
    <div className="animate-in fade-in duration-500">
      <div className="flex items-center gap-2 mb-4 text-[13px] font-bold uppercase tracking-widest text-text-muted">
        <span>{breadcrumbRoot}</span>
        <span className="text-text-muted/30">›</span>
        <span className="text-text-primary">Lead Management</span>
      </div>

      <div className="flex justify-between items-end mb-6">
        <div>
          <div className="text-[20px] font-bold text-text-primary">
            {ownerFilter === 'unassigned'
              ? 'Unallocated Lead Management'
              : ownerName
                ? `${ownerName}'s Leads`
                : priorityFilter
                ? `${priorityFilter.charAt(0).toUpperCase()}${priorityFilter.slice(1)} Leads`
                : defaultTitle}
          </div>
          <div className="text-[14px] text-text-muted mt-1">
            {priorityFilter
              ? `Showing ${priorityFilter} leads only · Allocation control · Lifecycle monitoring`
              : subtitle}
            {periodLabel ? ` · ${dateField === 'convertedAt' ? 'converted' : 'created'} in ${periodLabel}` : ''}
          </div>
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

      {/* Period filter. A month picked here filters the rows AND the tab counts
          above them; a period arriving from a Founder Summary card (a week, a
          quarter, a year) is honoured too and shown as the chip on the right. */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <span className="text-[12px] font-bold uppercase tracking-widest text-text-muted mr-1">Period</span>
        <select
          className="bg-white border border-border rounded-lg px-4 py-1.5 text-[11px] font-bold uppercase tracking-wider outline-none focus:border-blue transition-colors min-w-[150px]"
          value={period === 'month' || period === 'monthly' ? periodValue : ''}
          onChange={e => applyPeriod(e.target.value ? 'month' : '', e.target.value)}
        >
          <option value="">All Time</option>
          {MONTHS.map(m => <option key={m} value={m}>{m}</option>)}
        </select>

        {periodLabel && (
          <button
            onClick={() => applyPeriod('', '')}
            title="Show leads from every period"
            className="px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wider border bg-[#eff6ff] text-[#3b82f6] border-[#bfdbfe] hover:bg-[#dbeafe] transition-colors"
          >
            {dateField === 'convertedAt' ? 'Converted in ' : ''}{periodLabel} only <span className="opacity-60">&times;</span>
          </button>
        )}

        {ownerName && (
          <button
            onClick={() => { setOwnerFilter(''); setOwnerName(''); setPage(1); }}
            title="Show leads from every owner"
            className="px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wider border bg-[#eff6ff] text-[#3b82f6] border-[#bfdbfe] hover:bg-[#dbeafe] transition-colors"
          >
            {ownerName} only <span className="opacity-60">&times;</span>
          </button>
        )}
      </div>

      {/* Priority filter — the Hot/Warm/Cold cards on the summary link straight in
          here, and without this row there was no sign the list was filtered. */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <span className="text-[12px] font-bold uppercase tracking-widest text-text-muted mr-1">Priority</span>
        {[
          { id: '', label: 'All' },
          { id: 'hot', label: 'Hot' },
          { id: 'warm', label: 'Warm' },
          { id: 'cold', label: 'Cold' },
        ].map(p => (
          <button
            key={p.id || 'all'}
            onClick={() => { setPriorityFilter(p.id); setPage(1); }}
            className={`px-4 py-1.5 rounded-lg text-[13px] font-bold uppercase tracking-wider border transition-all ${
              priorityFilter === p.id
                ? p.id === 'hot'
                  ? 'bg-[#fef2f2] text-[#dc2626] border-[#fecaca]'
                  : p.id === 'warm'
                    ? 'bg-[#fffbeb] text-[#d97706] border-[#fde68a]'
                    : p.id === 'cold'
                      ? 'bg-[#eff6ff] text-[#3b82f6] border-[#bfdbfe]'
                      : 'bg-[#0f766e] text-white border-[#0f766e]'
                : 'bg-white text-text-muted border-border hover:border-blue/30'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2 mb-8">
        {tabs.map(tab => (
          <button 
            key={tab.id}
            onClick={() => { setActiveTab(tab.id); setPage(1); }}
            className={`px-5 py-2 rounded-xl text-[13px] font-bold uppercase tracking-wider transition-all border shadow-sm ${activeTab === tab.id ? 'bg-[#0f766e] text-white border-[#0f766e]' : 'bg-white text-text-muted border-border hover:border-blue/30'}`}
          >
            {tab.label} <span className={`ml-2 opacity-60 ${activeTab === tab.id ? 'text-white' : 'text-blue'}`}>{tab.count}</span>
          </button>
        ))}
      </div>

      <div className="card overflow-hidden border border-border bg-white rounded-xl shadow-sm">
        <div className="card-header border-b border-border bg-white flex justify-between items-center px-5 py-4">
          <div className="text-[15px] font-bold text-text-primary">{listTitle}</div>
          <div className="flex gap-3">
             <div className="relative">
               <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="11" cy="11" r="8"></circle><path d="M21 21l-4.35-4.35"></path></svg>
               <input 
                 type="text" 
                 placeholder="Search lead, ID or business..." 
                 className="bg-surface2/50 border border-border rounded-lg pl-9 pr-4 py-1.5 text-[12px] outline-none focus:border-blue transition-colors w-64"
                 value={searchTerm}
                 onChange={e => setSearchTerm(e.target.value)}
               />
             </div>
             {showStateColumn && (
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
             )}
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-[13px] uppercase tracking-wider font-bold text-text-muted">
            <thead>
              <tr className="bg-surface2/50 border-b border-border">
                <th className="p-4">Lead Details</th>
                {showStateColumn && <th className="p-4 text-center">State</th>}
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
                    <div className="text-[12px] text-text-muted mt-0.5">{l.leadId}</div>
                  </td>
                  {showStateColumn && (
                    <td className="p-4 text-center">
                      <span className="bg-blue/10 text-blue px-2 py-0.5 rounded text-[10px] font-bold">{l.state || 'N/A'}</span>
                    </td>
                  )}
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
                  <td className="p-4 text-center text-[13px] text-text-muted font-mono">{new Date(l.updatedAt).toLocaleDateString()}</td>
                  <td className="p-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {/* Fix: Lead Pipeline — View Details button opens lead history */}
                      <Button size="xs" variant="outline" className="bg-white border-border shadow-sm text-text-muted font-bold px-3" onClick={() => openModal('lead-history', { leadId: l._id, leadName: l.name })}>View</Button>
                      <Button size="xs" variant="outline" className="bg-white border-border shadow-sm text-text-primary font-bold px-3" onClick={() => openModal('update-lead', { leadData: l })}>Update</Button>
                      <Button size="xs" variant="outline" className="bg-white border-blue/10 text-blue border-blue/20 shadow-sm font-bold px-3" onClick={() => openModal('allocate-lead', { leadData: l })}>Allocate</Button>
                      {extraRowActions?.(l, openModal)}
                    </div>
                  </td>
                </tr>
              ))}
              {leads.length === 0 && !isLoading && (
                 <tr><td colSpan={showStateColumn ? 6 : 5} className="p-12 text-center text-text-muted italic normal-case">No leads matching your criteria.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex justify-between items-center p-5 border-t border-border bg-surface2/10">
          <div className="text-[13px] text-text-muted font-bold uppercase tracking-tight">
            Showing {((page - 1) * 20) + 1} - {Math.min(page * 20, total)} of {total} {footerNoun}
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

export default LeadManagementPage;
