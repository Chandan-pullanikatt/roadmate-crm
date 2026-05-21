import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { attendanceApi } from '../../../api/attendanceApi';
import { usersApi } from '../../../api/usersApi';
import { dashboardApi } from '../../../api/dashboardApi';
import { Button, Modal, Avatar, Tag, StatCard, DashboardSkeleton } from '../../../components/ui';
import { useToast } from '../../../context/ToastContext';

const Attendance = () => {
  const queryClient = useQueryClient();
  const { addToast } = useToast();
  const [viewType, setViewType] = useState('Today');
  const [viewDate, setViewDate] = useState(new Date());
  const [searchTerm, setSearchTerm] = useState('');

  const month = viewDate.getMonth() + 1;
  const year = viewDate.getFullYear();

  // 1. Get Dashboard Stats
  const { data: dashData, isLoading: dashLoading } = useQuery({
    queryKey: ['dashboard', 'industry-manager'],
    queryFn: () => dashboardApi.getIndustryManagerDashboard().then(res => res.data),
    staleTime: 5 * 60 * 1000,
    placeholderData: (prev) => prev
  });

  // 2. Get Executives Performance (for the table)
  const { data: performanceData, isLoading: perfLoading } = useQuery({
    queryKey: ['dashboard', 'performance', month, year],
    queryFn: () => dashboardApi.getIndustryManagerDashboard().then(res => res.data.executivePerformance),
    staleTime: 5 * 60 * 1000,
    placeholderData: (prev) => prev
  });

  const allExecutives = performanceData || [];
  const stats = dashData?.stats || {};
  const userInfo = dashData?.user || {};

  const executives = useMemo(() => {
    if (!searchTerm.trim()) return allExecutives;
    const q = searchTerm.toLowerCase();
    return allExecutives.filter(e =>
      e.name?.toLowerCase().includes(q) ||
      e.district?.toLowerCase().includes(q)
    );
  }, [allExecutives, searchTerm]);

  const getInitials = (name) => name?.split(' ').map(n => n[0]).join('').toUpperCase() || 'U';

  const exportRegister = () => {
    addToast("Exporting attendance register...", "success");
  };

  if ((dashLoading || perfLoading) && !dashData) return <DashboardSkeleton />;

  return (
    <div className="space-y-6 animate-in fade-in duration-700 pb-12">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Attendance</h1>
          <p className="text-sm text-text-muted">Work %, leaves, salary - All executives</p>
        </div>
        <div className="flex items-center gap-3">
            <div className="relative">
                <input
                    type="text"
                    placeholder="Search leads, executives..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="pl-10 pr-4 py-2 bg-surface2 border border-border rounded-xl text-[11px] font-bold focus:ring-2 focus:ring-purple/20 transition-all outline-none min-w-[280px]"
                />
                <span className="absolute left-3 top-1/2 -translate-y-1/2 opacity-40 text-sm">🔍</span>
            </div>
            <button className="w-10 h-10 rounded-xl bg-surface2 border border-border flex items-center justify-center hover:bg-surface3 transition-colors relative">
                <span className="text-lg">🔔</span>
            </button>
            <Avatar name={userInfo.name} size="md" className="border-2 border-purple/10" />
        </div>
      </div>

      {/* Sub Header Card */}
      <div className="bg-surface1 border border-border/40 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm">
        <div>
          <h2 className="text-lg font-bold">Attendance · {userInfo.industry} Team</h2>
          <p className="text-xs text-text-muted">All {executives.length} district executives · Work %, leaves, salary</p>
        </div>
        <div className="flex gap-2">
            <Button variant="outline" className="rounded-xl h-10 px-5 font-bold border-border/60 text-[11px] uppercase tracking-widest" onClick={exportRegister}>
                Export
            </Button>
        </div>
      </div>

      {/* 4 Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="card p-6 border-l-4 border-green shadow-sm hover:shadow-md transition-shadow">
            <div className="text-[10px] font-bold text-text-muted uppercase tracking-widest mb-3">Present Today</div>
            <div className="text-2xl font-black text-text-primary">{stats.activeToday || 0}</div>
            <div className="mt-2 text-[10px] font-bold text-text-muted italic">
                of {executives.length} total
            </div>
        </div>

        <div className="card p-6 border-l-4 border-amber shadow-sm hover:shadow-md transition-shadow">
            <div className="text-[10px] font-bold text-text-muted uppercase tracking-widest mb-3">Half Day</div>
            <div className="text-2xl font-black text-text-primary">{stats.halfDayToday || 1}</div>
            <div className="mt-2 text-[10px] font-bold text-text-muted">
                Work % <span className="text-amber">52</span>
            </div>
        </div>

        <div className="card p-6 border-l-4 border-blue shadow-sm hover:shadow-md transition-shadow">
            <div className="text-[10px] font-bold text-text-muted uppercase tracking-widest mb-3">Avg Attendance %</div>
            <div className="text-2xl font-black text-blue">{stats.avgWorkPct || 94}%</div>
            <div className="mt-2 text-[10px] font-bold text-text-muted">
                <span className="text-blue">↑</span> This month
            </div>
        </div>

        <div className="card p-6 border-l-4 border-purple shadow-sm hover:shadow-md transition-shadow">
            <div className="text-[10px] font-bold text-text-muted uppercase tracking-widest mb-3">Working Hours</div>
            <div className="text-xl font-black text-purple">9:30 AM – 6:30 PM</div>
            <div className="mt-2 text-[10px] font-bold text-text-muted uppercase tracking-tighter">
                Standard working hours
            </div>
        </div>
      </div>

      {/* Attendance Register Section */}
      <div className="card shadow-lg shadow-purple/5 border-border/40 overflow-hidden">
        <div className="card-header border-none px-8 pt-8 pb-4 flex flex-col sm:flex-row justify-between items-center gap-4">
           <h3 className="text-sm font-black uppercase tracking-widest text-text-muted">Attendance Register</h3>
           <div className="flex bg-surface2 p-1 rounded-xl border border-border/40 shadow-sm">
                {['Today', 'This Week', 'This Month'].map(tab => (
                    <button 
                        key={tab}
                        onClick={() => setViewType(tab)}
                        className={`px-4 py-2 text-[10px] font-black rounded-lg transition-all uppercase tracking-widest ${viewType === tab ? 'bg-white shadow-sm text-purple' : 'text-text-muted hover:text-text-primary'}`}
                    >{tab}</button>
                ))}
            </div>
        </div>

        <div className="p-0 overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[1000px]">
            <thead>
              <tr className="bg-surface2/30 text-[9px] font-black text-text-muted uppercase tracking-widest border-y border-border/40">
                <th className="px-8 py-4">Name</th>
                <th className="px-6 py-4">District</th>
                <th className="px-6 py-4 text-center">Status</th>
                <th className="px-6 py-4 text-center">In Time</th>
                <th className="px-6 py-4 text-center">WFH</th>
                <th className="px-6 py-4 text-center">Late</th>
                <th className="px-6 py-4">Work %</th>
                <th className="px-6 py-4 text-center">Leads Done</th>
                <th className="px-6 py-4 text-center">Attendance %</th>
                <th className="px-6 py-4 text-right pr-8">Salary Preview</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {executives.map((exec, idx) => (
                <tr key={exec._id || idx} className="hover:bg-purple-light/10 transition-colors group">
                  <td className="px-8 py-4">
                    <div className="flex items-center gap-3">
                       <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-black text-white av-${idx % 5} shadow-sm`}>
                          {getInitials(exec.name)}
                       </div>
                       <span className="text-xs font-black text-text-primary group-hover:text-purple transition-colors">{exec.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-[10px] font-bold text-text-secondary uppercase tracking-tight">{exec.district}</span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <Tag 
                        variant={exec.completionPct >= 60 ? 'green' : 'amber'} 
                        label={exec.completionPct >= 60 ? 'Present' : 'Half Day'} 
                        className="text-[9px] font-black px-3 py-1 rounded-lg uppercase tracking-tighter"
                    />
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className="text-[10px] font-black text-text-primary">
                      {exec.loginTime || '9:30 AM'}
                      {exec.isLateLogin && <span className="ml-1 text-orange text-[9px]">▲</span>}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    {exec.isWFH
                      ? <span className="px-2 py-0.5 bg-blue/10 text-blue rounded-full text-[9px] font-bold">WFH</span>
                      : <span className="text-[10px] text-text-muted">Office</span>}
                  </td>
                  <td className="px-6 py-4 text-center">
                    {(exec.lateLoginMinutes || 0) > 0
                      ? <span className="text-[10px] font-bold text-orange">{exec.lateLoginMinutes}m</span>
                      : <span className="text-[10px] text-text-muted">—</span>}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                        <div className="w-16 h-1.5 bg-surface2 rounded-full overflow-hidden border border-border/40">
                            <div 
                                className={`h-full rounded-full transition-all duration-1000 ${exec.completionPct >= 70 ? 'bg-green' : exec.completionPct >= 30 ? 'bg-amber' : 'bg-red'}`} 
                                style={{ width: `${exec.completionPct}%` }} 
                            />
                        </div>
                        <span className="text-[10px] font-black text-text-primary">{exec.completionPct}%</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className="text-[11px] font-black text-text-primary">{exec.calls || 0}</span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className="text-[11px] font-black text-text-primary">{exec.completionPct}%</span>
                  </td>
                  <td className="px-6 py-4 text-right pr-8">
                    <Tag 
                        variant={exec.completionPct >= 60 ? 'green' : 'amber'} 
                        label={exec.completionPct >= 60 ? 'Full' : '½ Day'} 
                        className="text-[9px] font-black px-3 py-1 rounded-lg uppercase tracking-tighter"
                    />
                  </td>
                </tr>
              ))}
              {executives.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-8 py-16 text-center text-text-muted italic">No executives found</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Attendance;
