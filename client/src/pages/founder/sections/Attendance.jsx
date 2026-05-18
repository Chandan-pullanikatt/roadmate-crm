import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import DashboardSkeleton from '../../../components/skeletons/DashboardSkeleton';
import { dashboardApi } from '../../../api/dashboardApi';
import { configApi } from '../../../api/configApi';
import { Button, Tag } from '../../../components/ui';
import { exportToCSV } from '../../../utils/exportUtils';

const Attendance = () => {
  const queryClient = useQueryClient();
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  const [roleFilter, setRoleFilter] = useState('All');

  // Fetch Attendance Summary
  const { data: attendanceSummary, isLoading: loadingAttendance } = useQuery({
    queryKey: ['attendance-summary', month, year, roleFilter],
    queryFn: () => dashboardApi.getAttendanceSummary({
      month,
      year,
      role: roleFilter === 'All' ? undefined : roleFilter
    }).then(res => res.data),
    staleTime: 5 * 60 * 1000,
    placeholderData: keepPreviousData
  });

  const { data: workingHoursConfig } = useQuery({
    queryKey: ['config', 'working-hours'],
    queryFn: () => configApi.getConfig('working-hours').then(res => res.data?.value || {}),
    staleTime: 10 * 60 * 1000
  });

  // Fetch Salary Data
  const { data: salaryData, isLoading: loadingSalary } = useQuery({
    queryKey: ['salary-report', month, year, roleFilter],
    queryFn: () => dashboardApi.getReport('salary', { 
      month, 
      year 
    }).then(res => res.data),
    staleTime: 5 * 60 * 1000,
    placeholderData: keepPreviousData
  });

  // Run Payroll Mutation
  const payrollMutation = useMutation({
    mutationFn: (data) => dashboardApi.generateSalary(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['salary-report']);
      alert('Payroll generated successfully!');
    }
  });

  const handleRunPayroll = () => {
    if (window.confirm(`Are you sure you want to run payroll for ${getMonthName(month)} ${year}?`)) {
      payrollMutation.mutate({ month, year });
    }
  };

  const handleExportAttendance = () => {
    if (!attendanceSummary) return;
    const exportData = attendanceSummary.map(item => ({
      Staff: item.user?.name,
      Role: item.user?.role?.replace('_', ' '),
      Present: item.present,
      Absent: item.absent || 0,
      'Half Day': item.halfDay || 0,
      Leave: item.leave || 0,
      'Work %': (item.avgWorkPct || 0) + '%',
    }));
    exportToCSV(exportData, `Attendance_${getMonthName(month)}_${year}`);
  };

  const handleExportSalary = () => {
    if (!salaryData?.data) return;
    const exportData = salaryData.data.map(item => ({
      Staff: item.user?.name,
      Role: item.user?.role?.replace('_', ' '),
      'Base Salary': item.baseSalary,
      'Working Days': item.workingDays,
      'Leaves': item.leaveDays || 0,
      'Deductions': item.deductions || 0,
      'Incentives': item.incentives || 0,
      'Net Salary': item.netSalary
    }));
    exportToCSV(exportData, `Salary_Sheet_${getMonthName(month)}_${year}`);
  };

  React.useEffect(() => {
    const handleRefresh = () => {
      queryClient.invalidateQueries({ queryKey: ['attendance-summary'] });
      queryClient.invalidateQueries({ queryKey: ['salary-report'] });
    };
    window.addEventListener('refresh-attendance', handleRefresh);
    return () => window.removeEventListener('refresh-attendance', handleRefresh);
  }, [queryClient]);

  const getMonthName = (m) => {
    return new Date(2000, m - 1, 1).toLocaleString('default', { month: 'long' });
  };

  const getRoleLabel = (role) => {
    if (role === 'state_manager') return 'State Mgr';
    if (role === 'industry_manager') return 'Ind. Mgr';
    if (role === 'executive') return 'Executive';
    return role;
  };

  if (loadingAttendance || loadingSalary) return <DashboardSkeleton />;

  return (
    <div className="animate-in fade-in duration-500 space-y-8 pb-20">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Attendance</h1>
          <p className="text-sm text-text-muted mt-1">Attendance register · Work %, half-days, salary</p>
        </div>
        <div className="flex items-center gap-3">
             <button className="bg-[#0f766e] text-white px-6 py-2 rounded-xl font-bold text-sm shadow-sm" onClick={() => window.dispatchEvent(new CustomEvent('open-modal', { detail: 'add-lead' }))}>+ Add Lead</button>
             <button className="bg-white border border-border text-text-primary px-6 py-2 rounded-xl font-bold text-sm" onClick={() => window.dispatchEvent(new CustomEvent('open-modal', { detail: 'create-state-manager' }))}>+ State Manager</button>
        </div>
      </div>

      {/* Attendance Register Section */}
      <div className="bg-white rounded-2xl shadow-sm border border-border overflow-hidden">
        <div className="p-6 border-b border-border flex justify-between items-center">
          <div>
            <h2 className="text-lg font-bold text-text-primary">Attendance</h2>
            <p className="text-xs text-text-muted mt-0.5">All staff attendance {"\u00B7"} Work %, half-days, leaves {"\u00B7"} Auto-calculated</p>
          </div>
          <div className="flex gap-3">
             <select 
               className="bg-white border border-border rounded-lg px-4 py-1.5 text-xs font-bold text-text-secondary outline-none"
               value={month}
               onChange={e => setMonth(Number(e.target.value))}
             >
               {[1,2,3,4,5,6,7,8,9,10,11,12].map(m => (
                 <option key={m} value={m}>{getMonthName(m)} {year}</option>
               ))}
             </select>
             <select
               className="bg-white border border-border rounded-lg px-4 py-1.5 text-xs font-bold text-text-secondary outline-none"
               value={roleFilter}
               onChange={e => setRoleFilter(e.target.value)}
             >
               <option value="All">All Roles</option>
               <option value="state_manager">State Manager</option>
               <option value="industry_manager">Industry Manager</option>
               <option value="executive">Executive</option>
             </select>
             <Button variant="outline" size="sm" className="bg-white font-bold" onClick={handleExportAttendance}>Export</Button>
          </div>
        </div>

        <div className="p-6">
          {/* Working Hours Banner */}
          <div className="bg-[#f0fdf4] border border-[#dcfce7] rounded-xl p-4 flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center text-[#166534] shadow-sm">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
              </div>
              <span className="text-[13px] font-bold text-[#166534]">Working Hours Configuration</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="bg-[#dcfce7] text-[#166534] px-3 py-1 rounded-full text-[11px] font-bold border border-[#bbf7d0]">Normal: {workingHoursConfig?.normalStart || '9:30 AM'}</span>
              <span className="bg-[#eff6ff] text-[#1e40af] px-3 py-1 rounded-full text-[11px] font-bold border border-[#dbeafe]">Ramadan: {workingHoursConfig?.ramadanStart || '9:00 AM'}</span>
              <button className="bg-white border border-border px-4 py-1 rounded-lg text-[11px] font-bold ml-2 hover:bg-surface2 transition-all" onClick={() => window.dispatchEvent(new CustomEvent('open-modal', { detail: 'work-time' }))}>Edit</button>
              <span className="text-[10px] text-text-muted ml-4">Below {workingHoursConfig?.rules?.leaveThreshold ?? 30}% work → Leave | Below {workingHoursConfig?.rules?.halfDayThreshold ?? 70}% → Half Day</span>
            </div>
          </div>

          <div className="border border-border rounded-xl overflow-hidden table-responsive">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-surface2/30 border-b border-border">
                  <th className="p-4 text-[10px] font-bold uppercase tracking-widest text-text-muted">Staff</th>
                  <th className="p-4 text-[10px] font-bold uppercase tracking-widest text-text-muted text-center">Present</th>
                  <th className="p-4 text-[10px] font-bold uppercase tracking-widest text-text-muted text-center">Absent</th>
                  <th className="p-4 text-[10px] font-bold uppercase tracking-widest text-text-muted text-center">Half Day</th>
                  <th className="p-4 text-[10px] font-bold uppercase tracking-widest text-text-muted text-center">Leave</th>
                  <th className="p-4 text-[10px] font-bold uppercase tracking-widest text-text-muted text-center">WFH</th>
                  <th className="p-4 text-[10px] font-bold uppercase tracking-widest text-text-muted text-center">Late (min)</th>
                  <th className="p-4 text-[10px] font-bold uppercase tracking-widest text-text-muted text-center">Early Exit</th>
                  <th className="p-4 text-[10px] font-bold uppercase tracking-widest text-text-muted">Work %</th>
                  <th className="p-4 text-[10px] font-bold uppercase tracking-widest text-text-muted">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {attendanceSummary?.map((row, idx) => (
                  <tr key={idx} className="hover:bg-surface2/20 transition-colors">
                    <td className="p-4">
                      <div className="font-bold text-[14px] text-text-primary">{row.user?.name ?? 'Unknown'}</div>
                      <div className="text-[11px] text-text-muted">{getRoleLabel(row.user?.role)}</div>
                    </td>
                    <td className="p-4 text-center font-bold text-[13px] text-text-secondary">{row.present}</td>
                    <td className="p-4 text-center font-bold text-[13px] text-red">{row.absent || '0'}</td>
                    <td className="p-4 text-center font-bold text-[13px] text-orange">{row.halfDay || '0'}</td>
                    <td className="p-4 text-center font-bold text-[13px] text-blue">{row.leave || '0'}</td>
                    <td className="p-4 text-center">
                      {row.wfhDays > 0
                        ? <span className="px-2 py-0.5 bg-blue/10 text-blue rounded-full text-[10px] font-bold">{row.wfhDays}d</span>
                        : <span className="text-[11px] text-text-muted">—</span>}
                    </td>
                    <td className="p-4 text-center">
                      {(row.avgLateMinutes || 0) > 0
                        ? <span className="text-[12px] font-bold text-orange">{Math.round(row.avgLateMinutes)}m</span>
                        : <span className="text-[11px] text-text-muted">—</span>}
                    </td>
                    <td className="p-4 text-center">
                      {(row.avgEarlyExitMinutes || 0) > 0
                        ? <span className="text-[12px] font-bold text-red">{Math.round(row.avgEarlyExitMinutes)}m</span>
                        : <span className="text-[11px] text-text-muted">—</span>}
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="flex-1 h-1.5 bg-surface2 rounded-full overflow-hidden max-w-[80px]">
                          <div 
                            className={`h-full rounded-full ${row.avgWorkPct > 80 ? 'bg-[#0f766e]' : row.avgWorkPct > 50 ? 'bg-orange' : 'bg-red'}`} 
                            style={{ width: `${row.avgWorkPct}%` }}
                          ></div>
                        </div>
                        <span className="text-[12px] font-bold">{Math.round(row.avgWorkPct)}%</span>
                      </div>
                    </td>
                    <td className="p-4">
                      <Tag variant={row.avgWorkPct > 80 ? 'success' : row.avgWorkPct > 50 ? 'warning' : 'danger'} size="sm">
                        {row.avgWorkPct > 80 ? 'Active' : row.avgWorkPct > 50 ? 'Half Day' : 'Inactive'}
                      </Tag>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Salary Section */}
      <div className="bg-white rounded-2xl shadow-sm border border-border overflow-hidden">
        <div className="p-6 border-b border-border flex justify-between items-center">
          <div>
            <h2 className="text-lg font-bold text-text-primary">Auto Salary Calculation</h2>
            <p className="text-xs text-text-muted mt-0.5">Basic salary + working days + leaves + incentives</p>
          </div>
          <Button 
            className="bg-[#0f766e] text-white px-8 font-bold" 
            onClick={handleRunPayroll}
            isLoading={payrollMutation.isPending}
          >
            Run Payroll
          </Button>
        </div>

        <div className="p-6">
          <div className="border border-border rounded-xl overflow-hidden table-responsive">
            <div className="p-4 bg-surface2/30 border-b border-border flex justify-between items-center">
               <h3 className="text-sm font-bold text-text-primary">Salary Sheet {"\u2014"} {getMonthName(month)} {year}</h3>
               <div className="flex gap-2">
                 <span className="bg-orange-light text-orange px-3 py-1 rounded-full text-[10px] font-bold border border-orange/20">Incentive correction: Manual</span>
                 <Button variant="outline" size="xs" className="bg-white" onClick={handleExportSalary}>Export</Button>
               </div>
            </div>
            <table className="w-full text-left">
              <thead>
                <tr className="bg-surface2/10 border-b border-border">
                  <th className="p-4 text-[10px] font-bold uppercase tracking-widest text-text-muted">Staff</th>
                  <th className="p-4 text-[10px] font-bold uppercase tracking-widest text-text-muted">Basic</th>
                  <th className="p-4 text-[10px] font-bold uppercase tracking-widest text-text-muted text-center">Working Days</th>
                  <th className="p-4 text-[10px] font-bold uppercase tracking-widest text-text-muted text-center">Leaves</th>
                  <th className="p-4 text-[10px] font-bold uppercase tracking-widest text-text-muted text-center">Deductions</th>
                  <th className="p-4 text-[10px] font-bold uppercase tracking-widest text-text-muted text-center">Incentives</th>
                  <th className="p-4 text-[10px] font-bold uppercase tracking-widest text-text-muted text-center">Net Pay</th>
                  <th className="p-4 text-[10px] font-bold uppercase tracking-widest text-text-muted text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {salaryData?.data?.map((row, idx) => (
                  <tr key={idx} className="hover:bg-surface2/20 transition-colors">
                    <td className="p-4">
                      <div className="font-bold text-[14px] text-text-primary">{row.user?.name ?? 'Unknown'}</div>
                      <div className="text-[11px] text-text-muted">{getRoleLabel(row.user?.role)}</div>
                    </td>
                    <td className="p-4 font-medium text-[13px]">{"\u20B9"}{row.baseSalary?.toLocaleString()}</td>
                    <td className="p-4 text-center font-medium text-[13px]">{row.workingDays}</td>
                    <td className="p-4 text-center font-medium text-[13px] text-blue">{row.leaveDays || '0'}</td>
                    <td className="p-4 text-center font-medium text-[13px] text-red">-{row.deductions > 0 ? `\u20B9${row.deductions.toLocaleString()}` : '\u20B90'}</td>
                    <td className="p-4 text-center font-medium text-[13px] text-[#0f766e]">+{row.incentives > 0 ? `\u20B9${row.incentives.toLocaleString()}` : '\u20B90'}</td>
                    <td className="p-4 text-center font-bold text-[14px] text-text-primary">{"\u20B9"}{row.netSalary?.toLocaleString()}</td>
                    <td className="p-4 text-right">
                      <button 
                        className="bg-white border border-border text-text-secondary px-3 py-1 rounded-lg text-[11px] font-bold hover:bg-surface2 transition-all"
                        onClick={() => window.dispatchEvent(new CustomEvent('open-modal', { detail: { type: 'edit-incentive', salaryId: row._id } }))}
                      >
                        Edit Incentive
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Attendance;
