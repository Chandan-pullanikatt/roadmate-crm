import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { leaveApi } from '../../../api/leaveApi';
import { dashboardApi } from '../../../api/dashboardApi';
import { Tag, Button, Avatar, DashboardSkeleton } from '../../../components/ui';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';

const LeaveCalendar = () => {
  const { user: currentUser } = useAuth();
  const queryClient = useQueryClient();
  const { addToast } = useToast();

  const [viewDate, setViewDate] = useState(new Date());
  const [leaveForm, setLeaveForm] = useState({
    type: 'Casual Leave',
    fromDate: '',
    toDate: '',
    reason: ''
  });

  const month = viewDate.getMonth() + 1;
  const year = viewDate.getFullYear();

  // 1. Get Calendar Data (Holidays, etc.)
  const { data: calendarData, isLoading: calLoading } = useQuery({
    queryKey: ['leaves', 'im-calendar', currentUser?.state, month, year],
    queryFn: () => leaveApi.getLeaveCalendar(currentUser?.state, { month, year }).then(res => res.data),
    enabled: !!currentUser?.state,
    staleTime: 5 * 60 * 1000,
    placeholderData: (prev) => prev
  });

  // 2. Get Executive Leave Requests (Pending — excludes own)
  const { data: pendingLeaves = [], isLoading: leavesLoading } = useQuery({
    queryKey: ['leaves', 'im-approvals'],
    queryFn: () => leaveApi.getPendingLeaves().then(res => res.data || []),
    staleTime: 5 * 60 * 1000,
    placeholderData: (prev) => prev
  });

  // 3. Get Dashboard Profile
  const { data: dashData, isLoading: dashLoading } = useQuery({
    queryKey: ['dashboard', 'industry-manager'],
    queryFn: () => dashboardApi.getIndustryManagerDashboard().then(res => res.data),
    staleTime: 5 * 60 * 1000,
    placeholderData: (prev) => prev
  });


  const userInfo = dashData?.user || currentUser || {};

  // Mutations
  const requestMutation = useMutation({
    mutationFn: (data) => {
      const typeMap = {
        'Casual Leave': 'paid',
        'Sick Leave': 'sick',
        'Earned Leave': 'paid',
        'Optional Holiday': 'optional_holiday',
        'Unpaid Leave': 'unpaid'
      };
      return leaveApi.applyLeave({
        ...data,
        type: typeMap[data.type] || 'unpaid'
      });
    },
    onSuccess: () => {
      addToast("Leave request submitted to State Manager", "success");
      setLeaveForm({ type: 'Casual Leave', fromDate: '', toDate: '', reason: '' });
      queryClient.invalidateQueries({ queryKey: ['leaves'] });
    },
    onError: (err) => {
      addToast(err.response?.data?.message || "Error submitting leave request", "error");
    }
  });

  const approveMutation = useMutation({
    mutationFn: leaveApi.approveLeave,
    onSuccess: () => {
      queryClient.invalidateQueries(['leaves', 'im-approvals']);
      addToast("Leave request approved", "success");
    }
  });

  const rejectMutation = useMutation({
    mutationFn: (data) => leaveApi.rejectLeave(data.id, { approvalNote: "Rejected by Industry Manager" }),
    onSuccess: () => {
      queryClient.invalidateQueries(['leaves', 'im-approvals']);
      addToast("Leave request rejected", "error");
    }
  });

  // Calendar Helpers
  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const daysInMonth = new Date(year, month, 0).getDate();
  const firstDay = new Date(year, month - 1, 1).getDay();
  const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const getDayEvents = (day) => {
    if (!day) return [];
    const dateStr = new Date(year, month - 1, day).setHours(0,0,0,0);
    return calendarData?.filter(item => new Date(item.date).setHours(0,0,0,0) === dateStr) || [];
  };

  if ((calLoading || leavesLoading || dashLoading) && !dashData) return <DashboardSkeleton />;

  return (
    <div className="space-y-6 animate-in fade-in duration-700 pb-12">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Leave Calendar</h1>
          <p className="text-sm text-text-muted">Executive leave approvals - My leave request</p>
        </div>
        <div className="flex items-center gap-3">
            <div className="relative">
                <input 
                    type="text" 
                    placeholder="Search leads, executives..." 
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
          <h2 className="text-lg font-bold">Leave Calendar · {userInfo.industry} Team</h2>
          <p className="text-xs text-text-muted">Executive leave approvals - My leave request to State Manager</p>
        </div>
        <Button variant="outline" className="rounded-xl h-10 px-5 font-bold border-border/60 text-[11px] uppercase tracking-widest" onClick={() => window.dispatchEvent(new CustomEvent('open-modal', { detail: 'leave-policy' }))}>
           📜 Leave Policy
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Calendar (7 cols) */}
        <div className="lg:col-span-7 card shadow-lg shadow-purple/5 border-border/40 p-8">
            <div className="flex items-center justify-between mb-8">
                <h3 className="text-lg font-black text-text-primary tracking-tight">{monthNames[month-1]} {year}</h3>
                <div className="flex gap-4">
                    <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-red"></span> <span className="text-[10px] font-black text-text-muted uppercase">Holiday</span></div>
                    <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-amber"></span> <span className="text-[10px] font-black text-text-muted uppercase">Optional</span></div>
                    <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-blue"></span> <span className="text-[10px] font-black text-text-muted uppercase">Leave</span></div>
                </div>
            </div>

            <div className="grid grid-cols-7 mb-4">
                {weekDays.map(wd => (
                    <div key={wd} className="text-center text-[10px] font-black text-text-muted uppercase tracking-widest py-2">{wd}</div>
                ))}
            </div>

            <div className="grid grid-cols-7 gap-1">
                {Array.from({ length: firstDay }).map((_, i) => (
                    <div key={`empty-${i}`} className="aspect-square"></div>
                ))}
                
                {Array.from({ length: daysInMonth }).map((_, i) => {
                    const day = i + 1;
                    const events = getDayEvents(day);
                    const holiday = events.find(e => e.type === 'holiday');
                    const optional = events.find(e => e.type === 'optional_holiday');
                    const leaves = events.filter(e => e.type === 'leave');

                    let bgClass = 'bg-surface2/20';
                    let textClass = 'text-text-muted';
                    let icon = null;

                    if (holiday) { bgClass = 'bg-red-light/30 border border-red/10'; textClass = 'text-red'; icon = <div className="w-1 h-1 rounded-full bg-red mt-1"></div>; }
                    else if (optional) { bgClass = 'bg-amber-light/30 border border-amber/10'; textClass = 'text-amber'; icon = <div className="text-[8px] mt-0.5">▲</div>; }
                    else if (leaves.length > 0) { bgClass = 'bg-blue-light/30 border border-blue/10'; textClass = 'text-blue'; icon = <div className="text-[8px] mt-0.5">≡</div>; }

                    return (
                        <div key={day} className={`aspect-square flex flex-col items-center justify-center rounded-xl transition-all hover:scale-105 cursor-pointer ${bgClass}`}>
                            <span className={`text-xs font-black ${textClass}`}>{day}</span>
                            {icon}
                        </div>
                    );
                })}
            </div>
        </div>

        {/* Right Column: Approvals & Form (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
            {/* Executive Leave Requests */}
            <div className="card shadow-lg shadow-purple/5 border-border/40 p-6">
                <div className="flex items-center justify-between mb-6">
                    <h3 className="text-sm font-black text-text-primary uppercase tracking-tight">Executive Leave Requests</h3>
                    <Tag variant="amber" label={`${pendingLeaves.length} Pending`} className="px-3 rounded-lg font-black" />
                </div>

                <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2 scrollbar-hide">
                    {pendingLeaves.map((leave, idx) => (
                        <div key={idx} className="bg-surface2/30 rounded-2xl p-4 border border-border/40 group hover:bg-white hover:shadow-md transition-all">
                            <div className="flex items-center gap-3 mb-3">
                                <Avatar name={leave.user.name} size="sm" className={`av-${idx % 5} rounded-lg`} />
                                <div>
                                    <p className="text-[11px] font-black text-text-primary">{leave.user.name}</p>
                                    <p className="text-[9px] font-bold text-text-muted uppercase tracking-tighter">
                                        {leave.type.replace('_', ' ')} · {leave.days}d · {new Date(leave.fromDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} - {new Date(leave.toDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                                    </p>
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <button 
                                    onClick={() => approveMutation.mutate(leave._id)}
                                    className="flex-1 py-1.5 rounded-lg bg-green/10 text-green text-[10px] font-black uppercase tracking-widest hover:bg-green hover:text-white transition-all border border-green/20"
                                >Approve</button>
                                <button 
                                    onClick={() => rejectMutation.mutate({ id: leave._id })}
                                    className="flex-1 py-1.5 rounded-lg bg-red/10 text-red text-[10px] font-black uppercase tracking-widest hover:bg-red hover:text-white transition-all border border-red/20"
                                >Reject</button>
                            </div>
                        </div>
                    ))}
                    {pendingLeaves.length === 0 && (
                        <div className="py-12 text-center opacity-50 italic text-xs font-bold text-text-muted uppercase tracking-widest">No pending approvals</div>
                    )}
                </div>
            </div>

            {/* My Leave Request Form */}
            <div className="card shadow-lg shadow-purple/5 border-border/40 p-6">
                <h3 className="text-sm font-black text-text-primary uppercase tracking-tight mb-6">My Leave Request to State Manager</h3>
                <div className="space-y-4">
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-text-muted uppercase tracking-widest">Leave Type</label>
                        <select 
                            className="w-full px-4 py-2 bg-surface2 border border-border rounded-xl outline-none text-xs font-bold"
                            value={leaveForm.type}
                            onChange={e => setLeaveForm({...leaveForm, type: e.target.value})}
                        >
                            <option value="Casual Leave">Casual Leave</option>
                            <option value="Sick Leave">Sick Leave</option>
                            <option value="Earned Leave">Earned Leave</option>
                            <option value="Unpaid Leave">Unpaid Leave</option>
                            <option value="Optional Holiday">Optional Holiday</option>
                        </select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-text-muted uppercase tracking-widest">From Date</label>
                            <input 
                                type="date" 
                                className="w-full px-4 py-2 bg-surface2 border border-border rounded-xl outline-none text-xs font-bold"
                                value={leaveForm.fromDate}
                                onChange={e => setLeaveForm({...leaveForm, fromDate: e.target.value})}
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-text-muted uppercase tracking-widest">To Date</label>
                            <input 
                                type="date" 
                                className="w-full px-4 py-2 bg-surface2 border border-border rounded-xl outline-none text-xs font-bold"
                                value={leaveForm.toDate}
                                onChange={e => setLeaveForm({...leaveForm, toDate: e.target.value})}
                            />
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-text-muted uppercase tracking-widest">Reason</label>
                        <textarea 
                            placeholder="Reason.."
                            className="w-full px-4 py-3 bg-surface2 border border-border rounded-xl outline-none text-xs font-bold min-h-[80px]"
                            value={leaveForm.reason}
                            onChange={e => setLeaveForm({...leaveForm, reason: e.target.value})}
                        />
                    </div>

                    <Button 
                        className="w-full bg-purple text-white border-none rounded-xl h-10 font-black text-[10px] uppercase tracking-widest shadow-lg shadow-purple/10"
                        onClick={() => requestMutation.mutate(leaveForm)}
                        disabled={!leaveForm.fromDate || !leaveForm.toDate || requestMutation.isLoading}
                    >
                        {requestMutation.isLoading ? "Submitting..." : "Submit Request"}
                    </Button>
                </div>
            </div>
        </div>
      </div>

    </div>
  );
};

export default LeaveCalendar;
