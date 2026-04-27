import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { dashboardApi } from '../../../api/dashboardApi';
import { Tag, Button } from '../../../components/ui';

const Meetings = () => {
  const [filterType, setFilterType] = useState('All Types');

  const { data: meetingData, isLoading } = useQuery({
    queryKey: ['dashboard', 'meetings'],
    queryFn: () => dashboardApi.getMeetings().then(res => res.data)
  });

  if (isLoading) return <div className="p-8 text-center text-muted">Loading meetings...</div>;

  const metrics = meetingData?.metrics || {};
  const directMeetings = meetingData?.directMeetings || [];
  const virtualMeetings = meetingData?.virtualMeetings || [];

  const formatTime = (dateStr) => {
    if (!dateStr) return 'TBD';
    const date = new Date(dateStr);
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  };

  const getStatusBadge = (meeting) => {
    const status = meeting.status.toLowerCase();
    if (status.includes('done')) return <span className="m-badge completed">COMPLETED</span>;
    if (status.includes('rnr')) return <span className="m-badge rnr">RNR</span>;
    
    const now = new Date();
    const mTime = new Date(meeting.time);
    const diff = (mTime - now) / (1000 * 60);

    // Is it tomorrow?
    const isTomorrow = mTime.getDate() === now.getDate() + 1 && mTime.getMonth() === now.getMonth() && mTime.getFullYear() === now.getFullYear();

    if (diff > 0 && diff < 30) return <span className="m-badge now">NOW</span>;
    if (isTomorrow) return <span className="m-badge task">DAY-BEFORE TASK</span>;
    if (!meeting.isConfirmed) return <span className="m-badge confirm">CONFIRM</span>;
    
    return <span className="m-badge task">SCHEDULED</span>;
  };

  return (
    <div className="meetings-page animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Meetings Management</h1>
          <p className="text-sm text-muted">All scheduled, confirmed, and past meetings for this executive</p>
        </div>
        <div className="flex gap-3">
          <div className="flex items-center gap-2 bg-surface p-1 rounded-lg border border-border">
            <span className="text-xs font-bold text-muted px-2">Filter:</span>
            <select 
              className="bg-transparent border-none text-xs font-bold focus:ring-0 cursor-pointer"
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
            >
              <option>All Types</option>
              <option>Direct</option>
              <option>Virtual</option>
            </select>
          </div>
          <button className="btn btn-orange btn-sm font-bold shadow-md shadow-orange/10">+ Schedule Meeting</button>
        </div>
      </div>

      {/* Metrics Bar */}
      <div className="work-metrics-grid mb-8">
        <div className="metric-card orange">
          <div className="metric-label">DIRECT MEETINGS</div>
          <div className="metric-value">{metrics.directCount || 0}</div>
          <div className="metric-sub text-amber-600">{metrics.pendingConfirm || 0} pending confirm</div>
        </div>
        <div className="metric-card blue">
          <div className="metric-label">VIRTUAL MEETINGS</div>
          <div className="metric-value">{metrics.virtualCount || 0}</div>
          <div className="metric-sub text-blue-600">{metrics.happeningToday || 0} happening today</div>
        </div>
        <div className="metric-card green">
          <div className="metric-label">COMPLETED</div>
          <div className="metric-value">{metrics.completedMonth || 0}</div>
          <div className="metric-sub text-green-600">This month</div>
        </div>
        <div className="metric-card red">
          <div className="metric-label">RNR / CANCELLED</div>
          <div className="metric-value">{metrics.rnrCancelled || 0}</div>
          <div className="metric-sub text-red-600">Needs reschedule</div>
        </div>
      </div>

      {/* Meetings Layout */}
      <div className="meetings-grid-layout">
        
        {/* Direct Meetings Column */}
        <div className="m-column">
          <div className="section-label-v2">
            <span className="text-xl">🤝</span> Direct Meetings
          </div>
          {directMeetings.length === 0 ? (
            <div className="p-12 text-center text-muted border border-dashed rounded-xl bg-surface2/50">No direct meetings scheduled</div>
          ) : (
            directMeetings.map(m => (
              <div key={m.id} className="meeting-card-v2 direct">
                <div className="m-card-header">
                  <div>
                    <div className="m-company-name">{m.company}</div>
                    <div className="m-time-loc">Today · {formatTime(m.time)} · {m.location}</div>
                  </div>
                  {getStatusBadge(m)}
                </div>
                <div className="m-contact-info">
                  <div>Contact: <strong>{m.contactName} ({m.contactRole})</strong></div>
                  <div>Revenue Potential: <span className="m-revenue">₹{(m.revenuePotential / 100000).toFixed(1)}L/Yr</span></div>
                </div>
                <div className="m-actions">
                  <button className="btn btn-ghost btn-xs">View History</button>
                  <button className="btn btn-outline btn-xs">Update Lead</button>
                  {!m.isConfirmed && <button className="btn btn-orange btn-xs">Confirm Visit</button>}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Virtual Meetings Column */}
        <div className="m-column">
          <div className="section-label-v2">
            <span className="text-xl">🎥</span> Virtual Meetings
          </div>
          {virtualMeetings.length === 0 ? (
            <div className="p-12 text-center text-muted border border-dashed rounded-xl bg-surface2/50">No virtual meetings scheduled</div>
          ) : (
            virtualMeetings.map(m => (
              <div key={m.id} className="meeting-card-v2 virtual">
                <div className="m-card-header">
                  <div>
                    <div className="m-company-name">{m.company}</div>
                    <div className="m-time-loc">Today · {formatTime(m.time)} · {m.link ? 'Zoom/Meet' : 'Link TBD'}</div>
                  </div>
                  {getStatusBadge(m)}
                </div>
                <div className="m-contact-info">
                  <div>Contact: <strong>{m.contactName} ({m.contactRole})</strong></div>
                  <div>Revenue Potential: <span className="m-revenue">₹{(m.revenuePotential / 100000).toFixed(1)}L/Yr</span></div>
                </div>
                <div className="m-actions">
                  {m.link ? (
                    <button className="btn btn-primary btn-xs" onClick={() => window.open(m.link, '_blank')}>Join Meeting</button>
                  ) : (
                    <button className="btn btn-outline btn-xs">Set Link</button>
                  )}
                  <button className="btn btn-ghost btn-xs">History</button>
                </div>
              </div>
            ))
          )}
        </div>

      </div>
    </div>
  );
};

export default Meetings;
