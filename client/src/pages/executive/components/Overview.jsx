import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, keepPreviousData, useQueryClient } from '@tanstack/react-query';
import DashboardSkeleton from '../../../components/skeletons/DashboardSkeleton';
import { dashboardApi } from '../../../api/dashboardApi';
import { leadsApi } from '../../../api/leadsApi';
import { Button, Tag, Modal } from '../../../components/ui';
import { groupParam } from '../../../constants/leadStatusGroups';

// Same card colours as the Founder overview, keyed by the canonical group label.
const PIPELINE_COLORS = {
  All: '#3b82f6',
  New: '#3b82f6',
  'Follow-up': '#8b5cf6',
  Meeting: '#0f766e',
  Blocking: '#d97706',
  'Full Amount Received': '#0891b2',
  Converted: '#16a34a',
  Lost: '#dc2626',
  RNR: '#64748b',
  Escalated: '#ea580c',
};

const getCurrentDefaultValue = (tab) => {
  const now = new Date();
  if (tab === 'week') {
    const week = Math.ceil(now.getDate() / 7);
    return `Week ${week > 5 ? 5 : week}`;
  }
  if (tab === 'month') return now.toLocaleString('en-US', { month: 'long' });
  if (tab === 'quarter') return `Q${Math.floor(now.getMonth() / 3) + 1}`;
  if (tab === 'year') return String(now.getFullYear());
  return '';
};

const getDropdownOptions = (tab) => {
  if (tab === 'week') return ['Week 1', 'Week 2', 'Week 3', 'Week 4', 'Week 5'];
  if (tab === 'month') return ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  if (tab === 'quarter') return ['Q1', 'Q2', 'Q3', 'Q4'];
  if (tab === 'year') {
    const currentYear = new Date().getFullYear();
    return Array.from({ length: 5 }, (_, i) => String(currentYear - i));
  }
  return [];
};

const formatMeetingLead = (meeting) => meeting?.company || meeting?.leadName || 'Upcoming Meeting';

const formatMeetingCountdown = (meetingAt) => {
  if (!meetingAt) return 'Upcoming Meeting';
  const diffMinutes = Math.max(0, Math.round((new Date(meetingAt).getTime() - Date.now()) / 60000));
  if (diffMinutes < 60) return `Meeting in ${diffMinutes} min`;
  const hours = Math.floor(diffMinutes / 60);
  const minutes = diffMinutes % 60;
  if (hours < 24) return `Meeting in ${hours}h${minutes ? ` ${minutes}m` : ''}`;
  const days = Math.floor(hours / 24);
  return `Meeting in ${days} day${days > 1 ? 's' : ''}`;
};

const formatMeetingSubtitle = (meeting) => {
  if (!meeting) return '';
  const timeLabel = new Date(meeting.meetingAt).toLocaleString([], { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
  return [
    timeLabel,
    meeting.inviteeSummary || meeting.owner?.name || 'Assigned staff',
    `${meeting.type} Meeting`,
    meeting.meetingLink ? 'Link Ready' : null
  ].filter(Boolean).join(' · ');
};

const formatDate = (d) => d ? new Date(d).toLocaleDateString([], { day: 'numeric', month: 'short' }) : '';

const Overview = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [summaryTab, setSummaryTab] = useState('week');
  const [summaryPeriodValue, setSummaryPeriodValue] = useState(() => getCurrentDefaultValue('week'));
  const [meetingDetail, setMeetingDetail] = useState(null);
  const [meetingLinkInput, setMeetingLinkInput] = useState('');
  const [savingMeetingLink, setSavingMeetingLink] = useState(false);
  const leaveRequestsRef = useRef(null);

  const { data: dashData, isLoading } = useQuery({
    queryKey: ['dashboard', 'district-manager', summaryTab, summaryPeriodValue],
    queryFn: () => dashboardApi.getDistrictManagerDashboard({ period: summaryTab, value: summaryPeriodValue }).then(res => res.data),
    staleTime: 0,
    placeholderData: keepPreviousData
  });

  useEffect(() => {
    setMeetingLinkInput(meetingDetail?.meetingLink || '');
  }, [meetingDetail]);

  const handleSaveMeetingLink = async () => {
    if (!meetingDetail?._id) return;
    setSavingMeetingLink(true);
    try {
      const res = await leadsApi.updateLead(meetingDetail._id, { meetingLink: meetingLinkInput.trim() });
      const savedLink = res.data?.meetingLink || meetingLinkInput.trim();
      setMeetingDetail(prev => prev ? { ...prev, meetingLink: savedLink } : prev);
      queryClient.invalidateQueries({ queryKey: ['dashboard'], exact: false });
    } catch (err) {
      alert(err.response?.data?.message || 'Error saving meeting link');
    } finally {
      setSavingMeetingLink(false);
    }
  };

  // Cards counted for the selected period hand that period to the lead list, so
  // the list behind a number matches the number.
  const periodQuery = () =>
    new URLSearchParams({
      period: summaryTab,
      ...(summaryPeriodValue ? { value: summaryPeriodValue } : {})
    }).toString();

  const handleTabChange = (t) => {
    setSummaryTab(t);
    setSummaryPeriodValue(getCurrentDefaultValue(t));
  };

  const openModal = (detail) => {
    window.dispatchEvent(new CustomEvent('open-modal', { detail }));
  };

  if (isLoading) return <DashboardSkeleton />;

  const stats = dashData?.stats || {};
  const pipelineStats = dashData?.pipelineStats || [];
  const priorityStats = dashData?.priorityStats || [];
  const expectedOnboardingList = dashData?.expectedOnboardingList || [];
  const pendingLeaves = dashData?.pendingLeaves || [];
  const nextMeeting = (dashData?.upcomingMeetings || [])[0];

  return (
    <div className="animate-in fade-in duration-500">
      {nextMeeting ? (
        <div
          className="meeting-alert mb-6 bg-accent-light/10 border border-accent/20 p-4 rounded-2xl flex items-center gap-4 hover:bg-accent-light/20 transition-all cursor-pointer"
          onClick={() => setMeetingDetail(nextMeeting)}
        >
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
            <Button
              size="xs"
              className="bg-accent text-white border-none"
              onClick={(e) => {
                e.stopPropagation();
                window.open(nextMeeting.meetingLink, '_blank', 'noopener,noreferrer');
              }}
            >
              Join Now
            </Button>
          ) : null}
        </div>
      ) : null}

      <div className="section-header">
        <div>
          <div className="section-title">District Manager Summary</div>
          <div className="section-sub">Your leads &amp; pipeline</div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex bg-surface2 p-1 rounded-xl border border-border">
            {['today', 'week', 'month', 'quarter', 'year'].map(t => (
              <button
                key={t}
                onClick={() => handleTabChange(t)}
                className={`px-6 py-1.5 text-[12px] font-bold uppercase tracking-widest rounded-lg transition-all ${summaryTab === t ? 'bg-surface text-purple shadow-sm' : 'text-text-muted hover:text-text-secondary'}`}
              >
                {t}
              </button>
            ))}
          </div>

          {summaryTab !== 'today' && (
            <select
              value={summaryPeriodValue}
              onChange={(e) => setSummaryPeriodValue(e.target.value)}
              className="bg-white border border-border rounded-xl px-4 py-2 text-[14px] font-bold text-text-secondary outline-none focus:border-blue shadow-sm min-w-[120px]"
            >
              {getDropdownOptions(summaryTab).map(opt => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-5 gap-4 mb-6">
        <div className="stat-card cursor-pointer hover:shadow-md transition-shadow" style={{ borderTop: '4px solid #14b8a6' }} onClick={() => navigate(`/dashboard?page=leads&${periodQuery()}`)}>
          <div className="flex justify-between items-start mb-2">
            <div className="stat-label">Total Leads</div>
            <div className="bg-teal/10 p-1.5 rounded-lg">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#14b8a6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="4" y1="21" x2="4" y2="14"></line><line x1="4" y1="10" x2="4" y2="3"></line><line x1="12" y1="21" x2="12" y2="12"></line><line x1="12" y1="8" x2="12" y2="3"></line><line x1="20" y1="21" x2="20" y2="16"></line><line x1="20" y1="12" x2="20" y2="3"></line><line x1="1" y1="14" x2="7" y2="14"></line><line x1="9" y1="8" x2="15" y2="8"></line><line x1="17" y1="16" x2="23" y2="16"></line></svg>
            </div>
          </div>
          <div className="text-[28px] font-bold font-mono text-text-primary mb-1">{stats.totalLeads?.toLocaleString() || 0}</div>
          <div className="text-[12px] font-medium text-teal">{"↑"} {stats.leadsToday || 0} new today</div>
        </div>

        <div className="stat-card cursor-pointer hover:shadow-md transition-shadow" style={{ borderTop: '4px solid #3b82f6' }} onClick={() => navigate(`/dashboard?page=leads&priority=hot,warm&${periodQuery()}`)}>
          <div className="stat-label mb-2 mt-1">Expected Onboarding</div>
          <div className="text-[28px] font-bold font-mono text-text-primary mb-1">{stats.expectedOnboarding?.toLocaleString() || 0}</div>
          <div className="text-[12px] font-medium text-teal">{"↑"} {summaryPeriodValue || summaryTab} pipeline</div>
        </div>

        <div className="stat-card cursor-pointer hover:shadow-md transition-shadow" style={{ borderTop: '4px solid #f59e0b' }} onClick={() => navigate('/dashboard?page=leads&status=converted')}>
          <div className="stat-label mb-2 mt-1">Conversions</div>
          <div className="text-[28px] font-bold font-mono text-text-primary mb-1">{stats.converted?.toLocaleString() || 0}</div>
          <div className="text-[12px] font-medium text-teal">{"↑"} {stats.convertedThisMonth || 0} this month</div>
        </div>

        <div className="stat-card" style={{ borderTop: '4px solid #0891b2' }}>
          <div className="stat-label mb-2 mt-1">Revenue Generated</div>
          <div className="text-[28px] font-bold font-mono text-text-primary mb-1">
            {"₹"}{stats.revenue ? (stats.revenue >= 10000000 ? (stats.revenue / 10000000).toFixed(2) + 'Cr' : stats.revenue.toLocaleString()) : '0'}
          </div>
          <div className="text-[12px] font-medium text-teal">
            {(stats.revGrowth ?? 0) >= 0 ? '↑' : '↓'} {Math.abs(stats.revGrowth ?? 0)}% MoM
          </div>
        </div>

        <div
          className="stat-card cursor-pointer hover:shadow-md transition-shadow"
          style={{ borderTop: '4px solid #dc2626' }}
          onClick={() => leaveRequestsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
        >
          <div className="stat-label mb-2 mt-1">Pending Leaves</div>
          <div className="text-[28px] font-bold font-mono text-text-primary mb-1">{stats.pendingLeavesCount || 0}</div>
          <div className="text-[12px] font-medium text-orange flex items-center gap-1">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
            Awaiting approval
          </div>
        </div>
      </div>

      <div className="flex justify-between items-end mb-4 mt-8">
        <div>
          <div className="text-[15px] font-bold text-text-primary">Lead Pipeline</div>
          <div className="text-[14px] text-text-muted mt-0.5">Expected onboarding leads & current pipeline status</div>
        </div>
        <Button size="sm" className="bg-[#0f766e] hover:bg-[#0d645e] text-white border-none" onClick={() => openModal('add-lead')}>+ Add Lead</Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-4 mb-8">
        {pipelineStats.map((s) => {
          const color = PIPELINE_COLORS[s.label] || '#3b82f6';
          let bgClass = 'bg-white';
          let borderClass = 'border-border';
          if (s.label === 'Converted') {
            bgClass = 'bg-[#f0fdf4]';
            borderClass = 'border-[#bbf7d0]';
          }
          if (s.label === 'Lost') {
            bgClass = 'bg-[#fef2f2]';
            borderClass = 'border-[#fecaca]';
          }

          return (
            <div
              key={s.label}
              className={`rounded-xl border ${borderClass} ${bgClass} p-5 pb-0 flex flex-col items-center justify-center relative overflow-hidden shadow-sm cursor-pointer hover:shadow-md transition-shadow`}
              onClick={() => navigate(`/dashboard?page=leads&status=${groupParam(s.label)}`)}
              title={`View all ${s.label} leads`}
            >
              <div className="text-[28px] font-bold font-mono mb-1" style={{ color }}>{s.count}</div>
              <div className="text-[14px] text-text-muted font-medium mb-5">{s.label}</div>
              <div className="w-[80%] h-1 rounded-t-md absolute bottom-0" style={{ backgroundColor: color }}></div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-3 gap-4 mb-8">
        {priorityStats.map((p) => {
          const tone = p.priority === 'hot'
            ? { text: 'text-[#dc2626]', bar: '#dc2626', bg: 'bg-[#fef2f2]', border: 'border-[#fecaca]' }
            : p.priority === 'warm'
              ? { text: 'text-[#d97706]', bar: '#d97706', bg: 'bg-[#fffbeb]', border: 'border-[#fde68a]' }
              : { text: 'text-[#3b82f6]', bar: '#3b82f6', bg: 'bg-white', border: 'border-border' };
          return (
            <div
              key={p.priority}
              className={`rounded-xl border ${tone.border} ${tone.bg} p-5 pb-0 flex flex-col items-center justify-center relative overflow-hidden shadow-sm cursor-pointer hover:shadow-md transition-shadow`}
              onClick={() => navigate(`/dashboard?page=leads&priority=${p.priority}`)}
              title={`View all ${p.label} leads`}
            >
              <div className={`text-[28px] font-bold font-mono mb-1 ${tone.text}`}>{p.count}</div>
              <div className="text-[14px] text-text-muted font-medium mb-5">{p.label} Leads</div>
              <div className="w-[80%] h-1 rounded-t-md absolute bottom-0" style={{ backgroundColor: tone.bar }}></div>
            </div>
          );
        })}
      </div>

      <div className="flex justify-between items-end mb-4 mt-8">
        <div>
          <div className="text-[15px] font-bold text-text-primary">Expected Onboarding Leads</div>
          <div className="text-[14px] text-text-muted mt-0.5">Hot &amp; Warm leads expected to convert</div>
        </div>
        {expectedOnboardingList.length > 5 && (
          <Button size="sm" variant="outline" className="bg-white" onClick={() => navigate(`/dashboard?page=leads&priority=hot,warm&${periodQuery()}`)}>
            View All
          </Button>
        )}
      </div>

      <div className="card overflow-hidden mb-8 border border-border bg-white rounded-xl shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface2/50 text-[12px] font-bold text-text-muted uppercase tracking-wider border-b border-border">
                <th className="p-4 font-bold">Lead Name</th>
                <th className="p-4 font-bold">District</th>
                <th className="p-4 font-bold text-center">Status</th>
                <th className="p-4 font-bold">Expected Date</th>
                <th className="p-4 font-bold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {expectedOnboardingList.slice(0, 5).map((lead) => (
                <tr key={lead._id} className="hover:bg-surface2/30 transition-colors">
                  <td className="p-4">
                    <div className="text-[13px] font-bold text-text-primary">{lead.name}</div>
                    <div className="text-[13px] text-text-muted mt-0.5">{lead.phone || 'No contact number'}</div>
                  </td>
                  <td className="p-4">
                    <span className="inline-flex items-center justify-center px-2 py-1 rounded-md bg-blue/10 text-blue text-[10px] font-bold uppercase tracking-wider">{lead.district || lead.state || '—'}</span>
                  </td>
                  <td className="p-4 text-center">
                    <span className={`inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${lead.priority === 'hot' ? 'bg-red/5 text-red border-red/20' : 'bg-amber/5 text-amber border-amber/20'}`}>
                      {lead.priority || 'warm'}
                    </span>
                  </td>
                  <td className="p-4 text-[15px] text-text-secondary font-medium">{lead.expectedDate}</td>
                  <td className="p-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button size="xs" variant="outline" className="bg-white border-border shadow-sm text-text-primary" onClick={() => openModal({ type: 'view-lead', leadId: lead._id })}>View</Button>
                      <Button size="xs" variant="outline" className="bg-white border-border shadow-sm text-text-primary" onClick={() => openModal({ type: 'update-lead', leadData: lead })}>Edit</Button>
                    </div>
                  </td>
                </tr>
              ))}
              {expectedOnboardingList.length === 0 && (
                <tr>
                  <td colSpan="5" className="p-8 text-center text-text-muted text-[15px]">No expected onboarding leads found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div ref={leaveRequestsRef} className="flex justify-between items-end mb-4 mt-8 scroll-mt-6">
        <div>
          <div className="text-[15px] font-bold text-text-primary">My Leave Requests</div>
          <div className="text-[14px] text-text-muted mt-0.5">Your leave requests awaiting approval</div>
        </div>
        <div className="flex items-center gap-2">
          <div className="bg-amber/10 border border-amber/20 text-amber text-[11px] font-bold px-3 py-1 rounded-full flex items-center gap-1 shadow-sm">
            {"⚠"} {pendingLeaves.length} Pending
          </div>
          <Button size="sm" variant="outline" className="bg-white" onClick={() => openModal('apply-leave')}>Apply Leave</Button>
        </div>
      </div>

      <div className="card overflow-hidden mb-8 border border-border bg-white rounded-xl shadow-sm">
        <div className="divide-y divide-border">
          {pendingLeaves.map((l) => {
            const typeDisplay = (l.type || '').split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
            return (
              <div key={l._id} className="flex items-center justify-between p-4 hover:bg-surface2/30 transition-colors">
                <div>
                  <div className="text-[13.5px] font-bold text-text-primary">{typeDisplay || 'Leave'} {"·"} {l.days} day(s)</div>
                  <div className="text-[13px] text-text-muted mt-0.5">
                    {formatDate(l.fromDate)}{l.toDate && l.toDate !== l.fromDate ? ` – ${formatDate(l.toDate)}` : ''}
                    {l.reason ? <> {"·"} <span className="italic">{l.reason}</span></> : null}
                  </div>
                </div>
                <Tag variant="amber" label="Pending" />
              </div>
            );
          })}
          {pendingLeaves.length === 0 && (
            <div className="p-8 text-center text-text-muted text-[15px]">No pending leave requests.</div>
          )}
          <div className="p-3 bg-surface2/30 flex justify-end">
            <Button size="sm" variant="outline" className="bg-white text-text-primary shadow-sm font-semibold" onClick={() => navigate('/dashboard?page=leave-calendar')}>View Leave Calendar</Button>
          </div>
        </div>
      </div>

      <Modal
        isOpen={!!meetingDetail}
        title="Meeting Details"
        subtitle={meetingDetail ? formatMeetingLead(meetingDetail) : ''}
        onClose={() => setMeetingDetail(null)}
      >
        {meetingDetail && (
          <div className="space-y-4">
            <div className="p-4 bg-surface2/50 rounded-xl border border-border">
              <div className="text-[13px] font-bold text-text-muted uppercase tracking-wider mb-1">Time</div>
              <div className="text-sm font-bold text-text-primary">{new Date(meetingDetail.meetingAt).toLocaleString()}</div>
            </div>
            <div className="p-4 bg-surface2/50 rounded-xl border border-border">
              <div className="text-[13px] font-bold text-text-muted uppercase tracking-wider mb-1">Assigned Staff</div>
              <div className="text-sm font-bold text-text-primary">{meetingDetail.inviteeSummary || meetingDetail.owner?.name || 'Assigned staff'}</div>
            </div>
            {meetingDetail.meetingLink ? (
              <div className="p-4 bg-blue/5 rounded-xl border border-blue/10">
                <div className="text-[11px] font-bold text-blue uppercase tracking-wider mb-2">Meeting Link</div>
                <a className="text-sm font-bold text-blue underline break-all" href={meetingDetail.meetingLink} target="_blank" rel="noreferrer">
                  {meetingDetail.meetingLink}
                </a>
              </div>
            ) : (
              <div className="p-4 bg-amber/5 rounded-xl border border-amber/10 text-sm font-medium text-amber">No meeting link has been added yet.</div>
            )}
            <div className="p-4 bg-surface2/50 rounded-xl border border-border">
              <label className="text-[13px] font-bold text-text-muted uppercase tracking-wider mb-2 block">Add / Update Meeting Link</label>
              <input
                className="input"
                type="url"
                value={meetingLinkInput}
                onChange={(e) => setMeetingLinkInput(e.target.value)}
                placeholder="https://meet.google.com/... or https://zoom.us/..."
              />
              <div className="flex justify-end gap-2 mt-3">
                <Button variant="outline" onClick={() => setMeetingLinkInput(meetingDetail.meetingLink || '')}>Reset</Button>
                <Button className="bg-[#0f766e] text-white" onClick={handleSaveMeetingLink} loading={savingMeetingLink}>
                  Save Link
                </Button>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default Overview;
