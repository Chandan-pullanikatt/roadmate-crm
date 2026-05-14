import React, { useState, useRef } from 'react';
import Papa from 'papaparse';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import DashboardSkeleton from '../../../components/skeletons/DashboardSkeleton';
import { leaveApi } from '../../../api/leaveApi';
import { dashboardApi } from '../../../api/dashboardApi';
import { Avatar, Button, Tag } from '../../../components/ui';
import { toast } from 'react-hot-toast';

const LeaveCalendar = () => {
  const queryClient = useQueryClient();
  const today = new Date();
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [uploadState, setUploadState] = useState('');
  const calFileRef = useRef(null);

  const handleCalendarUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadState('parsing');
    Papa.parse(file, {
      header: true, skipEmptyLines: true,
      complete: async (result) => {
        try {
          const holidays = result.data.map(row => ({
            name: row.Name || row.name || row.Holiday || '',
            date: row.Date || row.date || '',
            type: (row.Type || row.type || 'public').toLowerCase(),
          })).filter(h => h.name && h.date);
          await leaveApi.updateLeavePolicy({ holidays, year: new Date().getFullYear() });
          toast.success(`${holidays.length} holiday(s) uploaded!`);
          queryClient.invalidateQueries({ queryKey: ['leaves'] });
        } catch { toast.error('Upload failed'); }
        finally { setUploadState(''); if (calFileRef.current) calFileRef.current.value = ''; }
      },
      error: () => { toast.error('Failed to parse CSV'); setUploadState(''); }
    });
  };
  
  // My Leave Request Form State
  const [leaveForm, setLeaveForm] = useState({
    type: 'casual',
    fromDate: '',
    toDate: '',
    days: 1,
    reason: ''
  });

  const { data: dashData } = useQuery({
    queryKey: ['dashboard', 'state-manager'],
    queryFn: () => dashboardApi.getStateManagerDashboard().then(res => res.data),
    staleTime: 5 * 60 * 1000,
    placeholderData: keepPreviousData
  });

  const { data: teamLeaves, isLoading: leavesLoading } = useQuery({
    queryKey: ['leaves', 'state-team', currentMonth, currentYear],
    queryFn: () => leaveApi.getLeaveCalendar(dashData?.user?.state, { month: currentMonth + 1, year: currentYear }).then(res => res.data),
    enabled: !!dashData?.user?.state,
    staleTime: 5 * 60 * 1000,
    placeholderData: keepPreviousData
  });

  const { data: pendingLeaves, isLoading: pendingLoading } = useQuery({
    queryKey: ['leaves', 'pending-state'],
    queryFn: () => leaveApi.getPendingLeaves().then(res => res.data),
    staleTime: 5 * 60 * 1000,
    placeholderData: keepPreviousData
  });

  const approvalMutation = useMutation({
    mutationFn: ({ id, status }) => {
      if (status === 'approved') return leaveApi.approveLeave(id);
      return leaveApi.rejectLeave(id, { approvalNote: 'Rejected by State Manager' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leaves'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard', 'state-manager'] });
      toast.success("Request updated successfully");
    }
  });

  const applyMutation = useMutation({
    mutationFn: (data) => {
      const typeMap = {
        'casual': 'paid',
        'sick': 'sick',
        'optional_holiday': 'optional_holiday',
        'unpaid': 'unpaid'
      };
      return leaveApi.requestLeave({
        ...data,
        type: typeMap[data.type] || 'unpaid'
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leaves'] });
      toast.success("Leave request sent to Founder");
      setLeaveForm({ type: 'casual', fromDate: '', toDate: '', days: 1, reason: '' });
    },
    onError: (err) => toast.error(err.response?.data?.message || "Failed to send request")
  });

  const todayStr = new Date().toISOString().split('T')[0];

  const handleApply = (e) => {
    e.preventDefault();
    if (!leaveForm.fromDate || !leaveForm.toDate) {
      toast.error('Please select leave dates');
      return;
    }
    if (leaveForm.fromDate < todayStr || leaveForm.toDate < todayStr) {
      toast.error('Past dates cannot be selected for leave');
      return;
    }
    if (leaveForm.toDate < leaveForm.fromDate) {
      toast.error('To Date must be on or after the From Date');
      return;
    }
    applyMutation.mutate(leaveForm);
  };

  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const firstDayOfMonth = new Date(currentYear, currentMonth, 1).getDay();

  if (leavesLoading || pendingLoading) return <DashboardSkeleton />;

  const user = dashData?.user || {};

  return (
    <div className="animate-in fade-in duration-500">
      {/* HEADER */}
      <div className="section-header mb-6">
        <div>
          <div className="section-title">Leave Calendar · {user.state}</div>
          <div className="section-sub text-[13px]">Holiday calendar - Leave policies - Approvals</div>
        </div>
        <div className="flex items-center gap-2">
          <input ref={calFileRef} type="file" accept=".csv" className="hidden" onChange={handleCalendarUpload} />
          <Button variant="outline" size="sm" className="bg-white shadow-sm border-border font-bold px-4" onClick={() => calFileRef.current?.click()} disabled={uploadState === 'parsing'}>
            {uploadState === 'parsing' ? 'Uploading...' : '📅 Upload Calendar'}
          </Button>
          <Button variant="outline" size="sm" className="bg-white shadow-sm border-border text-text font-bold px-5" onClick={() => window.dispatchEvent(new CustomEvent('open-modal', { detail: 'leave-policy' }))}>
            <span className="mr-2">📄</span> Leave Policy
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* CALENDAR COLUMN */}
        <div className="lg:col-span-7">
          <div className="card shadow-xl border-none bg-white/80 backdrop-blur-md">
            <div className="card-header border-b border-border/50 flex justify-between items-center p-6">
              <div className="section-title text-[16px] font-black tracking-tight">
                {new Date(currentYear, currentMonth).toLocaleString('default', { month: 'long', year: 'numeric' })}
              </div>
              <div className="flex gap-4">
                <span className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-red">
                  <span className="w-2.5 h-2.5 rounded-full bg-red"></span> Holiday
                </span>
                <span className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-amber">
                  <span className="w-2.5 h-2.5 bg-amber-light border border-amber/30 rounded-sm"></span> Optional
                </span>
                <span className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-blue">
                  <span className="w-2.5 h-2.5 bg-blue-light border border-blue/30 rounded-sm"></span> Leave
                </span>
              </div>
            </div>
            <div className="card-body p-6">
              <div className="grid grid-cols-7 gap-3">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                  <div key={d} className="text-center text-[11px] font-black text-text-muted/60 uppercase tracking-widest pb-4">{d}</div>
                ))}
                {Array.from({ length: firstDayOfMonth }).map((_, i) => (
                  <div key={`blank-${i}`} className="h-16"></div>
                ))}
                {Array.from({ length: daysInMonth }).map((_, i) => {
                  const day = i + 1;
                  const dayDate = new Date(currentYear, currentMonth, day).toDateString();
                  const event = teamLeaves?.find(l => new Date(l.date).toDateString() === dayDate);
                  
                  return (
                    <div key={day} className={`h-16 rounded-2xl flex flex-col items-center justify-center relative transition-all group border border-transparent
                      ${event?.type === 'holiday' ? 'bg-red-light/5' : ''}
                      ${event?.type === 'optional' ? 'bg-amber-light/10 border-amber/20' : ''}
                      ${event?.type === 'leave' ? 'bg-blue-light/10 border-blue/20' : ''}
                      hover:scale-105 hover:shadow-lg hover:z-10 cursor-pointer
                    `}>
                      <span className={`text-[13px] font-black ${event?.type === 'holiday' ? 'text-red' : 'text-text-secondary'}`}>{day}</span>
                      {event?.type === 'holiday' && <span className="absolute bottom-2 w-1.5 h-1.5 rounded-full bg-red animate-pulse"></span>}
                      {event?.type === 'optional' && <span className="absolute top-1 right-1 text-[8px] font-black text-amber">⚠</span>}
                      {event?.type === 'leave' && <span className="absolute bottom-2 w-3 h-0.5 rounded-full bg-blue"></span>}
                      
                      {/* TOOLTIP */}
                      {event && (
                        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-48 bg-white border border-border shadow-2xl rounded-xl p-3 z-50 opacity-0 group-hover:opacity-100 pointer-events-none transition-all">
                          <div className="text-[10px] font-black uppercase text-text-muted mb-1">{event.type}</div>
                          <div className="text-[12px] font-bold text-text mb-2">{event.name}</div>
                          {event.users?.length > 0 && (
                            <div className="flex flex-col gap-1">
                               {event.users.map((u, i) => <div key={i} className="text-[11px] text-blue font-medium tracking-tight">· {u}</div>)}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="mt-8 text-[11px] text-text-muted font-medium italic bg-surface p-3 rounded-xl border border-border/50">
                * Working hours: 9:30 AM - During Ramadan: 9:00 AM. 
                <span className="block mt-1 font-bold">Standard 25 working days per month observed.</span>
              </div>
            </div>
          </div>
        </div>

        {/* ACTIONS COLUMN */}
        <div className="lg:col-span-5 flex flex-col gap-8">
          {/* PENDING APPROVALS */}
          <div className="card border-none shadow-xl bg-white/80 backdrop-blur-md">
            <div className="card-header border-b border-border/50 flex justify-between items-center p-5">
              <div className="section-title text-sm font-black uppercase tracking-wider">Pending Leave Approvals</div>
              <Tag variant="amber" label={`${pendingLeaves?.length || 0} Pending`} className="font-black text-[9px] tracking-widest" />
            </div>
            <div className="card-body p-4 space-y-4 max-h-[300px] overflow-y-auto custom-scrollbar">
              {pendingLeaves?.map((l) => (
                <div key={l._id} className="flex items-center gap-4 p-4 bg-surface2/30 rounded-2xl border border-border/40 group hover:border-blue/30 transition-all">
                  <Avatar name={l.user?.name} size="md" className="av-state" />
                  <div className="flex-1 min-w-0">
                    <div className="text-[13.5px] font-black leading-tight">{l.user?.name}</div>
                    <div className="text-[11px] text-text-muted mt-1 font-medium">{l.type?.replace('_', ' ')} · {l.days}d · {new Date(l.fromDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}-{new Date(l.toDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</div>
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      size="xs" 
                      className="bg-green text-white font-black text-[10px] px-3 py-1.5 rounded-lg shadow-sm hover:shadow-md transition-all"
                      onClick={() => approvalMutation.mutate({ id: l._id, status: 'approved' })}
                    >Approve</Button>
                    <Button 
                      size="xs" 
                      variant="outline" 
                      className="text-red border-red/30 font-black text-[10px] px-3 py-1.5 rounded-lg hover:bg-red-light/10 transition-all"
                      onClick={() => approvalMutation.mutate({ id: l._id, status: 'rejected' })}
                    >Reject</Button>
                  </div>
                </div>
              ))}
              {pendingLeaves?.length === 0 && (
                <div className="p-12 text-center">
                  <div className="text-[24px] mb-2 opacity-50">✨</div>
                  <div className="text-[11px] text-text-muted italic font-medium tracking-tight">Your approval queue is completely empty.</div>
                </div>
              )}
            </div>
          </div>

          {/* MY LEAVE REQUEST */}
          <div className="card border-none shadow-xl bg-white/80 backdrop-blur-md">
            <div className="card-header border-b border-border/50 p-5">
              <div className="section-title text-sm font-black uppercase tracking-wider">My Leave Request to Founder</div>
            </div>
            <div className="card-body p-6">
              <form onSubmit={handleApply} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5 col-span-2">
                    <label className="text-[10px] font-black uppercase text-text-muted tracking-widest px-1">Leave Type</label>
                    <select 
                      className="w-full bg-surface2/50 border border-border/50 rounded-xl px-4 py-3 text-[13px] font-bold outline-none focus:border-blue/50 transition-all appearance-none"
                      value={leaveForm.type}
                      onChange={e => setLeaveForm({...leaveForm, type: e.target.value})}
                    >
                      <option value="casual">Casual Leave</option>
                      <option value="sick">Sick Leave</option>
                      <option value="optional_holiday">Optional Holiday</option>
                      <option value="unpaid">Loss of Pay (LOP)</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase text-text-muted tracking-widest px-1">From Date</label>
                    <input
                      type="date"
                      className="w-full bg-surface2/50 border border-border/50 rounded-xl px-4 py-3 text-[13px] font-bold outline-none focus:border-blue/50 transition-all"
                      min={todayStr}
                      value={leaveForm.fromDate}
                      onChange={e => setLeaveForm({
                        ...leaveForm,
                        fromDate: e.target.value,
                        toDate: leaveForm.toDate && leaveForm.toDate < e.target.value ? e.target.value : leaveForm.toDate
                      })}
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase text-text-muted tracking-widest px-1">To Date</label>
                    <input
                      type="date"
                      className="w-full bg-surface2/50 border border-border/50 rounded-xl px-4 py-3 text-[13px] font-bold outline-none focus:border-blue/50 transition-all"
                      min={leaveForm.fromDate || todayStr}
                      value={leaveForm.toDate}
                      onChange={e => setLeaveForm({...leaveForm, toDate: e.target.value})}
                      required
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase text-text-muted tracking-widest px-1">Reason</label>
                  <textarea 
                    className="w-full bg-surface2/50 border border-border/50 rounded-xl px-4 py-3 text-[13px] font-bold outline-none focus:border-blue/50 transition-all min-h-[80px] resize-none"
                    placeholder="Reason for leave..."
                    value={leaveForm.reason}
                    onChange={e => setLeaveForm({...leaveForm, reason: e.target.value})}
                    required
                  ></textarea>
                </div>
                <Button 
                  type="submit"
                  className="w-full bg-blue text-white font-black py-4 rounded-xl shadow-lg shadow-blue/20 hover:shadow-blue/40 transition-all"
                  loading={applyMutation.isLoading}
                >
                  Send Request to Founder
                </Button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LeaveCalendar;

