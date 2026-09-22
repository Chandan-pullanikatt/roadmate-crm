import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import api from '../api/axios';
import { leadsApi } from '../api/leadsApi';
import { LEAD_STATUS_GROUPS, GROUP_ORDER, groupParam } from '../constants/leadStatusGroups';

// Pipeline card colours, keyed by the canonical group label (same as the Founder Overview).
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

const PERIOD_TABS = ['today', 'week', 'month', 'quarter', 'year'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const defaultPeriodValue = (tab) => {
  const now = new Date();
  if (tab === 'week') return `Week ${Math.min(Math.ceil(now.getDate() / 7), 5)}`;
  if (tab === 'month') return MONTHS[now.getMonth()];
  if (tab === 'quarter') return `Q${Math.floor(now.getMonth() / 3) + 1}`;
  if (tab === 'year') return String(now.getFullYear());
  return '';
};

const periodOptions = (tab) => {
  if (tab === 'week') return ['Week 1', 'Week 2', 'Week 3', 'Week 4', 'Week 5'];
  if (tab === 'month') return MONTHS;
  if (tab === 'quarter') return ['Q1', 'Q2', 'Q3', 'Q4'];
  if (tab === 'year') {
    const year = new Date().getFullYear();
    return Array.from({ length: 5 }, (_, i) => String(year - i));
  }
  return [];
};

const periodLabel = (period, value) => (period === 'today' ? 'today' : `in ${value}`);

// Period state (today / week / month / quarter / year + which one), starting on `initial`.
export const usePeriod = (initial) => {
  const [period, setPeriodTab] = useState(initial);
  const [value, setValue] = useState(() => defaultPeriodValue(initial));
  const setPeriod = (t) => { setPeriodTab(t); setValue(defaultPeriodValue(t)); };
  return { period, value, setPeriod, setValue };
};

export const PeriodPicker = ({ period, value, setPeriod, setValue }) => (
  <div className="flex flex-wrap items-center gap-2">
    <div className="flex bg-surface2 p-1 rounded-xl border border-border">
      {PERIOD_TABS.map(t => (
        <button
          key={t}
          onClick={() => setPeriod(t)}
          className={`px-3 py-1.5 text-[12px] font-bold uppercase tracking-widest rounded-lg transition-all ${period === t ? 'bg-surface text-purple shadow-sm' : 'text-text-muted hover:text-text-secondary'}`}
        >
          {t}
        </button>
      ))}
    </div>
    {period !== 'today' && (
      <select
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="bg-white border border-border rounded-xl px-3 py-1.5 text-[14px] font-bold text-text-secondary outline-none focus:border-blue shadow-sm"
      >
        {periodOptions(period).map(opt => (
          <option key={opt} value={opt}>{opt}</option>
        ))}
      </select>
    )}
  </div>
);

/**
 * Lead pipeline for one person's own leads (not their team's), filterable by
 * period. Each card opens the lead list filtered to that status, owner and period.
 */
const LeadPipelinePanel = ({ ownerId, ownerName, className = '' }) => {
  const navigate = useNavigate();
  const picker = usePeriod('week');
  const { period, value } = picker;

  const { data: counts } = useQuery({
    queryKey: ['leads', 'counts', ownerId, period, value],
    queryFn: () => leadsApi.getCounts({
      owner: ownerId,
      period,
      value: value || undefined
    }).then(res => res.data),
    enabled: !!ownerId,
    placeholderData: keepPreviousData
  });

  const stats = [
    { label: 'All', count: counts?.total || 0 },
    ...GROUP_ORDER.map(label => ({
      label,
      count: LEAD_STATUS_GROUPS[label].reduce((sum, st) => sum + (counts?.[st] || 0), 0)
    }))
  ];

  const openList = (label) => {
    const params = new URLSearchParams({
      page: 'leads',
      status: label === 'All' ? 'all' : groupParam(label),
      owner: ownerId,
      ownerName: ownerName || '',
      period,
      ...(value ? { value } : {})
    });
    navigate(`/dashboard?${params.toString()}`);
  };

  return (
    <div className={`bg-white rounded-2xl border border-border p-6 shadow-sm ${className}`}>
      <div className="flex flex-wrap justify-between items-center gap-3 mb-5">
        <div>
          <h3 className="text-[16px] font-bold text-text-primary">Lead Pipeline</h3>
          <div className="text-[14px] text-text-muted mt-0.5">{ownerName}'s own leads, created in the selected period</div>
        </div>
        <PeriodPicker {...picker} />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
        {stats.map(s => {
          const color = PIPELINE_COLORS[s.label] || '#3b82f6';
          const tint = s.label === 'Converted'
            ? 'bg-[#f0fdf4] border-[#bbf7d0]'
            : s.label === 'Lost' ? 'bg-[#fef2f2] border-[#fecaca]' : 'bg-white border-border';
          return (
            <div
              key={s.label}
              className={`rounded-xl border ${tint} p-4 pb-0 flex flex-col items-center justify-center relative overflow-hidden shadow-sm cursor-pointer hover:shadow-md transition-shadow`}
              onClick={() => openList(s.label)}
              title={`View ${ownerName}'s ${s.label} leads`}
            >
              <div className="text-[24px] font-bold font-mono mb-1" style={{ color }}>{s.count}</div>
              <div className="text-[13px] text-text-muted font-medium mb-4 text-center">{s.label}</div>
              <div className="w-[80%] h-1 rounded-t-md absolute bottom-0" style={{ backgroundColor: color }}></div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// Every lead action in the period, as a share of all of them.
const BREAKDOWN_ROWS = [
  { key: 'calls', label: 'Calls', color: 'bg-blue' },
  { key: 'rnr', label: 'RNR', color: 'bg-text-muted' },
  { key: 'followups', label: 'Follow-ups', color: 'bg-purple' },
  { key: 'meetingsVirtual', label: 'Virtual Meetings', color: 'bg-teal' },
  { key: 'meetingsDirect', label: 'Direct Meetings', color: 'bg-teal-700' },
  { key: 'blocking', label: 'Blocking Amount Received', color: 'bg-amber' },
  { key: 'fullAmount', label: 'Full Amount Received', color: 'bg-cyan-600' },
  { key: 'conversions', label: 'Converted', color: 'bg-green' },
  { key: 'lost', label: 'Lost', color: 'bg-red' },
  { key: 'escalated', label: 'Escalated', color: 'bg-orange-600' },
];

/** Lead actions one user performed, filterable by period. */
export const LeadMetricsBreakdown = ({ userId }) => {
  const picker = usePeriod('month');
  const { period, value } = picker;

  const { data: counts = {} } = useQuery({
    queryKey: ['stats', 'user-actions', userId, period, value],
    queryFn: () => api.get(`/stats/user/${userId}/actions`, {
      params: { period, value: value || undefined }
    }).then(res => res.data),
    enabled: !!userId,
    placeholderData: keepPreviousData
  });

  const total = BREAKDOWN_ROWS.reduce((sum, r) => sum + (counts[r.key] || 0), 0);

  return (
    <div className="bg-white rounded-2xl border border-border p-6 shadow-sm">
      <div className="flex flex-wrap justify-between items-start gap-3 mb-6">
        <div>
          <h3 className="text-[18px] font-bold mb-1 flex items-center gap-2">
            <span className="text-teal">📊</span> Lead Metrics Breakdown
          </h3>
          <div className="text-[14px] text-text-muted">Lead actions {periodLabel(period, value)} · {total} in total</div>
        </div>
        <PeriodPicker {...picker} />
      </div>
      <div className="space-y-5">
        {BREAKDOWN_ROWS.map(r => {
          const count = counts[r.key] || 0;
          const pct = total > 0 ? Math.round((count / total) * 100) : 0;
          return (
            <div key={r.key}>
              <div className="flex justify-between items-center mb-2">
                <span className="text-[13px] font-bold text-text-primary">{r.label}</span>
                <span className="text-[14px] font-black text-text-muted">{count} ({pct}%)</span>
              </div>
              <div className="w-full h-2 bg-surface2 rounded-full overflow-hidden border border-border/50">
                <div className={`h-full ${r.color} transition-all duration-1000`} style={{ width: `${pct}%` }}></div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default LeadPipelinePanel;
