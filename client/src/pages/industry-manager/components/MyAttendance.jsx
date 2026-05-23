/**
 * MyAttendance — shows the Industry Manager's own attendance calendar.
 * Reuses the same attendanceApi.getAttendance() call used by executives;
 * it returns the logged-in user's records regardless of role.
 */
import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { attendanceApi } from '../../../api/attendanceApi';
import { dashboardApi } from '../../../api/dashboardApi';
import { Button } from '../../../components/ui';

const MyAttendance = () => {
  const [viewDate, setViewDate] = useState(new Date());
  const month = viewDate.getMonth() + 1;
  const year = viewDate.getFullYear();
  const queryClient = useQueryClient();

  const { data: dashData } = useQuery({
    queryKey: ['dashboard', 'industry-manager'],
    queryFn: () => dashboardApi.getIndustryManagerDashboard().then(res => res.data),
    staleTime: 5 * 60 * 1000,
  });

  const { data: events = [], isLoading } = useQuery({
    queryKey: ['attendance', 'matrix', month, year],
    queryFn: () => attendanceApi.getAttendance({ month, year }).then(res => res.data),
    staleTime: 5 * 60 * 1000,
  });

  React.useEffect(() => {
    const handleRefresh = () => {
      queryClient.invalidateQueries(['attendance', 'matrix', month, year]);
    };
    window.addEventListener('refresh-matrix', handleRefresh);
    return () => window.removeEventListener('refresh-matrix', handleRefresh);
  }, [queryClient, month, year]);

  const daysInMonth = new Date(year, month, 0).getDate();
  const firstDay   = new Date(year, month - 1, 1).getDay();
  const calendarDays = [];
  for (let i = 0; i < firstDay; i++) calendarDays.push(null);
  for (let i = 1; i <= daysInMonth; i++) calendarDays.push(i);

  const prevMonth = () => setViewDate(new Date(year, month - 2, 1));
  const nextMonth = () => setViewDate(new Date(year, month, 1));

  const getDayEvents = (day) => {
    if (!day) return [];
    const dateStr = new Date(year, month - 1, day).setHours(0, 0, 0, 0);
    return events.filter(ev => {
      const evDate = new Date(ev.date).setHours(0, 0, 0, 0);
      if (ev.type === 'leave' && ev.toDate) {
        const toDate = new Date(ev.toDate).setHours(0, 0, 0, 0);
        return dateStr >= evDate && dateStr <= toDate;
      }
      return evDate === dateStr;
    });
  };

  const getStatusClass = (ev) => {
    if (ev.type === 'holiday') return 'matrix-status-holiday';
    if (ev.type === 'leave')   return 'matrix-status-leave';
    if (ev.status === 'present') return 'matrix-status-present';
    if (ev.status === 'half_day') return 'matrix-status-half';
    return 'matrix-status-absent';
  };

  const userInfo = dashData?.user || {};
  const presentCount  = events.filter(e => e.type === 'attendance' && e.status === 'present').length;
  const leaveCount    = events.filter(e => e.type === 'leave').length;
  const holidayCount  = events.filter(e => e.type === 'holiday').length;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-400 pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="px-2.5 py-1 rounded-md bg-purple-light text-purple text-[10px] font-bold uppercase tracking-wider border border-purple/10">
              My Attendance
            </div>
          </div>
          <h1 className="text-3xl font-extrabold text-text-primary tracking-tight">My Attendance</h1>
          <p className="text-sm text-text-muted mt-1 font-medium">
            {userInfo.name} · {userInfo.industry} · Personal attendance record
          </p>
        </div>
        <div className="flex items-center gap-2 bg-surface p-1 rounded-lg border border-border">
          <button className="icon-btn btn-xs" onClick={prevMonth}>←</button>
          <span className="text-xs font-bold px-2">
            {viewDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
          </span>
          <button className="icon-btn btn-xs" onClick={nextMonth}>→</button>
        </div>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card p-5 border-l-4 border-purple">
          <div className="text-[10px] font-bold text-text-muted uppercase tracking-widest mb-2">Working Days</div>
          <div className="text-2xl font-black text-text-primary">{daysInMonth}</div>
        </div>
        <div className="card p-5 border-l-4 border-green">
          <div className="text-[10px] font-bold text-text-muted uppercase tracking-widest mb-2">Days Present</div>
          <div className="text-2xl font-black text-green">{presentCount}</div>
        </div>
        <div className="card p-5 border-l-4 border-red">
          <div className="text-[10px] font-bold text-text-muted uppercase tracking-widest mb-2">Leaves Taken</div>
          <div className="text-2xl font-black text-red">{leaveCount}</div>
        </div>
        <div className="card p-5 border-l-4 border-blue">
          <div className="text-[10px] font-bold text-text-muted uppercase tracking-widest mb-2">Holidays</div>
          <div className="text-2xl font-black text-blue">{holidayCount}</div>
        </div>
      </div>

      {/* Calendar */}
      <div className="card shadow-lg shadow-purple/5 border-border/40 overflow-hidden">
        <div className="p-5 border-b border-border bg-surface2/30 flex justify-between items-center">
          <div className="text-sm font-extrabold">
            Attendance & Leave Matrix — {viewDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
          </div>
          <div className="flex gap-4 text-[11px] font-bold text-text-muted">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-green inline-block" /> Present
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-amber inline-block" /> Leave
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-blue inline-block" /> Holiday
            </span>
          </div>
        </div>

        <div>
          <div className="grid grid-cols-7 border-b border-border">
            {['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'].map(d => (
              <div key={d} className="p-3 text-[10px] font-black text-text-muted tracking-widest text-center">{d}</div>
            ))}
          </div>
          <div className="matrix-days-grid grid grid-cols-7">
            {calendarDays.map((day, idx) => {
              const dayEvents  = getDayEvents(day);
              const isToday    = day === new Date().getDate() && month === (new Date().getMonth() + 1) && year === new Date().getFullYear();
              const isWeekend  = idx % 7 === 0 || idx % 7 === 6;
              return (
                <div
                  key={idx}
                  className={`matrix-cell border-b border-r border-border/20 p-2 min-h-[80px] ${!day ? 'bg-surface2/20' : ''} ${isWeekend ? 'bg-surface2/30' : ''} ${isToday ? 'ring-2 ring-purple/30 ring-inset' : ''}`}
                >
                  {day && (
                    <>
                      <div className={`text-[11px] font-black mb-1 ${isToday ? 'text-purple' : 'text-text-muted'}`}>
                        {day < 10 ? `0${day}` : day}
                      </div>
                      <div className="flex flex-col gap-0.5">
                        {dayEvents.map((ev, eidx) => (
                          <div key={eidx} className={`matrix-status-badge text-[9px] font-bold px-1.5 py-0.5 rounded ${getStatusClass(ev)}`}>
                            {ev.type === 'attendance' && ev.status === 'present' ? '✓ Present' : ev.label || ev.type}
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

      {/* Apply leave button */}
      <div className="flex justify-end">
        <Button
          className="rounded-xl px-6 py-2.5 font-bold text-[11px] uppercase tracking-wider"
          onClick={() => window.dispatchEvent(new CustomEvent('open-modal', { detail: 'apply-leave' }))}
        >
          Apply For Leave
        </Button>
      </div>
    </div>
  );
};

export default MyAttendance;
