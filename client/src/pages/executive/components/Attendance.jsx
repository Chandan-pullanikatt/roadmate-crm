import React, { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { dashboardApi } from '../../../api/dashboardApi';
import { attendanceApi } from '../../../api/attendanceApi';
import { Button } from '../../../components/ui';

const Attendance = () => {
  const [viewDate, setViewDate] = useState(new Date());
  const month = viewDate.getMonth() + 1;
  const year = viewDate.getFullYear();

  const queryClient = useQueryClient();

  // Fetch unified attendance/leave events
  const { data: events = [], isLoading } = useQuery({
    queryKey: ['attendance', 'matrix', month, year],
    queryFn: () => attendanceApi.getAttendance({ month, year }).then(res => res.data)
  });

  React.useEffect(() => {
    const handleRefresh = () => {
      queryClient.invalidateQueries(['attendance', 'matrix', month, year]);
    };
    window.addEventListener('refresh-matrix', handleRefresh);
    return () => window.removeEventListener('refresh-matrix', handleRefresh);
  }, [queryClient, month, year]);

  // Calendar Logic
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
    
    return events.filter(ev => {
      const evDate = new Date(ev.date).setHours(0,0,0,0);
      if (ev.type === 'leave' && ev.toDate) {
        const toDate = new Date(ev.toDate).setHours(0,0,0,0);
        return dateStr >= evDate && dateStr <= toDate;
      }
      return evDate === dateStr;
    });
  };

  const getStatusClass = (ev) => {
    if (ev.type === 'holiday') return 'matrix-status-holiday';
    if (ev.type === 'leave') return 'matrix-status-leave';
    if (ev.status === 'present') return 'matrix-status-present';
    if (ev.status === 'half_day') return 'matrix-status-half';
    return 'matrix-status-absent';
  };

  return (
    <div className="attendance-page animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* Header Section */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Leave Calendar</h1>
          <p className="text-sm text-muted">Track your attendance, holidays and leave applications</p>
        </div>
        <div className="flex gap-3">
          <div className="flex items-center gap-2 bg-surface p-1 rounded-lg border border-border">
            <button className="icon-btn btn-xs" onClick={prevMonth}>←</button>
            <span className="text-xs font-bold px-2">{viewDate.toLocaleString('default', { month: 'long', year: 'numeric' })}</span>
            <button className="icon-btn btn-xs" onClick={nextMonth}>→</button>
          </div>
          <button className="btn btn-orange btn-sm font-bold shadow-md shadow-orange/10 px-5" onClick={() => window.dispatchEvent(new CustomEvent('open-modal', { detail: 'apply-leave' }))}>Apply For Leave</button>
        </div>
      </div>

      {/* Main Matrix Card */}
      <div className="matrix-card-container bg-surface border border-border rounded-2xl overflow-hidden shadow-sm">
        <div className="matrix-header p-5 border-b border-border bg-surface2/30 flex justify-between items-center">
          <div className="text-sm font-extrabold">Attendance & Leave Matrix — {viewDate.toLocaleString('default', { month: 'long', year: 'numeric' })}</div>
          <div className="flex gap-4">
            <span className="matrix-legend-item"><span className="legend-dot present"></span> Present</span>
            <span className="matrix-legend-item"><span className="legend-dot leave"></span> Leave</span>
            <span className="matrix-legend-item"><span className="legend-dot holiday"></span> Holiday</span>
          </div>
        </div>

        <div className="matrix-grid-wrapper">
          <div className="matrix-days-header grid grid-cols-7 border-b border-border">
            {['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'].map(d => (
              <div key={d} className="p-3 text-[11px] font-black text-muted tracking-widest text-center">{d}</div>
            ))}
          </div>
          
          <div className="matrix-days-grid grid grid-cols-7">
            {calendarDays.map((day, idx) => {
              const dayEvents = getDayEvents(day);
              const isToday = day === new Date().getDate() && month === (new Date().getMonth() + 1) && year === new Date().getFullYear();
              const isWeekend = idx % 7 === 0 || idx % 7 === 6;

              return (
                <div key={idx} className={`matrix-cell ${!day ? 'empty' : ''} ${isWeekend ? 'weekend' : ''} ${isToday ? 'today' : ''}`}>
                  {day && (
                    <>
                      <div className="matrix-day-num">{day < 10 ? `0${day}` : day}</div>
                      <div className="matrix-cell-content">
                        {dayEvents.map((ev, eidx) => (
                          <div key={eidx} className={`matrix-status-badge ${getStatusClass(ev)}`}>
                            {ev.type === 'attendance' && ev.status === 'present' ? '✓ Present' : ev.label}
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Stats Summary Footer */}
      <div className="grid grid-cols-4 gap-4 mt-6">
        <div className="side-card p-4">
          <div className="text-[10px] font-bold text-muted uppercase">Working Days (Month)</div>
          <div className="text-xl font-extrabold mt-1">{daysInMonth} Days</div>
        </div>
        <div className="side-card p-4">
          <div className="text-[10px] font-bold text-muted uppercase text-green-600">Days Present</div>
          <div className="text-xl font-extrabold mt-1 text-green-600">{events.filter(e => e.type === 'attendance' && e.status === 'present').length}</div>
        </div>
        <div className="side-card p-4">
          <div className="text-[10px] font-bold text-muted uppercase text-red-600">Leaves Taken</div>
          <div className="text-xl font-extrabold mt-1 text-red-600">{events.filter(e => e.type === 'leave').length}</div>
        </div>
        <div className="side-card p-4">
          <div className="text-[10px] font-bold text-muted uppercase text-blue-600">Holidays</div>
          <div className="text-xl font-extrabold mt-1 text-blue-600">{events.filter(e => e.type === 'holiday').length}</div>
        </div>
      </div>
    </div>
  );
};

export default Attendance;
