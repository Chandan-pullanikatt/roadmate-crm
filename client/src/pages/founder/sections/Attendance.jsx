import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { attendanceApi } from '../../../api/attendanceApi';
import { dashboardApi } from '../../../api/dashboardApi';
import { Avatar, Button, Tag, DataTable } from '../../../components/ui';

const Attendance = () => {
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [filterRole, setFilterRole] = useState('All');

  const { data: dashData } = useQuery({
    queryKey: ['dashboard', 'founder'],
    queryFn: () => dashboardApi.getFounderDashboard().then(res => res.data)
  });

  const { data: attendanceRecords, isLoading } = useQuery({
    queryKey: ['attendance', 'global', selectedMonth, selectedYear, filterRole],
    queryFn: () => attendanceApi.getTeamAttendance(new Date().toISOString().split('T')[0]).then(res => res.data)
  });

  if (isLoading) return <div className="p-8 text-center text-text-muted">Syncing enterprise attendance...</div>;

  const stats = dashData?.stats || {};
  const records = attendanceRecords || [];

  const columns = [
    {
      header: 'Staff Member',
      accessor: 'user.name',
      render: (val, row) => (
        <div className="flex items-center gap-3">
          <Avatar name={val} size="sm" />
          <div>
            <div className="font-bold text-[13px]">{val}</div>
            <div className="text-[10px] text-text-muted uppercase">{row.user?.role?.replace('-', ' ')}</div>
          </div>
        </div>
      )
    },
    { header: 'Check In', accessor: 'startTime', render: (val) => <span className="mono text-[11px] font-bold">{val || '--:--'}</span> },
    { 
      header: 'Status', 
      accessor: 'status', 
      render: (val) => <Tag variant={val === 'present' ? 'green' : val === 'half-day' ? 'amber' : 'red'} label={val?.toUpperCase()} /> 
    },
    { 
      header: 'Work %', 
      accessor: 'workPercentage', 
      render: (val) => (
        <div className="flex items-center gap-3">
          <div className="h-1.2 w-12 bg-surface2 rounded-full overflow-hidden border border-border">
            <div className={`h-full ${val >= 80 ? 'bg-accent' : 'bg-amber'}`} style={{ width: `${val || 0}%` }}></div>
          </div>
          <span className="text-[10px] mono font-bold">{val || 0}%</span>
        </div>
      ) 
    },
    { header: 'Efficiency', accessor: 'completionPct', render: (val) => <span className="mono text-[11px] font-bold text-blue">{val || 0}%</span> },
    { header: 'State', accessor: 'user.state', render: (val) => <Tag variant="gray" label={val} /> }
  ];

  return (
    <div className="animate-in fade-in duration-500">
      <div className="section-header">
        <div>
          <div className="section-title">Enterprise Attendance</div>
          <div className="section-sub">Cross-state staff monitoring · Real-time presence · Automated work logging</div>
        </div>
        <div className="flex gap-2">
           <select 
             className="bg-surface border border-border rounded-lg px-4 py-1.5 text-xs outline-none focus:border-purple"
             value={selectedMonth}
             onChange={e => setSelectedMonth(parseInt(e.target.value))}
           >
             {Array.from({ length: 12 }).map((_, i) => (
               <option key={i} value={i}>{new Date(0, i).toLocaleString('default', { month: 'long' })}</option>
             ))}
           </select>
           <select 
             className="bg-surface border border-border rounded-lg px-4 py-1.5 text-xs outline-none focus:border-purple"
             value={filterRole}
             onChange={e => setFilterRole(e.target.value)}
           >
             <option value="All">All Roles</option>
             <option value="state-manager">State Managers</option>
             <option value="industry-manager">Industry Managers</option>
             <option value="executive">Executives</option>
           </select>
           <Button variant="outline" size="sm">Export Master CSV</Button>
        </div>
      </div>

      <div className="stat-grid mb-6">
        <div className="stat-card">
          <div className="stat-label">Total Staff</div>
          <div className="stat-value text-blue">{stats.totalStaff || 0}</div>
          <div className="stat-delta">Across all regions</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Present Today</div>
          <div className="stat-value text-accent">{stats.todayAttendance || 0}</div>
          <div className="stat-delta">Currently active</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">On Leave</div>
          <div className="stat-value text-red">{stats.onLeaveCount || 0}</div>
          <div className="stat-delta">Approved absences</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Avg Work %</div>
          <div className="stat-value text-teal">{stats.attendancePct || 0}%</div>
          <div className="stat-delta">Global efficiency</div>
        </div>
      </div>

      <div className="card mb-8">
        <div className="card-header border-b border-border bg-surface2/10">
          <div className="section-title text-sm">Attendance Register · {new Date(selectedYear, selectedMonth).toLocaleString('default', { month: 'long', year: 'numeric' })}</div>
        </div>
        <DataTable columns={columns} data={records} />
      </div>

      <div className="section-header">
        <div>
          <div className="section-title">Automated Payroll Preview</div>
          <div className="section-sub">Real-time salary calculation based on attendance & efficiency</div>
        </div>
        <Button className="bg-purple text-white" size="sm">Run Monthly Payroll</Button>
      </div>

      <div className="card">
         <div className="p-8 text-center text-text-muted text-xs italic">
            Payroll generation is triggered on the 1st of every month. The preview above shows real-time data from the Attendance Register.
         </div>
         <DataTable 
           columns={[
             { header: 'Staff', accessor: 'user.name' },
             { header: 'Basic', accessor: 'user.salary', render: (val) => <span className="mono">₹{val?.toLocaleString() || '0'}</span> },
             { header: 'Working Days', accessor: 'presentCount', render: () => <span className="mono">22</span> },
             { header: 'Leaves', accessor: 'leaveCount', render: () => <span className="mono text-red">2</span> },
             { header: 'Incentives', accessor: 'incentives', render: () => <span className="mono text-accent">+₹2,500</span> },
             { header: 'Net Pay', accessor: 'netPay', render: () => <span className="mono font-bold text-accent">₹24,500</span> },
             { header: 'Action', accessor: '_id', render: () => <Button size="xs" variant="outline">Adjust</Button>, align: 'right' }
           ]}
           data={records.slice(0, 3)}
         />
      </div>
    </div>
  );
};

export default Attendance;
