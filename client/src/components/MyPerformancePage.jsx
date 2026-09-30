import React from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { leadsApi } from '../api/leadsApi';
import { useAuth } from '../context/AuthContext';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { DashboardSkeleton } from './ui';
import { usePeriod, PeriodPicker } from './LeadPipelinePanel';
import TargetSection from './TargetSection';
import ActivityProgress from './ActivityProgress';

const STATUS_COLORS = {
  new: '#3B82F6',
  called: '#8B5CF6',
  followup: '#F59E0B',
  rnr: '#EF4444',
  meeting_virtual: '#06B6D4',
  meeting_direct: '#0EA5E9',
  converted: '#10B981',
  lost: '#6B7280',
  not_interested: '#9CA3AF',
  escalated: '#EC4899',
};

const STATUS_LABELS = {
  new: 'New',
  called: 'Called',
  followup: 'Follow-Up',
  rnr: 'RNR',
  meeting_virtual: 'Virtual Meeting',
  meeting_direct: 'Direct Meeting',
  converted: 'Converted',
  lost: 'Lost',
  not_interested: 'Not Interested',
  escalated: 'Escalated',
  blocking_amount_received: 'Blocking Amount Received',
  full_amount_received: 'Full Amount Received',
};

const periodText = (period, value) => value || (period === 'yesterday' ? 'Yesterday' : 'Today');

/**
 * A manager's own My Performance page -- the same layout for every role that has
 * one (State, Industry and District Managers). `roleName` heads the breadcrumb;
 * `scope` is the role's own line in the subtitle (state, industry · state, ...).
 */
const MyPerformancePage = ({ roleName, scope }) => {
  const { user } = useAuth();
  const breakdownPicker = usePeriod('month');

  const { data: countsData, isLoading: countsLoading } = useQuery({
    queryKey: ['leads', 'counts', 'self', breakdownPicker.period, breakdownPicker.value],
    queryFn: () => leadsApi.getCounts({
      owner: 'self',
      period: breakdownPicker.period,
      value: breakdownPicker.value || undefined
    }).then(res => res.data),
    placeholderData: keepPreviousData,
  });


  if (countsLoading) return <DashboardSkeleton />;

  // `total` is a sum, not a status -- keep it out of the pie.
  const { total: totalLeads = 0, ...statusCounts } = countsData || {};
  const pieData = Object.entries(statusCounts)
    .filter(([, val]) => val > 0)
    .map(([key, val]) => ({
      name: STATUS_LABELS[key] || key,
      value: val,
      color: STATUS_COLORS[key] || '#94A3B8',
    }));

  return (
    <div className="animate-in fade-in duration-500 space-y-8">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-[14px] font-medium text-text-muted">
        <span>{roleName}</span>
        <span className="text-text-muted/30">›</span>
        <span className="text-text-primary font-semibold">My Performance</span>
      </div>

      {/* Header */}
      <div>
        <h1 className="text-[24px] font-bold text-text-primary tracking-tight">My Performance</h1>
        <p className="text-[16px] text-text-muted mt-0.5">
          {user?.name} · {scope} · Personal lead metrics & conversion tracking
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Lead Status Breakdown - Pie Chart */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-border shadow-sm p-6">
          <div className="flex flex-wrap justify-between items-start gap-3 mb-6">
            <div>
              <h3 className="text-[16px] font-bold text-text-primary mb-1 flex items-center gap-2">
                <span className="text-purple">📊</span> Lead Status Breakdown
              </h3>
              <p className="text-[14px] text-text-muted">
                Leads created {periodText(breakdownPicker.period, breakdownPicker.value)} · {totalLeads} in total
              </p>
            </div>
            <PeriodPicker {...breakdownPicker} />
          </div>

          {pieData.length > 0 ? (
            <div className="flex flex-col md:flex-row items-center gap-8">
              {/* Explicit height: a percentage height measures as -1 before the
                  flex parent has laid out, which makes Recharts warn. */}
              <div className="w-full min-w-[240px] md:w-[280px] h-[280px]">
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={110}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={index} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ borderRadius: 12, border: '1px solid var(--border)', fontSize: 12, fontWeight: 600 }}
                      formatter={(value, name) => [`${value} leads`, name]}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex-1 grid grid-cols-2 gap-3">
                {pieData.map((item) => (
                  <div key={item.name} className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: item.color }}></div>
                    <span className="text-[13px] font-medium text-text-muted truncate">{item.name}</span>
                    <span className="text-[11px] font-bold text-text-primary ml-auto">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="h-[200px] flex items-center justify-center text-text-muted italic text-[16px]">
              No leads in this period
            </div>
          )}
        </div>

        {/* Activity Progress -- the Team Performance Leaderboard's columns */}
        <ActivityProgress userId={user?._id} />
      </div>

      <TargetSection filterable />
    </div>
  );
};

export default MyPerformancePage;
