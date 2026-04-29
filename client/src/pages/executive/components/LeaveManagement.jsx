import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { leaveApi } from '../../../api/leaveApi';
import { dashboardApi } from '../../../api/dashboardApi';
import { Tag, Modal } from '../../../components/ui';
import { useToast } from '../../../context/ToastContext';
import { useAuth } from '../../../context/AuthContext';

const LeaveManagement = () => {
  const queryClient = useQueryClient();
  const { addToast } = useToast();
  const { user: currentUser } = useAuth();
  
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
  const [leaveForm, setLeaveForm] = useState({ type: 'paid', fromDate: '', toDate: '', reason: '' });
  const [viewDate, setViewDate] = useState(new Date());

  const month = viewDate.getMonth() + 1;
  const year = viewDate.getFullYear();

  // Fetch my leave requests
  const { data: leaves } = useQuery({
    queryKey: ['leaves', 'my-requests'],
    queryFn: () => leaveApi.getLeaves().then(res => res.data)
  });

  // Fetch leave balance
  const { data: balance } = useQuery({
    queryKey: ['leaves', 'balance', currentUser?._id],
    queryFn: () => leaveApi.getLeaveBalance(currentUser?._id).then(res => res.data),
    enabled: !!currentUser?._id
  });

  // Fetch leave calendar (holidays + leaves)
  const { data: calendarData } = useQuery({
    queryKey: ['leaves', 'calendar', currentUser?.state, month, year],
    queryFn: () => leaveApi.getLeaveCalendar(currentUser?.state, { month, year }).then(res => res.data),
    enabled: !!currentUser?.state
  });

  const requestMutation = useMutation({
    mutationFn: (data) => leaveApi.createLeave(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leaves'] });
      setIsRequestModalOpen(false);
      setLeaveForm({ type: 'paid', fromDate: '', toDate: '', reason: '' });
      addToast("Leave request submitted", "success");
    },
    onError: (err) => {
      addToast(err.response?.data?.message || "Request failed", "error");
    }
  });

  // Calendar helpers
  const daysInMonth = new Date(year, month, 0).getDate();
  const firstDay = new Date(year, month - 1, 1).getDay();
  const calendarDays = [];
  for (let i = 0; i < firstDay; i++) calendarDays.push(null);
  for (let i = 1; i <= daysInMonth; i++) calendarDays.push(i);

  const prevMonth = () => setViewDate(new Date(year, month - 2, 1));
  const nextMonth = () => setViewDate(new Date(year, month, 1));

  const getDayEvents = (day) => {
    if (!day) return [];
    const dateStr = new Date(year, month - 1, day).setHours(0,0,0,0);
    return calendarData?.filter(e => new Date(e.date).setHours(0,0,0,0) === dateStr) || [];
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="section-header">
        <div>
          <div className="section-title">Leave & Calendar</div>
          <div className="section-sub">My leave balance, calendar, policies</div>
        </div>
        <button className="btn btn-orange btn-sm" onClick={() => setIsRequestModalOpen(true)}>Request Leave</button>
      </div>

      <div className="stat-grid">
        <div className="stat-card green">
          <div className="stat-label">Paid Leaves Remaining</div>
          <div className="stat-value">{balance?.paidLeaveBalance || 0}</div>
          <div className="stat-delta delta-up">Earned monthly</div>
        </div>
        <div className="stat-card amber">
          <div className="stat-label">Optional Holidays Left</div>
          <div className="stat-value">{balance?.optionalHolidayBalance || 0}</div>
          <div className="stat-delta" style={{color: 'var(--amber)'}}>As per state policy</div>
        </div>
        <div className="stat-card blue">
          <div className="stat-label">Leaves Taken (Month)</div>
          <div className="stat-value">{balance?.approvedThisMonth || 0}</div>
          <div className="stat-delta delta-up">Approved days</div>
        </div>
        <div className="stat-card red">
          <div className="stat-label">Pending Requests</div>
          <div className="stat-value">{balance?.pendingRequests || 0}</div>
          <div className="stat-delta" style={{color: 'var(--accent)'}}>Awaiting approval</div>
        </div>
      </div>

      <div className="two-col">
        {/* Leave Policy Card */}
        <div className="card">
          <div className="card-header">
            <div className="section-title" style={{fontSize: '13px'}}>Leave Policies</div>
            <Tag label="VIEW ONLY" variant="blue" />
          </div>
          <div className="card-body">
            <div className="space-y-2">
              <div style={{padding: '9px 12px', background: 'var(--surface2)', borderRadius: 'var(--radius-sm)', borderLeft: '3px solid var(--accent)', fontSize: '13px'}}>During <strong>probation</strong> — No paid leave allowed</div>
              <div style={{padding: '9px 12px', background: 'var(--surface2)', borderRadius: 'var(--radius-sm)', borderLeft: '3px solid var(--accent)', fontSize: '13px'}}>Post probation — <strong>1 paid leave per month</strong> accrued</div>
              <div style={{padding: '9px 12px', background: 'var(--surface2)', borderRadius: 'var(--radius-sm)', borderLeft: '3px solid var(--amber)', fontSize: '13px'}}>Optional holidays — check state list in calendar</div>
              <div style={{padding: '9px 12px', background: 'var(--red-light)', borderRadius: 'var(--radius-sm)', borderLeft: '3px solid var(--red)', fontSize: '12.5px', color: 'var(--red)'}}>Unapproved absence → yesterday's + today's full work re-assigned</div>
            </div>
          </div>
        </div>

        {/* Calendar Card */}
        <div className="card">
          <div className="card-header">
            <div className="section-title" style={{fontSize: '13px'}}>{viewDate.toLocaleString('default', { month: 'long', year: 'numeric' })}</div>
            <div className="flex gap-2">
              <button className="btn btn-outline btn-xs" onClick={prevMonth}>←</button>
              <button className="btn btn-outline btn-xs" onClick={nextMonth}>→</button>
            </div>
          </div>
          <div className="card-body">
            <div className="cal-header">
              {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => (
                <div key={d} className="cal-day-name">{d}</div>
              ))}
            </div>
            <div className="cal-grid">
              {calendarDays.map((day, idx) => {
                const events = getDayEvents(day);
                const isHoliday = events.some(e => e.type === 'holiday');
                const isOptional = events.some(e => e.type === 'optional');
                const isMyLeave = events.some(e => e.type === 'leave' && e.users.includes(currentUser?.name));
                const isToday = day === new Date().getDate() && month === (new Date().getMonth() + 1);
                
                return (
                  <div 
                    key={idx} 
                    className={`cal-day ${!day ? 'past' : ''} ${isMyLeave ? 'leave' : ''} ${isHoliday ? 'holiday' : ''} ${isOptional ? 'optional' : ''} ${isToday ? 'today' : ''}`}
                    title={events.map(e => e.name).join(', ')}
                  >
                    <span>{day}</span>
                  </div>
                );
              })}
            </div>
            <div style={{display: 'flex', gap: '12px', marginTop: '16px', flexWrap: 'wrap'}}>
              <span style={{fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px'}}><span style={{width: '10px', height: '10px', borderRadius: '2px', background: 'var(--blue-light)', border: '1px solid var(--blue)', display: 'inline-block'}}></span>My Leave</span>
              <span style={{fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px'}}><span style={{width: '10px', height: '10px', borderRadius: '2px', background: 'var(--red-light)', display: 'inline-block'}}></span>Holiday</span>
              <span style={{fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px'}}><span style={{width: '10px', height: '10px', borderRadius: '2px', background: 'var(--amber-light)', display: 'inline-block'}}></span>Optional</span>
            </div>
          </div>
        </div>
      </div>

      {isRequestModalOpen && (
        <Modal title="Request Leave" onClose={() => setIsRequestModalOpen(false)}>
          <div className="p-6">
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="form-label">From Date</label>
                <input type="date" className="form-input" value={leaveForm.fromDate} onChange={(e) => setLeaveForm({...leaveForm, fromDate: e.target.value})} />
              </div>
              <div>
                <label className="form-label">To Date</label>
                <input type="date" className="form-input" value={leaveForm.toDate} onChange={(e) => setLeaveForm({...leaveForm, toDate: e.target.value})} />
              </div>
            </div>
            <div className="mb-4">
              <label className="form-label">Leave Type</label>
              <select className="form-select" value={leaveForm.type} onChange={(e) => setLeaveForm({...leaveForm, type: e.target.value})}>
                <option value="paid">Paid Leave</option>
                <option value="optional_holiday">Optional Holiday</option>
                <option value="sick">Sick Leave</option>
                <option value="unpaid">Loss of Pay (LOP)</option>
              </select>
            </div>
            <div className="mb-6">
              <label className="form-label">Reason</label>
              <textarea className="form-textarea" placeholder="Reason for leave..." value={leaveForm.reason} onChange={(e) => setLeaveForm({...leaveForm, reason: e.target.value})} />
            </div>
            <div className="flex justify-end gap-3">
              <button className="btn btn-outline" onClick={() => setIsRequestModalOpen(false)}>Cancel</button>
              <button 
                className="btn btn-orange" 
                disabled={requestMutation.isLoading}
                onClick={() => requestMutation.mutate(leaveForm)}
              >
                {requestMutation.isLoading ? "Submitting..." : "Submit Request"}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default LeaveManagement;
