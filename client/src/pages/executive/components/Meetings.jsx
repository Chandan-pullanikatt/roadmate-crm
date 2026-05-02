import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { dashboardApi } from '../../../api/dashboardApi';

const STATUS_TABS = ['All', 'Confirm Pending', 'Confirmed', 'Today', 'RNR'];

const Meetings = () => {
  const [filterType, setFilterType] = useState('All Types');
  const [filterStatus, setFilterStatus] = useState('All');

  const { data: meetingData, isLoading } = useQuery({
    queryKey: ['dashboard', 'meetings'],
    queryFn: () => dashboardApi.getMeetings().then(res => res.data)
  });

  const openModal = (type, data = null) => {
    window.dispatchEvent(new CustomEvent('open-modal', {
      detail: typeof type === 'string' ? { type, ...data } : type
    }));
  };

  if (isLoading) return <div className="p-8 text-center text-muted">Loading meetings...</div>;

  const metrics = meetingData?.metrics || {};
  const allDirectMeetings   = meetingData?.directMeetings  || [];
  const allVirtualMeetings  = meetingData?.virtualMeetings || [];

  const now = new Date();

  const classifyMeeting = (m) => {
    const mTime = new Date(m.time);
    const diff  = (mTime - now) / (1000 * 60);
    const isToday = mTime.toDateString() === now.toDateString();

    if (m.status?.toLowerCase().includes('done'))  return 'completed';
    if (m.status?.toLowerCase().includes('rnr'))   return 'rnr';
    if (isToday && diff > 0 && diff < 30)          return 'today';
    if (m.isConfirmed)                             return 'confirmed';
    return 'pending';
  };

  const applyFilters = (list) => {
    return list.filter(m => {
      if (filterType !== 'All Types') {
        const isVirtual = !!m.link;
        if (filterType === 'Direct'  &&  isVirtual) return false;
        if (filterType === 'Virtual' && !isVirtual) return false;
      }
      if (filterStatus !== 'All') {
        const cls = classifyMeeting(m);
        if (filterStatus === 'Confirm Pending' && cls !== 'pending')   return false;
        if (filterStatus === 'Confirmed'       && cls !== 'confirmed') return false;
        if (filterStatus === 'Today'           && cls !== 'today')     return false;
        if (filterStatus === 'RNR'             && cls !== 'rnr')       return false;
      }
      return true;
    });
  };

  const directMeetings  = applyFilters(allDirectMeetings);
  const virtualMeetings = applyFilters(allVirtualMeetings);

  const formatTime = (dateStr) => {
    if (!dateStr) return 'TBD';
    return new Date(dateStr).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  };

  const getStatusBadge = (meeting) => {
    const cls = classifyMeeting(meeting);
    if (cls === 'completed') return <span className="m-badge completed">COMPLETED</span>;
    if (cls === 'rnr')       return <span className="m-badge rnr">RNR</span>;
    if (cls === 'today')     return <span className="m-badge now">NOW</span>;
    if (cls === 'confirmed') return <span className="m-badge task">CONFIRMED</span>;
    return <span className="m-badge confirm">CONFIRM</span>;
  };

  return (
    <div className="meetings-page animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Meetings Management</h1>
          <p className="text-sm text-muted">All scheduled, confirmed, and past meetings for this executive</p>
        </div>
        <button className="btn btn-orange btn-sm font-bold shadow-md shadow-orange/10" onClick={() => openModal('schedule-meeting')}>
          + Schedule Meeting
        </button>
      </div>

      {/* Metrics Bar */}
      <div className="work-metrics-grid mb-6">
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

      {/* Filter bar */}
      <div className="flex items-center gap-3 mb-6 p-3 bg-surface rounded-xl border border-border">
        {/* Type filter */}
        <div className="flex items-center gap-2 bg-surface2 p-1 rounded-lg border border-border">
          <span className="text-xs font-bold text-muted px-2">Type:</span>
          <select
            className="bg-transparent border-none text-xs font-bold focus:ring-0 cursor-pointer"
            value={filterType}
            onChange={e => setFilterType(e.target.value)}
          >
            <option>All Types</option>
            <option>Direct</option>
            <option>Virtual</option>
          </select>
        </div>

        {/* Status filter tabs */}
        <div className="flex bg-surface2 p-1 rounded-lg border border-border gap-1">
          {STATUS_TABS.map(tab => (
            <button
              key={tab}
              onClick={() => setFilterStatus(tab)}
              className={`px-3 py-1 rounded-md text-[11px] font-bold transition-all ${
                filterStatus === tab
                  ? 'bg-white text-text-primary shadow-sm'
                  : 'text-text-muted hover:text-text-secondary'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="ml-auto text-[11px] text-text-muted font-medium">
          {directMeetings.length + virtualMeetings.length} meeting{directMeetings.length + virtualMeetings.length !== 1 ? 's' : ''} shown
        </div>
      </div>

      {/* Meetings Layout */}
      <div className="meetings-grid-layout">

        {/* Direct Meetings Column */}
        <div className="m-column">
          <div className="section-label-v2">
            <span className="text-xl">🤝</span> Direct Meetings
            <span className="ml-2 text-[11px] font-bold text-text-muted">({directMeetings.length})</span>
          </div>
          {directMeetings.length === 0 ? (
            <div className="p-12 text-center text-muted border border-dashed rounded-xl bg-surface2/50">
              No direct meetings {filterStatus !== 'All' ? `with status "${filterStatus}"` : 'scheduled'}
            </div>
          ) : (
            directMeetings.map(m => (
              <div key={m.id} className="meeting-card-v2 direct">
                <div className="m-card-header">
                  <div>
                    <div className="m-company-name">{m.company}</div>
                    <div className="m-time-loc">
                      {new Date(m.time).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} · {formatTime(m.time)} · {m.location}
                    </div>
                  </div>
                  {getStatusBadge(m)}
                </div>
                <div className="m-contact-info">
                  <div>Contact: <strong>{m.contactName} ({m.contactRole})</strong></div>
                  <div>Revenue Potential: <span className="m-revenue">₹{(m.revenuePotential / 100000).toFixed(1)}L/Yr</span></div>
                </div>
                <div className="m-actions">
                  <button
                    className="btn btn-ghost btn-xs"
                    onClick={() => openModal('lead-history', { leadId: m.id, leadName: m.company })}
                  >
                    View History
                  </button>
                  <button className="btn btn-outline btn-xs" onClick={() => openModal('update-lead', { leadData: { _id: m.id, ...m } })}>Reschedule</button>
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
            <span className="ml-2 text-[11px] font-bold text-text-muted">({virtualMeetings.length})</span>
          </div>
          {virtualMeetings.length === 0 ? (
            <div className="p-12 text-center text-muted border border-dashed rounded-xl bg-surface2/50">
              No virtual meetings {filterStatus !== 'All' ? `with status "${filterStatus}"` : 'scheduled'}
            </div>
          ) : (
            virtualMeetings.map(m => (
              <div key={m.id} className="meeting-card-v2 virtual">
                <div className="m-card-header">
                  <div>
                    <div className="m-company-name">{m.company}</div>
                    <div className="m-time-loc">
                      {new Date(m.time).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} · {formatTime(m.time)} · {m.link ? 'Zoom/Meet' : 'Link TBD'}
                    </div>
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
                    <button className="btn btn-outline btn-xs" onClick={() => openModal('update-lead', { leadData: { _id: m.id, ...m } })}>Set Link</button>
                  )}
                  <button
                    className="btn btn-ghost btn-xs"
                    onClick={() => openModal('lead-history', { leadId: m.id, leadName: m.company })}
                  >
                    History
                  </button>
                  <button className="btn btn-outline btn-xs" onClick={() => openModal('update-lead', { leadData: { _id: m.id, ...m } })}>Reschedule</button>
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
