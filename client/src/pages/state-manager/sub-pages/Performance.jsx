import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import DashboardSkeleton from '../../../components/skeletons/DashboardSkeleton';
import { dashboardApi } from '../../../api/dashboardApi';
import { Button, Tag } from '../../../components/ui';
import ManagerPerformanceTable from '../../../components/ManagerPerformanceTable';
import { usePeriod, PeriodPicker } from '../../../components/LeadPipelinePanel';
import { PerfScopeTabs, usePerfScope, scopeHint, scopedMetrics } from '../../../components/PerformanceScopeTabs';
import { roleLabel } from '../../../utils/roleLabel';

const Performance = () => {
  const navigate = useNavigate();

  // The table used to call the dashboard with no period at all and so always
  // showed the current month, whatever the rest of the app was looking at.
  const picker = usePeriod('month');
  const { period, value: periodValue } = picker;
  const { scope, setScope } = usePerfScope('teams');

  // staleTime 0 so switching period always refetches instead of serving the
  // previous window's cached numbers.
  const { data: dashData, isLoading } = useQuery({
    queryKey: ['dashboard', 'state-manager', 'performance', period, periodValue],
    queryFn: () => dashboardApi.getStateManagerDashboard({ period, value: periodValue || undefined }).then(res => res.data),
    staleTime: 0,
    placeholderData: keepPreviousData
  });

  const user = dashData?.user || {};

  // One row per Industry Manager under every filter; the filter picks whether
  // the row counts their own leads, their district managers' leads, or both.
  const rows = useMemo(() => {
    const managers = dashData?.industryManagers || [];
    const dms = (n) => `${n} ${roleLabel('executive')}${n === 1 ? '' : 's'}`;
    const subLabel = {
      individual: () => `${roleLabel('industry_manager')} · own work`,
      teams: (m) => `Team · ${dms(m.teamSize || 0)}`,
      all: (m) => `${roleLabel('industry_manager')} + ${dms(m.teamSize || 0)}`
    }[scope];

    return managers.map(m => {
      const metrics = scopedMetrics(m, scope);
      return {
        ...metrics,
        _id: `${m._id}:${scope}`,
        userId: m._id,
        name: m.name,
        state: m.state,
        industry: m.industry,
        efficiency: metrics.workPct || 0,
        subLabel: subLabel(m)
      };
    });
  }, [dashData, scope]);

  // The headline cards read the rows on screen, so they always describe the same
  // people, the same scope and the same window as the table below them.
  const leader = (field) => [...rows].sort((a, b) => (b[field] || 0) - (a[field] || 0))[0];
  const topRevenue = leader('revenue');
  const topCalls = leader('calls');
  const topConv = leader('converted');
  const topEfficiency = leader('efficiency');

  const periodLabel = periodValue || period;

  if (isLoading && !dashData) return <DashboardSkeleton />;

  return (
    <div className="animate-in fade-in duration-500">
      <div className="flex flex-wrap justify-between items-start gap-4 mb-6">
        <div>
          <div className="section-title">Performance Analytics</div>
          <div className="section-sub">Cross-industry performance comparison and leaderboard for {user.state}</div>
        </div>
        <PeriodPicker {...picker} />
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
            Work %, Leads, Calls, Direct &amp; Virtual Meetings, Blockings and Revenue for {periodLabel} {"·"} {scopeHint(scope)} {"·"} click a column header to sort, a row to drill in
          </div>
        </div>
        <div className="flex items-center gap-3">
          <PerfScopeTabs scope={scope} setScope={setScope} />
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
