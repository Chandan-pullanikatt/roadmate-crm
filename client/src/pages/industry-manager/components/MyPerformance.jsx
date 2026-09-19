import React from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import api from '../../../api/axios';
import { leadsApi } from '../../../api/leadsApi';
import { useAuth } from '../../../context/AuthContext';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { DashboardSkeleton } from '../../../components/ui';
import { usePeriod, PeriodPicker } from '../../../components/LeadPipelinePanel';
import { TargetSection } from '../../executive/components/Performance';

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

const periodText = (period, value) => (period === 'today' ? 'Today' : value);

const MyPerformance = () => {
  const { user } = useAuth();
  const breakdownPicker = usePeriod('month');
  const progressPicker = usePeriod('month');

  const { data: countsData, isLoading: countsLoading } = useQuery({
    queryKey: ['leads', 'counts', 'self', breakdownPicker.period, breakdownPicker.value],
    queryFn: () => leadsApi.getCounts({
      owner: 'self',
      period: breakdownPicker.period,
      value: breakdownPicker.value || undefined
    }).then(res => res.data),
    placeholderData: keepPreviousData,
  });

  const { data: actions = {}, isLoading: actionsLoading } = useQuery({
    queryKey: ['stats', 'user-actions', user?._id, progressPicker.period, progressPicker.value],
    queryFn: () => api.get(`/stats/user/${user._id}/actions`, {
      params: { period: progressPicker.period, value: progressPicker.value || undefined }
    }).then(res => res.data),
    enabled: !!user?._id,
    placeholderData: keepPreviousData,
  });

  if (countsLoading || actionsLoading) return <DashboardSkeleton />;

  // `total` is a sum, not a status -- keep it out of the pie.
  const { total: totalLeads = 0, ...statusCounts } = countsData || {};
  const pieData = Object.entries(statusCounts)
    .filter(([, val]) => val > 0)
    .map(([key, val]) => ({
      name: STATUS_LABELS[key] || key,
      value: val,
      color: STATUS_COLORS[key] || '#94A3B8',
    }));

  const calls = actions.calls || 0;
  const conversionRate = calls > 0 ? Math.round(((actions.conversions || 0) / calls) * 100) : 0;

  return (
    <div className="animate-in fade-in duration-500 space-y-8">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-[14px] font-medium text-text-muted">
        <span>Industry Manager</span>
        <span className="text-text-muted/30">›</span>
        <span className="text-text-primary font-semibold">My Performance</span>
      </div>

      {/* Header */}
      <div>
        <h1 className="text-[24px] font-bold text-text-primary tracking-tight">My Performance</h1>
        <p className="text-[16px] text-text-muted mt-0.5">
          {user?.name} · {user?.industry} · {user?.state} · Personal lead metrics & conversion tracking
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

        {/* Activity Progress */}
        <div className="bg-white rounded-2xl border border-border shadow-sm p-6 flex flex-col">
          <div className="flex flex-col gap-3 mb-6">
            <div>
              <h3 className="text-[16px] font-bold text-text-primary mb-1 flex items-center gap-2">
                <span className="text-green">🎯</span> Activity Progress
              </h3>
              <p className="text-[14px] text-text-muted">
                Your lead actions · {periodText(progressPicker.period, progressPicker.value)}
              </p>
            </div>
            <PeriodPicker {...progressPicker} />
          </div>

          <div className="space-y-5 flex-1">
            <ProgressMetric label="Calls" value={calls} target={50} color="#8B5CF6" />
            <ProgressMetric label="Meetings" value={actions.meetings || 0} target={20} color="#3B82F6" />
            <ProgressMetric label="Converted" value={actions.conversions || 0} target={10} color="#10B981" />
            <ProgressMetric label="Follow-Ups Set" value={actions.followups || 0} target={30} color="#F59E0B" />
          </div>

          <div className="mt-auto pt-6 border-t border-border">
            <div className="flex justify-between items-end mb-2">
              <span className="text-[12px] font-bold text-text-muted uppercase tracking-wider">Call-to-Conversion Rate</span>
              <span className="text-sm font-black text-purple">{conversionRate}%</span>
            </div>
            <div className="h-2.5 bg-surface2 rounded-full overflow-hidden border border-border/50">
              <div
                className="h-full bg-gradient-to-r from-purple to-blue transition-all duration-1000 rounded-full"
                style={{ width: `${Math.min(conversionRate, 100)}%` }}
              ></div>
            </div>
          </div>
        </div>
      </div>

      <TargetSection filterable />
    </div>
  );
};

// Helper: Progress bar with label
const ProgressMetric = ({ label, value, target, color }) => {
  const pct = target > 0 ? Math.min(Math.round((value / target) * 100), 100) : 0;
  return (
    <div>
      <div className="flex justify-between items-center mb-1.5">
        <span className="text-[12px] font-bold text-text-primary">{label}</span>
        <span className="text-[11px] font-black" style={{ color }}>{value} / {target}</span>
      </div>
      <div className="h-2 bg-surface2 rounded-full overflow-hidden border border-border/50">
        <div className="h-full rounded-full transition-all duration-1000" style={{ width: `${pct}%`, backgroundColor: color }}></div>
      </div>
    </div>
  );
};

export default MyPerformance;
