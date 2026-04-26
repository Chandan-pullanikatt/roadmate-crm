import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { leaveApi } from '../../../api/leaveApi';
import { Tag } from '../../../components/ui';
import { useAuth } from '../../../context/AuthContext';

const LeaveCalendar = () => {
  const { user: currentUser } = useAuth();
  const [viewDate, setViewDate] = useState(new Date());

  const month = viewDate.getMonth() + 1;
  const year = viewDate.getFullYear();

  const { data: calendarData, isLoading } = useQuery({
    queryKey: ['leaves', 'im-calendar', currentUser?.state, month, year],
    queryFn: () => leaveApi.getLeaveCalendar(currentUser?.state, { month, year }).then(res => res.data),
    enabled: !!currentUser?.state
  });

  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const daysInMonth = new Date(year, month, 0).getDate();
  const firstDay = new Date(year, month - 1, 1).getDay();
  const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const prevMonth = () => setViewDate(new Date(year, month - 2, 1));
  const nextMonth = () => setViewDate(new Date(year, month, 1));

  const getDayEvents = (day) => {
    if (!day) return [];
    const dateStr = new Date(year, month - 1, day).setHours(0,0,0,0);
    return calendarData?.filter(item => new Date(item.date).setHours(0,0,0,0) === dateStr) || [];
  };

  if (isLoading) return <div className="p-8 text-center text-text-muted">Loading calendar...</div>;

  return (
    <div className="space-y-6 animate-in zoom-in-95 duration-500">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold text-text-primary tracking-tight">Staff Availability Calendar</h2>
          <p className="text-sm text-text-muted">
             {monthNames[month - 1]} {year} · State: {currentUser?.state || 'N/A'}
          </p>
        </div>
        <div className="flex items-center gap-4">
           <div className="flex items-center gap-4 text-[10px] font-bold text-text-muted uppercase hidden md:flex">
              <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-red"></span> Holiday</div>
              <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-blue"></span> Leave</div>
              <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-amber"></span> Optional</div>
           </div>
           <div className="flex gap-1">
             <button className="btn btn-outline btn-xs" onClick={prevMonth}>←</button>
             <button className="btn btn-outline btn-xs" onClick={nextMonth}>→</button>
           </div>
        </div>
      </div>

      <div className="bg-surface rounded-2xl border border-border shadow-default overflow-hidden">
        <div className="grid grid-cols-7 border-b border-border bg-surface2/30">
          {weekDays.map(wd => (
            <div key={wd} className="py-4 text-center text-xs font-bold text-text-muted uppercase tracking-widest">{wd}</div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {Array.from({ length: firstDay }).map((_, i) => (
            <div key={`empty-${i}`} className="min-h-[100px] bg-surface2/10 border-b border-r border-border"></div>
          ))}
          
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1;
            const events = getDayEvents(day);
            const isToday = day === new Date().getDate() && month === (new Date().getMonth() + 1) && year === new Date().getFullYear();
            
            return (
              <div key={day} className={`min-h-[100px] border-b border-r border-border p-2 transition-colors hover:bg-surface2/20 flex flex-col gap-1 ${isToday ? 'bg-purple/5' : ''}`}>
                 <span className={`text-xs font-bold ${isToday ? 'w-6 h-6 bg-purple text-white rounded-full flex items-center justify-center' : 'text-text-secondary'}`}>
                    {day}
                 </span>
                 <div className="flex-1 space-y-1 overflow-y-auto pr-1 scrollbar-hide py-1">
                    {events.map((ev, idx) => {
                      let typeClass = 'bg-blue-light text-blue border-blue/20';
                      if (ev.type === 'holiday') typeClass = 'bg-red-light text-red border-red/20';
                      if (ev.type === 'optional_holiday') typeClass = 'bg-amber-light text-amber border-amber/20';
                      
                      return (
                        <div key={idx} className={`text-[9px] px-1.5 py-0.5 rounded border leading-tight ${typeClass}`}>
                           <p className="font-bold truncate">{ev.name}</p>
                           {ev.users && ev.users.length > 0 && <p className="opacity-70 truncate">{ev.users.join(', ')}</p>}
                        </div>
                      );
                    })}
                 </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default LeaveCalendar;
