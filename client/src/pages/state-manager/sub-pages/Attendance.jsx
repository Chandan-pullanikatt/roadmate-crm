import React, { useState } from 'react';
import { roleLabel } from '../../../utils/roleLabel';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import DashboardSkeleton from '../../../components/skeletons/DashboardSkeleton';
import { attendanceApi } from '../../../api/attendanceApi';
import { dashboardApi } from '../../../api/dashboardApi';
import { Avatar, Button, Tag } from '../../../components/ui';

const Attendance = () => {
  const [period, setPeriod] = useState('Today');

  const { data: dashData } = useQuery({
    queryKey: ['dashboard', 'state-manager'],
    queryFn: () => dashboardApi.getStateManagerDashboard().then(res => res.data),
    staleTime: 5 * 60 * 1000,
    placeholderData: keepPreviousData
  });

  // Tab label -> what the /attendance/team endpoint expects. Anything not a
  // named period falls back to a single day.
  const PERIOD_TABS = ['Today', 'This Week', 'This Month', 'This Year'];
  const PERIOD_PARAMS = {
    'This Week': { period: 'week' },
    'This Month': { period: 'month' },
    'This Year': { period: 'year' },
  };
  const periodParam = PERIOD_PARAMS[period] || { date: new Date().toISOString().split('T')[0] };

  const { data: attendanceRecords, isLoading } = useQuery({
    queryKey: ['attendance', 'state-team', period],
    queryFn: () => attendanceApi.getTeamAttendance(periodParam).then(res => res.data),
    staleTime: 5 * 60 * 1000,
    placeholderData: keepPreviousData
  });

  const stats = dashData?.stats || {};
  const user = dashData?.user || {};
  const totalStaff = (stats.industryManagersCount || 0) + (stats.districtExecutivesCount || 0);

  const handleExport = () => {
    if (!attendanceRecords || attendanceRecords.length === 0) return;
    const headers = "Name,Role,Status,InTime,WorkPct,Leaves,AttendancePct\n";
    const rows = attendanceRecords.map(a => 
      `${a.user?.name},${a.user?.role},${a.status},${a.startTime || 'N/A'},${a.workPercentage}%,${a.leaveDays || 0},${a.completionPct}%`
    ).join('\n');
    const blob = new Blob([headers + rows], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Attendance_${user.state || 'Team'}_${period.replace(' ', '_')}_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  if (isLoading) return <DashboardSkeleton />;

  return (
    <div className="animate-in fade-in duration-500">
      {/* HEADER */}
      <div className="section-header mb-6">
        <div>
          <div className="section-title">Attendance · {user.state} Team</div>
          <div className="section-sub text-[13px]">All industry managers & district managers</div>
        </div>
        <Button variant="outline" size="sm" className="bg-white shadow-sm border-border text-text font-bold px-5" onClick={handleExport}>Export Report</Button>
      </div>

      {/* STAT CARDS */}
      <div className="stat-grid mb-8">
        <div className="stat-card border-l-4 border-green">
          <div className="stat-label">Present Today</div>
          <div className="stat-value text-green">{stats.presentToday || 0}</div>
          <div className="stat-delta text-text-muted">of {totalStaff} total staff</div>
        </div>
        <div className="stat-card border-l-4 border-red">
          <div className="stat-label">On Leave Today</div>
          <div className="stat-value text-red">{stats.onLeaveToday || 0}</div>
          <div className="stat-delta text-red font-medium">Approved leaves</div>
        </div>
        <div className="stat-card border-l-4 border-blue">
          <div className="stat-label">Avg Attendance %</div>
          <div className="stat-value text-blue">{stats.avgAttendanceMonth || 0}%</div>
          <div className="stat-delta text-blue font-bold">↑ 2% this month</div>
        </div>
        <div className="stat-card border-l-4 border-amber">
          <div className="stat-label">Half Days</div>
          <div className="stat-value text-amber">{stats.halfDaysThisWeek || 0}</div>
          <div className="stat-delta text-amber font-medium">This week</div>
        </div>
      </div>

      {/* REGISTER SECTION */}
      <div className="card">
        <div className="card-header border-b border-border bg-surface2/5 flex justify-between items-center px-6 py-4">
          <div className="section-title text-[15px]">Attendance Register</div>
          <div className="flex bg-surface2 p-1 rounded-lg border border-border">
             {PERIOD_TABS.map(t => (
               <button 
                 key={t} 
                 className={`px-4 py-1 text-[13px] font-bold uppercase rounded-md transition-all ${period === t ? 'bg-white shadow-sm text-blue' : 'text-text-muted hover:text-text'}`}
                 onClick={() => setPeriod(t)}
               >
                 {t}
               </button>
             ))}
          </div>
        </div>
        <div className="card-body p-0">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface2/30 text-[12px] uppercase font-black tracking-widest text-text-muted border-b border-border">
                <th className="px-6 py-4">Name</th>
                <th className="px-6 py-4">Role</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">In Time</th>
                <th className="px-6 py-4">Work From</th>
                <th className="px-6 py-4">Work %</th>
                <th className="px-6 py-4">Leaves</th>
                <th className="px-6 py-4">Attendance %</th>
              </tr>
            </thead>
            <tbody>
              {attendanceRecords?.map((r, idx) => (
                <tr key={r._id} className="border-b last:border-0 hover:bg-surface2 transition-all group">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <Avatar name={r.user?.name} size="sm" className={`av-${idx % 5}`} />
                      <span className="font-black text-[13px] tracking-tight">{r.user?.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-[13px] text-text-muted font-bold tracking-tight uppercase">{r.user?.industry || roleLabel(r.user?.role)}</span>
                  </td>
                  <td className="px-6 py-4">
                    <Tag 
                        variant={r.status === 'present' ? 'green' : r.status === 'leave' ? 'red' : 'amber'} 
                        label={r.status === 'present' ? 'Present' : r.status === 'leave' ? 'On Leave' : 'Absent'} 
                        className="font-black text-[9px] tracking-widest"
                    />
                  </td>
                  <td className="px-6 py-4">
                    <span className="mono text-[13px] font-black text-text-secondary">{r.startTime || '--:--'}</span>
                  </td>
                  <td className="px-6 py-4">
                    {r.isWFH
                      ? <span className="px-2 py-0.5 bg-orange/10 text-orange rounded-full text-[9px] font-black uppercase" title={r.wfhReason || ''}>WFH</span>
                      : <span className="text-[12px] text-text-muted">Office</span>}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3 min-w-[100px]">
                      <div className="h-1.5 flex-1 bg-surface2 rounded-full overflow-hidden border border-border/50">
                        <div className="h-full bg-blue shadow-sm" style={{ width: `${r.workPercentage || 0}%` }}></div>
                      </div>
                      <span className="text-[12px] mono font-black text-text-muted">{r.workPercentage || 0}%</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className="mono text-[14px] font-black text-text-secondary">{r.leaveDays || 0}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="mono text-[15px] font-black text-text-secondary">{r.completionPct || 0}%</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {isLoading && <div className="p-20 text-center text-text-muted italic">Compiling register data...</div>}
          {attendanceRecords?.length === 0 && !isLoading && <div className="p-20 text-center text-text-muted italic">No attendance activity recorded for this period.</div>}
        </div>
      </div>
    </div>
  );
};

export default Attendance;

