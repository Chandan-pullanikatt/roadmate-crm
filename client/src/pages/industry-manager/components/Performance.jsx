import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Tag, DashboardSkeleton } from '../../../components/ui';
import { dashboardApi } from '../../../api/dashboardApi';
import ManagerPerformanceTable from '../../../components/ManagerPerformanceTable';
import { usePeriod, PeriodPicker } from '../../../components/LeadPipelinePanel';
import { PerfScopeTabs, usePerfScope, scopeHint } from '../../../components/PerformanceScopeTabs';
import { roleLabel } from '../../../utils/roleLabel';

const Performance = () => {
  const navigate = useNavigate();
  // The table used to call the dashboard with no period at all and so always
  // showed the current month, whatever the rest of the app was looking at.
  const picker = usePeriod('month');
  const { period, value: periodValue } = picker;
  const { scope, setScope } = usePerfScope('personal');

  const { data: dashData, isLoading } = useQuery({
    queryKey: ['dashboard', 'industry-manager', period, periodValue],
    queryFn: () => dashboardApi.getIndustryManagerDashboard(period, periodValue || undefined).then(res => res.data),
    staleTime: 5 * 60 * 1000,
    placeholderData: (prev) => prev
  });

  const userInfo = dashData?.user || {};

  // Three ways to read the same window, from the one payload. A district
  // manager has nobody reporting to them, so their team line and their personal
  // line would be identical — only this manager gets a team row, and it is the
  // whole team's total. Row ids stay unique under "All", where the manager
  // contributes both lines, so the real user id travels as `userId`.
  const rows = useMemo(() => {
    const executives = dashData?.executivePerformance || [];
    const self = dashData?.selfPerformance;
    const team = dashData?.teamPerformance;

    const teamRows = team ? [{
      ...team,
      _id: `${team._id}:team`,
      userId: team._id,
      subLabel: `Team · ${roleLabel('industry_manager')} + ${team.teamSize || 0} ${roleLabel('executive')}${(team.teamSize || 0) === 1 ? '' : 's'}`
    }] : [];

    const personalRows = [
      ...(self ? [{
        ...self,
        _id: `${self._id}:self`,
        userId: self._id,
        subLabel: `${roleLabel('industry_manager')} · own work`
      }] : []),
      ...executives.map(e => ({
        ...e,
        _id: `${e._id}:self`,
        userId: e._id,
        subLabel: `${roleLabel('executive')}${e.district ? ` · ${e.district}` : ''}`
      }))
    ];

    if (scope === 'teams') return teamRows;
    if (scope === 'personal') return personalRows;
    return [...teamRows, ...personalRows];
  }, [dashData, scope]);

  // The cards read the rows on screen, so they always describe the same people,
  // the same scope and the same window as the table below them. `completionPct`
  // is today's attendance and only the district-manager rows carry it; the
  // rollup and the manager's own line fall back to the period's work %.
  const workPctOf = (row) => row?.completionPct ?? row?.workPct ?? 0;
  const leader = (compare) => (rows.length ? [...rows].sort(compare)[0] : null);

  const topPerformer = leader((a, b) => (b.converted || 0) - (a.converted || 0) || workPctOf(b) - workPctOf(a));
  const bestRevenue = leader((a, b) => (b.revenue || 0) - (a.revenue || 0));
  const mostCalls = leader((a, b) => (b.calls || 0) - (a.calls || 0));
  const mostFollowups = leader((a, b) => (b.followupsCount || 0) - (a.followupsCount || 0));

  const formatCurrency = (val) => {
    if (val >= 100000) return `₹${(val / 100000).toFixed(1)}L`;
    if (val >= 1000) return `₹${(val / 1000).toFixed(1)}K`;
    return `₹${val}`;
  };

  const periodLabel = period === 'today' ? 'today' : periodValue;

  if (isLoading && !dashData) return <DashboardSkeleton />;

  return (
    <div className="space-y-6 animate-in fade-in duration-700 pb-12">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Staff Performance</h1>
          <p className="text-[16px] text-text-muted">{roleLabel('industry_manager')} · {userInfo.industry} · All district managers</p>
        </div>
        <PeriodPicker {...picker} />
      </div>

      {/* Sub Header */}
      <div className="bg-surface1 border border-border/40 rounded-2xl p-6 shadow-sm">
        <h2 className="text-lg font-bold">Staff Performance - {userInfo.industry} - {userInfo.state}</h2>
        <p className="text-[14px] text-text-muted">Work % · Leads · Calls · Direct &amp; Virtual Meetings · Blockings · Revenue</p>
      </div>

      {/* Top 4 Performance Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Top Performer */}
        <div className="card p-6 border-l-4 border-purple shadow-sm hover:shadow-md transition-shadow">
            <div className="text-[12px] font-bold text-text-muted uppercase tracking-widest mb-3">Top Performer</div>
            <div className="flex items-center gap-4">
                <div className="text-xl font-black text-purple">{topPerformer?.name || '—'}</div>
            </div>
            <div className="mt-2 text-[14px] font-bold text-text-muted">
                <span className="text-purple">{workPctOf(topPerformer)}% Work</span> · {topPerformer?.converted || 0} Conv.
            </div>
        </div>

        {/* Best Revenue */}
        <div className="card p-6 border-l-4 border-green shadow-sm hover:shadow-md transition-shadow">
            <div className="text-[12px] font-bold text-text-muted uppercase tracking-widest mb-3">Best Revenue</div>
            <div className="text-2xl font-black text-text-primary">{formatCurrency(bestRevenue?.revenue || 0)}</div>
            <div className="mt-2 text-[12px] font-bold text-text-muted">
                {bestRevenue?.name} · {bestRevenue?.district || bestRevenue?.industry}
            </div>
        </div>

        {/* Most Calls */}
        <div className="card p-6 border-l-4 border-blue shadow-sm hover:shadow-md transition-shadow">
            <div className="text-[12px] font-bold text-text-muted uppercase tracking-widest mb-3">Most Calls</div>
            <div className="text-2xl font-black text-text-primary">{mostCalls?.calls || 0}</div>
            <div className="mt-2 text-[12px] font-bold text-text-muted">
                {mostCalls?.name} · {mostCalls?.district || mostCalls?.industry}
            </div>
        </div>

        {/* Most Follow-ups */}
        <div className="card p-6 border-l-4 border-amber shadow-sm hover:shadow-md transition-shadow">
            <div className="text-[12px] font-bold text-text-muted uppercase tracking-widest mb-3">Most Follow-ups</div>
            <div className="text-2xl font-black text-text-primary">{mostFollowups?.followupsCount || 0}</div>
            <div className="mt-2 text-[12px] font-bold text-text-muted">
                {mostFollowups?.name} · {mostFollowups?.district || mostFollowups?.industry}
            </div>
        </div>
      </div>

      {/* Detail Table */}
      <div>
        <div className="flex flex-wrap justify-between items-end gap-3 mb-4">
          <div>
            <div className="text-[15px] font-bold text-text-primary">Staff-by-Staff Detail Report</div>
            <div className="text-[14px] text-text-muted mt-0.5">
              For {periodLabel} · {scopeHint(scope)} · click a column header to sort, a row to open that manager's profile
            </div>
          </div>
          <PerfScopeTabs scope={scope} setScope={setScope} />
        </div>
        <ManagerPerformanceTable
          rows={rows}
          fallbackState={userInfo.state}
          sortable
          onRowClick={(row) => navigate(`/dashboard/executives/${row.userId || row._id}`)}
          emptyMessage="No district managers found"
          renderActions={(row) => (
            // Active / On Leave is a live, per-person question, so it is only
            // meaningful on a district manager's own line.
            row.isWorking === undefined ? null : (
              <Tag
                variant={row.isWorking ? 'green' : 'amber'}
                label={row.isWorking ? 'Active' : 'On Leave'}
                className="text-[9px] font-black px-3 py-1 rounded-lg uppercase tracking-tighter"
              />
            )
          )}
        />
      </div>
    </div>
  );
};

export default Performance;
