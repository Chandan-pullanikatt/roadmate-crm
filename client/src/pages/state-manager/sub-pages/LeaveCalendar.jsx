import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { leaveApi } from '../../../api/leaveApi';
import { dashboardApi } from '../../../api/dashboardApi';
import { Avatar, Button, Tag, Modal } from '../../../components/ui';
import { useToast } from '../../../context/ToastContext';

const LeaveCalendar = ({ openModal }) => {
  const queryClient = useQueryClient();
  const { addToast } = useToast();
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());

  const { data: dashData } = useQuery({
    queryKey: ['dashboard', 'state-manager'],
    queryFn: () => dashboardApi.getStateManagerDashboard().then(res => res.data)
  });

  const { data: teamLeaves, isLoading: leavesLoading } = useQuery({
    queryKey: ['leaves', 'state-team', currentMonth, currentYear],
    queryFn: () => leaveApi.getTeamLeaves(currentMonth + 1, currentYear).then(res => res.data)
  });

  const { data: pendingLeaves, isLoading: pendingLoading } = useQuery({
    queryKey: ['leaves', 'pending-state'],
    queryFn: () => leaveApi.getPendingLeaves().then(res => res.data)
  });

  const updateStatusMutation = useMutation({
    mutationFn: (data) => leaveApi.updateLeaveStatus(data.id, data.status, data.reason),
    onSuccess: () => {
      queryClient.invalidateQueries(['leaves']);
      queryClient.invalidateQueries(['dashboard', 'state-manager']);
      addToast("Leave status updated", "success");
    }
  });

  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const firstDayOfMonth = new Date(currentYear, currentMonth, 1).getDay();
  
  const holidays = [14, 22]; // Mock for now, could be fetched from policy API

  const handleAction = (id, status) => {
    updateStatusMutation.mutate({ id, status });
  };

  if (leavesLoading || pendingLoading) return <div className="p-8 text-center text-text-muted">Syncing calendar...</div>;

  return (
    <div className="animate-in fade-in duration-500">
      <div className="section-header">
        <div>
          <div className="section-title">Leave & Holiday Calendar</div>
          <div className="section-sub">State holidays, leave approvals, and organizational policy management</div>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" size="sm" onClick={() => openModal('leave-policy')}>📄 View Full Policy</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* CALENDAR CARD */}
        <div className="card">
          <div className="card-header border-b border-border flex justify-between items-center bg-surface2/10">
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
              {Array.from({ length: firstDayOfMonth }).map((_, i) => (
                <div key={`blank-${i}`} className="h-14"></div>
              ))}
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
                    ${isToday ? 'bg-blue text-white font-bold shadow-md' : ''}
                    ${isHoliday ? 'bg-red-light/20' : ''}
                    ${dayLeaves?.length > 0 ? 'bg-blue-light/10' : ''}
                  `}>
                    <span className="text-sm font-bold">{day}</span>
                    <div className="flex gap-0.5 mt-0.5">
                      {isHoliday && <span className="w-1 h-1 rounded-full bg-red"></span>}
                      {dayLeaves?.length > 0 && <span className="w-1 h-1 rounded-full bg-blue"></span>}
                    </div>
                    {dayLeaves?.length > 0 && (
                      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 bg-surface border border-border rounded-xl shadow-xl z-10 p-2 text-[8px] flex flex-col gap-1 pointer-events-none">
                        {dayLeaves.map((l, idx) => <div key={idx} className="truncate font-bold">{l.user?.name}</div>)}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* APPROVALS & POLICIES */}
        <div className="flex flex-col gap-6">
          <div className="card">
            <div className="card-header border-b border-border bg-surface2/10">
              <div className="section-title text-sm">Pending Approvals</div>
              <Tag variant="amber" label={`${pendingLeaves?.length || 0} Action Required`} />
            </div>
            <div className="card-body p-0 max-h-[400px] overflow-y-auto">
              {pendingLeaves?.map((l) => (
                <div key={l._id} className="flex items-center gap-4 p-5 border-b last:border-0 hover:bg-surface2 transition-colors">
                  <Avatar name={l.user?.name} size="md" className="av-state" />
                  <div className="flex-1 min-w-0">
                    <div className="text-[14px] font-bold">{l.user?.name}</div>
                    <div className="text-[11.5px] text-text-muted mt-0.5 capitalize">{l.type} · {l.days}d</div>
                    <div className="text-[11px] text-text-muted mt-0.5">{new Date(l.startDate).toLocaleDateString()} - {new Date(l.endDate).toLocaleDateString()}</div>
                    <div className="text-[11px] text-text-muted italic mt-2 bg-surface2 p-2 rounded-lg border border-border">"{l.reason}"</div>
                  </div>
                  <div className="flex flex-col gap-2">
                    <Button size="xs" className="bg-purple text-white" onClick={() => handleAction(l._id, 'approved')}>Approve</Button>
                    <Button size="xs" variant="outline" className="text-red border-red/20" onClick={() => handleAction(l._id, 'rejected')}>Reject</Button>
                  </div>
                </div>
              ))}
              {pendingLeaves?.length === 0 && <div className="p-12 text-center text-text-muted text-xs italic">No pending leave requests</div>}
            </div>
          </div>

          <div className="card">
            <div className="card-header border-b border-border bg-surface2/10"><div className="section-title text-sm">State Leave Policy</div></div>
            <div className="card-body">
              <div className="flex flex-col gap-3">
                {[
                  { lbl: 'Paid Leaves', val: '1.5 Days / Month' },
                  { lbl: 'Approval Level', val: 'Direct Manager → SM' },
                  { lbl: 'Efficiency Link', val: 'Must maintain >70%' },
                  { lbl: 'Loss of Pay', val: 'Applied if balance < 0' },
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
