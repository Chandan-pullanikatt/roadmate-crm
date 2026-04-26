import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { DataTable, Avatar } from '../../../components/ui';
import { dashboardApi } from '../../../api/dashboardApi';

const Performance = () => {
  const [viewType, setViewType] = useState('monthly');

  const { data: dashData, isLoading } = useQuery({
    queryKey: ['dashboard', 'industry-manager', viewType],
    queryFn: () => dashboardApi.getIndustryManagerDashboard().then(res => res.data)
  });

  if (isLoading) return <div className="p-8 text-center text-text-muted">Analyzing staff metrics...</div>;

  const executives = dashData?.executives || [];
  
  // Transform executive data for charts
  const callData = executives.map(e => ({
    name: e.name.split(' ')[0],
    calls: e.callsToday || 0,
    meetings: e.meetingsDone || 0,
    conversions: e.conversionsTotal || 0
  }));

  // Mock trend data (since backend doesn't have history endpoint yet)
  const conversionTrend = [
    { name: 'Week 1', conv: Math.floor(executives.length * 1.2) },
    { name: 'Week 2', conv: Math.floor(executives.length * 1.5) },
    { name: 'Week 3', conv: Math.floor(executives.length * 1.1) },
    { name: 'Week 4', conv: Math.floor(executives.length * 1.8) },
  ];

  const columns = [
    {
      header: 'Executive',
      accessor: 'name',
      render: (val, row) => (
        <div className="flex items-center gap-3">
          <Avatar name={val} size="sm" />
          <span className="font-bold text-sm tracking-tight">{val}</span>
        </div>
      )
    },
    { header: 'District', accessor: 'district' },
    { header: 'Calls', accessor: 'callsToday' },
    { header: 'Meetings', accessor: 'meetingsDone' },
    { 
      header: 'Efficiency', 
      accessor: 'completionPct', 
      render: (val) => <span className="font-mono text-purple font-black">{val}%</span> 
    },
    { 
      header: 'Conv.', 
      accessor: 'conversionsTotal', 
      render: (val) => <span className="font-mono text-accent font-bold">{val}</span> 
    }
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <div className="flex justify-between items-center bg-surface border border-border p-6 rounded-2xl shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-text-primary tracking-tight">Staff Performance Analytics</h2>
          <p className="text-sm text-text-muted">Individual activity tracking, conversion trends & team efficiency.</p>
        </div>
        <div className="flex bg-surface2 p-1 rounded-xl border border-border">
          {['daily', 'weekly', 'monthly'].map(type => (
            <button 
              key={type}
              onClick={() => setViewType(type)}
              className={`px-6 py-2 text-xs font-bold uppercase tracking-widest rounded-lg transition-all ${viewType === type ? 'bg-surface text-purple shadow-sm' : 'text-text-muted hover:text-text-secondary'}`}
            >
              {type}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Calls Bar Chart */}
        <div className="lg:col-span-2 bg-surface border border-border rounded-2xl p-6 shadow-sm">
          <h3 className="text-sm font-bold text-text-primary mb-6 flex items-center justify-between">
             Call & Meeting Distribution
             <span className="text-[10px] text-text-muted uppercase">Live Activity</span>
          </h3>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={callData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 10, fill: 'var(--text-muted)'}} />
                <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fill: 'var(--text-muted)'}} />
                <Tooltip 
                   contentStyle={{ borderRadius: '12px', border: '1px solid var(--border)', boxShadow: 'var(--shadow-md)' }}
                   cursor={{ fill: 'var(--surface2)', opacity: 0.5 }}
                />
                <Bar dataKey="calls" name="Calls" fill="var(--purple)" radius={[4, 4, 0, 0]} barSize={24} />
                <Bar dataKey="meetings" name="Meetings" fill="var(--teal)" radius={[4, 4, 0, 0]} barSize={24} />
                <Bar dataKey="conversions" name="Conversions" fill="var(--accent)" radius={[4, 4, 0, 0]} barSize={24} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Conversion Trend */}
        <div className="bg-surface border border-border rounded-2xl p-6 shadow-sm">
           <h3 className="text-sm font-bold text-text-primary mb-6">Aggregate Conversion Trend</h3>
           <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={conversionTrend}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 10, fill: 'var(--text-muted)'}} />
                <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fill: 'var(--text-muted)'}} />
                <Tooltip />
                <Line type="monotone" dataKey="conv" name="Converted" stroke="var(--accent)" strokeWidth={3} dot={{ r: 4, fill: 'var(--accent)' }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Detail Table */}
      <div className="bg-surface border border-border rounded-2xl overflow-hidden shadow-default">
         <div className="p-6 border-b border-border bg-surface2/20">
            <h3 className="font-bold text-sm text-text-primary uppercase tracking-tight">Executive Detail Report</h3>
         </div>
         <DataTable 
           columns={columns} 
           data={executives} 
           emptyMessage="No performance data available."
         />
      </div>
    </div>
  );
};

export default Performance;
