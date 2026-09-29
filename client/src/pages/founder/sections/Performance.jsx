import React, { useMemo } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import DashboardSkeleton from '../../../components/skeletons/DashboardSkeleton';
import { dashboardApi } from '../../../api/dashboardApi';
import { Tag } from '../../../components/ui';
import { usePeriod, PeriodPicker } from '../../../components/LeadPipelinePanel';
import { PerfScopeTabs, usePerfScope, scopeHint } from '../../../components/PerformanceScopeTabs';
import ManagerPerformanceTable from '../../../components/ManagerPerformanceTable';
import { roleLabel } from '../../../utils/roleLabel';

const PERIOD_LABEL = { yesterday: 'Yesterday', today: 'Today', week: 'Week', month: 'Month', quarter: 'Quarter', year: 'Year' };

const Performance = () => {
  const navigate = useNavigate();
  const picker = usePeriod('month');
  const { period, value: periodValue } = picker;
  const { scope, setScope } = usePerfScope('teams');
  const { data: dashData, isLoading } = useQuery({
    queryKey: ['dashboard', 'founder', period, periodValue],
    queryFn: () => dashboardApi.getFounderDashboard({ period, value: periodValue || undefined }).then(res => res.data),
    staleTime: 5 * 60 * 1000,
    placeholderData: keepPreviousData
  });

  const stats = dashData?.stats || {};

  // Whose numbers the leaderboard reports.
  //
  //   Teams     each State Manager rolled up with their whole office — the
  //             state managers, industry managers and district managers under
  //             them. These are the teams that report to the founder.
  //   Personal  every manager's own work, counted on its own, at all three
  //             levels. A district manager is a leaf, so their line is the same
  //             either way and appears once.
  //   All       both, distinguished by the sub-label under the name.
  //
  // Row ids stay unique under All, where a manager contributes two lines, so
  // the real user id travels as `userId`.
  const managers = useMemo(() => {
    const stateManagers = dashData?.stateManagersPerformance || [];
    const industryManagers = dashData?.industryManagersPerformance || [];
    const districtManagers = dashData?.executivesPerformance || [];

    const decorate = (row) => ({
      ...row,
      completionPct: row.workPct || 0,
      leadsCount: row.periodLeads || 0,
      conversionsTotal: row.converted || 0,
    });

    const teamRows = stateManagers.map(m => decorate({
      ...m,
      _id: `${m._id}:team`,
      userId: m._id,
      subLabel: `Team · ${roleLabel('state_manager')} + ${m.teamSize || 0} reporting`,
    }));

    const personalOf = (row, role) => decorate({
      ...row,
      ...(row.own || {}),
      _id: `${row._id}:self`,
      userId: row._id,
      subLabel: `${roleLabel(role)} · own work`,
    });

    const personalRows = [
      ...stateManagers.map(m => personalOf(m, 'state_manager')),
      ...industryManagers.map(m => personalOf(m, 'industry_manager')),
      ...districtManagers.map(m => decorate({
        ...m,
        _id: `${m._id}:self`,
        userId: m._id,
        subLabel: `${roleLabel('executive')}${m.district ? ` · ${m.district}` : ''}`,
      })),
    ];

    if (scope === 'teams') return teamRows;
    if (scope === 'personal') return personalRows;
    return [...teamRows, ...personalRows];
  }, [dashData, scope]);

  const chartManagers = useMemo(
    () => [...managers].sort((a, b) => b.completionPct - a.completionPct),
    [managers]
  );

  // The table lists all three levels under Personal, and only state managers
  // have a state-manager profile page.
  const profilePath = (row) => {
    const id = row.userId || row._id;
    return row.user?.role === 'state_manager'
      ? `/dashboard/state-managers/${id}`
      : `/dashboard/executives/${id}`;
  };

  const periodLabel = periodValue || period;

  if (isLoading) return <DashboardSkeleton />;

  return (
    <div className="animate-in fade-in duration-500">
      <div className="section-header">
        <div>
          <div className="section-title">Performance Analytics</div>
          <div className="section-sub">Enterprise-wide conversion tracking &amp; regional office metrics</div>
        </div>
        <PeriodPicker {...picker} />
      </div>

      <div className="stat-grid mb-6">
        <div className="stat-card">
          <div className="stat-label">Avg Work Completion</div>
          <div className="stat-value text-green">{stats.attendancePct || 0}%</div>
          <div className="stat-delta">Cross-platform efficiency</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Leads Reach Rate</div>
          <div className="stat-value text-blue">{stats.reachRate || 0}%</div>
          <div className="stat-delta">Contact connectivity</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Meeting Rate</div>
          <div className="stat-value text-amber">{stats.meetingRate || 0}%</div>
          <div className="stat-delta">Leads → Meeting</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Conversion Rate</div>
          <div className="stat-value text-teal">{stats.conversionRate || 0}%</div>
          <div className="stat-delta">Platform average</div>
        </div>
      </div>

      {/* Monthly comparison chart — conversions per state manager */}
      {chartManagers.length > 0 && (
        <div className="card">
          <div className="card-header border-b border-border bg-surface2/10">
            <div className="section-title text-sm">Performance Comparison — {PERIOD_LABEL[period]}{periodValue ? ` · ${periodValue}` : ''}</div>
          </div>
          <div className="p-6">
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={chartManagers} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F0" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fontWeight: 700 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{ border: '1px solid #E5E7EB', borderRadius: 12, fontSize: 12 }}
                  cursor={{ fill: '#F9FAFB' }}
                />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, paddingTop: 12 }} />
                <Bar dataKey="leadsCount"       name="Leads"       fill="#3B82F6" radius={[4,4,0,0]} maxBarSize={32} />
                <Bar dataKey="conversionsTotal" name="Conversions" fill="#059669" radius={[4,4,0,0]} maxBarSize={32} />
                <Bar dataKey="completionPct"    name="Work %"      fill="#7C3AED" radius={[4,4,0,0]} maxBarSize={32} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      <div className="flex flex-wrap justify-between items-end gap-3 mb-4">
        <div>
          <div className="text-[15px] font-bold text-text-primary">State Office Leaderboard</div>
          <div className="text-[14px] text-text-muted mt-0.5">
            Work %, Leads, Calls, Direct &amp; Virtual Meetings, Blockings and Revenue for {periodLabel} {"·"} {scopeHint(scope)} {"·"} click a column header to sort, a row to drill in
          </div>
        </div>
        <PerfScopeTabs scope={scope} setScope={setScope} />
      </div>

      <ManagerPerformanceTable
        rows={managers}
        sortable
        onRowClick={(m) => navigate(profilePath(m))}
        emptyMessage="No performance data available"
        renderActions={(m) => (
          <>
            <Tag
              variant={(m.workPct || 0) >= 80 ? 'green' : (m.workPct || 0) >= 50 ? 'amber' : 'red'}
              label={(m.workPct || 0) >= 80 ? 'OPTIMAL' : (m.workPct || 0) >= 50 ? 'STABLE' : 'CRITICAL'}
            />
            <button
              className="text-[11px] font-bold text-blue underline underline-offset-2"
              onClick={() => navigate(profilePath(m))}
            >
              View Details
            </button>
          </>
        )}
      />
    </div>
  );
};

export default Performance;
