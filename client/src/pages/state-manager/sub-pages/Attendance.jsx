import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { attendanceApi } from '../../../api/attendanceApi';
import { dashboardApi } from '../../../api/dashboardApi';
import { Avatar, Button, Tag, DataTable } from '../../../components/ui';

const Attendance = () => {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

  const { data: dashData } = useQuery({
    queryKey: ['dashboard', 'state-manager'],
    queryFn: () => dashboardApi.getStateManagerDashboard().then(res => res.data)
  });

  const { data: attendanceRecords, isLoading } = useQuery({
    queryKey: ['attendance', 'state-team', selectedDate],
    queryFn: () => attendanceApi.getTeamAttendance(selectedDate).then(res => res.data)
  });

  const stats = dashData?.stats || {};

  const columns = [
    {
      header: 'Member Name',
      accessor: 'user.name',
      render: (val, row) => (
        <div className="flex items-center gap-3">
          <Avatar name={val} size="sm" />
          <span className="font-bold text-[14px]">{val}</span>
        </div>
      )
    },
    { header: 'Role', accessor: 'user.role', render: (val) => <span className="text-[12px] text-text-muted font-medium uppercase tracking-tight">{val?.replace('-', ' ')}</span> },
    { 
      header: 'Status', 
      accessor: 'status', 
      render: (val) => <Tag variant={val === 'present' ? 'green' : val === 'half-day' ? 'amber' : 'red'} label={val?.toUpperCase()} /> 
    },
    { header: 'Punch In', accessor: 'startTime', render: (val) => <span className="mono text-[11px] font-bold">{val || '--:--'}</span> },
    { 
      header: 'Daily Work %', 
      accessor: 'workPercentage', 
      render: (val) => (
        <div className="flex items-center gap-3">
          <div className="h-1.5 w-20 bg-surface2 rounded-full overflow-hidden border border-border">
            <div className="h-full bg-blue transition-all" style={{ width: `${val || 0}%` }}></div>
          </div>
          <span className="text-[11px] mono font-bold">{val || 0}%</span>
        </div>
      ) 
    },
    { header: 'Efficiency', accessor: 'completionPct', render: (val) => <span className="mono text-[11px] font-bold text-blue">{val || 0}%</span> }
  ];

  const handleExport = () => {
    if (!attendanceRecords || attendanceRecords.length === 0) return;
    const headers = "Name,Role,Status,CheckIn,WorkPct\n";
    const rows = attendanceRecords.map(a => 
      `${a.user?.name},${a.user?.role},${a.status},${a.startTime},${a.workPercentage}%`
    ).join('\n');
    const blob = new Blob([headers + rows], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Attendance_${selectedDate}.csv`;
    a.click();
  };

  return (
    <div className="animate-in fade-in duration-500">
      <div className="section-header">
        <div>
          <div className="section-title">Team Attendance Register</div>
          <div className="section-sub">Daily work percentages and presence monitoring for {dashData?.user?.state}</div>
        </div>
        <div className="flex gap-2">
           <input 
             type="date" 
             className="bg-surface border border-border rounded-lg px-3 py-1.5 text-xs outline-none focus:border-purple"
             value={selectedDate}
             onChange={e => setSelectedDate(e.target.value)}
           />
           <Button variant="outline" size="sm" onClick={handleExport}>Export CSV</Button>
        </div>
      </div>

      <div className="stat-grid mb-6">
        <div className="stat-card">
          <div className="stat-label">Present Today</div>
          <div className="stat-value" style={{ color: 'var(--accent)' }}>{stats.todayAttendance || 0}</div>
          <div className="stat-delta">of {stats.totalExecutives + stats.totalIndustries || 0} total staff</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">On Leave Today</div>
          <div className="stat-value" style={{ color: 'var(--red)' }}>{stats.onLeaveToday || 0}</div>
          <div className="stat-delta">Approved leaves</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Avg Attendance %</div>
          <div className="stat-value" style={{ color: 'var(--blue)' }}>{stats.attendancePct || 0}%</div>
          <div className="stat-delta text-blue">↑ State average</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Work Flag (Half)</div>
          <div className="stat-value" style={{ color: 'var(--amber)' }}>{stats.pendingLeaves || 0}</div>
          <div className="stat-delta">Work below 70%</div>
        </div>
      </div>

      <div className="card">
        <div className="card-header border-b border-border bg-surface2/10">
          <div className="section-title text-sm">Attendance List · {new Date(selectedDate).toLocaleDateString()}</div>
        </div>
        
        <DataTable 
          columns={columns}
          data={attendanceRecords || []}
          isLoading={isLoading}
          emptyMessage="No attendance records for this date"
        />
      </div>
    </div>
  );
};

export default Attendance;
