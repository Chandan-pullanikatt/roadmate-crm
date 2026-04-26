import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { dashboardApi } from '../../../api/dashboardApi';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell
} from 'recharts';

const Performance = () => {
  const { data: dashData, isLoading } = useQuery({
    queryKey: ['dashboard', 'executive'],
    queryFn: () => dashboardApi.getExecutiveDashboard().then(res => res.data)
  });

  const stats = [
    { label: 'Total Leads Handled', value: dashData?.monthlyStats?.totalLeads || 0, color: 'blue' },
    { label: 'Leads Converted', value: dashData?.monthlyStats?.converted || 0, color: 'green' },
    { label: 'Meetings Done', value: dashData?.monthlyStats?.meetingsDone || 0, color: 'purple' },
    { label: 'Work Completion %', value: `${dashData?.attendance?.completionPct || 0}%`, color: 'orange' },
  ];

  // Map backend history to chart data if available, else use placeholders
  const weeklyData = dashData?.weeklyActivity || [
    { name: 'Mon', pct: 0 },
    { name: 'Tue', pct: 0 },
    { name: 'Wed', pct: 0 },
    { name: 'Thu', pct: 0 },
    { name: 'Fri', pct: 0 },
    { name: 'Sat', pct: 0 },
    { name: 'Sun', pct: 0 },
  ];

  const leadOutcomes = [
    { label: 'Converted', val: dashData?.monthlyStats?.converted || 0, color: 'var(--accent)' },
    { label: 'Follow-up Set', val: dashData?.monthlyStats?.followupsSet || 0, color: 'var(--purple)' },
    { label: 'Meeting Set', val: dashData?.monthlyStats?.meetingsDone || 0, color: 'var(--teal)' },
    { label: 'RNR / Busy', val: dashData?.monthlyStats?.rnrCount || 0, color: 'var(--text-muted)' },
    { label: 'Lost / Rejected', val: dashData?.monthlyStats?.lost || 0, color: 'var(--red)' },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="section-header">
        <div>
          <div className="section-title">My Performance</div>
          <div className="section-sub">Detailed conversion stats and work quality for {new Date().toLocaleString('default', { month: 'long' })}</div>
        </div>
      </div>

      <div className="stat-grid">
        {stats.map((s, idx) => (
          <div key={idx} className={`stat-card ${s.color}`}>
            <div className="stat-label">{s.label}</div>
            <div className="stat-value">{s.value}</div>
            <div className="stat-delta">This Month</div>
          </div>
        ))}
      </div>

      <div className="two-col">
        {/* Weekly Completion Bar Chart */}
        <div className="card">
          <div className="card-header"><div className="section-title" style={{fontSize: '13px'}}>Weekly Activity Trend</div></div>
          <div className="card-body">
            <div className="h-[240px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={weeklyData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                  <XAxis dataKey="name" fontSize={10} axisLine={false} tickLine={false} stroke="var(--text-muted)" />
                  <YAxis fontSize={10} axisLine={false} tickLine={false} stroke="var(--text-muted)" />
                  <Tooltip 
                    cursor={{fill: 'var(--surface2)'}} 
                    contentStyle={{borderRadius: '8px', border: '1px solid var(--border)', fontSize: '12px', background: 'var(--surface)'}}
                  />
                  <Bar dataKey="pct" radius={[4, 4, 0, 0]} fill="var(--accent)">
                    {weeklyData.map((entry, index) => (
                      <Cell key={index} fill={entry.pct < 30 ? 'var(--red)' : (entry.pct < 75 ? 'var(--amber)' : 'var(--accent)')} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Lead Outcomes Progress Meters */}
        <div className="card">
          <div className="card-header"><div className="section-title" style={{fontSize: '13px'}}>Conversion Funnel</div></div>
          <div className="card-body">
            <div className="space-y-4">
              {leadOutcomes.map((item, idx) => {
                const maxVal = Math.max(...leadOutcomes.map(o => o.val)) || 1;
                const pct = (item.val / maxVal) * 100;
                return (
                  <div key={idx}>
                    <div style={{display:'flex',justifyContent:'space-between',fontSize:12,marginBottom:6}}>
                      <span style={{color:'var(--text-secondary)',fontWeight:500}}>{item.label}</span>
                      <span style={{fontWeight:700,fontFamily:'DM Mono, monospace'}}>{item.val}</span>
                    </div>
                    <div className="perf-bar" style={{height: '6px', background: 'var(--surface2)', borderRadius: '10px', overflow: 'hidden'}}>
                      <div className="perf-fill" style={{ width: `${pct}%`, height: '100%', background: item.color, transition: 'width 1s ease-in-out' }}></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Performance;
