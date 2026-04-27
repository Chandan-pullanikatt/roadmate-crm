import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { dashboardApi } from '../../../api/dashboardApi';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell
} from 'recharts';

const Performance = () => {
  const [timeFilter, setTimeFilter] = useState('Month');
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();

  // 1. Fetch Performance Data
  const { data, isLoading } = useQuery({
    queryKey: ['performance', 'executive', month, year],
    queryFn: () => dashboardApi.getPerformance({ month, year }).then(res => res.data)
  });

  const metrics = data?.metrics || {};
  const statusBreakdown = data?.statusBreakdown || {};
  const weeklyTrends = data?.weeklyTrends || [];

  const MetricCard = ({ title, value, unit = '', growth, growthPrefix = '↑', isCurrency = false }) => (
    <div className="report-metric-card bg-surface border border-border p-5 rounded-2xl shadow-sm">
      <div className="flex justify-between items-start mb-4">
        <div className="text-3xl font-black tracking-tight">
          {isCurrency && '₹'}{value}{unit}
        </div>
      </div>
      <div className="text-[10px] font-black text-muted uppercase tracking-widest mb-2">{title}</div>
      <div className={`text-[11px] font-bold ${growth >= 0 ? 'text-green-600' : 'text-red-600'}`}>
        {growth >= 0 ? '↑' : '↓'} {Math.abs(growth)}{isCurrency ? 'L' : '%'} <span className="text-muted font-medium">vs prev month</span>
      </div>
    </div>
  );

  return (
    <div className="performance-reports-page animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* 1. Header Section */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Summary & Reports</h1>
          <p className="text-sm text-muted">Performance Summary · District Executive · Mohan R. · Mumbai</p>
        </div>
        <div className="flex bg-surface border border-border rounded-lg p-1">
          {['Week', 'Month', 'Quarter', 'Year'].map(f => (
            <button 
              key={f}
              className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all ${timeFilter === f ? 'bg-[#FFFBEB] text-[#92400E] shadow-sm' : 'text-muted hover:bg-surface2'}`}
              onClick={() => setTimeFilter(f)}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* 2. Top Metric Rows */}
      <div className="grid grid-cols-4 gap-5 mb-5">
        <MetricCard title="Total Calls Made" value={metrics.totalCalls?.value || 0} growth={metrics.totalCalls?.growth} />
        <MetricCard title="Conversions" value={metrics.conversions?.value || 0} growth={metrics.conversions?.growth} />
        <MetricCard title="Revenue Generated" value={metrics.revenue?.value || 0} unit="L" growth={metrics.revenue?.growth} isCurrency={true} />
        <MetricCard title="Meetings Attended" value={metrics.meetings?.value || 0} growth={metrics.meetings?.growth} />
      </div>

      <div className="grid grid-cols-4 gap-5 mb-8">
        <MetricCard title="Fresh Leads" value={metrics.freshLeads?.value || 0} growth={0} />
        <MetricCard title="RNR Leads" value={metrics.rnrLeads?.value || 0} growth={metrics.rnrLeads?.growth} />
        <MetricCard title="Conversion Rate" value={metrics.conversionRate?.value || 0} unit="%" growth={metrics.conversionRate?.growth} />
        <div className="report-metric-card bg-surface border border-border p-5 rounded-2xl shadow-sm">
          <div className="text-3xl font-black tracking-tight">{metrics.points?.value?.toLocaleString() || 0}</div>
          <div className="text-[10px] font-black text-muted uppercase tracking-widest mb-2">Total Points</div>
          <div className="text-[11px] font-bold text-amber-600">{metrics.points?.tier || 'Gold Tier'}</div>
        </div>
      </div>

      {/* 3. Charts Section */}
      <div className="grid grid-cols-3 gap-6">
        
        {/* Daily Conversions Chart */}
        <div className="col-span-2 bg-surface border border-border rounded-2xl p-6 shadow-sm">
          <div className="text-sm font-extrabold mb-8">Daily Conversions — {now.toLocaleString('default', { month: 'long', year: 'numeric' })}</div>
          <div style={{ width: '100%', height: 300 }}>
            <ResponsiveContainer>
              <BarChart data={weeklyTrends}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 11, fontWeight: 700, fill: 'var(--text-muted)' }}
                  dy={10}
                />
                <YAxis hide />
                <Tooltip 
                  cursor={{ fill: 'var(--surface2)' }}
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                />
                <Bar dataKey="conversions" radius={[4, 4, 0, 0]} barSize={80}>
                  {weeklyTrends.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={index === weeklyTrends.length - 1 ? '#C2410C' : 
                            index === weeklyTrends.length - 2 ? '#FDE68A' : 
                            index === weeklyTrends.length - 3 ? '#FEF3C7' : '#FFFBEB'} 
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="flex justify-between mt-4 px-4">
            {['W1', 'W2', 'W3', 'W4'].map(w => <span key={w} className="text-[10px] font-black text-muted">{w}</span>)}
          </div>
        </div>

        {/* Lead Status Breakdown */}
        <div className="bg-surface border border-border rounded-2xl p-6 shadow-sm">
          <div className="text-[11px] font-black tracking-widest uppercase mb-8">Lead Status Breakdown</div>
          <div className="space-y-6">
            <StatusRow label="Fresh Leads" count={statusBreakdown.fresh} color="#F97316" total={100} />
            <StatusRow label="Hot Follow" count={statusBreakdown.hot} color="#C2410C" total={100} />
            <StatusRow label="Converted" count={statusBreakdown.converted} color="#059669" total={100} />
            <StatusRow label="RNR" count={statusBreakdown.rnr} color="#DC2626" total={100} />
            <StatusRow label="Not Interested" count={statusBreakdown.notInterested} color="#94A3B8" total={100} />
          </div>
        </div>

      </div>

      {/* 4. Bottom Section - Meeting Performance Placeholder */}
      <div className="mt-6 bg-surface border border-border rounded-2xl p-6 shadow-sm">
        <div className="text-sm font-extrabold mb-4">Meeting Performance</div>
        <div className="flex items-center justify-center h-20 text-muted text-xs italic">
          Detailed meeting conversion and feedback analysis coming soon...
        </div>
      </div>

    </div>
  );
};

const StatusRow = ({ label, count, color, total }) => (
  <div className="space-y-2">
    <div className="flex justify-between items-center">
      <span className="text-xs font-bold text-text-secondary">{label}</span>
      <span className="text-xs font-black">{count || 0}</span>
    </div>
    <div className="h-1.5 w-full bg-surface2 rounded-full overflow-hidden">
      <div 
        className="h-full rounded-full transition-all duration-1000" 
        style={{ width: `${Math.min(100, (count / total) * 100)}%`, backgroundColor: color }}
      ></div>
    </div>
  </div>
);

export default Performance;
