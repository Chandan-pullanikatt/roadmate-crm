import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import DashboardSkeleton from '../../../components/skeletons/DashboardSkeleton';
import { dashboardApi } from '../../../api/dashboardApi';
import { leaveApi } from '../../../api/leaveApi';
import { Avatar, Button, Tag } from '../../../components/ui';
import { toast } from 'react-hot-toast';
import { groupParam } from '../../../constants/leadStatusGroups';

// Pipeline card colours, keyed by the canonical group label. Same map the Founder
// overview uses, so the two pipelines read identically.
const PIPELINE_COLORS = {
  All: '#3b82f6',
  New: '#3b82f6',
  'Follow-up': '#8b5cf6',
  'Virtual Meeting': '#0d9488',
  'Direct Meeting': '#0f766e',
  Blocking: '#d97706',
  'Full Amount Received': '#0891b2',
  Converted: '#16a34a',
  Lost: '#dc2626',
  RNR: '#64748b',
  Escalated: '#ea580c',
};

const Overview = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [eventFilter, setEventFilter] = useState('Today');

  // Headline-card time filter, mirroring the Founder Summary.
  const [summaryTab, setSummaryTab] = useState('week');

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

  const [summaryPeriodValue, setSummaryPeriodValue] = useState(() => getCurrentDefaultValue('week'));

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

  // staleTime 0 so switching period always refetches instead of serving the
  // previous window's cached numbers.
  const { data: dashData, isLoading } = useQuery({
    queryKey: ['dashboard', 'state-manager', summaryTab, summaryPeriodValue],
    queryFn: () => dashboardApi.getStateManagerDashboard({ period: summaryTab, value: summaryPeriodValue }).then(res => res.data),
    staleTime: 0,
    placeholderData: keepPreviousData
  });

  const leaveMutation = useMutation({
    mutationFn: ({ id, status }) => {
      if (status === 'approved') return leaveApi.approveLeave(id);
      return leaveApi.rejectLeave(id, { approvalNote: 'Rejected by State Manager' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard', 'state-manager'] });
      toast.success('Leave request updated');
    },
    onError: (err) => toast.error(err.message)
  });

  // Sub-pages are switched via the ?page= param read by StateDashboard.jsx
  const goToLead = (id) => id && navigate(`/leads/${id}`);

  if (isLoading) return <DashboardSkeleton />;

  const stats = dashData?.stats || {};
  const managers = dashData?.industryManagers || [];
  const allEvents = dashData?.upcomingEvents || [];
  const pipelineStats = dashData?.pipelineStats || [];
  const priorityStats = dashData?.priorityStats || [];
  const expectedOnboarding = dashData?.expectedOnboarding || [];
  const leaveRequests = dashData?.leaveRequests || [];
  const escalated = dashData?.escalated || [];
  const user = dashData?.user || {};

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const events = allEvents.filter(e => {
    const d = new Date(e.time);
    d.setHours(0, 0, 0, 0);
    if (eventFilter === 'Today') return d.getTime() === today.getTime();
    return d.getTime() === tomorrow.getTime();
  });

  const formatCurrency = (val) => {
    if (val >= 100000) return `\u20B9${(val / 100000).toFixed(1)}L`;
    return `\u20B9${val.toLocaleString()}`;
  };

  // The revenue delta compares the selected window to the one before it, so the
  // label has to follow the tab rather than always reading "MoM".
  const growthLabel = {
    today: 'vs yesterday',
    week: 'WoW',
    month: 'MoM',
    quarter: 'QoQ',
    year: 'YoY'
  }[summaryTab] || 'MoM';

  // The headline cards count one window, so every card that drills down has to hand
  // that window over or the list underneath contradicts the number just clicked.
  const periodQuery = () =>
    new URLSearchParams({
      period: summaryTab,
      ...(summaryPeriodValue ? { value: summaryPeriodValue } : {})
    }).toString();

  const statCard = 'bg-surface1 p-5 rounded-2xl border border-border shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all group relative overflow-hidden cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-blue/50';

  // Makes a stat card behave like a button (pointer + keyboard) without changing its markup
  const cardProps = (page, query = '') => {
    const go = () => navigate(`/dashboard?page=${page}${query ? `&${query}` : ''}`);
    return {
      role: 'button',
      tabIndex: 0,
      className: statCard,
      onClick: go,
      onKeyDown: (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); }
      },
    };
  };

  return (
    <div className="animate-in fade-in duration-500 pb-10">
      {/* Header Section */}
      <div className="flex flex-wrap justify-between items-start gap-4 mb-6">
        <div>
          <h1 className="text-[22px] font-bold text-text-primary">State Manager Dashboard</h1>
          <p className="text-[15px] text-text-muted mt-0.5">
            {user.state} · Full state overview · Industry managers & district managers
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex bg-surface2 p-1 rounded-xl border border-border">
            {['today', 'week', 'month', 'quarter', 'year'].map(t => (
              <button
                key={t}
                onClick={() => handleTabChange(t)}
                className={`px-5 py-1.5 text-[12px] font-bold uppercase tracking-widest rounded-lg transition-all ${summaryTab === t ? 'bg-surface1 text-purple shadow-sm' : 'text-text-muted hover:text-text-secondary'}`}
              >
                {t}
              </button>
            ))}
          </div>

          {summaryTab !== 'today' && (
            <select
              value={summaryPeriodValue}
              onChange={(e) => setSummaryPeriodValue(e.target.value)}
              className="bg-surface1 border border-border rounded-xl px-4 py-2 text-[14px] font-bold text-text-secondary outline-none focus:border-blue shadow-sm min-w-[120px]"
            >
              {getDropdownOptions().map(opt => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Escalation Alert */}
      {escalated.length > 0 && (
        <div className="bg-[#FFFBEB] border border-[#FEF3C7] rounded-2xl p-4 flex items-center gap-4 mb-6 animate-pulse-subtle shadow-sm">
          <div className="w-10 h-10 rounded-full bg-[#FEF3C7] flex items-center justify-center text-[#D97706] text-lg shrink-0">{"\u26A0"}</div>
          <div className="flex-1">
            <div className="text-[13.5px] font-bold text-[#92400E]">
              {escalated.length} Escalated Lead{escalated.length > 1 ? 's' : ''} <span className="font-normal">awaiting your approval, from Industry Manager {"\u2014"} <button onClick={() => goToLead(escalated[0]._id)} className="font-bold underline underline-offset-2 hover:text-[#B45309]">{escalated[0].company || escalated[0].name}</button> {"\u00B7"} {escalated[0].district} {"\u00B7"} {escalated[0].priority}</span>
            </div>
          </div>
          <div className="flex gap-2">
            {/* These leads are not this manager's yet — they have to be approved
                first — so the button goes to the approvals page, not the escalate
                modal, which would have tried to push on a lead they do not own. */}
            <Button 
              size="sm" 
              className="bg-[#D97706] hover:bg-[#B45309] text-white border-none h-8 px-4 text-[12px] font-bold"
              onClick={() => navigate('/dashboard?page=escalations')}
            >
              Review &amp; Approve
            </Button>
          </div>
        </div>
      )}

      {/* Stat Grid — same headline cards as the Founder overview, minus State Managers */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mb-6">
        <div {...cardProps('leads', periodQuery())}>
          <div className="absolute top-0 left-0 w-full h-1 bg-teal/40"></div>
          <div className="text-[15px] font-bold text-text-muted">Total Leads</div>
          <div className="text-[28px] font-black text-text-primary mt-1">{(stats.totalLeads ?? 0).toLocaleString()}</div>
          <div className="text-[11.5px] font-bold text-teal mt-2 flex items-center gap-1">
            {"\u2191"} {stats.leadsToday ?? 0} new today
          </div>
        </div>

        <div {...cardProps('leads', `${periodQuery()}&priority=hot,warm&excludeStatuses=converted,lost,not_interested`)}>
          <div className="absolute top-0 left-0 w-full h-1 bg-blue/40"></div>
          <div className="text-[15px] font-bold text-text-muted">Expected Onboarding</div>
          <div className="text-[28px] font-black text-text-primary mt-1">{(stats.expectedOnboarding ?? 0).toLocaleString()}</div>
          <div className="text-[11.5px] font-bold text-teal mt-2 flex items-center gap-1">
            {"\u2191"} {summaryPeriodValue || summaryTab} pipeline
          </div>
        </div>

        <div {...cardProps('leads', `${periodQuery()}&status=converted&dateField=convertedAt`)}>
          <div className="absolute top-0 left-0 w-full h-1 bg-amber/40"></div>
          <div className="text-[15px] font-bold text-text-muted">Conversions</div>
          <div className="text-[28px] font-black text-text-primary mt-1">{(stats.converted ?? 0).toLocaleString()}</div>
          <div className="text-[11.5px] font-bold text-teal mt-2 flex items-center gap-1">
            {"\u2191"} {stats.convertedThisMonth ?? 0} this month
          </div>
        </div>

        <div {...cardProps('reports')}>
          <div className="absolute top-0 left-0 w-full h-1 bg-[#0891b2]/40"></div>
          <div className="text-[15px] font-bold text-text-muted">Revenue Generated</div>
          <div className="text-[28px] font-black text-text-primary mt-1">
            {"\u20B9"}{stats.revenue ? (stats.revenue >= 10000000 ? (stats.revenue / 10000000).toFixed(2) + 'Cr' : stats.revenue.toLocaleString()) : '0'}
          </div>
          <div className="text-[11.5px] font-bold text-teal mt-2 flex items-center justify-between">
            <span>{(stats.revenueGrowth ?? 0) >= 0 ? '\u2191' : '\u2193'} {Math.abs(stats.revenueGrowth ?? 0)}% {growthLabel}</span>
            <span className="text-[10px] font-bold text-blue underline">View Analysis</span>
          </div>
        </div>

        <div {...cardProps('industry-managers')}>
          <div className="absolute top-0 left-0 w-full h-1 bg-blue/40"></div>
          <div className="text-[15px] font-bold text-text-muted">Industry Managers</div>
          <div className="text-[28px] font-black text-text-primary mt-1">{stats.industryManagersBreakdown?.total ?? 0}</div>
          <div className="text-[11.5px] font-bold mt-2 flex gap-2">
            <span className="text-teal">{"\u2022"} {stats.industryManagersBreakdown?.working ?? 0} Working</span>
            <span className="text-red">{"\u2022"} {stats.industryManagersBreakdown?.onLeave ?? 0} On Leave</span>
            <span className="text-text-muted">{"\u2022"} {stats.industryManagersBreakdown?.notStarted ?? 0} Not Started</span>
          </div>
        </div>

        <div {...cardProps('executives')}>
          <div className="absolute top-0 left-0 w-full h-1 bg-purple/40"></div>
          <div className="text-[15px] font-bold text-text-muted">District Managers</div>
          <div className="text-[28px] font-black text-text-primary mt-1">{stats.districtManagersBreakdown?.total ?? 0}</div>
          <div className="text-[11.5px] font-bold mt-2 flex gap-2">
            <span className="text-teal">{"\u2022"} {stats.districtManagersBreakdown?.working ?? 0} Working</span>
            <span className="text-red">{"\u2022"} {stats.districtManagersBreakdown?.onLeave ?? 0} On Leave</span>
            <span className="text-text-muted">{"\u2022"} {stats.districtManagersBreakdown?.notStarted ?? 0} Not Started</span>
          </div>
        </div>

        <div {...cardProps('calendar')}>
          <div className="absolute top-0 left-0 w-full h-1 bg-red/40"></div>
          <div className="text-[15px] font-bold text-text-muted">Pending Leaves</div>
          <div className="text-[28px] font-black text-text-primary mt-1">{stats.pendingLeaves ?? 0}</div>
          <div className="text-[11.5px] font-bold text-[#D97706] mt-2 flex items-center gap-1">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
            Needs approval
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-6">
        {/* Industry Managers List */}
        <div className="lg:col-span-7 bg-surface1 rounded-2xl border border-border shadow-sm overflow-hidden">
          <div className="p-5 border-b border-border flex justify-between items-center">
            <div>
              <h2 className="text-[15px] font-bold text-text-primary">Industry Managers {"\u00B7"} {user.state}</h2>
              <p className="text-[14px] text-text-muted mt-0.5">Drill in for full details</p>
            </div>
            <Button variant="outline" size="sm" className="text-[12px] h-8 px-4 font-bold border-border">View All</Button>
          </div>
          <div className="divide-y divide-border">
            {managers.map((m, idx) => (
              <div key={idx} className="p-5 flex items-center gap-4 hover:bg-surface2/30 transition-colors cursor-pointer group">
                <Avatar name={m.name} size="md" className={`av-${idx % 5}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-center mb-1.5">
                    <div className="font-bold text-[14px] text-text-primary group-hover:text-blue transition-colors">{m.name}</div>
                    <div className="text-[13px] font-black text-text-muted uppercase tracking-wider">{m.efficiency}%</div>
                  </div>
                  <div className="text-[14px] text-text-muted mb-3">{m.industry} {"\u00B7"} {m.districts} Districts {"\u00B7"} {m.leadsCount} leads</div>
                  <div className="h-1.5 w-full bg-surface2 rounded-full overflow-hidden border border-border/50">
                    <div 
                      className="h-full bg-blue transition-all duration-1000 ease-out" 
                      style={{ width: `${m.efficiency}%` }}
                    ></div>
                  </div>
                </div>
                <div className="flex gap-6 ml-4">
                  <div className="text-center">
                    <div className="text-[14px] font-black text-text-primary">{m.calls}</div>
                    <div className="text-[11px] text-text-muted uppercase font-black tracking-tighter">Calls</div>
                  </div>
                  <div className="text-center">
                    <div className="text-[14px] font-black text-text-primary">{m.conversions}</div>
                    <div className="text-[11px] text-text-muted uppercase font-black tracking-tighter">Conv.</div>
                  </div>
                  <div className="text-center">
                    <div className="text-[14px] font-black text-teal">{formatCurrency(m.revenue)}</div>
                    <div className="text-[11px] text-text-muted uppercase font-black tracking-tighter">Rev.</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Upcoming Events */}
        <div className="lg:col-span-5 bg-surface1 rounded-2xl border border-border shadow-sm overflow-hidden">
          <div className="p-5 border-b border-border flex justify-between items-center">
            <div>
              <h2 className="text-[15px] font-bold text-text-primary">Upcoming Events</h2>
              <p className="text-[14px] text-text-muted mt-0.5">Meetings, follow-ups, leave</p>
            </div>
            <div className="flex gap-1">
               {['Today', 'Tomorrow'].map(t => (
                 <button key={t} onClick={() => setEventFilter(t)} className={`px-3 py-1 text-[13px] font-bold rounded-md transition-all ${eventFilter === t ? 'bg-blue/10 text-blue' : 'text-text-muted hover:bg-surface2'}`}>
                   {t}
                 </button>
               ))}
            </div>
          </div>
          <div className="p-5 flex flex-col gap-5">
            {events.map((e, i) => (
              <div
                key={i}
                onClick={() => goToLead(e._id)}
                className={`flex gap-4 group ${e._id ? 'cursor-pointer' : ''}`}
              >
                <div className="w-10 h-10 rounded-xl bg-surface2 flex items-center justify-center text-lg shrink-0 group-hover:scale-110 transition-transform">
                   {e.type === 'meeting' ? '📹' : e.type === 'followup' ? '📞' : '📅'}
                </div>
                <div className="flex-1 border-b border-border/50 pb-4 group-last:border-0 group-last:pb-0">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="text-[13.5px] font-bold text-text-primary group-hover:text-blue transition-colors">{e.title}</div>
                      <div className="text-[13.5px] text-text-muted mt-0.5">{e.subTitle}</div>
                      <div className="text-[11.5px] font-black text-blue mt-2 uppercase tracking-wide">
                        {new Date(e.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} {new Date(e.time).toLocaleDateString() === new Date().toLocaleDateString() ? 'Today' : ''}
                      </div>
                    </div>
                    <Tag 
                      variant={e.type === 'meeting' ? 'teal' : e.type === 'followup' ? 'purple' : 'amber'} 
                      label={e.type} 
                      className="text-[9px] px-2 py-0.5 uppercase font-black"
                    />
                  </div>
                </div>
              </div>
            ))}
            {events.length === 0 && <div className="py-10 text-center text-[14px] text-text-muted italic">No upcoming events scheduled</div>}
          </div>
        </div>
      </div>

      {/* Lead Pipeline — same buckets and cards as the Founder overview, scoped to
          this state and the window selected above. */}
      <div className="flex justify-between items-end mb-4 mt-8">
        <div>
          <div className="text-[15px] font-bold text-text-primary">Lead Pipeline {"·"} {user.state}</div>
          <div className="text-[14px] text-text-muted mt-0.5">Expected onboarding leads &amp; current pipeline status</div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-4 mb-8">
        {pipelineStats.map((s, i) => {
          let bgClass = 'bg-surface1';
          let borderClass = 'border-border';
          const bottomColor = PIPELINE_COLORS[s.label] || '#3b82f6';

          if (s.label === 'Converted') {
            bgClass = 'bg-[#f0fdf4]';
            borderClass = 'border-[#bbf7d0]';
          }
          if (s.label === 'Lost') {
            bgClass = 'bg-[#fef2f2]';
            borderClass = 'border-[#fecaca]';
          }

          // Slug must match the lead-list tab ids, which come from the same canonical
          // groups — otherwise the card opens a tab filtering on a status no lead has.
          const statusParam = groupParam(s.label);

          return (
            <div
              key={i}
              className={`rounded-xl border ${borderClass} ${bgClass} p-5 pb-0 flex flex-col items-center justify-center relative overflow-hidden shadow-sm cursor-pointer hover:shadow-md transition-shadow`}
              onClick={() => navigate(`/dashboard?page=leads&owner=all&status=${statusParam}&${periodQuery()}`)}
              title={`View all ${s.label} leads`}
            >
              <div className="text-[28px] font-bold font-mono mb-1" style={{ color: bottomColor }}>
                {s.count}
              </div>
              <div className="text-[14px] text-text-muted font-medium mb-5">{s.label}</div>
              <div className="w-[80%] h-1 rounded-t-md absolute bottom-0" style={{ backgroundColor: bottomColor }}></div>
            </div>
          );
        })}
      </div>

      {/* Lead temperature — a separate axis from the status buckets above */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        {priorityStats.map((p) => {
          const tone = p.priority === 'hot'
            ? { text: 'text-[#dc2626]', bar: '#dc2626', bg: 'bg-[#fef2f2]', border: 'border-[#fecaca]' }
            : p.priority === 'warm'
              ? { text: 'text-[#d97706]', bar: '#d97706', bg: 'bg-[#fffbeb]', border: 'border-[#fde68a]' }
              : { text: 'text-[#3b82f6]', bar: '#3b82f6', bg: 'bg-surface1', border: 'border-border' };
          return (
            <div
              key={p.priority}
              className={`rounded-xl border ${tone.border} ${tone.bg} p-5 pb-0 flex flex-col items-center justify-center relative overflow-hidden shadow-sm cursor-pointer hover:shadow-md transition-shadow`}
              onClick={() => navigate(`/dashboard?page=leads&owner=all&priority=${p.priority}&${periodQuery()}`)}
              title={`View all ${p.label} leads`}
            >
              <div className={`text-[28px] font-bold font-mono mb-1 ${tone.text}`}>{p.count}</div>
              <div className="text-[14px] text-text-muted font-medium mb-5">{p.label} Leads</div>
              <div className="w-[80%] h-1 rounded-t-md absolute bottom-0" style={{ backgroundColor: tone.bar }}></div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-6">
        {/* Leave Requests */}
        <div className="lg:col-span-12 bg-surface1 rounded-2xl border border-border shadow-sm overflow-hidden">
          <div className="p-5 border-b border-border flex justify-between items-center">
            <div>
              <h2 className="text-[15px] font-bold text-text-primary">Leave Requests</h2>
              <p className="text-[14px] text-text-muted mt-0.5">Industry Managers &amp; District Managers pending approval</p>
            </div>
            <Tag variant="amber" label={`${leaveRequests.length} Pending`} className="font-black text-[10px]" />
          </div>
          <div className="divide-y divide-border">
            {leaveRequests.map((r, i) => (
              <div key={i} className="p-5 flex items-center gap-4 group">
                <Avatar name={r.user.name} size="md" className={`av-${i % 5}`} />
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-[14px] text-text-primary">{r.user.name}</div>
                  <div className="text-[13px] text-text-muted mt-0.5 truncate">
                    Industry Mgr {"\u00B7"} {r.user.industry} {"\u00B7"} {new Date(r.fromDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} {"\u00B7"} {r.reason}
                  </div>
                </div>
                <div className="flex gap-2">
                   <button 
                     onClick={() => leaveMutation.mutate({ id: r._id, status: 'approved' })}
                     className="px-3 py-1.5 bg-green/10 text-green text-[11px] font-black rounded-lg hover:bg-green hover:text-white transition-all border border-green/20"
                   >
                     Approve
                   </button>
                   <button 
                     onClick={() => leaveMutation.mutate({ id: r._id, status: 'rejected' })}
                     className="px-3 py-1.5 bg-red/10 text-red text-[11px] font-black rounded-lg hover:bg-red hover:text-white transition-all border border-red/20"
                   >
                     Reject
                   </button>
                </div>
              </div>
            ))}
            {leaveRequests.length === 0 && (
              <div className="p-10 text-center text-[14px] text-text-muted italic">No pending leave requests from managers</div>
            )}
            <div className="p-4 bg-surface2/30 border-t border-border">
               <button className="w-full py-2 text-[14px] font-bold text-text-secondary hover:text-blue transition-colors">Manage All Requests</button>
            </div>
          </div>
        </div>
      </div>

      {/* Expected Onboarding Table */}
      <div className="bg-surface1 rounded-2xl border border-border shadow-sm overflow-hidden">
        <div className="p-6 border-b border-border flex justify-between items-center">
          <div>
            <h2 className="text-[16px] font-bold text-text-primary">Expected Onboarding Leads {"\u00B7"} {user.state}</h2>
            <p className="text-[15px] text-text-muted mt-0.5">Track & manage leads across industries</p>
          </div>
          <div className="flex gap-3">
             <Button variant="outline" size="sm" className="font-bold text-[12px] border-border shadow-sm">
                📊 1 Bulk Upload
             </Button>
             <Button 
                className="bg-blue hover:bg-blue-dark text-white font-bold text-[12px] border-none shadow-lg shadow-blue/20"
                onClick={() => window.dispatchEvent(new CustomEvent('open-modal', { detail: 'add-lead' }))}
             >
                + Add Lead
             </Button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface2/50 border-b border-border">
                <th className="px-6 py-4 text-[13px] font-black text-text-muted uppercase tracking-wider">Lead ID</th>
                <th className="px-6 py-4 text-[13px] font-black text-text-muted uppercase tracking-wider">Business</th>
                <th className="px-6 py-4 text-[13px] font-black text-text-muted uppercase tracking-wider">Industry</th>
                <th className="px-6 py-4 text-[13px] font-black text-text-muted uppercase tracking-wider">District</th>
                <th className="px-6 py-4 text-[13px] font-black text-text-muted uppercase tracking-wider">Manager</th>
                <th className="px-6 py-4 text-[13px] font-black text-text-muted uppercase tracking-wider">Status</th>
                <th className="px-6 py-4 text-[13px] font-black text-text-muted uppercase tracking-wider text-right">Revenue</th>
                <th className="px-6 py-4 text-[13px] font-black text-text-muted uppercase tracking-wider text-center">Age</th>
                <th className="px-6 py-4 text-[13px] font-black text-text-muted uppercase tracking-wider text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {expectedOnboarding.map((l, i) => (
                <tr
                  key={i}
                  onClick={() => goToLead(l._id)}
                  className="hover:bg-surface2/30 transition-colors group cursor-pointer"
                >
                  <td className="px-6 py-4 font-mono text-[13.5px] font-black text-text-secondary">{l.leadId}</td>
                  <td className="px-6 py-4">
                    <div className="text-[14px] font-bold text-text-primary group-hover:text-blue transition-colors">{l.business}</div>
                    <div className="text-[13.5px] text-text-muted mt-0.5">{l.contact}</div>
                  </td>
                  <td className="px-6 py-4">
                     <span className="px-3 py-1 bg-surface2 text-text-secondary text-[12px] font-black rounded-full uppercase tracking-wide border border-border/50">
                        {l.industry}
                     </span>
                  </td>
                  <td className="px-6 py-4 text-[15px] font-bold text-text-secondary">{l.district}</td>
                  <td className="px-6 py-4 text-[13px] font-bold text-text-primary">{l.manager}</td>
                  <td className="px-6 py-4">
                     <Tag 
                       variant={l.priority === 'hot' ? 'red' : l.priority === 'warm' ? 'amber' : 'blue'} 
                       label={l.status.toUpperCase()} 
                       className="text-[10px] px-2 py-0.5 font-black uppercase"
                     />
                  </td>
                  <td className="px-6 py-4 text-[13.5px] font-black text-text-primary text-right">
                    {formatCurrency(l.revenue)}
                  </td>
                  <td className="px-6 py-4 text-[14px] font-bold text-text-muted text-center">{l.age}</td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={(e) => { e.stopPropagation(); goToLead(l._id); }}
                      className="px-4 py-1.5 bg-surface2 hover:bg-border text-text-secondary text-[13px] font-bold rounded-lg transition-all border border-border"
                    >
                       View
                    </button>
                  </td>
                </tr>
              ))}
              {expectedOnboarding.length === 0 && (
                <tr>
                  <td colSpan="9" className="px-6 py-20 text-center text-[15px] text-text-muted italic">
                    No leads found in current pipeline for onboarding
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

export default Overview;

