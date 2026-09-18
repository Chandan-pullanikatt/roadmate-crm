import React, { useState, useEffect, useMemo } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import DashboardSkeleton from '../../../components/skeletons/DashboardSkeleton';
import { leadsApi } from '../../../api/leadsApi';
import { Button, Tag } from '../../../components/ui';
import { exportToCSV } from '../../../utils/exportUtils';
import { Country, State } from 'country-state-city';

const COUNTRIES = Country.getAllCountries();
// Leads without a country are almost all Indian, so India's states are listed
// until a country is picked.
const statesFor = (countryName) => {
  const iso = COUNTRIES.find((c) => c.name === countryName)?.isoCode || 'IN';
  return State.getStatesOfCountry(iso);
};

// This page is the drill-down behind the Founder's "Expected Onboarding" card, so it must
// mirror that number: open leads tagged Hot or Warm, split into a tab each. It used to load
// the entire lead list, which is why the drill-down never matched the card.
const CLOSED_STATUSES = 'converted,lost,not_interested';
const PAGE_SIZE = 15;

const ExpectedOnboarding = () => {
  const [activeTab, setActiveTab] = useState('Hot');
  const [filterState, setFilterState] = useState('All');
  const [filterCountry, setFilterCountry] = useState('All');
  const [listSearch, setListSearch] = useState('');
  const [debouncedListSearch, setDebouncedListSearch] = useState('');
  const [page, setPage] = useState(1);

  // The Founder card counts only leads created inside the period picked on the Overview,
  // so it hands that period over in the URL. Opened from the sidebar there is no period
  // and the page lists every open Hot/Warm lead, which is what its subtitle promises.
  const [searchParams, setSearchParams] = useSearchParams();
  const period = searchParams.get('period') || undefined;
  const periodValue = searchParams.get('value') || undefined;
  const periodLabel = period ? (periodValue || period) : null;

  const clearPeriod = () => {
    const next = new URLSearchParams(searchParams);
    next.delete('period');
    next.delete('value');
    setSearchParams(next, { replace: true });
  };

  // Debounce list search (API)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedListSearch(listSearch);
    }, 350);
    return () => clearTimeout(timer);
  }, [listSearch]);

  // Every query on this page shares one filter set, so the tab counts, the rows and
  // the pagination footer can never disagree with each other.
  const baseFilters = useMemo(() => ({
    excludeStatuses: CLOSED_STATUSES,
    state: filterState === 'All' ? undefined : filterState,
    country: filterCountry === 'All' ? undefined : filterCountry,
    search: debouncedListSearch || undefined,
    period,
    value: periodValue
  }), [filterState, filterCountry, debouncedListSearch, period, periodValue]);

  // Any change to what is being listed sends you back to page 1 — otherwise a filter
  // applied on page 3 lands on an empty page.
  useEffect(() => {
    setPage(1);
  }, [activeTab, filterState, filterCountry, debouncedListSearch, period, periodValue]);

  const { data: leadData, isLoading, isFetching } = useQuery({
    queryKey: ['leads', 'expected-onboarding', activeTab, filterState, filterCountry, debouncedListSearch, period, periodValue, page],
    queryFn: () => leadsApi.getLeads({
      ...baseFilters,
      priority: activeTab.toLowerCase(),
      page,
      limit: PAGE_SIZE
    }).then(res => res.data),
    staleTime: 5 * 60 * 1000,
    placeholderData: keepPreviousData
  });

  // The tab counts used to come off the Founder dashboard card, which counts only leads
  // *created inside the selected period* (default: this week). The table below has no
  // such date filter, so the tabs read (0) while 15 rows sat underneath them. Count the
  // same query the table runs instead — page 1 of each priority just for its total.
  const { data: tabCounts } = useQuery({
    queryKey: ['leads', 'expected-onboarding', 'counts', filterState, filterCountry, debouncedListSearch, period, periodValue],
    queryFn: async () => {
      const [hot, warm] = await Promise.all([
        leadsApi.getLeads({ ...baseFilters, priority: 'hot', limit: 1 }).then(res => res.data),
        leadsApi.getLeads({ ...baseFilters, priority: 'warm', limit: 1 }).then(res => res.data)
      ]);
      return { Hot: hot?.total ?? 0, Warm: warm?.total ?? 0 };
    },
    staleTime: 5 * 60 * 1000,
    placeholderData: keepPreviousData
  });

  const openModal = (type, data = null) => {
    window.dispatchEvent(new CustomEvent('open-modal', { 
      detail: typeof type === 'string' ? { type, ...data } : type 
    }));
  };

  const handleExport = () => {
    if (filteredLeads.length === 0) return;
    const dataToExport = filteredLeads.map(l => ({
      'Lead Name': l.name,
      'Company': l.company || 'N/A',
      'Phone': l.phone || 'N/A',
      'Owner': l.owner?.name || 'Unassigned',
      'Status': l.status?.toUpperCase(),
      'State': l.state || 'N/A',
      'Follow-up Date': l.followUpDate ? new Date(l.followUpDate).toLocaleDateString() : 'N/A'
    }));
    exportToCSV(dataToExport, `Expected_Onboarding_${activeTab}_Leads`);
  };

  const tabs = [
    { label: 'Hot', count: tabCounts?.Hot ?? 0 },
    { label: 'Warm', count: tabCounts?.Warm ?? 0 }
  ];

  const total = leadData?.total ?? 0;
  const totalPages = Math.max(leadData?.totalPages ?? 1, 1);
  const rangeStart = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(page * PAGE_SIZE, total);

  const filteredLeads = leadData?.leads || [];
  const stateOptions = useMemo(() => statesFor(filterCountry), [filterCountry]);

  if (isLoading) return <DashboardSkeleton />;

  const getStatusStyle = (status) => {
    const s = status.toLowerCase();
    if (s.includes('hot')) return 'ls-hot';
    if (s.includes('meeting')) return 'ls-meeting';
    if (s.includes('warm')) return 'ls-warm';
    if (s.includes('followup') || s.includes('called')) return 'ls-followup';
    if (s.includes('rnr')) return 'ls-rnr';
    if (s.includes('converted')) return 'ls-converted';
    if (s.includes('lost') || s.includes('not_interested')) return 'ls-lost';
    return 'ls-cold';
  };

  const formatFollowUp = (date, time) => {
    if (!date) return '—';
    const d = new Date(date);
    const today = new Date();
    const isToday = d.toDateString() === today.toDateString();
    
    if (isToday) {
      return <span className="text-blue font-bold">Today {time || ''}</span>;
    }
    
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <div className="animate-in fade-in duration-500 space-y-6">
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-border">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-text-primary">Expected Onboarding Leads</h2>
              <p className="text-[14px] text-text-muted mt-0.5">
                Hot &amp; Warm leads still open, across all states{periodLabel ? ` - created in ${periodLabel}` : ''}
              </p>
            </div>
          </div>

          {/* TABS — Hot / Warm only, matching the Expected Onboarding card */}
          <div className="flex flex-wrap gap-2 pt-2">
            {tabs.map((tab) => (
              <button
                key={tab.label}
                onClick={() => setActiveTab(tab.label)}
                className={`px-4 py-2 rounded-xl text-[14px] font-bold transition-all border shadow-sm flex items-center gap-2 ${activeTab === tab.label ? 'bg-[#f0fdf4] text-[#166534] border-[#dcfce7]' : 'bg-white text-text-muted border-border hover:border-blue/30'}`}
              >
                {tab.label} <span className={`opacity-60 ${activeTab === tab.label ? 'text-[#166534]' : 'text-blue'}`}>({tab.count})</span>
              </button>
            ))}
            {periodLabel && (
              <button
                onClick={clearPeriod}
                title="Show every open Hot & Warm lead"
                className="px-4 py-2 rounded-xl text-xs font-bold border border-blue/20 bg-blue-light text-blue flex items-center gap-2"
              >
                {periodLabel} only <span className="opacity-60">&times;</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* TABLE SECTION */}
      <div className="bg-white rounded-2xl shadow-sm border border-border overflow-hidden">
        <div className="p-5 border-b border-border flex justify-between items-center bg-white/50 backdrop-blur-sm sticky top-0 z-10">
          <h3 className="font-bold text-text-primary">{activeTab} Leads</h3>
          <div className="flex gap-3">
             <div className="relative">
                <input 
                  type="text" 
                  placeholder="Search leads.." 
                  className="bg-surface2/30 border border-border rounded-lg pl-9 pr-4 py-1.5 text-xs w-64 focus:bg-white outline-none focus:border-blue"
                  value={listSearch}
                  onChange={e => setListSearch(e.target.value)}
                />
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="11" cy="11" r="8"></circle><path d="M21 21l-4.35-4.35"></path></svg>
             </div>
             <select
               className="bg-white border border-border rounded-lg px-4 py-1.5 text-[14px] font-bold text-text-secondary outline-none focus:border-blue min-w-[120px] max-w-[180px]"
               value={filterCountry}
               onChange={e => { setFilterCountry(e.target.value); setFilterState('All'); }}
             >
               <option value="All">All Countries</option>
               {COUNTRIES.map((c) => (
                 <option key={c.isoCode} value={c.name}>{c.name}</option>
               ))}
             </select>
             <select
               className="bg-white border border-border rounded-lg px-4 py-1.5 text-[14px] font-bold text-text-secondary outline-none focus:border-blue min-w-[120px] max-w-[180px]"
               value={filterState}
               onChange={e => setFilterState(e.target.value)}
             >
               <option value="All">All States</option>
               {stateOptions.map((s) => (
                 <option key={s.isoCode} value={s.name}>{s.name}</option>
               ))}
             </select>
             <Button variant="outline" size="sm" className="bg-white text-text-primary font-bold" onClick={handleExport}>Export</Button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface2/30 border-b border-border">
                <th className="p-4 text-[13px] font-bold uppercase tracking-widest text-text-muted">Lead</th>
                <th className="p-4 text-[13px] font-bold uppercase tracking-widest text-text-muted">Phone</th>
                <th className="p-4 text-[13px] font-bold uppercase tracking-widest text-text-muted">Assigned</th>
                <th className="p-4 text-[13px] font-bold uppercase tracking-widest text-text-muted text-center">Status</th>
                <th className="p-4 text-[13px] font-bold uppercase tracking-widest text-text-muted">Last Action</th>
                <th className="p-4 text-[13px] font-bold uppercase tracking-widest text-text-muted">Next Follow-up</th>
                <th className="p-4 text-[13px] font-bold uppercase tracking-widest text-text-muted text-right">Actions</th>
              </tr>
            </thead>
            <tbody className={`divide-y divide-border font-medium text-text-primary ${isFetching ? 'opacity-60 transition-opacity' : 'transition-opacity'}`}>
              {filteredLeads.map((l) => (
                <tr key={l._id} className="hover:bg-surface2/20 transition-colors group">
                  <td className="p-4">
                    <div className="font-bold text-[14px] text-text-primary">{l.name}</div>
                  </td>
                  <td className="p-4 text-[15px] font-mono text-text-secondary">{l.phone || 'N/A'}</td>
                  <td className="p-4">
                    <div className="flex items-center gap-2">
                       <div className="w-6 h-6 rounded-full bg-blue-light text-blue flex items-center justify-center text-[10px] font-bold uppercase border border-blue/10">
                         {l.owner?.name?.[0] || 'U'}
                       </div>
                       <span className="text-[13px] font-medium">{l.owner?.name || 'Unassigned'}</span>
                    </div>
                  </td>
                  <td className="p-4 text-center">
                    <span className={`tag ${getStatusStyle(l.status)}`}>
                      {l.status.toUpperCase()}
                    </span>
                  </td>
                  <td className="p-4">
                     <span className="text-[14.5px] text-text-muted line-clamp-1 max-w-[150px]">{l.notes || 'No action recorded'}</span>
                  </td>
                  <td className="p-4">
                     <div className="text-[13px] font-medium">{formatFollowUp(l.followUpDate, l.followUpTime)}</div>
                  </td>
                  <td className="p-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button className="bg-white border border-border text-text-secondary px-3 py-1 rounded-md text-[13px] font-bold hover:bg-surface2 transition-all" onClick={() => openModal('view-lead', { leadId: l._id })}>View</button>
                      <button className="bg-white border border-border text-text-secondary px-3 py-1 rounded-md text-[13px] font-bold hover:bg-surface2 transition-all" onClick={() => openModal('lead-history', { leadId: l._id, leadName: l.name })}>History</button>
                      <button className="bg-[#0f766e] text-white px-3 py-1 rounded-md text-[11px] font-bold hover:shadow-md transition-all" onClick={() => openModal('update-lead', { leadData: l })}>Update</button>
                      <button className="bg-blue text-white px-3 py-1 rounded-md text-[11px] font-bold hover:shadow-md transition-all" onClick={() => openModal('allocate-lead', { leadData: l })}>Allocate</button>
                      <button className="bg-white border border-red/20 text-red px-3 py-1 rounded-md text-[11px] font-bold hover:bg-red-light transition-all" onClick={() => leadsApi.deleteLead(l._id).then(() => window.location.reload())}>Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredLeads.length === 0 && !isLoading && (
                 <tr><td colSpan="7" className="p-16 text-center text-text-muted italic">
                   {debouncedListSearch ? "No leads found matching your search" : "No leads found matching your criteria."}
                 </td></tr>
              )}
              {isLoading && (
                 <tr><td colSpan="7" className="p-16 text-center text-text-muted shimmer">Loading lead data...</td></tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex justify-between items-center p-5 border-t border-border bg-surface2/10">
          <div className="text-[14px] text-text-muted font-medium">
            {`Showing ${rangeStart}-${rangeEnd} of ${total} ${activeTab.toLowerCase()} leads`}
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[14px] text-text-muted font-medium">Page {page} of {totalPages}</span>
            <div className="flex gap-2">
              <Button
                size="xs"
                variant="outline"
                className="bg-white px-4"
                disabled={page <= 1 || isFetching}
                onClick={() => setPage(p => Math.max(1, p - 1))}
              >Previous</Button>
              <Button
                size="xs"
                variant="outline"
                className="bg-white px-4"
                disabled={page >= totalPages || isFetching}
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              >Next</Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExpectedOnboarding;
