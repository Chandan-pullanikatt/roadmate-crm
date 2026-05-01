import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { leadsApi } from '../../../api/leadsApi';
import { dashboardApi } from '../../../api/dashboardApi';
import { useAuth } from '../../../context/AuthContext';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { StatCard, Tag, DashboardSkeleton } from '../../../components/ui';

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
};

const MyPerformance = () => {
  const { user } = useAuth();

  const { data: countsData, isLoading: countsLoading } = useQuery({
    queryKey: ['leads', 'counts'],
    queryFn: () => leadsApi.getCounts().then(res => res.data),
    staleTime: 5 * 60 * 1000,
  });

  const { data: dashData, isLoading: dashLoading } = useQuery({
    queryKey: ['dashboard', 'executive'],
    queryFn: () => dashboardApi.getExecutiveDashboard().then(res => res.data),
    staleTime: 5 * 60 * 1000,
  });

  const { data: recentLeadsData } = useQuery({
    queryKey: ['leads', 'personal-recent'],
    queryFn: () => leadsApi.getLeads({ limit: 20 }).then(res => res.data),
    staleTime: 5 * 60 * 1000,
  });

  if (countsLoading || dashLoading) return <DashboardSkeleton />;

  const counts = countsData || {};
  const monthly = dashData?.monthlyStats || {};
  const today = dashData?.todayStats || {};
  const recentLeads = recentLeadsData?.leads || [];

  const totalLeads = Object.values(counts).reduce((sum, c) => sum + (c || 0), 0);

  // Build pie data
  const pieData = Object.entries(counts)
    .filter(([, val]) => val > 0)
    .map(([key, val]) => ({
      name: STATUS_LABELS[key] || key,
      value: val,
      color: STATUS_COLORS[key] || '#94A3B8',
    }));

  const conversionRate = totalLeads > 0 ? ((counts.converted || 0) / totalLeads * 100).toFixed(1) : 0;

  return (
    <div className="animate-in fade-in duration-500 space-y-8">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-[12px] font-medium text-text-muted">
        <span>Industry Manager</span>
        <span className="text-text-muted/30">›</span>
        <span className="text-text-primary font-semibold">My Performance</span>
      </div>

      {/* Header */}
      <div>
        <h1 className="text-[24px] font-bold text-text-primary tracking-tight">My Performance</h1>
        <p className="text-[14px] text-text-muted mt-0.5">
          {user?.name} · {user?.industry} · {user?.state} · Personal lead metrics & conversion tracking
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard label="Total Leads" value={totalLeads} delta="Lifetime" colorClass="blue" />
        <StatCard label="New This Month" value={counts.new || 0} delta="Active pipeline" colorClass="purple" />
        <StatCard label="Converted" value={counts.converted || 0} delta={`${conversionRate}% rate`} colorClass="green" />
        <StatCard label="RNR" value={counts.rnr || 0} delta="Not reached" colorClass="amber" />
        <StatCard label="Follow-Up Pending" value={counts.followup || 0} delta="Needs action" colorClass="teal" />
      </div>

      {/* Charts & Target */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Lead Status Breakdown - Pie Chart */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-border shadow-sm p-6">
          <h3 className="text-[16px] font-bold text-text-primary mb-1 flex items-center gap-2">
            <span className="text-purple">📊</span> Lead Status Breakdown
          </h3>
          <p className="text-[12px] text-text-muted mb-6">Distribution across all statuses</p>

          {pieData.length > 0 ? (
            <div className="flex flex-col md:flex-row items-center gap-8">
              <div className="w-full md:w-[280px] h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
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
                    <span className="text-[11px] font-medium text-text-muted truncate">{item.name}</span>
                    <span className="text-[11px] font-bold text-text-primary ml-auto">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="h-[200px] flex items-center justify-center text-text-muted italic text-sm">
              No lead data available
            </div>
          )}
        </div>

        {/* Monthly Target vs Achieved */}
        <div className="bg-white rounded-2xl border border-border shadow-sm p-6 flex flex-col">
          <h3 className="text-[16px] font-bold text-text-primary mb-1 flex items-center gap-2">
            <span className="text-green">🎯</span> Monthly Progress
          </h3>
          <p className="text-[12px] text-text-muted mb-6">This month's activity summary</p>
          
          <div className="space-y-5 flex-1">
            <ProgressMetric label="Calls Made" value={monthly.totalCalls || 0} target={100} color="#8B5CF6" />
            <ProgressMetric label="Meetings Set" value={monthly.totalMeetings || 0} target={20} color="#3B82F6" />
            <ProgressMetric label="Conversions" value={monthly.converted || 0} target={10} color="#10B981" />
            <ProgressMetric label="Follow-Ups" value={today.followups || 0} target={30} color="#F59E0B" />
          </div>

          <div className="mt-auto pt-6 border-t border-border">
            <div className="flex justify-between items-end mb-2">
              <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Overall Completion</span>
              <span className="text-sm font-black text-purple">{dashData?.attendance?.completionPct || 0}%</span>
            </div>
            <div className="h-2.5 bg-surface2 rounded-full overflow-hidden border border-border/50">
              <div 
                className="h-full bg-gradient-to-r from-purple to-blue transition-all duration-1000 rounded-full" 
                style={{ width: `${Math.min(dashData?.attendance?.completionPct || 0, 100)}%` }}
              ></div>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Lead Activity */}
      <div className="bg-white rounded-2xl border border-border shadow-sm overflow-hidden">
        <div className="p-6 border-b border-border flex items-center justify-between">
          <div>
            <h3 className="text-[16px] font-bold text-text-primary flex items-center gap-2">
              <span className="text-blue">📋</span> Recent Lead Activity
            </h3>
            <p className="text-[12px] text-text-muted mt-0.5">Last 20 leads in your pipeline</p>
          </div>
          <Tag variant="blue" label={`${recentLeads.length} leads`} />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-surface2/50 border-b border-border">
                <th className="px-6 py-3 text-[10px] font-black uppercase text-text-muted tracking-widest">Lead</th>
                <th className="px-6 py-3 text-[10px] font-black uppercase text-text-muted tracking-widest">Status</th>
                <th className="px-6 py-3 text-[10px] font-black uppercase text-text-muted tracking-widest">Priority</th>
                <th className="px-6 py-3 text-[10px] font-black uppercase text-text-muted tracking-widest">District</th>
                <th className="px-6 py-3 text-[10px] font-black uppercase text-text-muted tracking-widest">Updated</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {recentLeads.map((lead) => (
                <tr key={lead._id} className="hover:bg-surface2/20 transition-colors">
                  <td className="px-6 py-3">
                    <div className="text-[13px] font-bold text-text-primary">{lead.company || lead.name}</div>
                    <div className="text-[11px] text-text-muted">{lead.name} · {lead.phone}</div>
                  </td>
                  <td className="px-6 py-3">
                    <Tag 
                      variant={lead.status === 'converted' ? 'green' : lead.status === 'lost' ? 'red' : lead.status === 'followup' ? 'amber' : 'blue'} 
                      label={(lead.status || 'new').replace('_', ' ').toUpperCase()} 
                      className="text-[9px]"
                    />
                  </td>
                  <td className="px-6 py-3">
                    <span className={`text-[11px] font-bold uppercase ${lead.priority === 'hot' ? 'text-red' : lead.priority === 'warm' ? 'text-amber' : 'text-blue'}`}>
                      {lead.priority || 'cold'}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-[12px] text-text-secondary">{lead.district || '—'}</td>
                  <td className="px-6 py-3 text-[11px] text-text-muted">
                    {lead.updatedAt ? new Date(lead.updatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'}
                  </td>
                </tr>
              ))}
              {recentLeads.length === 0 && (
                <tr>
                  <td colSpan="5" className="px-6 py-12 text-center text-text-muted italic text-sm">No recent lead activity</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
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
