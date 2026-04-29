import React, { useState, useEffect, useMemo } from 'react';
import { useQuery, keepPreviousData, useQueryClient } from '@tanstack/react-query';
import { 
  StatCard, 
  Button, 
  Avatar, 
  Tag, 
  DashboardSkeleton 
} from '../../../components/ui';
import { dashboardApi } from '../../../api/dashboardApi';
import { leadsApi } from '../../../api/leadsApi';
import { useToast } from '../../../context/ToastContext';

const LeadManagement = () => {
  const queryClient = useQueryClient();
  const { addToast } = useToast();
  const [activeTab, setActiveTab] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [isExporting, setIsExporting] = useState(false);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setPage(1);
    }, 350);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const { data: dashData } = useQuery({
    queryKey: ['dashboard', 'industry-manager'],
    queryFn: () => dashboardApi.getIndustryManagerDashboard().then(res => res.data),
    staleTime: 5 * 60 * 1000,
    placeholderData: keepPreviousData
  });

  const { data: counts } = useQuery({
    queryKey: ['leads', 'counts'],
    queryFn: () => leadsApi.getCounts().then(res => res.data),
    staleTime: 5 * 60 * 1000
  });

  const { data: leadData, isLoading, isFetching } = useQuery({
    queryKey: ['leads', 'industry-list', activeTab, debouncedSearch, page],
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
      a.download = `industry-leads-export-${new Date().toISOString().split('T')[0]}.csv`;
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
  const stats = dashData?.stats || {};
  const userInfo = dashData?.user || {};

  const tabs = [
    { id: 'all', label: 'All', count: Object.values(counts || {}).reduce((a, b) => a + b, 0) },
    { id: 'new', label: 'New', count: counts?.new || 0 },
    { id: 'followup', label: 'Follow-up', count: counts?.followup || 0 },
    { id: 'meeting', label: 'Meeting', count: (counts?.meeting_virtual || 0) + (counts?.meeting_direct || 0) },
    { id: 'converted', label: 'Converted', count: counts?.converted || 0 },
    { id: 'lost', label: 'Lost', count: counts?.lost || 0 },
    { id: 'rnr', label: 'RNR', count: counts?.rnr || 0 }
  ];

  const formatCurrency = (val) => {
    if (val >= 100000) return `₹${(val / 100000).toFixed(1)}L`;
    if (val >= 1000) return `₹${(val / 1000).toFixed(1)}K`;
    return `₹${val}`;
  };

  const getStatusVariant = (status) => {
    status = status?.toLowerCase();
    if (status === 'hot') return 'red';
    if (status === 'warm') return 'amber';
    if (status === 'converted') return 'green';
    if (status === 'rnr') return 'amber';
    if (status === 'followup') return 'purple';
    if (status === 'lost') return 'gray';
    return 'blue';
  };

  const openModal = (type, data = null) => {
    window.dispatchEvent(new CustomEvent('open-modal', { 
      detail: typeof type === 'string' ? { type, ...data } : type 
    }));
  };

  if (isLoading && !dashData) return <DashboardSkeleton />;

  return (
    <div className="space-y-8 animate-in fade-in duration-700 pb-12">
      {/* Premium Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
             <div className="px-2.5 py-1 rounded-md bg-purple-light text-purple text-[10px] font-bold uppercase tracking-wider border border-purple/10">
                Pipeline Central
             </div>
             <span className="text-text-muted opacity-30">/</span>
             <span className="text-text-muted text-[10px] font-bold uppercase tracking-wider">Lead Management</span>
          </div>
          <h1 className="text-3xl font-extrabold text-text-primary tracking-tight">
            Lead Database
          </h1>
          <p className="text-sm text-text-muted mt-1 font-medium">
            Managing {total} Leads <span className="mx-2 opacity-30">·</span> {userInfo.industry} <span className="mx-2 opacity-30">·</span> {userInfo.state}
          </p>
        </div>
        
        <div className="flex items-center gap-4 bg-white p-2 rounded-2xl border border-border/60 shadow-sm">
            <div className="relative">
                <input 
                    type="text" 
                    placeholder="Search leads, executives..." 
                    className="pl-10 pr-4 py-2 bg-surface2 border border-border rounded-xl text-[11px] font-bold focus:ring-2 focus:ring-purple/20 transition-all outline-none min-w-[280px]"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
                <span className="absolute left-3 top-1/2 -translate-y-1/2 opacity-40 text-sm">🔍</span>
            </div>
            <div className="h-8 w-px bg-border/60" />
            <Button 
                className="bg-[#0f766e] text-white border-none rounded-xl px-5 h-10 font-bold text-[11px] uppercase tracking-wider shadow-lg shadow-[#0f766e]/10"
                onClick={() => openModal('add-lead')}
            >
                + New Lead
            </Button>
        </div>
      </div>

      {/* Summary Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
            label="Total Leads" 
            value={stats.totalLeads || 0} 
            delta="In Database" 
            deltaType="up"
            colorClass="purple" 
        />
        <StatCard 
            label="Hot Pipeline" 
            value={stats.hotLeads || 0} 
            delta={`${Math.round((stats.hotLeads / (stats.totalLeads || 1)) * 100) || 0}%`}
            deltaLabel="of total"
            deltaType="up"
            colorClass="red" 
        />
        <StatCard 
            label="Converted" 
            value={stats.convertedThisMonth || 0} 
            delta="This month"
            deltaType="up"
            colorClass="green" 
        />
        <StatCard 
            label="Total Revenue" 
            value={formatCurrency(stats.revenue || 0)} 
            delta={`${stats.revGrowth || 0}%`}
            deltaLabel="growth"
            deltaType={stats.revGrowth >= 0 ? "up" : "down"}
            colorClass="teal" 
        />
      </div>

      {/* Main Table Card */}
      <div className="card shadow-lg shadow-purple/5 border-border/40 overflow-hidden">
        <div className="card-header border-none px-8 pt-8 pb-4 flex flex-col sm:flex-row justify-between gap-4">
          <div className="flex bg-surface2 p-1 rounded-xl border border-border/40 overflow-x-auto">
            {tabs.map(tab => (
                <button 
                    key={tab.id}
                    onClick={() => { setActiveTab(tab.id); setPage(1); }}
                    className={`px-4 py-2 text-[10px] font-black rounded-lg transition-all uppercase tracking-widest whitespace-nowrap ${activeTab === tab.id ? 'bg-white shadow-sm text-[#0f766e]' : 'text-text-muted hover:text-text-primary'}`}
                >
                  {tab.label} <span className="ml-1 opacity-50">{tab.count}</span>
                </button>
            ))}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="rounded-xl h-10 px-6 font-bold border-border/60 text-[10px] uppercase tracking-widest" onClick={() => openModal('bulk-upload')}>
                Bulk Upload
            </Button>
            <Button variant="outline" size="sm" className="rounded-xl h-10 px-6 font-bold border-purple/20 text-purple text-[10px] uppercase tracking-widest" onClick={() => openModal('bulk-allocate')}>
                Bulk Allocate
            </Button>
            <Button variant="outline" size="sm" className="rounded-xl h-10 px-6 font-bold border-border/60 text-[10px] uppercase tracking-widest" onClick={handleExport} loading={isExporting}>
                Export
            </Button>
          </div>
        </div>
        
        <div className="p-0 overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[1000px]">
            <thead>
              <tr className="bg-surface2/30 text-[9px] font-black text-text-muted uppercase tracking-widest border-y border-border/40">
                <th className="px-8 py-4">Lead ID</th>
                <th className="px-6 py-4">Business / Contact</th>
                <th className="px-6 py-4">District</th>
                <th className="px-6 py-4">Executive</th>
                <th className="px-6 py-4 text-center">Status</th>
                <th className="px-6 py-4 text-center">Last Updated</th>
                <th className="px-6 py-4 text-right pr-8">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {leads.map((lead, idx) => (
                <tr key={lead._id} className="hover:bg-purple-light/10 transition-colors group">
                  <td className="px-8 py-4">
                    <span className="text-[10px] font-black font-mono text-text-muted group-hover:text-purple transition-colors">{lead.leadId || (lead._id ?? '').substring(0,8).toUpperCase()}</span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-sm font-black text-text-primary group-hover:text-purple transition-colors">{lead.company || lead.name}</span>
                      <span className="text-[10px] font-bold text-text-muted">{lead.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-[10px] font-black text-text-secondary uppercase tracking-tight">{lead.district}</span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                       <div className="w-6 h-6 rounded-lg bg-surface2 flex items-center justify-center text-[9px] font-black">{lead.owner?.name?.[0] || 'U'}</div>
                       <span className="text-[11px] font-bold text-text-primary">{lead.owner?.name || 'Unassigned'}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <Tag 
                        variant={getStatusVariant(lead.status)} 
                        label={lead.status} 
                        className="text-[9px] font-black px-3 py-1.5 rounded-xl uppercase tracking-tighter shadow-sm"
                    />
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className="text-[11px] font-bold text-text-muted font-mono">{new Date(lead.updatedAt).toLocaleDateString()}</span>
                  </td>
                  <td className="px-6 py-4 text-right pr-8">
                    <div className="flex items-center justify-end gap-2">
                        <Button size="xs" variant="outline" className="font-bold text-[9px] uppercase tracking-wider" onClick={() => openModal('update-lead', { leadData: lead })}>Update</Button>
                        <Button size="xs" variant="outline" className="text-purple border-purple/10 font-bold text-[9px] uppercase tracking-wider" onClick={() => openModal('allocate-lead', { leadData: lead })}>Allocate</Button>
                    </div>
                  </td>
                </tr>
              ))}
              {leads.length === 0 && !isLoading && (
                  <tr>
                      <td colSpan="9" className="p-20 text-center">
                         <div className="text-3xl mb-3 opacity-30">🔍</div>
                         <div className="text-text-muted font-bold text-sm">No leads match your current search or filter.</div>
                      </td>
                  </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex justify-between items-center p-5 border-t border-border bg-surface2/5">
          <div className="text-[10px] text-text-muted font-black uppercase tracking-widest">
             Showing {((page - 1) * 20) + 1} - {Math.min(page * 20, total)} of {total} leads
          </div>
          <div className="flex gap-2">
            <Button size="xs" variant="outline" disabled={page === 1} onClick={() => setPage(p => p - 1)} className="rounded-xl px-6">Previous</Button>
            <Button size="xs" variant="outline" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className="rounded-xl px-6">Next</Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LeadManagement;
