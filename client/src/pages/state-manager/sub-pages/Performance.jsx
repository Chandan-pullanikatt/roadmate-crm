import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import DashboardSkeleton from '../../../components/skeletons/DashboardSkeleton';
import { dashboardApi } from '../../../api/dashboardApi';
import { Button, Tag } from '../../../components/ui';
import ManagerPerformanceTable from '../../../components/ManagerPerformanceTable';
import { roleLabel } from '../../../utils/roleLabel';

/** Time filter, the same tabs and (period, value) pair the State Manager Overview sends. */
const PERIOD_TABS = ['today', 'week', 'month', 'quarter', 'year'];

const defaultPeriodValue = (tab) => {
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

const periodOptions = (tab) => {
  if (tab === 'week') return ['Week 1', 'Week 2', 'Week 3', 'Week 4', 'Week 5'];
  if (tab === 'month') return ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  if (tab === 'quarter') return ['Q1', 'Q2', 'Q3', 'Q4'];
  if (tab === 'year') {
    const yr = new Date().getFullYear();
    return Array.from({ length: 5 }, (_, i) => String(yr - i));
  }
  return [];
};

/**
 * Whose numbers the leaderboard reports.
 *
 * A team row is an Industry Manager rolled up with the district managers under
 * them (the server's `rollupMetrics`); a personal row is one person's own work,
 * for industry managers and district managers alike. The same manager therefore
 * appears twice under "All" — the sub-label under the name says which line is
 * which, so the two are never read as a double count.
 */
const SCOPE_TABS = [
  { key: 'teams',    label: 'Teams',    hint: 'each industry manager rolled up with their district managers' },
  { key: 'personal', label: 'Personal', hint: 'every manager’s own work, counted on its own' },
  { key: 'all',      label: 'All',      hint: 'team rollups and personal lines together' }
];

const Performance = () => {
  const navigate = useNavigate();

  const [periodTab, setPeriodTab] = useState('month');
  const [periodValue, setPeriodValue] = useState(() => defaultPeriodValue('month'));
  const [scope, setScope] = useState('teams');

  const changePeriodTab = (tab) => {
    setPeriodTab(tab);
    setPeriodValue(defaultPeriodValue(tab));
  };

  // staleTime 0 so switching period always refetches instead of serving the
  // previous window's cached numbers.
  const { data: dashData, isLoading } = useQuery({
    queryKey: ['dashboard', 'state-manager', 'performance', periodTab, periodValue],
    queryFn: () => dashboardApi.getStateManagerDashboard({ period: periodTab, value: periodValue }).then(res => res.data),
    staleTime: 0,
    placeholderData: keepPreviousData
  });

  const user = dashData?.user || {};

  // Row ids have to stay unique under "All", where a manager contributes both a
  // team line and a personal one, so the real user id travels as `userId`.
  const rows = useMemo(() => {
    const managers = dashData?.industryManagers || [];
    const executives = dashData?.executivePerformance || [];

    const teamRows = managers.map(m => ({
      ...m,
      _id: `${m._id}:team`,
      userId: m._id,
      subLabel: `Team · ${roleLabel('industry_manager')} + ${m.teamSize || 0} ${roleLabel('executive')}${(m.teamSize || 0) === 1 ? '' : 's'}`
    }));

    const personalRows = [
      ...managers.map(m => ({
        ...(m.own || {}),
        _id: `${m._id}:self`,
        userId: m._id,
        name: m.name,
        state: m.state,
        industry: m.industry,
        efficiency: m.own?.workPct || 0,
        subLabel: `${roleLabel('industry_manager')} · own work`
      })),
      ...executives.map(e => ({
        ...e,
        _id: `${e._id}:self`,
        userId: e._id,
        efficiency: e.workPct || 0,
        subLabel: `${roleLabel('executive')}${e.district ? ` · ${e.district}` : ''}`
      }))
    ];

    if (scope === 'teams') return teamRows;
    if (scope === 'personal') return personalRows;
    return [...teamRows, ...personalRows];
  }, [dashData, scope]);

  // The headline cards read the rows on screen, so they always describe the same
  // people, the same scope and the same window as the table below them.
  const leader = (field) => [...rows].sort((a, b) => (b[field] || 0) - (a[field] || 0))[0];
  const topRevenue = leader('revenue');
  const topCalls = leader('calls');
  const topConv = leader('converted');
  const topEfficiency = leader('efficiency');

  const scopeHint = SCOPE_TABS.find(t => t.key === scope)?.hint;
  const periodLabel = periodTab === 'today' ? 'today' : periodValue;

  if (isLoading) return <DashboardSkeleton />;

  return (
    <div className="animate-in fade-in duration-500">
      <div className="flex flex-wrap justify-between items-start gap-4 mb-6">
        <div>
          <div className="section-title">Performance Analytics</div>
          <div className="section-sub">Cross-industry performance comparison and leaderboard for {user.state}</div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex bg-surface2 p-1 rounded-xl border border-border">
            {PERIOD_TABS.map(t => (
              <button
                key={t}
                onClick={() => changePeriodTab(t)}
                className={`px-4 py-1.5 text-[12px] font-bold uppercase tracking-widest rounded-lg transition-all ${periodTab === t ? 'bg-surface1 text-purple shadow-sm' : 'text-text-muted hover:text-text-secondary'}`}
              >
                {t}
              </button>
            ))}
          </div>

          {periodTab !== 'today' && (
            <select
              value={periodValue}
              onChange={(e) => setPeriodValue(e.target.value)}
              className="bg-surface1 border border-border rounded-xl px-4 py-2 text-[14px] font-bold text-text-secondary outline-none focus:border-blue shadow-sm min-w-[120px]"
            >
              {periodOptions(periodTab).map(opt => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          )}
        </div>
      </div>

      <div className="stat-grid mb-6">
        <div className="stat-card">
          <div className="stat-label">Top Revenue</div>
          <div className="stat-value" style={{ color: 'var(--accent)' }}>{"₹"}{topRevenue?.revenue?.toLocaleString() || '0'}</div>
          <div className="stat-delta">{topRevenue?.name || 'N/A'} {"·"} {topRevenue?.industry}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Most Calls</div>
          <div className="stat-value" style={{ color: 'var(--blue)' }}>{topCalls?.calls || 0}</div>
          <div className="stat-delta">{topCalls?.name || 'N/A'} {"·"} {topCalls?.industry}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Most Converted</div>
          <div className="stat-value" style={{ color: 'var(--amber)' }}>{topConv?.converted || 0}</div>
          <div className="stat-delta">{topConv?.name || 'N/A'} {"·"} {topConv?.industry}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Best Efficiency</div>
          <div className="stat-value" style={{ color: 'var(--teal)' }}>{topEfficiency?.efficiency || 0}%</div>
          <div className="stat-delta">{topEfficiency?.name || 'N/A'} {"·"} {topEfficiency?.industry}</div>
        </div>
      </div>

      <div className="flex flex-wrap justify-between items-end gap-3 mb-4">
        <div>
          <div className="text-[15px] font-bold text-text-primary">Team Performance Leaderboard</div>
          <div className="text-[14px] text-text-muted mt-0.5">
            Work %, Leads, Calls, Direct &amp; Virtual Meetings, Blockings and Revenue for {periodLabel} {"·"} {scopeHint} {"·"} click a column header to sort, a row to drill in
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex bg-surface2 p-1 rounded-xl border border-border">
            {SCOPE_TABS.map(t => (
              <button
                key={t.key}
                onClick={() => setScope(t.key)}
                title={t.hint}
                className={`px-4 py-1.5 text-[12px] font-bold uppercase tracking-widest rounded-lg transition-all ${scope === t.key ? 'bg-surface1 text-purple shadow-sm' : 'text-text-muted hover:text-text-secondary'}`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <Button variant="outline" size="sm">Export Detailed CSV</Button>
        </div>
      </div>

      <ManagerPerformanceTable
        rows={rows}
        fallbackState={user.state}
        sortable
        onRowClick={(m) => navigate(`/dashboard/executives/${m.userId || m._id}`)}
        emptyMessage="No performance data available"
        renderActions={(m) => (
          <Tag
            variant={(m.efficiency || 0) >= 80 ? 'green' : (m.efficiency || 0) >= 50 ? 'amber' : 'red'}
            label={(m.efficiency || 0) >= 80 ? 'ON TRACK' : (m.efficiency || 0) >= 50 ? 'AVERAGE' : 'LOW'}
          />
        )}
      />
    </div>
  );
};

export default Performance;
