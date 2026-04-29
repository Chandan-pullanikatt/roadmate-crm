import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { leadsApi } from '../../../api/leadsApi';
import { useToast } from '../../../context/ToastContext';

const LeadList = () => {
  const queryClient = useQueryClient();
  const { addToast } = useToast();
  const [activeFilter, setActiveFilter] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');

  // 1. Fetch leads for this executive
  const { data: leadsData, isLoading } = useQuery({
    queryKey: ['leads', 'my-leads', activeFilter, searchTerm],
    queryFn: () => {
      let statusParams;
      if (activeFilter === 'Fresh') statusParams = 'new';
      else if (activeFilter === 'Hot Follow') statusParams = 'followup';
      else if (activeFilter === 'Meetings') statusParams = 'meeting_virtual,meeting_direct';
      else if (activeFilter === 'Converted') statusParams = 'converted';

      return leadsApi.getLeads({
        status: statusParams,
        search: searchTerm || undefined,
        limit: 100
      }).then(res => res.data);
    }
  });

  const leads = leadsData?.leads || [];

  // Helper: Format Relative Time
  const formatLastContact = (dateStr) => {
    if (!dateStr) return 'Never';
    const date = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    return `${diffDays} Days ago`;
  };

  // Helper: Get Lead Type Pill
  const getTypePill = (status) => {
    if (status === 'meeting_direct') return <span className="type-pill direct">DIRECT MEET</span>;
    if (status === 'meeting_virtual') return <span className="type-pill virtual">VIRTUAL MEET</span>;
    return <span className="type-pill fresh">FRESH LEAD</span>;
  };

  // Helper: Get Status Pill
  const getStatusPill = (status) => {
    switch (status.toLowerCase()) {
      case 'converted': return <span className="status-pill closed">CLOSED</span>;
      case 'followup': return <span className="status-pill hot">HOT FOLLOW</span>;
      case 'meeting_scheduled': return <span className="status-pill blocking">BLOCKING RECEIVED</span>;
      case 'new': return <span className="status-pill next-day">NEXT DAY ACTION</span>;
      case 'not_interested': return <span className="status-pill not-interested">NOT INTERESTED</span>;
      case 'rnr': return <span className="status-pill rnr">RNR</span>;
      default: return <span className="status-pill">{status.toUpperCase()}</span>;
    }
  };

  const exportLeads = () => {
    if (leads.length === 0) return;
    const headers = ['Company', 'Decision Maker', 'Revenue', 'Type', 'Status'];
    const rows = leads.map(l => [l.company, l.name, l.expectedRevenue, l.status, l.status]);
    const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mapped-leads-${new Date().toLocaleDateString()}.csv`;
    a.click();
    addToast("Exporting leads as CSV", "success");
  };

  const openModal = (type, data = null) => {
    window.dispatchEvent(new CustomEvent('open-modal', { 
      detail: typeof type === 'string' ? { type, ...data } : type 
    }));
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
        <div className="text-sm font-extrabold text-primary">
          Total Mapped Leads ({leadsData?.totalLeads || leads.length})
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex gap-2 items-center">
            <span className="text-[11px] font-black text-muted uppercase tracking-widest mr-2">Filter:</span>
            {['All', 'Fresh', 'Hot Follow', 'Meetings', 'Converted'].map(f => (
              <button 
                key={f}
                className={`filter-chip-v2 ${activeFilter === f ? 'active' : ''}`}
                onClick={() => setActiveFilter(f)}
              >
                {f}
              </button>
            ))}
          </div>
          <div className="flex gap-2 border-l border-border pl-4">
            <button className="btn btn-ghost btn-sm font-bold text-xs" onClick={exportLeads}>Export CSV</button>
            <button className="btn btn-orange btn-sm font-bold text-xs px-4" onClick={() => openModal('add-lead')}>+ Add Lead</button>
          </div>
        </div>
      </div>

      {/* 3. Lead Table */}
      <div className="table-container">
        <table className="lead-list-table">
          <thead>
            <tr>
              <th>Company Name</th>
              <th>Decision Maker</th>
              <th>Revenue Potential</th>
              <th>Lead Type</th>
              <th>Last Contact</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan="7" className="text-center py-12 text-muted">Fetching leads...</td></tr>
            ) : leads.length === 0 ? (
              <tr><td colSpan="7" className="text-center py-12 text-muted">No leads found for this filter</td></tr>
            ) : leads.map(lead => (
              <tr key={lead._id}>
                <td><span className="font-bold">{lead.company || lead.name}</span></td>
                <td>{lead.name}</td>
                <td><span className="font-bold">₹{(lead.expectedRevenue / 100000).toFixed(1)}L / Yr</span></td>
                <td>{getTypePill(lead.status)}</td>
                <td>{formatLastContact(lead.lastCallAt)}</td>
                <td>{getStatusPill(lead.status)}</td>
                <td>
                  <div className="flex gap-2">
                    <button className="btn btn-ghost btn-xs font-bold" onClick={() => openModal('update-lead', { leadData: lead })}>Update</button>
                    <button className="btn btn-ghost btn-xs font-bold text-purple" onClick={() => openModal('allocate-lead', { leadData: lead })}>Allocate</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

    </div>
  );
};

export default LeadList;
