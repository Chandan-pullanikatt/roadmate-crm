import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import DashboardSkeleton from '../../../components/skeletons/DashboardSkeleton';
import { leaveApi } from '../../../api/leaveApi';
import { dashboardApi } from '../../../api/dashboardApi';
import { Avatar, Button, Tag } from '../../../components/ui';
import { useToast } from '../../../context/ToastContext';

const LeaveCalendar = () => {
  const queryClient = useQueryClient();
  const { addToast } = useToast();
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());

  const { data: dashData } = useQuery({
    queryKey: ['dashboard', 'founder'],
    queryFn: () => dashboardApi.getFounderDashboard().then(res => res.data),
    staleTime: 5 * 60 * 1000,
    placeholderData: keepPreviousData
  });

  const { data: teamLeaves, isLoading: leavesLoading } = useQuery({
    queryKey: ['leaves', 'global-team', currentMonth, currentYear],
    queryFn: () => leaveApi.getTeamLeaves(currentMonth + 1, currentYear).then(res => res.data),
    staleTime: 5 * 60 * 1000,
    placeholderData: keepPreviousData
  });

  const { data: pendingLeaves, isLoading: pendingLoading } = useQuery({
    queryKey: ['leaves', 'pending-global'],
    queryFn: () => leaveApi.getPendingLeaves().then(res => res.data),
    staleTime: 5 * 60 * 1000,
    placeholderData: keepPreviousData
  });

  const updateStatusMutation = useMutation({
    mutationFn: (data) => leaveApi.updateLeaveStatus(data.id, data.status, data.reason),
    onSuccess: () => {
      queryClient.invalidateQueries(['leaves']);
      addToast("Leave status updated", "success");
    }
  });

  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const firstDayOfMonth = new Date(currentYear, currentMonth, 1).getDay();
  const holidays = [14, 22, 28]; // Platform holidays

  if (leavesLoading || pendingLoading) return <DashboardSkeleton />;

  const stats = dashData?.stats || {};

  return (
    <div className="animate-in fade-in duration-500">
      <div className="section-header">
        <div>
          <div className="section-title">Leave & Policy Management</div>
          <div className="section-sub">Enterprise leave tracking · National holidays · Organizational policies</div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm">Mark National Holiday</Button>
          <Button className="bg-purple text-white" size="sm">Manage Policy</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="card">
          <div className="card-header border-b border-border bg-surface2/10 flex justify-between items-center">
            <div className="flex items-center gap-4">
              <Button size="xs" variant="outline" onClick={() => setCurrentMonth(m => m === 0 ? 11 : m - 1)}>&lt;</Button>
              <div className="section-title text-sm">{new Date(currentYear, currentMonth).toLocaleString('default', { month: 'long', year: 'numeric' })}</div>
              <Button size="xs" variant="outline" onClick={() => setCurrentMonth(m => m === 11 ? 0 : m + 1)}>&gt;</Button>
            </div>
            <div className="flex gap-3 text-[9px] font-bold uppercase tracking-tight">
               <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-red"></span> Holiday</span>
               <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-blue"></span> Leave</span>
            </div>
          </div>
          <div className="card-body">
            <div className="grid grid-cols-7 gap-1 text-center">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                <div key={d} className="text-[10px] font-bold text-text-muted py-2 uppercase tracking-wider">{d}</div>
              ))}
              {Array.from({ length: firstDayOfMonth }).map((_, i) => <div key={`b-${i}`} className="h-14"></div>)}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                 const day = i + 1;
                 const isToday = new Date().getDate() === day && new Date().getMonth() === currentMonth;
                 const isHoliday = holidays.includes(day);
                 const dayLeaves = teamLeaves?.filter(l => {
                    const start = new Date(l.startDate).getDate();
                    const end = new Date(l.endDate).getDate();
                    return day >= start && day <= end;
                 });

                 return (
                   <div key={day} className={`h-14 border border-border/30 rounded-xl flex flex-col items-center justify-center relative cursor-pointer hover:bg-surface2 transition-all group
                     ${isToday ? 'bg-purple text-white shadow-md' : ''}
                     ${isHoliday ? 'bg-red-light/20' : ''}
                   `}>
                     <span className="text-sm font-bold">{day}</span>
                     <div className="flex gap-0.5 mt-0.5">
                       {isHoliday && <span className="w-1 h-1 rounded-full bg-red"></span>}
                       {dayLeaves?.length > 0 && <span className="w-1 h-1 rounded-full bg-blue"></span>}
                     </div>
                   </div>
                 );
              })}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-6">
           <div className="card">
             <div className="card-header border-b border-border bg-surface2/10">
               <div className="section-title text-sm">Critical Pending Approvals</div>
               <Tag variant="amber" label={`${pendingLeaves?.length || 0} Requests`} />
             </div>
             <div className="divide-y divide-border max-h-[350px] overflow-y-auto">
               {pendingLeaves?.map(l => (
                 <div key={l._id} className="flex items-center gap-4 p-4 hover:bg-surface2 transition-colors">
                   <Avatar name={l.user?.name} size="sm" className="av-state" />
                   <div className="flex-1 min-w-0">
                     <div className="text-[13px] font-bold">{l.user?.name}</div>
                     <div className="text-[10px] text-text-muted capitalize">{l.user?.role?.replace('-', ' ')} · {l.type}</div>
                     <div className="text-[11px] text-text-secondary mt-1 italic">"{l.reason}"</div>
                   </div>
                   <div className="flex gap-2">
                     <Button size="xs" className="bg-accent text-white" onClick={() => updateStatusMutation.mutate({ id: l._id, status: 'approved' })}>Approve</Button>
                     <Button size="xs" variant="outline" className="text-red border-red/10" onClick={() => updateStatusMutation.mutate({ id: l._id, status: 'rejected' })}>Reject</Button>
                   </div>
                 </div>
               ))}
               {pendingLeaves?.length === 0 && <div className="p-12 text-center text-text-muted text-xs italic">No pending leave requests</div>}
             </div>
           </div>

           <div className="card">
              <div className="card-header border-b border-border bg-surface2/10"><div className="section-title text-sm">Enterprise Leave Rules</div></div>
              <div className="card-body">
                 <div className="flex flex-col gap-3">
                    {[
                      { lbl: 'Paid Leave', val: '1.5 Days/Month (Standard)' },
                      { lbl: 'Probation', val: '0 Paid Leaves' },
                      { lbl: 'Delayed Start', val: 'Half Day Loss' },
                      { lbl: 'Unapproved', val: 'Lead Reallocation' }
                    ].map((p, i) => (
                      <div key={i} className="flex justify-between items-center p-3 bg-surface2 rounded-xl border border-border/50">
                        <span className="text-xs font-bold">{p.lbl}</span>
                        <span className="text-xs text-text-muted font-medium">{p.val}</span>
                      </div>
                    ))}
                 </div>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
};

export default LeaveCalendar;
