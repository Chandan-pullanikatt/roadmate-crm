import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { dashboardApi } from '../../../api/dashboardApi';
import { attendanceApi } from '../../../api/attendanceApi';
import { Tag } from '../../../components/ui';

const Attendance = () => {
  const [viewDate, setViewDate] = useState(new Date());
  const month = viewDate.getMonth() + 1;
  const year = viewDate.getFullYear();

  // Fetch dashboard summary
  const { data: dashboardData, isLoading: isDashLoading } = useQuery({
    queryKey: ['dashboard', 'executive'],
    queryFn: () => dashboardApi.getExecutiveDashboard().then(res => res.data)
  });

  // Fetch attendance for the selected month
  const { data: attendanceList, isLoading: isAttLoading } = useQuery({
    queryKey: ['attendance', 'list', month, year],
    queryFn: () => attendanceApi.getAttendance({ month, year }).then(res => res.data)
  });

  const stats = dashboardData?.attendance || {
    status: 'absent',
    completionPct: 0
  };

  const monthlyStats = dashboardData?.monthlyStats || {
    leaveDays: 0,
    totalLeads: 0,
    converted: 0
  };

  // Calendar logic
  const getDaysInMonth = (m, y) => new Date(y, m, 0).getDate();
  const getFirstDayOfMonth = (m, y) => new Date(y, m - 1, 1).getDay();

  const daysInMonth = getDaysInMonth(month, year);
  const firstDay = getFirstDayOfMonth(month, year);
  const calendarDays = [];
  
  for (let i = 0; i < firstDay; i++) calendarDays.push(null);
  for (let i = 1; i <= daysInMonth; i++) calendarDays.push(i);

  const prevMonth = () => setViewDate(new Date(year, month - 2, 1));
  const nextMonth = () => setViewDate(new Date(year, month, 1));

  const getDayStatus = (day) => {
    if (!day) return null;
    const dateStr = new Date(year, month - 1, day).setHours(0,0,0,0);
    const att = attendanceList?.find(a => new Date(a.date).setHours(0,0,0,0) === dateStr);
    return att;
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="section-header">
        <div>
          <div className="section-title" style={{ fontSize: '20px' }}>My Attendance</div>
          <div className="section-sub">{viewDate.toLocaleString('default', { month: 'long', year: 'numeric' })} · Work tracker & salary</div>
        </div>
      </div>

      {/* Stats Row */}
      <div className="card full-col">
        <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)'}}>
          <div className="att-stat"><div className="att-val" style={{color:'var(--accent)'}}>{attendanceList?.filter(a => a.status === 'present').length || 0}</div><div className="att-lbl">Present</div></div>
          <div className="att-stat"><div className="att-val" style={{color:'var(--red)'}}>{attendanceList?.filter(a => a.status === 'absent').length || 0}</div><div className="att-lbl">Absent</div></div>
          <div className="att-stat"><div className="att-val" style={{color:'var(--amber)'}}>{attendanceList?.filter(a => a.status === 'half-day').length || 0}</div><div className="att-lbl">Half Day</div></div>
          <div className="att-stat"><div className="att-val" style={{color:'var(--blue)'}}>{monthlyStats.leaveDays || 0}</div><div className="att-lbl">Leave</div></div>
        </div>
      </div>

      <div className="warn-box">
        <i className="ri-information-line text-amber-600"></i>
        <div style={{fontSize:'12.5px'}}>
          <strong>Auto Rules:</strong> Work &lt;30% of allotted tasks = <strong>Leave</strong> · Work &lt;70% = <strong>Half Day</strong> · Delayed login = <strong>Half Day</strong>
        </div>
      </div>

      <div className="two-col">
        {/* Calendar Card */}
        <div className="card">
          <div className="card-header">
            <div className="section-title" style={{ fontSize: '13px' }}>{viewDate.toLocaleString('default', { month: 'long' })} Attendance</div>
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
                const att = getDayStatus(day);
                const isToday = day === new Date().getDate() && month === (new Date().getMonth() + 1);
                
                let dayClass = 'cal-day';
                if (!day) dayClass += ' past';
                if (isToday) dayClass += ' today';
                if (att?.status === 'present') dayClass += ' present'; // We'll add this class to index.css
                if (att?.status === 'absent' || att?.status === 'holiday') dayClass += ' holiday'; 
                if (att?.status === 'half-day') dayClass += ' optional'; 
                if (att?.status === 'leave') dayClass += ' leave'; 

                return (
                  <div key={idx} className={dayClass}>
                    {day}
                  </div>
                );
              })}
            </div>

            <div style={{display:'flex',gap:12,marginTop:10,flexWrap:'wrap'}}>
              <span style={{fontSize:11,display:'flex',alignItems:'center',gap:4}}><span style={{width:10,height:10,borderRadius:2,background:'var(--accent-light)',border:'1px solid var(--accent)',display:'inline-block'}}></span>Today</span>
              <span style={{fontSize:11,display:'flex',alignItems:'center',gap:4}}><span style={{width:10,height:10,borderRadius:2,background:'#DCFCE7',display:'inline-block'}}></span>Present</span>
              <span style={{fontSize:11,display:'flex',alignItems:'center',gap:4}}><span style={{width:10,height:10,borderRadius:2,background:'var(--red-light)',display:'inline-block'}}></span>Absent/Leave</span>
              <span style={{fontSize:11,display:'flex',alignItems:'center',gap:4}}><span style={{width:10,height:10,borderRadius:2,background:'var(--amber-light)',display:'inline-block'}}></span>Half Day</span>
            </div>
          </div>
        </div>

        {/* Salary Card */}
        <div className="card">
          <div className="card-header">
            <div className="section-title" style={{ fontSize: '13px' }}>Salary Estimate — {viewDate.toLocaleString('default', { month: 'long' })}</div>
            <Tag label="Real-time" variant="blue" />
          </div>
          
          <div className="card-body">
            <div style={{display:'flex',flexDirection:'column',gap:10}}>
              <div style={{display:'flex',justifyContent:'space-between',padding:'8px 0',borderBottom:'1px solid var(--border)',fontSize:13}}>
                <span style={{color:'var(--text-muted)'}}>Basic Salary</span>
                <span className="mono">₹{dashboardData?.user?.basicSalary || 0}</span>
              </div>
              <div style={{display:'flex',justifyContent:'space-between',padding:'8px 0',borderBottom:'1px solid var(--border)',fontSize:13}}>
                <span style={{color:'var(--text-muted)'}}>Conversions This Month</span>
                <span className="mono">{monthlyStats.converted}</span>
              </div>
              <div style={{display:'flex',justifyContent:'space-between',padding:'8px 0',borderBottom:'1px solid var(--border)',fontSize:13}}>
                <span style={{color:'var(--accent)'}}>Incentives (₹500/conv)</span>
                <span className="mono" style={{color:'var(--accent)'}}>+ ₹{monthlyStats.converted * 500}</span>
              </div>
              <div style={{padding:'10px',background:'var(--surface2)',borderRadius:'4px',fontSize:11,color:'var(--text-muted)'}}>
                Final salary will be generated on the 1st of next month based on verified attendance and manager approval.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Attendance;
