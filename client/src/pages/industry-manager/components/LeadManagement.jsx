import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  StatCard, 
  Button, 
  Avatar, 
  Tag, 
  Modal,
  DashboardSkeleton 
} from '../../../components/ui';
import { dashboardApi } from '../../../api/dashboardApi';
import { leadsApi } from '../../../api/leadsApi';
import { useToast } from '../../../context/ToastContext';

const LeadManagement = () => {
  const queryClient = useQueryClient();
  const { addToast } = useToast();
  const [activeTab, setActiveTab] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');

  const { data: dashData, isLoading } = useQuery({
    queryKey: ['dashboard', 'industry-manager'],
    queryFn: () => dashboardApi.getIndustryManagerDashboard().then(res => res.data),
    staleTime: 5 * 60 * 1000,
    placeholderData: (prev) => prev
  });

  const leads = useMemo(() => dashData?.leads || [], [dashData]);
  const stats = dashData?.stats || {};
  const userInfo = dashData?.user || {};

  const filteredLeads = useMemo(() => {
    let result = leads;
    if (activeTab !== 'All') {
        const tab = activeTab.toLowerCase();
        if (tab === 'follow-up') {
            result = result.filter(l => l.status.toLowerCase() === 'followup');
        } else {
            result = result.filter(l => l.status.toLowerCase() === tab);
        }
    }
    if (searchTerm) {
        result = result.filter(l => 
            l.company.toLowerCase().includes(searchTerm.toLowerCase()) || 
            l.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            l.leadId.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }
    return result;
  }, [leads, activeTab, searchTerm]);

  const formatCurrency = (val) => {
    if (val >= 100000) return `₹${(val / 100000).toFixed(1)}L`;
    if (val >= 1000) return `₹${(val / 1000).toFixed(1)}K`;
    return `₹${val}`;
  };

  const getStatusVariant = (status) => {
    status = status.toLowerCase();
    if (status === 'hot') return 'red';
    if (status === 'warm') return 'amber';
    if (status === 'converted') return 'green';
    if (status === 'rnr') return 'amber';
    if (status === 'followup') return 'purple';
    if (status === 'lost') return 'gray';
    return 'blue';
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
            Managing {leads.length} Leads <span className="mx-2 opacity-30">·</span> {userInfo.industry} <span className="mx-2 opacity-30">·</span> {userInfo.state}
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
                className="bg-purple text-white border-none rounded-xl px-5 h-10 font-bold text-[11px] uppercase tracking-wider shadow-lg shadow-purple/10"
                onClick={() => window.dispatchEvent(new CustomEvent('open-modal', { detail: 'add-lead' }))}
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
            delta={`${Math.round((stats.hotLeads / stats.totalLeads) * 100) || 0}%`}
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
          <div className="flex bg-surface2 p-1 rounded-xl border border-border/40">
            {['All', 'Hot', 'Follow-up', 'RNR', 'Converted', 'Lost'].map(tab => (
                <button 
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`px-4 py-2 text-[10px] font-black rounded-lg transition-all uppercase tracking-widest ${activeTab === tab ? 'bg-white shadow-sm text-purple' : 'text-text-muted hover:text-text-primary'}`}
                >{tab}</button>
            ))}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="rounded-xl h-10 px-6 font-bold border-border/60 text-[10px] uppercase tracking-widest">
                Bulk Upload
            </Button>
            <Button variant="outline" size="sm" className="rounded-xl h-10 px-6 font-bold border-border/60 text-[10px] uppercase tracking-widest">
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
                <th className="px-6 py-4 text-center">RNR</th>
                <th className="px-6 py-4">Revenue</th>
                <th className="px-6 py-4">Age</th>
                <th className="px-6 py-4 text-right pr-8">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {filteredLeads.map((lead, idx) => (
                <tr key={lead._id} className="hover:bg-purple-light/10 transition-colors group">
                  <td className="px-8 py-4">
                    <span className="text-[10px] font-black font-mono text-text-muted group-hover:text-purple transition-colors">{lead.leadId}</span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-sm font-black text-text-primary group-hover:text-purple transition-colors">{lead.company}</span>
                      <span className="text-[10px] font-bold text-text-muted">{lead.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-[10px] font-black text-text-secondary uppercase tracking-tight">{lead.district}</span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                       <Avatar name={lead.owner} size="xs" className={`av-${idx % 5} rounded-lg`} />
                       <span className="text-[11px] font-bold text-text-primary">{lead.owner}</span>
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
                    <span className={`text-[10px] font-black ${lead.rnrCount > 0 ? 'text-amber' : 'text-text-muted opacity-30'}`}>
                        {lead.rnrCount > 0 ? `${lead.rnrCount}x RNR` : '—'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-[11px] font-black text-text-primary">{formatCurrency(lead.revenue)}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-[11px] font-bold text-text-muted">{lead.age}d</span>
                  </td>
                  <td className="px-6 py-4 text-right pr-8">
                    <div className="flex items-center justify-end gap-3">
                        <button className="text-[9px] font-black text-text-muted hover:text-purple uppercase tracking-widest px-2 transition-colors">Details</button>
                        <button className="text-[9px] font-black text-amber hover:text-white hover:bg-amber border border-amber/30 rounded-lg px-4 py-1.5 uppercase tracking-widest bg-amber/5 transition-all shadow-sm">Escalate</button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredLeads.length === 0 && (
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
      </div>
    </div>
  );
};

export default LeadManagement;
