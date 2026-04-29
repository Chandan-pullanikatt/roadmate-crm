import React, { useState, useEffect, useMemo } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import DashboardSkeleton from '../../../components/skeletons/DashboardSkeleton';
import { leadsApi } from '../../../api/leadsApi';
import { dashboardApi } from '../../../api/dashboardApi';
import { Button, Tag } from '../../../components/ui';

const ExpectedOnboarding = () => {
  const [activeTab, setActiveTab] = useState('All');
  const [filterState, setFilterState] = useState('All');
  const [listSearch, setListSearch] = useState('');
  const [headerSearch, setHeaderSearch] = useState('');
  const [debouncedListSearch, setDebouncedListSearch] = useState('');
  const [debouncedHeaderSearch, setDebouncedHeaderSearch] = useState('');

  // Debounce list search (API)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedListSearch(listSearch);
    }, 350);
    return () => clearTimeout(timer);
  }, [listSearch]);

  // Debounce header search (Local)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedHeaderSearch(headerSearch);
    }, 350);
    return () => clearTimeout(timer);
  }, [headerSearch]);

  const { data: dashData } = useQuery({
    queryKey: ['dashboard', 'founder'],
    queryFn: () => dashboardApi.getFounderDashboard().then(res => res.data),
    staleTime: 5 * 60 * 1000,
    placeholderData: keepPreviousData
  });

  const { data: leadData, isLoading, isFetching } = useQuery({
    queryKey: ['leads', 'global', activeTab, filterState, debouncedListSearch],
    queryFn: () => leadsApi.getLeads({ 
      status: activeTab === 'All' ? undefined : activeTab.toLowerCase().replace(' ', '_'), 
      state: filterState === 'All' ? undefined : filterState,
      search: debouncedListSearch,
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

  const pipelineStats = dashData?.pipelineStats || [];

  // Local filtering for Header Search
  const filteredLeads = useMemo(() => {
    let result = leadData?.leads || [];
    if (debouncedHeaderSearch) {
      const query = debouncedHeaderSearch.toLowerCase();
      result = result.filter(l => 
        l.name?.toLowerCase().includes(query) ||
        l.company?.toLowerCase().includes(query) ||
        l.owner?.name?.toLowerCase().includes(query) ||
        l.state?.toLowerCase().includes(query)
      );
    }
    return result;
  }, [leadData?.leads, debouncedHeaderSearch]);

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
      {/* Top Header Section */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-border">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold text-text-primary">Lead Management</h1>
            <p className="text-sm text-text-muted mt-1">All leads - Filter, allocate, track, escalate</p>
          </div>
          <div className="flex items-center gap-3">
              <div className="relative">
                <input 
                  type="text" 
                  placeholder="Search leads, team, states..." 
                  className="bg-surface2/50 border border-border rounded-xl pl-10 pr-4 py-2 text-sm w-72 focus:bg-white transition-all outline-none focus:border-blue"
                  value={headerSearch}
                  onChange={(e) => setHeaderSearch(e.target.value)}
                />
                <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"></circle><path d="M21 21l-4.35-4.35"></path></svg>
              </div>
             <button className="w-10 h-10 flex items-center justify-center rounded-full bg-surface2 text-text-secondary hover:bg-surface3 transition-all relative">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>
                <span className="absolute top-2 right-2 w-2 h-2 bg-red rounded-full border-2 border-white"></span>
             </button>
             <button className="bg-[#0f766e] text-white px-6 py-2 rounded-xl font-bold text-sm shadow-sm hover:shadow-md transition-all" onClick={() => openModal('add-lead')}>+ Add Lead</button>
             <button className="bg-white border border-border text-text-primary px-6 py-2 rounded-xl font-bold text-sm hover:bg-surface2 transition-all">+ State Manager</button>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-text-primary">Lead Management</h2>
              <p className="text-xs text-text-muted mt-0.5">All leads across all states · Filter, allocate, track</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="bg-white" onClick={() => openModal('bulk-upload')}>Bulk Upload</Button>
              <Button variant="outline" size="sm" className="bg-white" onClick={() => openModal('allocate-lead')}>Allocate</Button>
              <Button size="sm" className="bg-[#0f766e] text-white" onClick={() => openModal('add-lead')}>+ Add Lead</Button>
            </div>
          </div>

          {/* TABS */}
          <div className="flex flex-wrap gap-2 pt-2">
            {pipelineStats.map((tab) => (
              <button 
                key={tab.label}
                onClick={() => setActiveTab(tab.label)}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border shadow-sm flex items-center gap-2 ${activeTab === tab.label ? 'bg-[#f0fdf4] text-[#166534] border-[#dcfce7]' : 'bg-white text-text-muted border-border hover:border-blue/30'}`}
              >
                {tab.label} <span className={`opacity-60 ${activeTab === tab.label ? 'text-[#166534]' : 'text-blue'}`}>({tab.count})</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* TABLE SECTION */}
      <div className="bg-white rounded-2xl shadow-sm border border-border overflow-hidden">
        <div className="p-5 border-b border-border flex justify-between items-center bg-white/50 backdrop-blur-sm sticky top-0 z-10">
          <h3 className="font-bold text-text-primary">Lead List</h3>
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
               className="bg-white border border-border rounded-lg px-4 py-1.5 text-xs font-bold text-text-secondary outline-none focus:border-blue min-w-[140px]"
               value={filterState}
               onChange={e => setFilterState(e.target.value)}
             >
               <option value="All">All States</option>
               <option>Kerala</option>
               <option>Telangana</option>
               <option>Maharashtra</option>
             </select>
             <Button variant="outline" size="sm" className="bg-white text-text-primary font-bold">Export</Button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface2/30 border-b border-border">
                <th className="p-4 text-[11px] font-bold uppercase tracking-widest text-text-muted">Lead</th>
                <th className="p-4 text-[11px] font-bold uppercase tracking-widest text-text-muted">Company</th>
                <th className="p-4 text-[11px] font-bold uppercase tracking-widest text-text-muted">Phone</th>
                <th className="p-4 text-[11px] font-bold uppercase tracking-widest text-text-muted">Assigned</th>
                <th className="p-4 text-[11px] font-bold uppercase tracking-widest text-text-muted text-center">Status</th>
                <th className="p-4 text-[11px] font-bold uppercase tracking-widest text-text-muted">Last Action</th>
                <th className="p-4 text-[11px] font-bold uppercase tracking-widest text-text-muted">Next Follow-up</th>
                <th className="p-4 text-[11px] font-bold uppercase tracking-widest text-text-muted text-right">Actions</th>
              </tr>
            </thead>
            <tbody className={`divide-y divide-border font-medium text-text-primary ${isFetching ? 'opacity-60 transition-opacity' : 'transition-opacity'}`}>
              {filteredLeads.map((l) => (
                <tr key={l._id} className="hover:bg-surface2/20 transition-colors group">
                  <td className="p-4">
                    <div className="font-bold text-[14px] text-text-primary">{l.name}</div>
                  </td>
                  <td className="p-4 text-[13px] text-text-secondary">{l.company || 'N/A'}</td>
                  <td className="p-4 text-[13px] font-mono text-text-secondary">{l.phone || 'N/A'}</td>
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
                     <span className="text-[12.5px] text-text-muted line-clamp-1 max-w-[150px]">{l.notes || 'No action recorded'}</span>
                  </td>
                  <td className="p-4">
                     <div className="text-[13px] font-medium">{formatFollowUp(l.followUpDate, l.followUpTime)}</div>
                  </td>
                  <td className="p-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button className="bg-[#0f766e] text-white px-3 py-1 rounded-md text-[11px] font-bold hover:shadow-md transition-all" onClick={() => openModal('update-lead', { leadData: l })}>Update</button>
                      <button className="bg-blue text-white px-3 py-1 rounded-md text-[11px] font-bold hover:shadow-md transition-all" onClick={() => openModal('allocate-lead', { leadData: l })}>Allocate</button>
                      <button className="bg-white border border-red/20 text-red px-3 py-1 rounded-md text-[11px] font-bold hover:bg-red-light transition-all">Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredLeads.length === 0 && !isLoading && (
                 <tr><td colSpan="8" className="p-16 text-center text-text-muted italic">
                   {debouncedListSearch || debouncedHeaderSearch ? "No leads found matching your search" : "No leads found matching your criteria."}
                 </td></tr>
              )}
              {isLoading && (
                 <tr><td colSpan="8" className="p-16 text-center text-text-muted shimmer">Loading lead data...</td></tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex justify-between items-center p-5 border-t border-border bg-surface2/10">
          <div className="text-xs text-text-muted font-medium">Showing {filteredLeads.length} leads in the current view</div>
          <div className="flex gap-2">
            <Button size="xs" variant="outline" className="bg-white px-4">Previous</Button>
            <Button size="xs" variant="outline" className="bg-white px-4">Next</Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExpectedOnboarding;
