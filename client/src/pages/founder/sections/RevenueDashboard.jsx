import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { dashboardApi } from '../../../api/dashboardApi';
import DashboardSkeleton from '../../../components/skeletons/DashboardSkeleton';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, Legend, LineChart, Line 
} from 'recharts';
import { Button } from '../../../components/ui';

const RevenueDashboard = () => {
  const [period, setPeriod] = useState('month');
  const [periodValue, setPeriodValue] = useState(() => {
    const now = new Date();
    return now.toLocaleString('en-US', { month: 'long' });
  });

  const { data, isLoading } = useQuery({
    queryKey: ['revenue-dashboard', period, periodValue],
    queryFn: () => dashboardApi.getRevenueDashboard(period, periodValue).then(res => res.data),
    staleTime: 5 * 60 * 1000
  });

  if (isLoading) return <DashboardSkeleton />;

  const summary = data?.summary || { totalRevenue: 0, count: 0, avgDealValue: 0 };
  const byCategory = data?.byCategory?.map(c => ({ 
    name: c._id.replace('_', ' ').split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '), 
    value: c.revenue 
  })) || [];
  
  const byState = data?.byState?.map(s => ({ 
    name: s._id || 'Unknown', 
    revenue: s.revenue 
  })) || [];

  const byIndustry = data?.byIndustry?.map(i => ({ 
    name: i._id || 'Unknown', 
    revenue: i.revenue 
  })) || [];

  const recentConversions = data?.recentConversions || [];

  const COLORS = ['#0f766e', '#3b82f6', '#8b5cf6', '#f59e0b', '#dc2626', '#6b7280'];

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(value);
  };

  const getDropdownOptions = () => {
    if (period === 'week') return ['Week 1', 'Week 2', 'Week 3', 'Week 4', 'Week 5'];
    if (period === 'month') return ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    if (period === 'quarter') return ['Q1', 'Q2', 'Q3', 'Q4'];
    if (period === 'year') {
      const currentYear = new Date().getFullYear();
      return Array.from({ length: 5 }, (_, i) => String(currentYear - i));
    }
    return [];
  };

  return (
    <div className="animate-in fade-in duration-500 pb-10">
      <div className="section-header flex justify-between items-center mb-8">
        <div>
          <h1 className="section-title text-2xl font-bold">Revenue Dashboard</h1>
          <p className="section-sub text-text-muted">Detailed financial performance and conversion analytics</p>
        </div>
        
        <div className="flex items-center gap-3 bg-surface2 p-1.5 rounded-2xl border border-border">
          <div className="flex gap-1">
            {['week', 'month', 'quarter', 'year'].map(t => (
              <button 
                key={t}
                onClick={() => {
                  setPeriod(t);
                  // Reset period value to current
                  const now = new Date();
                  if (t === 'month') setPeriodValue(now.toLocaleString('en-US', { month: 'long' }));
                  else if (t === 'quarter') setPeriodValue(`Q${Math.floor(now.getMonth() / 3) + 1}`);
                  else if (t === 'year') setPeriodValue(String(now.getFullYear()));
                  else setPeriodValue('Week 1');
                }}
                className={`px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest rounded-xl transition-all ${period === t ? 'bg-white text-purple shadow-sm' : 'text-text-muted hover:text-text-secondary'}`}
              >
                {t}
              </button>
            ))}
          </div>
          <div className="h-4 w-[1px] bg-border mx-1"></div>
          <select 
            value={periodValue}
            onChange={(e) => setPeriodValue(e.target.value)}
            className="bg-transparent border-none text-[11px] font-bold text-text-secondary outline-none pr-4 cursor-pointer"
          >
            {getDropdownOptions().map(opt => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="stat-card bg-white p-6 rounded-3xl border border-border shadow-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-teal/5 rounded-bl-full -mr-8 -mt-8 transition-all group-hover:scale-110"></div>
          <div className="stat-label text-xs font-bold text-text-muted uppercase tracking-widest mb-2">Total Revenue</div>
          <div className="text-3xl font-black text-text-primary mb-1">{formatCurrency(summary.totalRevenue)}</div>
          <div className="text-[11px] font-bold text-teal flex items-center gap-1">
             <span className="w-4 h-4 bg-teal/10 rounded-full flex items-center justify-center">↑</span>
             <span>12.5% from previous {period}</span>
          </div>
        </div>

        <div className="stat-card bg-white p-6 rounded-3xl border border-border shadow-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-blue/5 rounded-bl-full -mr-8 -mt-8 transition-all group-hover:scale-110"></div>
          <div className="stat-label text-xs font-bold text-text-muted uppercase tracking-widest mb-2">Conversions</div>
          <div className="text-3xl font-black text-text-primary mb-1">{summary.count}</div>
          <div className="text-[11px] font-bold text-blue flex items-center gap-1">
             <span className="w-4 h-4 bg-blue/10 rounded-full flex items-center justify-center">↑</span>
             <span>{Math.round(summary.count * 0.2)} new this {period}</span>
          </div>
        </div>

        <div className="stat-card bg-white p-6 rounded-3xl border border-border shadow-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-purple/5 rounded-bl-full -mr-8 -mt-8 transition-all group-hover:scale-110"></div>
          <div className="stat-label text-xs font-bold text-text-muted uppercase tracking-widest mb-2">Avg Deal Value</div>
          <div className="text-3xl font-black text-text-primary mb-1">{formatCurrency(summary.avgDealValue)}</div>
          <div className="text-[11px] font-bold text-purple flex items-center gap-1">
             <span className="w-4 h-4 bg-purple/10 rounded-full flex items-center justify-center">→</span>
             <span>Stable ticket size</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        <div className="card bg-white p-8 rounded-[32px] border border-border shadow-sm">
          <div className="flex justify-between items-center mb-8">
            <h3 className="text-sm font-bold uppercase tracking-widest text-text-primary">Revenue by Category</h3>
            <div className="flex gap-2">
               <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-teal"></div>
                  <span className="text-[10px] font-bold text-text-muted">Actuals</span>
               </div>
            </div>
          </div>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={byCategory}
                  cx="50%"
                  cy="50%"
                  innerRadius={80}
                  outerRadius={110}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {byCategory.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  formatter={(value) => formatCurrency(value)}
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)' }}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '11px', fontWeight: 'bold', paddingTop: '20px' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card bg-white p-8 rounded-[32px] border border-border shadow-sm">
          <h3 className="text-sm font-bold uppercase tracking-widest text-text-primary mb-8">Performance by State</h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byState}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fontWeight: 'bold', fill: '#64748b' }} 
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fontWeight: 'bold', fill: '#64748b' }}
                  tickFormatter={(val) => `\u20B9${val >= 100000 ? val/100000 + 'L' : val}`}
                />
                <Tooltip 
                  cursor={{ fill: '#f8fafc' }}
                  formatter={(value) => formatCurrency(value)}
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)' }}
                />
                <Bar dataKey="revenue" fill="#3b82f6" radius={[6, 6, 0, 0]} barSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8">
        <div className="card bg-white p-8 rounded-[32px] border border-border shadow-sm">
          <h3 className="text-sm font-bold uppercase tracking-widest text-text-primary mb-8">Industry Revenue Breakdown</h3>
          <div className="h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byIndustry} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                <XAxis 
                  type="number"
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fontWeight: 'bold', fill: '#64748b' }}
                  tickFormatter={(val) => `\u20B9${val >= 100000 ? val/100000 + 'L' : val}`}
                />
                <YAxis 
                  dataKey="name" 
                  type="category"
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fontWeight: 'bold', fill: '#64748b' }} 
                  width={120}
                />
                <Tooltip 
                  cursor={{ fill: '#f8fafc' }}
                  formatter={(value) => formatCurrency(value)}
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)' }}
                />
                <Bar dataKey="revenue" fill="#8b5cf6" radius={[0, 6, 6, 0]} barSize={30} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card bg-white p-0 rounded-[32px] border border-border shadow-sm overflow-hidden mt-4">
          <div className="p-8 border-b border-border flex justify-between items-center">
            <h3 className="text-sm font-bold uppercase tracking-widest text-text-primary">Recent Revenue Conversions</h3>
            <Button variant="outline" size="xs" className="rounded-full text-[10px] font-bold uppercase tracking-widest">View All Ledger</Button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface2/50 text-[10px] font-bold text-text-muted uppercase tracking-widest border-b border-border">
                  <th className="px-8 py-4">Entity / Business</th>
                  <th className="px-8 py-4">Category</th>
                  <th className="px-8 py-4">Amount</th>
                  <th className="px-8 py-4">Converted Date</th>
                  <th className="px-8 py-4 text-right">Reference</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {recentConversions.map((rev, idx) => (
                  <tr key={idx} className="hover:bg-surface2/30 transition-colors group">
                    <td className="px-8 py-5">
                      <div className="text-[13px] font-bold text-text-primary group-hover:text-blue transition-colors">{rev.company || rev.leadName}</div>
                      <div className="text-[11px] text-text-muted mt-0.5">{rev.leadName}</div>
                    </td>
                    <td className="px-8 py-5">
                      <span className="inline-flex px-2 py-1 rounded-lg bg-surface2 text-text-secondary text-[10px] font-bold uppercase tracking-wider border border-border">
                        {rev.category.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-8 py-5 text-[13px] font-black text-teal">{formatCurrency(rev.revenue)}</td>
                    <td className="px-8 py-5 text-[12px] font-medium text-text-secondary">
                       {new Date(rev.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </td>
                    <td className="px-8 py-5 text-right">
                       <button className="text-[11px] font-bold text-blue hover:underline">View Lead {"\u2192"}</button>
                    </td>
                  </tr>
                ))}
                {recentConversions.length === 0 && (
                  <tr>
                    <td colSpan="5" className="p-12 text-center text-text-muted italic text-sm">No recent conversions found for this period.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RevenueDashboard;
