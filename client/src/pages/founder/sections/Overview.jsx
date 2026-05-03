import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, keepPreviousData, useQueryClient } from '@tanstack/react-query';
import DashboardSkeleton from '../../../components/skeletons/DashboardSkeleton';
import { dashboardApi } from '../../../api/dashboardApi';
import { leadsApi } from '../../../api/leadsApi';
import { leaveApi } from '../../../api/leaveApi';
import { usersApi } from '../../../api/usersApi';
import { Avatar, Button, Tag } from '../../../components/ui';

const Overview = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [summaryTab, setSummaryTab] = useState('week');
  
  // Initialize summaryPeriodValue based on current date
  const getCurrentDefaultValue = (tab) => {
    const now = new Date();
    if (tab === 'week') {
      const week = Math.ceil(now.getDate() / 7);
      return `Week ${week > 5 ? 5 : week}`;
    }
    if (tab === 'month') {
      return now.toLocaleString('en-US', { month: 'long' });
    }
    if (tab === 'quarter') {
      const q = Math.floor(now.getMonth() / 3) + 1;
      return `Q${q}`;
    }
    if (tab === 'year') {
      return String(now.getFullYear());
    }
    return '';
  };

  const [summaryPeriodValue, setSummaryPeriodValue] = useState(() => getCurrentDefaultValue('week'));

  const { data: dashData, isLoading } = useQuery({
    queryKey: ['dashboard', 'founder', summaryTab, summaryPeriodValue],
    queryFn: () => dashboardApi.getFounderDashboard(summaryTab, summaryPeriodValue).then(res => res.data),
    staleTime: 5 * 60 * 1000,
    placeholderData: keepPreviousData
  });

  const { data: unallocatedCount = 0 } = useQuery({
    queryKey: ['leads', 'unallocated-count'],
    queryFn: () => leadsApi.getLeads({ owner: 'unassigned', limit: 1 }).then(r => r.data.total || 0),
    staleTime: 2 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  });

  const handleTabChange = (t) => {
    setSummaryTab(t);
    setSummaryPeriodValue(getCurrentDefaultValue(t));
  };

  const getDropdownOptions = () => {
    if (summaryTab === 'today') return [];
    if (summaryTab === 'week') return ['Week 1', 'Week 2', 'Week 3', 'Week 4', 'Week 5'];
    if (summaryTab === 'month') return ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    if (summaryTab === 'quarter') return ['Q1', 'Q2', 'Q3', 'Q4'];
    if (summaryTab === 'year') {
      const currentYear = new Date().getFullYear();
      return Array.from({ length: 5 }, (_, i) => String(currentYear - i));
    }
    return [];
  };

  const openModal = (detail) => {
    window.dispatchEvent(new CustomEvent('open-modal', { detail }));
  };

  if (isLoading) return <DashboardSkeleton />;

  const stats = dashData?.stats || {};
  const pipelineStats = dashData?.pipelineStats || [];
  const expectedOnboardingList = dashData?.expectedOnboardingList || [];
  const managers = dashData?.stateManagers || [];
  const pendingLeaves = dashData?.pendingLeaves || [];
  const recentLeads = dashData?.recentLeads || [];
  const upcomingMeetings = dashData?.upcomingMeetings || [];
  const nextMeeting = upcomingMeetings[0];

  const formatMeetingLead = (meeting) => meeting?.company || meeting?.leadName || 'Upcoming Meeting';

  const formatMeetingCountdown = (meetingAt) => {
    if (!meetingAt) return 'Upcoming Meeting';

    const diffMs = new Date(meetingAt).getTime() - Date.now();
    const diffMinutes = Math.max(0, Math.round(diffMs / 60000));

    if (diffMinutes < 60) return `Meeting in ${diffMinutes} min`;

    const hours = Math.floor(diffMinutes / 60);
    const minutes = diffMinutes % 60;

    if (hours < 24) return `Meeting in ${hours}h${minutes ? ` ${minutes}m` : ''}`;

    const days = Math.floor(hours / 24);
    return `Meeting in ${days} day${days > 1 ? 's' : ''}`;
  };

  const formatMeetingSubtitle = (meeting) => {
    if (!meeting) return '';

    const timeLabel = new Date(meeting.meetingAt).toLocaleString([], {
      day: 'numeric',
      month: 'short',
      hour: 'numeric',
      minute: '2-digit'
    });

    const participantLabel = meeting.inviteeSummary || meeting.owner?.name || 'Assigned staff';

    return [
      timeLabel,
      participantLabel,
      `${meeting.type} Meeting`,
      meeting.meetingLink ? 'Link Ready' : null
    ].filter(Boolean).join(' · ');
  };

  return (
    <div className="animate-in fade-in duration-500">
      {nextMeeting ? (
        <div className="meeting-alert mb-6 bg-accent-light/10 border border-accent/20 p-4 rounded-2xl flex items-center gap-4 hover:bg-accent-light/20 transition-all">
          <div className="w-10 h-10 bg-accent rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg shadow-accent/20">
            <svg width="20" height="20" viewBox="0 0 16 16" fill="none">
              <rect x="2" y="3" width="12" height="11" rx="1.5" stroke="white" strokeWidth="1.4" />
              <path d="M2 7h12M5 2v2M11 2v2" stroke="white" strokeWidth="1.3" strokeLinecap="round" />
              <circle cx="8" cy="11" r="1.5" fill="white" />
            </svg>
          </div>
          <div className="flex-1">
            <div className="text-[13.5px] font-bold text-accent">{formatMeetingCountdown(nextMeeting.meetingAt)} - {formatMeetingLead(nextMeeting)}</div>
            <div className="text-[11.5px] text-accent/70 mt-0.5">{formatMeetingSubtitle(nextMeeting)}</div>
          </div>
          {nextMeeting.meetingLink ? (
            <div className="flex gap-2">
              <Button
                size="xs"
                className="bg-accent text-white border-none"
                onClick={() => window.open(nextMeeting.meetingLink, '_blank', 'noopener,noreferrer')}
              >
                Join Now
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="section-header">
        <div>
          <div className="section-title">Founder Summary</div>
          <div className="section-sub">Enterprise overview {"\u2014"} all states, industries & staff</div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex bg-surface2 p-1 rounded-xl border border-border">
            {['today', 'week', 'month', 'quarter', 'year'].map(t => (
              <button 
                key={t}
                onClick={() => handleTabChange(t)}
                className={`px-6 py-1.5 text-[10px] font-bold uppercase tracking-widest rounded-lg transition-all ${summaryTab === t ? 'bg-surface text-purple shadow-sm' : 'text-text-muted hover:text-text-secondary'}`}
              >
                {t}
              </button>
            ))}
          </div>
          
          {summaryTab !== 'today' && (
            <select 
              value={summaryPeriodValue}
              onChange={(e) => setSummaryPeriodValue(e.target.value)}
              className="bg-white border border-border rounded-xl px-4 py-2 text-[12px] font-bold text-text-secondary outline-none focus:border-blue shadow-sm min-w-[120px]"
            >
              {getDropdownOptions().map(opt => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          )}
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
          <div className="text-[12px] font-medium text-teal">{"\u2191"} {stats.leadsToday || 0} new today</div>
        </div>

        <div className="stat-card" style={{ borderTop: '4px solid #3b82f6' }}>
          <div className="stat-label mb-2 mt-1">Expected Onboarding</div>
          <div className="text-[28px] font-bold font-mono text-text-primary mb-1">{stats.expectedOnboarding?.toLocaleString() || 0}</div>
          <div className="text-[12px] font-medium text-teal">{"\u2191"} This week pipeline</div>
        </div>

        <div className="stat-card" style={{ borderTop: '4px solid #f59e0b' }}>
          <div className="stat-label mb-2 mt-1">Conversions</div>
          <div className="text-[28px] font-bold font-mono text-text-primary mb-1">{stats.converted?.toLocaleString() || 0}</div>
          <div className="text-[12px] font-medium text-teal">{"\u2191"} {stats.convertedThisMonth || 0} this month</div>
        </div>

        <div 
          className="stat-card cursor-pointer hover:shadow-md transition-shadow" 
          style={{ borderTop: '4px solid #0891b2' }}
          onClick={() => window.location.href = '/dashboard?page=revenue'}
        >
          <div className="stat-label mb-2 mt-1">Revenue Generated</div>
          <div className="text-[28px] font-bold font-mono text-text-primary mb-1">
             {"\u20B9"}{stats.revenue ? (stats.revenue >= 10000000 ? (stats.revenue / 10000000).toFixed(2) + 'Cr' : stats.revenue.toLocaleString()) : '0'}
          </div>
          <div className="text-[12px] font-medium text-teal flex items-center justify-between">
            <span>{"\u2191"} 18.4% MoM</span>
            <span className="text-[10px] font-bold text-blue underline">View Analysis</span>
          </div>
        </div>

        <div className="stat-card" style={{ borderTop: '4px solid #8b5cf6' }}>
          <div className="stat-label mb-2 mt-1">State Managers</div>
          <div className="text-[28px] font-bold font-mono text-text-primary mb-1">{stats.stateManagers?.total || 0}</div>
          <div className="text-[12px] font-medium flex gap-2">
            <span className="text-teal">{"\u2022"} {stats.stateManagers?.working || 0} Working</span>
            <span className="text-red">{"\u2022"} {stats.stateManagers?.onLeave || 0} On Leave</span>
          </div>
        </div>

        <div className="stat-card" style={{ borderTop: '4px solid #3b82f6' }}>
          <div className="stat-label mb-2 mt-1">Industry Managers</div>
          <div className="text-[28px] font-bold font-mono text-text-primary mb-1">{stats.industryManagers?.total || 0}</div>
          <div className="text-[12px] font-medium flex gap-2">
            <span className="text-teal">{"\u2022"} {stats.industryManagers?.working || 0} Working</span>
            <span className="text-red">{"\u2022"} {stats.industryManagers?.onLeave || 0} On Leave</span>
          </div>
        </div>

        <div className="stat-card" style={{ borderTop: '4px solid #ea580c' }}>
          <div className="stat-label mb-2 mt-1">Sales Staff</div>
          <div className="text-[28px] font-bold font-mono text-text-primary mb-1">{stats.salesStaff?.total || 0}</div>
          <div className="text-[12px] font-medium flex gap-2">
            <span className="text-teal">{"\u2022"} {stats.salesStaff?.working || 0} Working</span>
            <span className="text-red">{"\u2022"} {stats.salesStaff?.onLeave || 0} On Leave</span>
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

      {/* Unallocated leads alert — visible badge like WhatsApp counter */}
      {unallocatedCount > 0 && (
        <div
          className="flex items-center gap-4 p-4 mb-6 bg-red/5 border border-red/20 rounded-2xl cursor-pointer hover:bg-red/10 transition-colors"
          onClick={() => navigate('/dashboard?page=leads')}
        >
          <div className="relative flex-shrink-0">
            <div className="w-10 h-10 rounded-xl bg-red/10 flex items-center justify-center">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/></svg>
            </div>
            <span className="absolute -top-1.5 -right-1.5 min-w-[20px] h-5 px-1 bg-red rounded-full flex items-center justify-center text-white text-[10px] font-black">
              {unallocatedCount > 99 ? '99+' : unallocatedCount}
            </span>
          </div>
          <div className="flex-1">
            <div className="text-sm font-bold text-red">Unallocated Leads</div>
            <div className="text-xs text-text-muted mt-0.5">{unallocatedCount} lead{unallocatedCount !== 1 ? 's' : ''} have no executive assigned — click to allocate</div>
          </div>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
        </div>
      )}

      <div className="flex justify-between items-end mb-4 mt-8">
        <div>
          <div className="text-[15px] font-bold text-text-primary">Lead Pipeline</div>
          <div className="text-[12px] text-text-muted mt-0.5">Expected onboarding leads & current pipeline status</div>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" className="bg-white" onClick={() => openModal('bulk-upload')}>Bulk Upload</Button>
          <Button size="sm" className="bg-[#0f766e] hover:bg-[#0d645e] text-white border-none" onClick={() => openModal('add-lead')}>+ Add Lead</Button>
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
          <div className="text-[12px] text-text-muted mt-0.5">Hot leads expected to convert this week {"\u00B7"} Requires allocation</div>
        </div>
        <Button size="sm" variant="outline" className="bg-white" onClick={() => openModal('bulk-allocate')}>Allocate Leads</Button>
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
                      <Button size="xs" className="bg-[#0f766e] hover:bg-[#0d645e] text-white border-none shadow-sm" onClick={() => openModal({ type: 'allocate-lead', leadData: lead })}>Allocate</Button>
                      <Button size="xs" variant="outline" className="bg-white border-border shadow-sm text-text-primary" onClick={() => openModal({ type: 'update-lead', leadData: lead })}>Edit</Button>
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

      <div className="flex justify-between items-end mb-4 mt-8">
        <div>
          <div className="text-[15px] font-bold text-text-primary">Performance by State Manager</div>
          <div className="text-[12px] text-text-muted mt-0.5">Click any row to drill into full State Manager dashboard</div>
        </div>
        <Button size="sm" variant="outline" className="bg-white">View All</Button>
      </div>

      <div className="card overflow-hidden mb-8 border border-border bg-white rounded-xl shadow-sm">
        <div className="divide-y divide-border">
          {dashData?.byState?.map((managerData, idx) => {
            const mName = managerData.stateManager !== 'Unassigned' ? managerData.stateManager : 'Unassigned';
            const initials = mName !== 'Unassigned' ? mName.split(' ').map(n=>n[0]).join('').substring(0, 2).toUpperCase() : 'U';
            const colors = ['bg-[#3b82f6]', 'bg-[#4f46e5]', 'bg-[#0f766e]', 'bg-[#ea580c]'];
            const avatarColor = colors[idx % colors.length];

            return (
              <div key={managerData.stateManagerId || idx} className="flex items-center justify-between p-4 hover:bg-surface2/30 transition-colors cursor-pointer group">
                <div className="flex items-center gap-4 min-w-[300px]">
                  <div className={`w-10 h-10 rounded-full text-white flex items-center justify-center font-bold text-sm ${avatarColor}`}>
                    {initials}
                  </div>
                  <div>
                    <div className="text-[13.5px] font-bold text-text-primary group-hover:text-blue transition-colors">{mName}</div>
                    <div className="text-[11px] text-text-muted mt-0.5 flex items-center gap-1">
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
                      {managerData.state} {"\u00B7"} State Manager
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-6 flex-1">
                  <div className="text-center w-14">
                    <div className="text-[15px] font-bold text-blue font-mono">{managerData.leads}</div>
                    <div className="text-[10px] text-text-muted uppercase tracking-wider">Leads</div>
                  </div>
                  <div className="text-center w-14">
                    <div className="text-[15px] font-bold text-[#16a34a] font-mono">{managerData.converted}</div>
                    <div className="text-[10px] text-text-muted uppercase tracking-wider">Conv.</div>
                  </div>
                  <div className="text-center w-20">
                    <div className="text-[15px] font-bold text-teal font-mono">
                       {"\u20B9"}{managerData.revenue >= 100000 ? (managerData.revenue >= 10000000 ? (managerData.revenue / 10000000).toFixed(1) + 'Cr' : (managerData.revenue / 100000).toFixed(1) + 'L') : managerData.revenue.toLocaleString()}
                    </div>
                    <div className="text-[10px] text-text-muted uppercase tracking-wider">Revenue</div>
                  </div>
                  
                  <div className="flex flex-col items-center justify-center w-24 border-l border-border pl-4">
                    <div className="flex items-center gap-2">
                       <div className="w-6 h-1.5 bg-surface2 rounded-full overflow-hidden">
                         <div className="h-full bg-[#d97706]" style={{ width: `${managerData.avgWorkPct || 0}%` }}></div>
                       </div>
                       <div className="text-[13px] font-bold text-[#d97706]">{Math.round(managerData.avgWorkPct || 0)}%</div>
                    </div>
                    <div className="text-[10px] text-text-muted uppercase tracking-wider mt-0.5">Work %</div>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 ml-8 w-[180px]">
                  <Button size="xs" className="bg-[#0f766e] hover:bg-[#0d645e] text-white border-none shadow-sm px-4" onClick={() => navigate(`/dashboard?page=state-managers&id=${managerData.stateManagerId}`)}>View</Button>
                  <Button size="xs" variant="outline" className="bg-white border-border shadow-sm text-text-primary px-3" onClick={async () => {
                    try {
                      const user = await usersApi.getUserById(managerData.stateManagerId).then(r => r.data);
                      openModal({ type: 'create-state-manager', editData: user });
                    } catch {
                      openModal({ type: 'create-state-manager', editData: managerData.managerData });
                    }
                  }}>Edit</Button>
                  <Button size="xs" variant="outline" className="bg-red/5 border-red/20 text-red shadow-sm hover:bg-red/10 px-3" onClick={async () => {
                    if (window.confirm(`Are you sure you want to delete ${managerData.stateManager}?`)) {
                      try {
                        await usersApi.deleteUser(managerData.stateManagerId);
                        window.dispatchEvent(new CustomEvent('refresh-users'));
                        queryClient.invalidateQueries({ queryKey: ['dashboard', 'founder'] });
                      } catch (err) {
                        alert(err.response?.data?.message || 'Error deleting manager');
                      }
                    }
                  }}>Delete</Button>
                </div>
              </div>
            );
          })}
          {(!dashData?.byState || dashData.byState.length === 0) && (
             <div className="p-8 text-center text-text-muted text-[13px]">No performance data found.</div>
          )}
        </div>
      </div>


      <div className="flex justify-between items-end mb-4 mt-8">
        <div>
          <div className="text-[15px] font-bold text-text-primary">Leave Approvals</div>
          <div className="text-[12px] text-text-muted mt-0.5">State Manager leave requests awaiting founder approval</div>
        </div>
        <div className="bg-amber/10 border border-amber/20 text-amber text-[11px] font-bold px-3 py-1 rounded-full flex items-center gap-1 shadow-sm">
           {"\u26A0"} {pendingLeaves.length} Pending
        </div>
      </div>

      <div className="card overflow-hidden mb-8 border border-border bg-white rounded-xl shadow-sm">
        <div className="divide-y divide-border">
          {pendingLeaves.map((l, idx) => {
             const mName = l.user?.name || 'Unknown';
             const initials = mName.split(' ').map(n=>n[0]).join('').substring(0, 2).toUpperCase();
             const colors = ['bg-[#3b82f6]', 'bg-[#8b5cf6]', 'bg-[#ea580c]', 'bg-[#14b8a6]'];
             const avatarColor = colors[idx % colors.length];

             const roleDisplay = l.user?.role === 'state_manager' ? 'State Manager' : l.user?.role === 'industry_manager' ? 'Industry Mgr' : 'Executive';
             const stateDisplay = l.user?.state || 'Unknown';
             const typeDisplay = (l.type || '').split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

             return (
              <div key={l._id} className="flex items-center justify-between p-4 hover:bg-surface2/30 transition-colors group">
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-full text-white flex items-center justify-center font-bold text-sm ${avatarColor}`}>
                    {initials}
                  </div>
                  <div>
                    <div className="text-[13.5px] font-bold text-text-primary group-hover:text-blue transition-colors">{mName}</div>
                    <div className="text-[11px] text-text-muted mt-0.5">
                      {roleDisplay}, {stateDisplay} {"\u00B7"} {typeDisplay} {"\u00B7"} {l.days} day(s) {"\u00B7"} <span className="italic">{l.reason}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2">
                  <Button size="xs" variant="outline" className="bg-[#f0fdf4] border-[#bbf7d0] text-[#16a34a] shadow-sm hover:bg-[#dcfce7] px-4 font-semibold" onClick={async () => {
                    try {
                      await leaveApi.approveLeave(l._id);
                      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
                    } catch (err) {
                      alert(err.response?.data?.message || 'Error approving leave');
                    }
                  }}>Approve</Button>
                  <Button size="xs" variant="outline" className="bg-[#fef2f2] border-[#fecaca] text-[#dc2626] shadow-sm hover:bg-[#fee2e2] px-4 font-semibold" onClick={() => openModal({ type: 'leave-approval' })}>Reject</Button>
                  <Button size="xs" variant="outline" className="bg-white border-border shadow-sm text-text-primary px-4 font-semibold" onClick={() => openModal({ type: 'leave-approval' })}>Details</Button>
                </div>
              </div>
             );
          })}
          {pendingLeaves.length === 0 && (
             <div className="p-8 text-center text-text-muted text-[13px]">No pending leave requests.</div>
          )}
          {pendingLeaves.length > 0 && (
             <div className="p-3 bg-surface2/30 flex justify-end">
               <Button size="sm" variant="outline" className="bg-white text-text-primary shadow-sm font-semibold">Manage All Leave Requests</Button>
             </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Overview;
