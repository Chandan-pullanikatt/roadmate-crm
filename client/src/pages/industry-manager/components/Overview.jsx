import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Tag,
  Button,
  DashboardSkeleton,
  Modal
} from '../../../components/ui';
import { dashboardApi } from '../../../api/dashboardApi';
import { leaveApi } from '../../../api/leaveApi';
import { leadsApi } from '../../../api/leadsApi';
import { groupParam } from '../../../constants/leadStatusGroups';
import { useToast } from '../../../context/ToastContext';

const FILTER_PERIODS = [
  { key: 'year',    label: 'Year'    },
  { key: 'quarter', label: 'Quarter' },
  { key: 'month',   label: 'Month'   },
  { key: 'week',    label: 'Week'    },
  { key: 'day',     label: 'Day'     },
];

const PERIOD_SUB_OPTIONS = {
  month: ['January','February','March','April','May','June','July','August','September','October','November','December'],
  week: ['Week 1','Week 2','Week 3','Week 4'],
  quarter: ['Q1','Q2','Q3','Q4'],
  year: (() => {
    const y = new Date().getFullYear();
    return [String(y), String(y - 1), String(y - 2), String(y - 3)];
  })(),
};

const Overview = () => {
  const queryClient = useQueryClient();
  const { addToast } = useToast();
  const navigate = useNavigate();
  const [period, setPeriod] = useState('month');
  const [periodValue, setPeriodValue] = useState('');
  const [execModal, setExecModal] = useState(null); // { exec, type: 'calls' | 'converted' | 'hot' }
  const [eventModal, setEventModal] = useState(null); // event object from upcomingEvents
  const [reassignModal, setReassignModal] = useState(null); // lead object
  const [reassignExecId, setReassignExecId] = useState('');
  const [summaryModal, setSummaryModal] = useState(null); // stat card id
  const [scheduleDay, setScheduleDay] = useState('today'); // 'today' | 'tomorrow'

  const handlePeriodChange = (key) => {
    setPeriod(key);
    setPeriodValue('');
  };

  const { data: dashData, isLoading } = useQuery({
    queryKey: ['dashboard', 'industry-manager', period, periodValue],
    queryFn: () => dashboardApi.getIndustryManagerDashboard(period, periodValue || undefined).then(res => res.data),
    staleTime: 0,
    placeholderData: (prev) => prev
  });

  const { data: eventActivity = [], isFetching: eventActivityLoading } = useQuery({
    queryKey: ['lead-activity', eventModal?.leadId],
    queryFn: () => leadsApi.getLeadActivity(eventModal.leadId).then(r => r.data.activities || []),
    enabled: !!eventModal?.leadId,
    staleTime: 0,
  });

  const reassignMutation = useMutation({
    mutationFn: ({ leadId, execId }) => leadsApi.allocateLead(leadId, execId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard', 'industry-manager'] });
      addToast('Lead reassigned successfully', 'success');
      setReassignModal(null);
      setReassignExecId('');
    },
    onError: (err) => addToast(err?.response?.data?.message || 'Reassignment failed', 'error'),
  });

  const approveMutation = useMutation({
    mutationFn: leaveApi.approveLeave,
    onSuccess: () => {
      queryClient.invalidateQueries(['dashboard', 'industry-manager']);
      addToast("Leave request approved", "success");
    }
  });

  const rejectMutation = useMutation({
    mutationFn: (id) => leaveApi.rejectLeave(id, { reason: 'Rejected by manager' }),
    onSuccess: () => {
      queryClient.invalidateQueries(['dashboard', 'industry-manager']);
      addToast("Leave request rejected", "error");
    }
  });

  if (isLoading && !dashData) return <DashboardSkeleton />;

  const stats = dashData?.stats || {};
  const periodStats = dashData?.periodStats || {};
  const activeLeads = dashData?.activeLeads ?? 0;
  const allTeam = dashData?.executivePerformance || [];
  const team = allTeam;
  const events = dashData?.upcomingEvents || [];
  // upcomingEvents spans today onward, so pick out the day being viewed.
  const visibleEvents = (() => {
    const target = new Date();
    if (scheduleDay === 'tomorrow') target.setDate(target.getDate() + 1);
    const targetDay = target.toDateString();
    return events.filter(ev => ev.time && new Date(ev.time).toDateString() === targetDay);
  })();
  const leaves = dashData?.leaveRequests || [];
  const userInfo = dashData?.user || {};
  const escalatedLeads = dashData?.escalatedLeads || [];
  const recentLeads = dashData?.leads || [];
  const summaryDrilldowns = dashData?.summaryDrilldowns || {};
  const pipelineStats = dashData?.pipelineStats || [];
  const priorityStats = dashData?.priorityStats || [];
  const expectedOnboardingList = dashData?.expectedOnboardingList || [];
  const summaryCounts = {
    executives: summaryDrilldowns.executives?.count ?? stats.totalExecutives ?? 0,
    revenue: summaryDrilldowns.revenue?.count ?? 0,
    totalLeads: summaryDrilldowns.totalLeads?.count ?? periodStats.totalLeads ?? 0,
    converted: summaryDrilldowns.converted?.count ?? stats.convertedThisMonth ?? 0,
    expectedOnboarding: periodStats.expectedOnboarding ?? 0,
    calls: summaryDrilldowns.calls?.count ?? stats.callsThisWeek ?? 0,
    meetings: summaryDrilldowns.meetings?.count ?? periodStats.meetings ?? 0,
    hot: summaryDrilldowns.hot?.count ?? periodStats.hot ?? 0,
    leaves: summaryDrilldowns.leaves?.count ?? leaves.length,
  };
  const goToLead = (leadId) => {
    if (!leadId) return;
    setSummaryModal(null);
    setExecModal(null);
    setEventModal(null);
    navigate(`/leads/${leadId}`);
  };

  // Pipeline card colours, keyed by the canonical group label.
  const PIPELINE_COLORS = {
    All: '#3b82f6', New: '#3b82f6', 'Follow-up': '#8b5cf6', Meeting: '#0f766e',
    Blocking: '#d97706', 'Full Amount Received': '#0891b2', Converted: '#16a34a',
    Lost: '#dc2626', RNR: '#64748b', Escalated: '#ea580c',
  };

  const formatCurrency = (val) => {
    if (val >= 100000) return `₹${(val / 100000).toFixed(1)}L`;
    if (val >= 1000) return `₹${(val / 1000).toFixed(1)}K`;
    return `₹${val}`;
  };

  const getInitials = (name) => name?.split(' ').map(n => n[0]).join('').toUpperCase() || 'U';

  // GlobalModals listens for this app-wide; same helper the other dashboards use.
  const openModal = (type, data = null) => {
    window.dispatchEvent(new CustomEvent('open-modal', {
      detail: typeof type === 'string' ? { type, ...data } : type
    }));
  };

  const convDelta = (stats.convertedThisMonth ?? 0) - (stats.convertedLastMonth ?? 0);
  const periodLabel = FILTER_PERIODS.find(p => p.key === period)?.label || 'Period';
  const selectedPeriodQuery = `period=${encodeURIComponent(period)}${periodValue ? `&value=${encodeURIComponent(periodValue)}` : ''}`;
  // Every figure on this page counts the whole reporting subtree -- this manager's own
  // leads plus their District Managers'. The ?page=leads route defaults to team-only,
  // which excludes the manager's own, so drill-downs have to say owner=all or the list
  // contradicts the number that was just clicked.
  const drilldownQuery = `owner=all&${selectedPeriodQuery}`;

  // The same headline cards the Founder and State Manager show, minus the two that
  // have no meaning here: State Managers and Industry Managers.
  const statCards = [
    {
      id: 'total-leads',
      color: '#14b8a6',
      label: 'Total Leads',
      value: summaryCounts.totalLeads,
      valueColor: 'var(--text-primary)',
      delta: `→ This ${periodLabel.toLowerCase()}`,
      deltaColor: 'var(--text-muted)',
    },
    {
      id: 'expected-onboarding',
      color: '#3b82f6',
      label: 'Expected Onboarding',
      value: summaryCounts.expectedOnboarding,
      valueColor: 'var(--text-primary)',
      delta: `↑ ${periodStats.expectedOnboardingHot ?? 0} hot, ${periodStats.expectedOnboardingWarm ?? 0} warm`,
      deltaColor: 'var(--accent)',
      navTo: `/dashboard?page=leads&priority=hot,warm&excludeStatuses=converted,lost,not_interested&${drilldownQuery}`,
    },
    {
      id: 'converted',
      color: '#f59e0b',
      label: 'Conversions',
      value: summaryCounts.converted,
      valueColor: 'var(--text-primary)',
      delta: `${convDelta > 0 ? '↑' : convDelta < 0 ? '↓' : '→'} ${Math.abs(convDelta)} vs last month`,
      deltaColor: convDelta >= 0 ? 'var(--accent)' : 'var(--red)',
    },
    {
      id: 'revenue',
      color: '#0891b2',
      label: 'Revenue Generated',
      value: formatCurrency(periodStats.revenue || 0),
      valueColor: 'var(--text-primary)',
      delta: period === 'month'
        ? `${(stats.revGrowth ?? 0) >= 0 ? '↑' : '↓'} ${Math.abs(Math.round(stats.revGrowth || 0))}% MoM`
        : `→ This ${periodLabel.toLowerCase()}`,
      deltaColor: period === 'month'
        ? ((stats.revGrowth ?? 0) >= 0 ? 'var(--accent)' : 'var(--red)')
        : 'var(--text-muted)',
    },
    {
      id: 'executives',
      color: '#ea580c',
      label: 'District Managers',
      value: summaryCounts.executives,
      valueColor: 'var(--text-primary)',
      delta: `↑ ${stats.activeToday >= stats.totalExecutives && stats.totalExecutives > 0 ? 'All' : (stats.activeToday || 0)} active · ${userInfo.industry || ''}`,
      deltaColor: 'var(--accent)',
      navOnly: true,
      page: 'team'
    },
    {
      id: 'leaves',
      color: '#dc2626',
      label: 'Pending Leaves',
      value: summaryCounts.leaves,
      valueColor: 'var(--text-primary)',
      delta: leaves.length > 0 ? 'Needs approval' : 'All clear',
      deltaColor: leaves.length > 0 ? 'var(--amber)' : 'var(--accent)',
      navOnly: true,
      page: 'approvals'
    }
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-700">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-text-primary tracking-tight">{userInfo.name}</h1>
          <p className="text-sm text-text-muted mt-0.5 font-medium">
            Industry Manager <span className="mx-2 opacity-30">·</span> {userInfo.industry} <span className="mx-2 opacity-30">·</span> {userInfo.state}
          </p>
        </div>
        {/* Period filter sits on the header row rather than a row of its own, which
            left a band of empty space across the page. */}
        <div className="flex flex-wrap items-center justify-end gap-3">
          {PERIOD_SUB_OPTIONS[period] && (
            <select
              value={periodValue}
              onChange={e => setPeriodValue(e.target.value)}
              className="h-9 px-3 rounded-xl border border-border/60 bg-white text-[11px] font-bold text-text-primary shadow-sm focus:outline-none focus:ring-2 focus:ring-purple/20 cursor-pointer"
            >
              <option value="">Current {FILTER_PERIODS.find(p => p.key === period)?.label}</option>
              {PERIOD_SUB_OPTIONS[period].map(opt => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          )}
          <div className="flex items-center gap-1 bg-surface2/60 p-1 rounded-2xl border border-border/40">
            {FILTER_PERIODS.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => handlePeriodChange(key)}
                className={`px-4 py-1.5 rounded-xl text-[11px] font-bold transition-all ${
                  period === key
                    ? 'bg-white shadow-sm text-purple border border-border/40'
                    : 'text-text-muted hover:text-text-primary'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Escalation Banner */}
      {escalatedLeads.length > 0 && (
        <div style={{
          background: 'var(--amber-light)',
          border: '1px solid #FCD34D',
          borderRadius: 'var(--radius-sm)',
          padding: '10px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          fontSize: 13,
          color: 'var(--amber)'
        }}>
          <span>⚠️</span>
          <span>
            <strong>{escalatedLeads.length} Lead{escalatedLeads.length > 1 ? 's' : ''} Escalated from District Manager</strong>
            {escalatedLeads[0] && ` — ${escalatedLeads[0].company || escalatedLeads[0].name || ''} · ${escalatedLeads[0].owner?.name || ''} · Needs manager decision`}
          </span>
          <button
            className="btn btn-xs btn-warn"
            style={{ marginLeft: 'auto', fontSize: 11, padding: '3px 10px', borderRadius: 5, border: '1px solid #FCD34D', background: 'transparent', color: 'var(--amber)', cursor: 'pointer', fontWeight: 600 }}
            onClick={() => navigate('/dashboard?page=leads')}
          >
            Review Lead
          </button>
          <button
            className="btn btn-xs btn-outline"
            style={{ fontSize: 11, padding: '3px 10px', borderRadius: 5, border: '1px solid var(--border)', background: 'var(--surface)', cursor: 'pointer', fontWeight: 600, color: 'var(--text-secondary)' }}
            onClick={() => navigate('/dashboard?page=leads')}
          >
            Escalate to State Manager
          </button>
        </div>
      )}

      {/* Headline stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {statCards.map((card) => (
          <div
            key={card.id}
            onClick={() => card.navTo ? navigate(card.navTo) : card.navOnly ? navigate(`/dashboard?page=${card.page}`) : setSummaryModal(card.id)}
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
              padding: '18px 20px',
              boxShadow: 'var(--shadow)',
              position: 'relative',
              overflow: 'hidden',
              cursor: 'pointer',
              transition: 'transform 0.15s, box-shadow 0.15s'
            }}
            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = 'var(--shadow-md)'; }}
            onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = 'var(--shadow)'; }}
          >
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: card.color }} />
            <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', fontWeight: 500 }}>{card.label}</div>
            <div style={{ fontSize: 26, fontWeight: 600, letterSpacing: '-0.5px', margin: '6px 0 4px', fontFamily: "'DM Mono', monospace", color: card.valueColor }}>{card.value}</div>
            <div style={{ fontSize: '11.5px', color: card.deltaColor }}>{card.delta}</div>
          </div>
        ))}
      </div>

      {/* Lead Pipeline -- same buckets and cards as the Founder overview */}
      <div className="flex justify-between items-end mb-4 mt-8">
        <div>
          <div className="text-[15px] font-bold text-text-primary">Lead Pipeline</div>
          <div className="text-[12px] text-text-muted mt-0.5">Expected onboarding leads &amp; current pipeline status</div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-4 mb-8">
        {pipelineStats.map((st, i) => {
          let bgClass = 'bg-white';
          let borderClass = 'border-border';
          const bottomColor = PIPELINE_COLORS[st.label] || '#3b82f6';
          if (st.label === 'Converted') { bgClass = 'bg-[#f0fdf4]'; borderClass = 'border-[#bbf7d0]'; }
          if (st.label === 'Lost') { bgClass = 'bg-[#fef2f2]'; borderClass = 'border-[#fecaca]'; }
          const statusParam = groupParam(st.label);
          return (
            <div
              key={i}
              className={`rounded-xl border ${borderClass} ${bgClass} p-5 pb-0 flex flex-col items-center justify-center relative overflow-hidden shadow-sm cursor-pointer hover:shadow-md transition-shadow`}
              onClick={() => navigate(`/dashboard?page=leads&status=${statusParam}&${drilldownQuery}`)}
              title={`View all ${st.label} leads`}
            >
              <div className="text-[28px] font-bold font-mono mb-1" style={{ color: bottomColor }}>{st.count}</div>
              <div className="text-[12px] text-text-muted font-medium mb-5">{st.label}</div>
              <div className="w-[80%] h-1 rounded-t-md absolute bottom-0" style={{ backgroundColor: bottomColor }}></div>
            </div>
          );
        })}
      </div>

      {/* Lead temperature -- a separate axis from the status buckets above */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        {priorityStats.map((pr) => {
          const tone = pr.priority === 'hot'
            ? { text: 'text-[#dc2626]', bar: '#dc2626', bg: 'bg-[#fef2f2]', border: 'border-[#fecaca]' }
            : pr.priority === 'warm'
              ? { text: 'text-[#d97706]', bar: '#d97706', bg: 'bg-[#fffbeb]', border: 'border-[#fde68a]' }
              : { text: 'text-[#3b82f6]', bar: '#3b82f6', bg: 'bg-white', border: 'border-border' };
          return (
            <div
              key={pr.priority}
              className={`rounded-xl border ${tone.border} ${tone.bg} p-5 pb-0 flex flex-col items-center justify-center relative overflow-hidden shadow-sm cursor-pointer hover:shadow-md transition-shadow`}
              onClick={() => navigate(`/dashboard?page=leads&priority=${pr.priority}&${drilldownQuery}`)}
              title={`View all ${pr.label} leads`}
            >
              <div className={`text-[28px] font-bold font-mono mb-1 ${tone.text}`}>{pr.count}</div>
              <div className="text-[12px] text-text-muted font-medium mb-5">{pr.label} Leads</div>
              <div className="w-[80%] h-1 rounded-t-md absolute bottom-0" style={{ backgroundColor: tone.bar }}></div>
            </div>
          );
        })}
      </div>

      {/* Expected Onboarding Leads */}
      <div className="flex justify-between items-end mb-4 mt-8">
        <div>
          <div className="text-[15px] font-bold text-text-primary">Expected Onboarding Leads</div>
          <div className="text-[12px] text-text-muted mt-0.5">Hot &amp; Warm leads expected to convert · Requires allocation</div>
        </div>
        <div className="flex items-center gap-2">
          {expectedOnboardingList.length > 5 && (
            <Button size="sm" variant="outline" className="bg-white" onClick={() => navigate(`/dashboard?page=leads&priority=hot,warm&excludeStatuses=converted,lost,not_interested&${drilldownQuery}`)}>
              View All
            </Button>
          )}
          <Button size="sm" variant="outline" className="bg-white" onClick={() => openModal('bulk-allocate')}>Allocate Leads</Button>
        </div>
      </div>

      <div className="card overflow-hidden mb-8 border border-border bg-white rounded-xl shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface2/50 text-[10px] font-bold text-text-muted uppercase tracking-wider border-b border-border">
                <th className="p-4 font-bold">Lead Name</th>
                <th className="p-4 font-bold">District</th>
                <th className="p-4 font-bold">Assigned To</th>
                <th className="p-4 font-bold text-center">Status</th>
                <th className="p-4 font-bold">Expected Date</th>
                <th className="p-4 font-bold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {expectedOnboardingList.slice(0, 5).map((lead, idx) => (
                <tr key={idx} className="hover:bg-surface2/30 transition-colors">
                  <td className="p-4">
                    <div className="text-[13px] font-bold text-text-primary">{lead.name}</div>
                    <div className="text-[11px] text-text-muted mt-0.5">{lead.phone || 'No contact number'}</div>
                  </td>
                  <td className="p-4">
                    <span className="inline-flex items-center justify-center px-2 py-1 rounded-md bg-blue/10 text-blue text-[10px] font-bold uppercase tracking-wider">{lead.district || '—'}</span>
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
                      <Button size="xs" variant="outline" className="bg-white border-border shadow-sm text-text-primary" onClick={() => goToLead(lead._id)}>View</Button>
                      <Button size="xs" className="bg-[#0f766e] hover:bg-[#0d645e] text-white border-none shadow-sm" onClick={() => openModal({ type: 'allocate-lead', leadData: lead })}>Allocate</Button>
                      <Button size="xs" variant="outline" className="bg-white border-border shadow-sm text-text-primary" onClick={() => openModal({ type: 'update-lead', leadData: lead })}>Edit</Button>
                    </div>
                  </td>
                </tr>
              ))}
              {expectedOnboardingList.length === 0 && (
                <tr>
                  <td colSpan="6" className="p-8 text-center text-text-muted text-[13px]">No expected onboarding leads found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Performance by District Manager -- where the Founder lists State Managers */}
      <div className="flex justify-between items-end mb-4 mt-8">
        <div>
          <div className="text-[15px] font-bold text-text-primary">Performance by District Manager</div>
          <div className="text-[12px] text-text-muted mt-0.5">Click any row to drill into that District Manager</div>
        </div>
        <Button size="sm" variant="outline" className="bg-white" onClick={() => navigate('/dashboard?page=team')}>View All</Button>
      </div>

      <div className="card overflow-hidden mb-8 border border-border bg-white rounded-xl shadow-sm">
        <div className="divide-y divide-border">
          {team.map((exec, idx) => {
            const initials = getInitials(exec.name);
            const colors = ['bg-[#3b82f6]', 'bg-[#4f46e5]', 'bg-[#0f766e]', 'bg-[#ea580c]'];
            const avatarColor = colors[idx % colors.length];
            return (
              <div
                key={exec._id || idx}
                className="flex items-center justify-between p-4 hover:bg-surface2/30 transition-colors cursor-pointer group"
                onClick={() => setExecModal({ exec, type: 'calls' })}
              >
                <div className="flex items-center gap-4 min-w-[300px]">
                  <div className={`w-10 h-10 rounded-full text-white flex items-center justify-center font-bold text-sm ${avatarColor}`}>{initials}</div>
                  <div>
                    <div className="text-[13.5px] font-bold text-text-primary group-hover:text-blue transition-colors">{exec.name}</div>
                    <div className="text-[11px] text-text-muted mt-0.5 flex items-center gap-1">
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
                      {exec.district || 'No district'} · District Manager
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-6 flex-1">
                  <div className="text-center w-14">
                    <div className="text-[15px] font-bold text-blue font-mono">{exec.leadsCount ?? 0}</div>
                    <div className="text-[10px] text-text-muted uppercase tracking-wider">Leads</div>
                  </div>
                  <div className="text-center w-14">
                    <div className="text-[15px] font-bold text-[#16a34a] font-mono">{exec.converted ?? 0}</div>
                    <div className="text-[10px] text-text-muted uppercase tracking-wider">Conv.</div>
                  </div>
                  <div className="text-center w-20">
                    <div className="text-[15px] font-bold text-teal font-mono">{formatCurrency(exec.revenue || 0)}</div>
                    <div className="text-[10px] text-text-muted uppercase tracking-wider">Revenue</div>
                  </div>
                  <div className="flex flex-col items-center justify-center w-24 border-l border-border pl-4">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-1.5 bg-surface2 rounded-full overflow-hidden">
                        <div className="h-full bg-[#d97706]" style={{ width: `${exec.completionPct || 0}%` }}></div>
                      </div>
                      <div className="text-[13px] font-bold text-[#d97706]">{Math.round(exec.completionPct || 0)}%</div>
                    </div>
                    <div className="text-[10px] text-text-muted uppercase tracking-wider mt-0.5">Work %</div>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 ml-8 w-[180px]" onClick={(ev) => ev.stopPropagation()}>
                  <Button size="xs" className="bg-[#0f766e] hover:bg-[#0d645e] text-white border-none shadow-sm px-4" onClick={() => setExecModal({ exec, type: 'calls' })}>View</Button>
                  <Button size="xs" variant="outline" className="bg-white border-border shadow-sm text-text-primary px-3" onClick={() => openModal({ type: 'create-exec', editData: exec })}>Edit</Button>
                </div>
              </div>
            );
          })}
          {team.length === 0 && (
            <div className="p-8 text-center text-text-muted text-[13px]">No district managers in this team yet.</div>
          )}
        </div>
      </div>

      {/* Bottom Section: Events & Leaves */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Upcoming Events */}
        <div className="card lg:col-span-2 shadow-sm border-border/40">
          <div className="card-header border-none px-8 pt-8">
            <div>
              <h3 className="text-xl font-bold text-text-primary tracking-tight">Upcoming Events</h3>
              <p className="text-sm text-text-muted mt-1 font-medium">
                Meetings &amp; follow-ups scheduled for {scheduleDay === 'today' ? 'today' : 'tomorrow'}
              </p>
            </div>
            <div className="flex gap-2">
              {['today', 'tomorrow'].map(d => (
                <div
                  key={d}
                  onClick={() => setScheduleDay(d)}
                  className={`py-1.5 px-3 rounded-xl text-[11px] font-bold cursor-pointer capitalize transition-all ${scheduleDay === d ? 'bg-purple text-white' : 'bg-surface2 border border-border text-text-secondary hover:bg-surface3'}`}
                >
                  {d}
                </div>
              ))}
            </div>
          </div>
          <div className="card-body px-4 pt-4 pb-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {visibleEvents.slice(0, 6).map((ev, idx) => (
                <div key={idx} onClick={() => setEventModal(ev)} className="p-4 rounded-2xl bg-surface/40 border border-border/30 hover:border-purple/30 hover:bg-white hover:shadow-md transition-all cursor-pointer group flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl transition-all group-hover:scale-110 ${ev.type === 'meeting' ? 'bg-teal-light text-teal shadow-teal/10' : 'bg-blue-light text-blue shadow-blue/10'}`}>
                    {ev.type === 'meeting' ? (ev.status?.includes('virtual') ? '🎥' : '🤝') : '📞'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold text-text-primary group-hover:text-purple transition-colors truncate">
                      {ev.name}
                    </div>
                    <div className="text-[11px] text-text-muted font-medium mt-0.5">
                      {ev.ownerName} <span className="mx-1">→</span> {ev.company}
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      <div className="px-2 py-0.5 rounded-lg bg-surface2 text-[9px] font-bold text-text-muted uppercase tracking-wider group-hover:bg-purple/5 group-hover:text-purple">
                        {new Date(ev.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                      <Tag
                        variant={ev.type === 'meeting' ? 'teal' : 'blue'}
                        label={ev.type === 'meeting' ? (ev.status?.includes('virtual') ? 'virtual' : 'direct') : 'followup'}
                        className="text-[9px] py-0.5"
                      />
                    </div>
                  </div>
                </div>
              ))}
              {visibleEvents.length === 0 && (
                <div className="col-span-full py-16 text-center">
                  <div className="text-4xl mb-4">📅</div>
                  <div className="text-text-muted font-medium">
                    {scheduleDay === 'today'
                      ? 'No events scheduled for the rest of today.'
                      : 'No events scheduled for tomorrow.'}
                  </div>
                  {scheduleDay === 'today' && (
                    <button
                      onClick={() => setScheduleDay('tomorrow')}
                      className="mt-4 text-purple text-sm font-bold hover:underline"
                    >
                      View Tomorrow's Schedule →
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Leave Requests Quick Approval */}
        <div className="card shadow-sm border-border/40">
          <div className="card-header border-none px-8 pt-8">
            <div>
              <h3 className="text-xl font-bold text-text-primary tracking-tight">Leave Approvals</h3>
              <p className="text-sm text-text-muted mt-1 font-medium">Pending requests</p>
            </div>
            {leaves.length > 0 && <div className="w-6 h-6 rounded-full bg-red text-white flex items-center justify-center text-[10px] font-bold shadow-lg shadow-red/20">{leaves.length}</div>}
          </div>
          <div className="card-body p-4 pt-0">
            <div className="space-y-3">
              {leaves.slice(0, 3).map((leave, idx) => (
                <div key={idx} className="p-4 rounded-2xl bg-surface/40 border border-border/30 hover:border-purple/20 transition-all">
                  <div className="flex items-center gap-3 mb-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xs font-bold text-white av-${idx % 5}`}>
                      {getInitials(leave.user?.name)}
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-bold text-text-primary">{leave.user?.name}</div>
                      <div className="text-[10px] text-text-muted font-semibold uppercase tracking-wider">
                        {leave.type.replace('_', ' ')} · {leave.days} Day{leave.days > 1 ? 's' : ''}
                      </div>
                    </div>
                  </div>
                  <p className="text-xs text-text-secondary leading-relaxed bg-surface2/50 p-2.5 rounded-xl border border-border/20 mb-4 line-clamp-2 italic">
                    "{leave.reason}"
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => approveMutation.mutate(leave._id)}
                      className="py-2.5 rounded-xl text-xs font-bold bg-green text-white hover:bg-green-dark transition-all shadow-md shadow-green/10"
                    >Approve</button>
                    <button
                      onClick={() => rejectMutation.mutate(leave._id)}
                      className="py-2.5 rounded-xl text-xs font-bold bg-white border border-red/20 text-red hover:bg-red-light transition-all"
                    >Reject</button>
                  </div>
                </div>
              ))}
              {leaves.length === 0 && (
                <div className="py-12 text-center">
                  <div className="text-3xl mb-3">✅</div>
                  <div className="text-text-muted text-sm font-medium">All leave requests processed.</div>
                </div>
              )}
              {leaves.length > 0 && (
                <button
                  className="w-full py-3 rounded-xl text-xs font-bold text-purple bg-purple-light hover:bg-purple hover:text-white transition-all"
                  onClick={() => navigate('/dashboard?page=approvals')}
                >
                  View All Requests
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Lead Owner Mapping */}
      <div className="card shadow-sm border-border/40">
        <div className="card-header border-none px-8 pt-6 pb-4">
          <div>
            <h3 className="text-base font-bold text-text-primary tracking-tight">Lead Owner Mapping · {userInfo.industry} District Managers</h3>
            <p className="text-xs text-text-muted mt-0.5 font-medium">Map &amp; reassign leads · One-by-one delivery to executive</p>
          </div>
          <button
            className="px-4 py-2 rounded-xl bg-purple text-white text-xs font-bold hover:opacity-90 transition-all shadow-lg shadow-purple/20"
            onClick={() => navigate('/dashboard?page=leads')}
          >
            Manage Mapping
          </button>
        </div>
        <div className="overflow-x-auto">
          {recentLeads.length === 0 ? (
            <div className="px-8 py-10 text-center text-text-muted text-sm">No leads to display.</div>
          ) : (
            <table className="w-full border-collapse text-[13px]">
              <thead>
                <tr className="bg-surface2/60 border-b border-border">
                  <th className="text-left px-6 py-3 text-[10px] font-bold uppercase tracking-wider text-text-muted">Name</th>
                  <th className="text-left px-6 py-3 text-[10px] font-bold uppercase tracking-wider text-text-muted">Assigned To</th>
                  <th className="text-left px-6 py-3 text-[10px] font-bold uppercase tracking-wider text-text-muted">District</th>
                  <th className="text-left px-6 py-3 text-[10px] font-bold uppercase tracking-wider text-text-muted">Status</th>
                  <th className="px-6 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {recentLeads.slice(0, 8).map((lead, idx) => (
                  <tr
                    key={lead._id || idx}
                    className="border-b border-border/40 hover:bg-surface2/30 transition-colors cursor-pointer group"
                    onClick={() => lead._id && navigate(`/leads/${lead._id}`)}
                  >
                    <td className="px-6 py-3 font-semibold text-text-primary group-hover:text-purple transition-colors">
                      {lead.name || lead.company || '—'}
                    </td>
                    <td className="px-6 py-3">
                      {lead.owner && lead.owner !== 'Unassigned' ? (
                        <span className="inline-flex items-center gap-1.5">
                          <span className="w-6 h-6 rounded-full bg-purple/10 text-purple text-[9px] font-bold flex items-center justify-center">
                            {lead.owner.charAt(0)}
                          </span>
                          <span className="text-text-secondary text-[12px]">{lead.owner}</span>
                        </span>
                      ) : (
                        <span className="text-text-muted text-[12px] italic">Unassigned</span>
                      )}
                    </td>
                    <td className="px-6 py-3 text-text-secondary">{lead.district || '—'}</td>
                    <td className="px-6 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-tight
                        ${lead.status === 'converted' ? 'bg-green/10 text-green' :
                          lead.status === 'hot' ? 'bg-red/10 text-red' :
                          lead.status === 'rnr' ? 'bg-surface2 text-text-muted' :
                          'bg-amber-light text-amber'}`}>
                        {lead.status || 'fresh'}
                      </span>
                    </td>
                    <td className="px-6 py-3" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        className="text-[11px] font-bold text-purple hover:underline"
                        onClick={() => { setReassignModal(lead); setReassignExecId(''); }}
                      >
                        Reassign
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {recentLeads.length > 8 && (
            <div className="px-8 py-4 border-t border-border/40">
              <button
                className="text-xs font-bold text-purple hover:underline"
                onClick={() => navigate('/dashboard?page=leads')}
              >
                View all {recentLeads.length} leads →
              </button>
            </div>
          )}
        </div>
      </div>
      {/* Summary Card Drill-down Modal */}
      {summaryModal && (() => {
        const drilldown = summaryDrilldowns || {};
        const revenueLeads = drilldown.revenue?.leads || [];
        const totalLeads = drilldown.totalLeads?.leads || [];
        const convertedLeads = drilldown.converted?.leads || [];
        const callRows = drilldown.calls?.rows || [];
        const meetingLeads = drilldown.meetings?.leads || [];
        const hotLeads = drilldown.hot?.leads || [];

        const CONFIG = {
          revenue: {
            title: 'Revenue — Converted Leads',
            subtitle: `${formatCurrency(periodStats.revenue || 0)} · ${revenueLeads.length} conversions`,
            color: 'var(--accent)',
            value: formatCurrency(periodStats.revenue || 0),
            leads: revenueLeads,
            emptyMsg: 'No converted leads found.',
            navTarget: `/dashboard?page=leads&status=converted&${drilldownQuery}`,
          },
          'total-leads': {
            title: 'Total Leads',
            subtitle: `${totalLeads.length} leads in this ${periodLabel.toLowerCase()}`,
            color: '#D97706',
            value: totalLeads.length,
            leads: totalLeads,
            emptyMsg: 'No leads found.',
            navTarget: `/dashboard?page=leads&${drilldownQuery}`,
          },
          converted: {
            title: 'Conversions',
            subtitle: `${convertedLeads.length} conversions`,
            color: 'var(--teal)',
            value: convertedLeads.length,
            leads: convertedLeads,
            emptyMsg: 'No converted leads found.',
            navTarget: `/dashboard?page=leads&status=converted&${drilldownQuery}`,
          },
          calls: {
            title: 'Calls This Week',
            subtitle: `${callRows.length} calls made`,
            color: 'var(--blue)',
            value: callRows.length,
            callRows,
            emptyMsg: 'No calls found for this week.',
            navTarget: '/dashboard?page=calls&period=week',
          },
          meetings: {
            title: 'Meetings',
            subtitle: `${meetingLeads.length} leads currently in meeting stage`,
            color: 'var(--teal)',
            value: meetingLeads.length,
            leads: meetingLeads,
            emptyMsg: 'No leads currently in meeting stage.',
            navTarget: '/dashboard?page=leads&status=meeting',
          },
          hot: {
            title: 'Hot Leads',
            subtitle: `${hotLeads.length} leads needing immediate attention`,
            color: 'var(--red)',
            value: hotLeads.length,
            leads: hotLeads,
            emptyMsg: 'No hot leads right now.',
            navTarget: `/dashboard?page=leads&priority=hot&excludeStatuses=converted,lost&${drilldownQuery}`,
          },
        };

        const cfg = CONFIG[summaryModal];
        if (!cfg) return null;

        return (
          <Modal
            isOpen
            title={cfg.title}
            subtitle={cfg.subtitle}
            onClose={() => setSummaryModal(null)}
            className="max-w-lg"
          >
            {/* Stat highlight */}
            <div
              className="rounded-xl p-4 mb-5 flex items-center gap-4"
              style={{ background: `${cfg.color}12`, border: `1px solid ${cfg.color}30` }}
            >
              <div className="text-4xl font-black tabular-nums" style={{ color: cfg.color }}>
                {cfg.value}
              </div>
              <div>
                <div className="text-sm font-bold text-text-primary">{cfg.title}</div>
                <div className="text-xs text-text-muted mt-0.5">{cfg.subtitle}</div>
              </div>
            </div>

            {/* Lead list or stat-only */}
            {cfg.loading ? (
              <div className="py-10 text-center text-text-muted text-sm">Loading leads…</div>
            ) : cfg.callRows ? (
              cfg.callRows.length === 0 ? (
                <div className="py-8 text-center">
                  <div className="text-3xl mb-3">📞</div>
                  <p className="text-sm text-text-muted">{cfg.emptyMsg}</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1 -mr-2">
                  {cfg.callRows.map((row, i) => {
                    const lead = row.lead;
                    return (
                      <div
                        key={row._id || lead?._id || i}
                        role="button"
                        tabIndex={0}
                        onClick={() => goToLead(lead?._id)}
                        onKeyDown={(e) => { if (e.key === 'Enter') goToLead(lead?._id); }}
                        className="flex items-center gap-3 p-3 rounded-xl bg-surface2 border border-border/40 hover:border-purple/40 hover:bg-purple-light/10 transition-colors cursor-pointer"
                      >
                        <div
                          className="w-7 h-7 rounded-lg flex items-center justify-center text-[11px] font-black text-white shrink-0"
                          style={{ background: cfg.color }}
                        >
                          {i + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-bold text-text-primary truncate">
                            {lead?.company || lead?.name || 'Unknown Lead'}
                          </div>
                          <div className="text-[11px] text-text-muted truncate">
                            {row.performedBy?.name || '—'} · {lead?.district || '—'} · {row.note || 'Call logged'}
                          </div>
                        </div>
                        <span
                          className="text-[9px] font-bold uppercase tracking-tight px-2 py-0.5 rounded-md shrink-0"
                          style={{ background: `${cfg.color}15`, color: cfg.color }}
                        >
                          called
                        </span>
                      </div>
                    );
                  })}
                </div>
              )
            ) : cfg.leads.length === 0 ? (
              <div className="py-8 text-center">
                <div className="text-3xl mb-3">📋</div>
                <p className="text-sm text-text-muted">{cfg.emptyMsg}</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1 -mr-2">
                {cfg.leads.map((lead, i) => (
                  <div
                    key={lead._id || i}
                    role="button"
                    tabIndex={0}
                    onClick={() => goToLead(lead._id)}
                    onKeyDown={(e) => { if (e.key === 'Enter') goToLead(lead._id); }}
                    className="flex items-center gap-3 p-3 rounded-xl bg-surface2 border border-border/40 hover:border-purple/40 hover:bg-purple-light/10 transition-colors cursor-pointer"
                  >
                    <div
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-[11px] font-black text-white shrink-0"
                      style={{ background: cfg.color }}
                    >
                      {i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-bold text-text-primary truncate">
                        {lead.name || lead.company || 'Unnamed Lead'}
                      </div>
                      <div className="text-[11px] text-text-muted truncate">
                        {lead.district || '—'} · {lead.company || 'No company'} · {lead.owner?.name || (typeof lead.owner === 'string' ? lead.owner : 'Unassigned')}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span
                        className="text-[9px] font-bold uppercase tracking-tight px-2 py-0.5 rounded-md"
                        style={{ background: `${cfg.color}15`, color: cfg.color }}
                      >
                        {lead.status?.replace(/_/g, ' ') || 'new'}
                      </span>
                      {lead.priority && (
                        <span className="text-[9px] font-bold text-text-muted uppercase">
                          {lead.priority}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-6 pt-4 border-t border-border/50 flex justify-end">
              <button
                onClick={() => { setSummaryModal(null); navigate(cfg.navTarget); }}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white transition-all hover:opacity-90 active:scale-95"
                style={{ background: cfg.color }}
              >
                View Full Details →
              </button>
            </div>
          </Modal>
        );
      })()}

      {/* Lead Reassign Modal */}
      {reassignModal && (
        <Modal
          isOpen
          title="Reassign Lead"
          subtitle="Assign to an executive in your team"
          onClose={() => { setReassignModal(null); setReassignExecId(''); }}
          className="max-w-sm"
        >
          {/* Lead info */}
          <div className="p-3 bg-surface2/60 rounded-xl border border-border/40 mb-5">
            <div className="text-sm font-bold text-text-primary">{reassignModal.company || reassignModal.name}</div>
            <div className="flex items-center gap-3 mt-1.5">
              <span className="text-[11px] text-text-muted">{reassignModal.district || '—'}</span>
              {reassignModal.owner && reassignModal.owner !== 'Unassigned' && (
                <>
                  <span className="text-text-muted opacity-30">·</span>
                  <span className="text-[11px] text-text-muted">Currently: <span className="font-bold text-text-primary">{reassignModal.owner}</span></span>
                </>
              )}
              <span className={`ml-auto px-2 py-0.5 rounded text-[9px] font-bold uppercase
                ${reassignModal.status === 'CONVERTED' ? 'bg-green/10 text-green' :
                  reassignModal.priority === 'hot' ? 'bg-red/10 text-red' :
                  'bg-amber-light text-amber'}`}>
                {reassignModal.status?.toLowerCase() || 'fresh'}
              </span>
            </div>
          </div>

          {/* District Manager dropdown — only this IM's team */}
          <div className="space-y-2 mb-6">
            <label className="block text-xs font-bold text-text-secondary">
              Assign To <span className="text-red">*</span>
            </label>
            <select
              className="select w-full"
              value={reassignExecId}
              onChange={e => setReassignExecId(e.target.value)}
            >
              <option value="">
                — Choose from your district managers —
              </option>
              {team.map(ex => (
                <option key={ex._id} value={ex._id}>
                  {ex.name}{ex.district ? ` · ${ex.district}` : ''}
                </option>
              ))}
            </select>
            {team.length === 0 && (
              <p className="text-[11px] text-amber font-medium">No district managers are assigned under this industry manager.</p>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-border/40">
            <button
              className="px-4 py-2 rounded-xl text-xs font-bold border border-border text-text-secondary hover:bg-surface2 transition-all"
              onClick={() => { setReassignModal(null); setReassignExecId(''); }}
            >
              Cancel
            </button>
            <button
              className="px-5 py-2 rounded-xl text-xs font-bold bg-purple text-white hover:opacity-90 transition-all disabled:opacity-40"
              disabled={!reassignExecId || reassignMutation.isPending}
              onClick={() => reassignMutation.mutate({ leadId: reassignModal._id, execId: reassignExecId })}
            >
              {reassignMutation.isPending ? 'Reassigning…' : 'Reassign Lead'}
            </button>
          </div>
        </Modal>
      )}

      {/* Event Detail Modal */}
      {eventModal && (
        <Modal
          isOpen
          title={eventModal.name}
          subtitle={`${eventModal.company} · ${eventModal.ownerName || '—'}`}
          onClose={() => setEventModal(null)}
          className="max-w-lg"
        >
          {/* Time + type banner */}
          <div className={`rounded-xl p-4 mb-5 flex items-center gap-4 ${eventModal.type === 'meeting' ? 'bg-teal/8 border border-teal/20' : 'bg-blue/8 border border-blue/20'}`}>
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shrink-0 ${eventModal.type === 'meeting' ? 'bg-teal-light' : 'bg-blue-light'}`}>
              {eventModal.type === 'meeting' ? (eventModal.status?.includes('virtual') ? '🎥' : '🤝') : '📞'}
            </div>
            <div>
              <div className={`text-base font-black ${eventModal.type === 'meeting' ? 'text-teal' : 'text-blue'}`}>
                {new Date(eventModal.time).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              </div>
              <div className="text-sm font-bold text-text-muted mt-0.5">
                {new Date(eventModal.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                <span className={`ml-3 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase ${eventModal.type === 'meeting' ? 'bg-teal/10 text-teal' : 'bg-blue/10 text-blue'}`}>
                  {eventModal.type === 'meeting' ? (eventModal.status?.includes('virtual') ? 'Virtual Meeting' : 'Direct Meeting') : 'Follow-up'}
                </span>
              </div>
            </div>
          </div>

          {/* Lead / Customer info grid */}
          <div className="grid grid-cols-2 gap-3 mb-5">
            {[
              { label: 'Name',      value: eventModal.contactName || eventModal.name || '—' },
              { label: 'Phone',     value: eventModal.phone || '—' },
              { label: 'District',  value: eventModal.district || '—' },
              { label: 'Owner',     value: eventModal.ownerName || '—' },
              { label: 'Priority',  value: eventModal.priority?.toUpperCase() || '—', colored: true },
            ].map(f => (
              <div key={f.label} className="p-3 rounded-xl bg-surface2 border border-border/40">
                <div className="text-[9px] font-bold text-text-muted uppercase tracking-wider mb-1">{f.label}</div>
                <div className={`text-sm font-bold ${f.colored && eventModal.priority === 'hot' ? 'text-red' : f.colored && eventModal.priority === 'warm' ? 'text-amber' : 'text-text-primary'}`}>
                  {f.value}
                </div>
              </div>
            ))}
          </div>

          {/* Notes */}
          {eventModal.notes && (
            <div className="mb-5 p-3 bg-surface2/60 rounded-xl border border-border/40">
              <div className="text-[9px] font-bold text-text-muted uppercase tracking-wider mb-1">Notes</div>
              <p className="text-sm text-text-secondary leading-relaxed">{eventModal.notes}</p>
            </div>
          )}

          {/* Activity history */}
          <div>
            <div className="text-[10px] font-bold text-text-muted uppercase tracking-wider mb-3">Recent Activity</div>
            {eventActivityLoading ? (
              <div className="py-6 text-center text-sm text-text-muted">Loading history…</div>
            ) : eventActivity.length === 0 ? (
              <div className="py-6 text-center text-sm text-text-muted italic">No activity recorded yet.</div>
            ) : (
              <div className="relative pl-4 max-h-[220px] overflow-y-auto pr-1 -mr-2">
                <div className="absolute left-1.5 top-1 bottom-1 w-px bg-border/60" />
                {eventActivity.slice(0, 8).map((a, i) => (
                  <div key={i} className="relative mb-3.5">
                    <div className={`absolute -left-[13px] top-1 w-2.5 h-2.5 rounded-full border-2 border-white ${i === 0 ? 'bg-purple' : 'bg-border2'}`} />
                    <div className="flex items-center justify-between gap-2 mb-0.5">
                      <div className="text-[10px] font-bold text-text-primary">
                        {new Date(a.createdAt || a.timestamp).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </div>
                      {a.performedBy?.name && (
                        <span className="text-[9px] font-bold text-purple bg-purple/5 px-1.5 py-0.5 rounded-md">
                          {a.performedBy.name}
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] font-semibold text-text-secondary">{a.action?.replace(/_/g, ' ')}</div>
                    {a.note && (
                      <div className="text-[11px] text-text-muted mt-0.5 leading-relaxed bg-surface2 rounded-lg px-2.5 py-1.5 border border-border/40">
                        {a.note}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* District Manager Detail Modal */}
      {execModal && (() => {
        const { exec, type } = execModal;
        const execModalRows = exec.drilldowns?.[type] || [];

        const EXEC_MODAL_CONFIG = {
          calls: {
            title: `Calls — ${exec.name}`,
            subtitle: `${exec.calls} calls this month · ${execModalRows.length} call records`,
            color: 'var(--blue)',
            emptyMsg: 'No call records found for this executive.',
            navTarget: `/dashboard?page=calls&userId=${encodeURIComponent(exec._id)}&executive=${encodeURIComponent(exec.name)}&period=month`,
          },
          converted: {
            title: `Converted — ${exec.name}`,
            subtitle: `${execModalRows.length} converted leads`,
            color: 'var(--teal)',
            emptyMsg: 'No converted leads found for this executive.',
            navTarget: `/dashboard?page=leads&owner=${encodeURIComponent(exec._id)}&status=converted&period=month`,
          },
          hot: {
            title: `Hot Leads — ${exec.name}`,
            subtitle: `${execModalRows.length} active hot leads`,
            color: 'var(--red)',
            emptyMsg: 'No active hot leads for this executive.',
            navTarget: `/dashboard?page=leads&owner=${encodeURIComponent(exec._id)}&priority=hot&excludeStatuses=converted,lost`,
          },
        };

        const cfg = EXEC_MODAL_CONFIG[type];
        if (!cfg) return null;

        return (
          <Modal
            isOpen
            title={cfg.title}
            subtitle={cfg.subtitle}
            onClose={() => setExecModal(null)}
            className="max-w-lg"
          >
            {/* Stat highlight */}
            <div
              className="rounded-xl p-4 mb-5 flex items-center gap-4"
              style={{ background: `${cfg.color}12`, border: `1px solid ${cfg.color}30` }}
            >
              <div className="text-4xl font-black tabular-nums" style={{ color: cfg.color }}>
                {execModalRows.length}
              </div>
              <div>
                <div className="text-sm font-bold text-text-primary">{exec.name}</div>
                <div className="text-xs text-text-muted mt-0.5">{exec.district} · {cfg.subtitle}</div>
              </div>
            </div>

            {/* Lead list */}
            {execModalRows.length === 0 ? (
              <div className="py-8 text-center">
                <div className="text-3xl mb-3">📋</div>
                <p className="text-sm text-text-muted">{cfg.emptyMsg}</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[340px] overflow-y-auto pr-1 -mr-2">
                {execModalRows.map((row, i) => {
                  const lead = type === 'calls' ? row.lead : row;
                  return (
                  <div
                    key={row._id || lead?._id || i}
                    role="button"
                    tabIndex={0}
                    onClick={() => goToLead(lead?._id)}
                    onKeyDown={(e) => { if (e.key === 'Enter') goToLead(lead?._id); }}
                    className="flex items-center gap-3 p-3 rounded-xl bg-surface2 border border-border/40 hover:border-purple/40 hover:bg-purple-light/10 transition-colors cursor-pointer"
                  >
                    <div
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-[11px] font-black text-white shrink-0"
                      style={{ background: cfg.color }}
                    >
                      {i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-bold text-text-primary truncate">
                        {lead?.company || lead?.name || 'Unknown Lead'}
                      </div>
                      <div className="text-[11px] text-text-muted truncate">
                        {type === 'calls'
                          ? `${lead?.district || '—'} · ${row.note || 'Call logged'}`
                          : `${lead?.district || '—'} · ${lead?.name || '—'}`}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span
                        className="text-[9px] font-bold uppercase tracking-tight px-2 py-0.5 rounded-md"
                        style={{ background: `${cfg.color}15`, color: cfg.color }}
                      >
                        {type === 'calls' ? 'called' : (lead?.status?.replace(/_/g, ' ') || 'new')}
                      </span>
                      {lead?.priority && (
                        <span className="text-[9px] font-bold text-text-muted uppercase">
                          {lead.priority}
                        </span>
                      )}
                    </div>
                  </div>
                )})}
              </div>
            )}

            <div className="mt-6 pt-4 border-t border-border/50 flex justify-end">
              <button
                onClick={() => { setExecModal(null); navigate(cfg.navTarget); }}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white transition-all hover:opacity-90 active:scale-95"
                style={{ background: cfg.color }}
              >
                View Full Details →
              </button>
            </div>
          </Modal>
        );
      })()}
    </div>
  );
};

export default Overview;
