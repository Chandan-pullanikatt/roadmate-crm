import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { dashboardApi } from '../../../api/dashboardApi';
import { Avatar, Button, Tag } from '../../../components/ui';

const Overview = () => {
  const [summaryTab, setSummaryTab] = useState('month');

  const { data: dashData, isLoading } = useQuery({
    queryKey: ['dashboard', 'founder', summaryTab],
    queryFn: () => dashboardApi.getFounderDashboard(summaryTab).then(res => res.data)
  });

  const openModal = (id) => {
    window.dispatchEvent(new CustomEvent('open-modal', { detail: id }));
  };

  if (isLoading) return <div className="p-8 text-center text-text-muted">Calculating enterprise metrics...</div>;

  const stats = dashData?.stats || {};
  const pipelineStats = dashData?.pipelineStats || [];
  const expectedOnboardingList = dashData?.expectedOnboardingList || [];
  const managers = dashData?.stateManagers || [];
  const pendingLeaves = dashData?.pendingLeaves || [];
  const recentLeads = dashData?.recentLeads || [];

  return (
    <div className="animate-in fade-in duration-500">
      {/* UPCOMING MEETING ALERT */}
      <div className="meeting-alert mb-6 bg-accent-light/10 border border-accent/20 p-4 rounded-2xl flex items-center gap-4 cursor-pointer hover:bg-accent-light/20 transition-all">
        <div className="w-10 h-10 bg-accent rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg shadow-accent/20">
          <svg width="20" height="20" viewBox="0 0 16 16" fill="none">
            <rect x="2" y="3" width="12" height="11" rx="1.5" stroke="white" strokeWidth="1.4" />
            <path d="M2 7h12M5 2v2M11 2v2" stroke="white" strokeWidth="1.3" strokeLinecap="round" />
            <circle cx="8" cy="11" r="1.5" fill="white" />
          </svg>
        </div>
        <div className="flex-1">
          <div className="text-[13.5px] font-bold text-accent">Board Meeting in 45 min — Q1 Revenue Review</div>
          <div className="text-[11.5px] text-accent/70 mt-0.5">3:30 PM · All State Managers · Zoom Link Ready</div>
        </div>
        <div className="flex gap-2">
          <Button size="xs" className="bg-accent text-white border-none">Join Now</Button>
          <Button size="xs" variant="outline" className="border-accent/20 text-accent" onClick={() => openModal('all-meetings')}>All Meetings</Button>
        </div>
      </div>

      <div className="section-header">
        <div>
          <div className="section-title">Founder Summary</div>
          <div className="section-sub">Enterprise overview — all states, industries & staff</div>
        </div>
        <div className="flex bg-surface2 p-1 rounded-xl border border-border">
          {['today', 'week', 'month', 'year'].map(t => (
            <button 
              key={t}
              onClick={() => setSummaryTab(t)}
              className={`px-6 py-1.5 text-[10px] font-bold uppercase tracking-widest rounded-lg transition-all ${summaryTab === t ? 'bg-surface text-purple shadow-sm' : 'text-text-muted hover:text-text-secondary'}`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <div className="stat-card" style={{ borderTop: '4px solid #14b8a6' }}>
          <div className="flex justify-between items-start mb-2">
            <div className="stat-label">Total Leads</div>
            <div className="bg-teal/10 p-1.5 rounded-lg">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#14b8a6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="4" y1="21" x2="4" y2="14"></line><line x1="4" y1="10" x2="4" y2="3"></line><line x1="12" y1="21" x2="12" y2="12"></line><line x1="12" y1="8" x2="12" y2="3"></line><line x1="20" y1="21" x2="20" y2="16"></line><line x1="20" y1="12" x2="20" y2="3"></line><line x1="1" y1="14" x2="7" y2="14"></line><line x1="9" y1="8" x2="15" y2="8"></line><line x1="17" y1="16" x2="23" y2="16"></line></svg>
            </div>
          </div>
          <div className="text-[28px] font-bold font-mono text-text-primary mb-1">{stats.totalLeads?.toLocaleString() || 0}</div>
          <div className="text-[12px] font-medium text-teal">↑ {stats.leadsToday || 0} new today</div>
        </div>

        <div className="stat-card" style={{ borderTop: '4px solid #3b82f6' }}>
          <div className="stat-label mb-2 mt-1">Expected Onboarding</div>
          <div className="text-[28px] font-bold font-mono text-text-primary mb-1">{stats.expectedOnboarding?.toLocaleString() || 0}</div>
          <div className="text-[12px] font-medium text-teal">↑ This week pipeline</div>
        </div>

        <div className="stat-card" style={{ borderTop: '4px solid #f59e0b' }}>
          <div className="stat-label mb-2 mt-1">Conversions</div>
          <div className="text-[28px] font-bold font-mono text-text-primary mb-1">{stats.converted?.toLocaleString() || 0}</div>
          <div className="text-[12px] font-medium text-teal">↑ {stats.convertedThisMonth || 0} this month</div>
        </div>

        <div className="stat-card" style={{ borderTop: '4px solid #0891b2' }}>
          <div className="stat-label mb-2 mt-1">Revenue Generated</div>
          <div className="text-[28px] font-bold font-mono text-text-primary mb-1">
             ₹{stats.revenue ? (stats.revenue >= 10000000 ? (stats.revenue / 10000000).toFixed(2) + 'Cr' : stats.revenue.toLocaleString()) : '0'}
          </div>
          <div className="text-[12px] font-medium text-teal">↑ 18.4% MoM</div>
        </div>

        <div className="stat-card" style={{ borderTop: '4px solid #8b5cf6' }}>
          <div className="stat-label mb-2 mt-1">State Managers</div>
          <div className="text-[28px] font-bold font-mono text-text-primary mb-1">{stats.stateManagers?.total || 0}</div>
          <div className="text-[12px] font-medium flex gap-2">
            <span className="text-teal">• {stats.stateManagers?.working || 0} Working</span>
            <span className="text-red">• {stats.stateManagers?.onLeave || 0} On Leave</span>
          </div>
        </div>

        <div className="stat-card" style={{ borderTop: '4px solid #3b82f6' }}>
          <div className="stat-label mb-2 mt-1">Industry Managers</div>
          <div className="text-[28px] font-bold font-mono text-text-primary mb-1">{stats.industryManagers?.total || 0}</div>
          <div className="text-[12px] font-medium flex gap-2">
            <span className="text-teal">• {stats.industryManagers?.working || 0} Working</span>
            <span className="text-red">• {stats.industryManagers?.onLeave || 0} On Leave</span>
          </div>
        </div>

        <div className="stat-card" style={{ borderTop: '4px solid #ea580c' }}>
          <div className="stat-label mb-2 mt-1">Sales Staff</div>
          <div className="text-[28px] font-bold font-mono text-text-primary mb-1">{stats.salesStaff?.total || 0}</div>
          <div className="text-[12px] font-medium flex gap-2">
            <span className="text-teal">• {stats.salesStaff?.working || 0} Working</span>
            <span className="text-red">• {stats.salesStaff?.onLeave || 0} On Leave</span>
          </div>
        </div>

        <div className="stat-card" style={{ borderTop: '4px solid #dc2626' }}>
          <div className="stat-label mb-2 mt-1">Pending Leaves</div>
          <div className="text-[28px] font-bold font-mono text-text-primary mb-1">{stats.pendingLeavesCount || 0}</div>
          <div className="text-[12px] font-medium text-orange flex items-center gap-1">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
            Needs approval
          </div>
        </div>
      </div>

      <div className="flex justify-between items-end mb-4 mt-8">
        <div>
          <div className="text-[15px] font-bold text-text-primary">Lead Pipeline</div>
          <div className="text-[12px] text-text-muted mt-0.5">Expected onboarding leads & current pipeline status</div>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" className="bg-white">Bulk Upload</Button>
          <Button size="sm" className="bg-[#0f766e] hover:bg-[#0d645e] text-white border-none">+ Add Lead</Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
        {pipelineStats.map((s, i) => {
          let bgClass = "bg-white";
          let borderClass = "border-border";
          let bottomColor = "#3b82f6";
          
          if (s.label === 'New') bottomColor = '#3b82f6';
          if (s.label === 'Follow-up') bottomColor = '#8b5cf6';
          if (s.label === 'Meeting') bottomColor = '#0f766e';
          if (s.label === 'Negotiation') bottomColor = '#d97706';
          
          if (s.label === 'Converted') {
             bgClass = "bg-[#f0fdf4]";
             borderClass = "border-[#bbf7d0]";
             bottomColor = "#16a34a";
          }
          if (s.label === 'Lost') {
             bgClass = "bg-[#fef2f2]";
             borderClass = "border-[#fecaca]";
             bottomColor = "#dc2626";
          }

          return (
            <div key={i} className={`rounded-xl border ${borderClass} ${bgClass} p-5 pb-0 flex flex-col items-center justify-center relative overflow-hidden shadow-sm`}>
              <div className={`text-[28px] font-bold font-mono mb-1 ${s.label === 'Converted' ? 'text-[#16a34a]' : s.label === 'Lost' ? 'text-[#dc2626]' : s.label === 'Follow-up' ? 'text-[#8b5cf6]' : s.label === 'Meeting' ? 'text-[#0f766e]' : s.label === 'Negotiation' ? 'text-[#d97706]' : 'text-[#3b82f6]'}`}>
                {s.count}
              </div>
              <div className="text-[12px] text-text-muted font-medium mb-5">{s.label}</div>
              <div className="w-[80%] h-1 rounded-t-md absolute bottom-0" style={{ backgroundColor: bottomColor }}></div>
            </div>
          );
        })}
      </div>

      <div className="flex justify-between items-end mb-4 mt-8">
        <div>
          <div className="text-[15px] font-bold text-text-primary">Expected Onboarding Leads</div>
          <div className="text-[12px] text-text-muted mt-0.5">Hot leads expected to convert this week · Requires allocation</div>
        </div>
        <Button size="sm" variant="outline" className="bg-white">Allocate Leads</Button>
      </div>

      <div className="card overflow-hidden mb-8 border border-border bg-white rounded-xl shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface2/50 text-[10px] font-bold text-text-muted uppercase tracking-wider border-b border-border">
                <th className="p-4 font-bold">Lead Name</th>
                <th className="p-4 font-bold">Company</th>
                <th className="p-4 font-bold">State</th>
                <th className="p-4 font-bold">Assigned To</th>
                <th className="p-4 font-bold text-center">Status</th>
                <th className="p-4 font-bold">Expected Date</th>
                <th className="p-4 font-bold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {expectedOnboardingList.map((lead, idx) => (
                <tr key={idx} className="hover:bg-surface2/30 transition-colors">
                  <td className="p-4">
                    <div className="text-[13px] font-bold text-text-primary">{lead.name}</div>
                    <div className="text-[11px] text-text-muted mt-0.5">{lead.name} Contact</div>
                  </td>
                  <td className="p-4 text-[13px] text-text-secondary font-medium">{lead.company}</td>
                  <td className="p-4">
                    <span className="inline-flex items-center justify-center px-2 py-1 rounded-md bg-blue/10 text-blue text-[10px] font-bold uppercase tracking-wider">{lead.state}</span>
                  </td>
                  <td className="p-4 text-[13px] text-text-secondary font-medium">{lead.assignedTo}</td>
                  <td className="p-4 text-center">
                    <span className={`inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${lead.priority === 'hot' ? 'bg-red/5 text-red border-red/20' : 'bg-amber/5 text-amber border-amber/20'}`}>
                      {lead.priority || 'warm'}
                    </span>
                  </td>
                  <td className="p-4 text-[13px] text-text-secondary font-medium">{lead.expectedDate}</td>
                  <td className="p-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button size="xs" className="bg-[#0f766e] hover:bg-[#0d645e] text-white border-none shadow-sm">Allocate</Button>
                      <Button size="xs" variant="outline" className="bg-white border-border shadow-sm text-text-primary">Edit</Button>
                    </div>
                  </td>
                </tr>
              ))}
              {expectedOnboardingList.length === 0 && (
                <tr>
                  <td colSpan="7" className="p-8 text-center text-text-muted text-[13px]">No expected onboarding leads found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="card">
          <div className="card-header border-b border-border bg-surface2/10 flex justify-between items-center">
            <div className="section-title text-sm">State Manager Performance</div>
            <Button size="xs" variant="outline">Detailed Analytics</Button>
          </div>
          <div className="divide-y divide-border">
            {managers.map((m, i) => (
              <div key={m._id} className="flex items-center gap-4 p-4 hover:bg-surface2 transition-colors cursor-pointer">
                <Avatar name={m.name} size="md" className="av-state" />
                <div className="flex-1 min-w-0">
                  <div className="text-[13.5px] font-bold">{m.name}</div>
                  <div className="text-[11px] text-text-muted mt-0.5">📍 {m.state} · SM</div>
                </div>
                <div className="flex gap-6 mx-4">
                  <div className="text-center"><div className="text-xs font-bold text-blue mono">{m.leadsCount || 0}</div><div className="text-[9px] text-text-muted uppercase">Leads</div></div>
                  <div className="text-center"><div className="text-xs font-bold text-accent mono">₹{m.revenue?.toLocaleString() || '0'}</div><div className="text-[9px] text-text-muted uppercase">Rev</div></div>
                </div>
                <div className="flex items-center gap-2">
                   <div className="text-[10px] font-bold mono">{m.completionPct || 0}%</div>
                   <div className="w-12 h-1 bg-surface2 rounded-full overflow-hidden">
                      <div className="h-full bg-accent" style={{ width: `${m.completionPct || 0}%` }}></div>
                   </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-6">
          <div className="card">
            <div className="card-header border-b border-border bg-surface2/10">
              <div className="section-title text-sm">Pending Founder Approvals</div>
              <Tag variant="amber" label={`${pendingLeaves.length} Leaves`} />
            </div>
            <div className="divide-y divide-border max-h-[300px] overflow-y-auto">
              {pendingLeaves.map((l) => (
                <div key={l._id} className="flex items-center gap-4 p-4 hover:bg-surface2 transition-colors">
                  <Avatar name={l.user?.name} size="sm" className="av-state" />
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-bold">{l.user?.name}</div>
                    <div className="text-[11px] text-text-muted truncate">SM · {l.type} · {l.reason}</div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="xs" className="bg-accent text-white">Approve</Button>
                    <Button size="xs" variant="outline" className="text-red border-red/10">Reject</Button>
                  </div>
                </div>
              ))}
              {pendingLeaves.length === 0 && <div className="p-12 text-center text-text-muted text-xs italic">No pending requests</div>}
            </div>
          </div>

          <div className="card">
            <div className="card-header border-b border-border bg-surface2/10">
              <div className="section-title text-sm">Recent Global Leads</div>
            </div>
            <div className="p-4">
              {recentLeads.slice(0, 3).map((l, i) => (
                <div key={i} className="flex justify-between items-center mb-4 last:mb-0">
                  <div>
                    <div className="text-xs font-bold">{l.company}</div>
                    <div className="text-[10px] text-text-muted">{l.state} · {l.industry}</div>
                  </div>
                  <Tag variant={l.status === 'hot' ? 'red' : 'gray'} label={l.status.toUpperCase()} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Overview;
