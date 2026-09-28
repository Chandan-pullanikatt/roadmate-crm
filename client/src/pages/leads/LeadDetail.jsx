import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { leadsApi } from '../../api/leadsApi';
import { DashboardSkeleton, Tag } from '../../components/ui';

const statusVariant = (status = '') => {
  if (status === 'converted') return 'green';
  if (status.includes('meeting')) return 'blue';
  if (status === 'followup' || status === 'new') return 'amber';
  if (status === 'lost' || status === 'not_interested') return 'red';
  return 'gray';
};

// Dates arrive both as a real appointment time and as a bare calendar day (the
// bulk import stores midnight), so a day-only date is printed without a time
// rather than reading "00:00".
const formatWhen = (value) => {
  if (!value) return null;
  const d = new Date(value);
  if (isNaN(d.getTime())) return null;
  const dayOnly = d.getHours() === 0 && d.getMinutes() === 0;
  return d.toLocaleString('en-IN', dayOnly
    ? { day: '2-digit', month: 'short', year: 'numeric' }
    : { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

/**
 * What this lead is next due for, and what to call it.
 *
 * Which field holds the date depends on how the lead was created: meetingAt is
 * only ever written by the scheduling wizard, an imported lead carries
 * followUpDate, and a meeting worked as an ordinary follow-up keeps its meeting
 * status (the rank lock) while its date goes to nextActionAt. So every label
 * reads the same fallback chain the work queue selects on, not a single field.
 */
const scheduleFor = (lead) => {
  const chain = lead.meetingAt || lead.nextActionAt || lead.followUpDate;
  switch (lead.status) {
    case 'meeting_direct':  return ['Direct Meeting', chain];
    case 'meeting_virtual': return ['Virtual Meeting', chain];
    case 'followup':        return ['Follow-Up Date', lead.followUpDate || lead.nextActionAt];
    case 'rnr':             return ['Next Retry', lead.nextActionAt];
    case 'escalated':       return ['Awaiting Approval Since', lead.nextActionAt];
    default:                return ['Next Action', lead.nextActionAt || lead.followUpDate];
  }
};

const LeadDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const { data: lead, isLoading: leadLoading } = useQuery({
    queryKey: ['lead', id],
    queryFn: () => leadsApi.getLeadById(id).then(r => r.data),
    enabled: !!id,
  });

  const { data: activityData, isLoading: activityLoading } = useQuery({
    queryKey: ['lead-activity', id],
    queryFn: () => leadsApi.getLeadActivity(id).then(r => r.data),
    enabled: !!id,
  });

  const activities = Array.isArray(activityData) ? activityData : [];

  if (leadLoading) return <DashboardSkeleton />;

  if (!lead) {
    return (
      <div className="p-10 text-center">
        <div className="text-lg font-black text-text-primary">Lead not found</div>
        <button className="mt-4 px-4 py-2 rounded-xl bg-purple text-white text-xs font-bold" onClick={() => navigate(-1)}>
          Go Back
        </button>
      </div>
    );
  }

  const displayName = lead.name || lead.company;
  const [scheduleLabel, scheduleDate] = scheduleFor(lead);

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-12">
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div>
          <button className="text-[11px] font-bold text-purple mb-3" onClick={() => navigate(-1)}>
            Back
          </button>
          <h1 className="text-3xl font-extrabold text-text-primary tracking-tight">{displayName}</h1>
          <p className="text-[16px] text-text-muted mt-1 font-medium">
            {lead.name} · {lead.district || 'No district'} · {lead.industry || 'No industry'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Tag variant={statusVariant(lead.status)} label={(lead.status || 'new').replace(/_/g, ' ')} className="uppercase font-black" />
          <Tag variant={lead.priority === 'hot' ? 'red' : lead.priority === 'warm' ? 'amber' : 'gray'} label={lead.priority || 'cold'} className="uppercase font-black" />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="card lg:col-span-1 border-border/40 shadow-sm">
          <div className="card-header border-border/40">
            <h2 className="text-sm font-black text-text-primary uppercase">Lead Details</h2>
          </div>
          <div className="p-5 grid grid-cols-1 gap-3">
            {[
              ['Name', lead.name],
              ['Company', lead.company || '—'],
              ['Phone', lead.phone],
              ['Email', lead.email || '—'],
              ['District', lead.district || '—'],
              ['State', lead.state || '—'],
              ['Owner', lead.owner?.name || 'Unassigned'],
              ['Lead ID', lead.leadId || '—'],
              ['Source', lead.leadSource || '—'],
              [scheduleLabel, formatWhen(scheduleDate) || 'Not set'],
              // A meeting lead often carries a follow-up date too -- the rank lock
              // keeps the meeting status while the follow-up work goes on -- so it
              // is shown alongside rather than hidden behind the status.
              ...(lead.followUpDate && !['followup', 'rnr'].includes(lead.status)
                ? [['Follow-Up Date', formatWhen(lead.followUpDate)]]
                : []),
              ...(lead.lastCallAt ? [['Last Call', formatWhen(lead.lastCallAt)]] : []),
              ['Expected Revenue', lead.expectedRevenue ? `₹${lead.expectedRevenue}` : '—'],
              ['Created', lead.createdAt ? new Date(lead.createdAt).toLocaleString('en-IN') : '—'],
            ].map(([label, value]) => (
              <div key={label} className="p-3 rounded-xl bg-surface2 border border-border/40">
                <div className="text-[11px] font-bold text-text-muted uppercase tracking-wider mb-1">{label}</div>
                <div className="text-sm font-bold text-text-primary break-words">{value}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="card lg:col-span-2 border-border/40 shadow-sm">
          <div className="card-header border-border/40">
            <div>
              <h2 className="text-sm font-black text-text-primary uppercase">Complete History</h2>
              <p className="text-[14px] text-text-muted mt-1">Calls, follow-ups, meetings, conversion updates, and notes</p>
            </div>
          </div>
          <div className="p-6">
            {activityLoading ? (
              <div className="py-10 text-center text-[16px] text-text-muted">Loading history...</div>
            ) : activities.length === 0 ? (
              <div className="py-10 text-center text-[16px] text-text-muted italic">No history recorded yet.</div>
            ) : (
              <div className="relative pl-5">
                <div className="absolute left-1.5 top-1 bottom-1 w-px bg-border/70" />
                {activities.map((activity, idx) => (
                  <div key={activity._id || idx} className="relative pb-5 last:pb-0">
                    <div className={`absolute -left-[18px] top-1 w-3 h-3 rounded-full border-2 border-white ${idx === 0 ? 'bg-purple' : 'bg-border2'}`} />
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="text-sm font-black text-text-primary capitalize">{(activity.action || 'updated').replace(/_/g, ' ')}</div>
                      <div className="text-[12px] font-bold text-text-muted">
                        {activity.createdAt ? new Date(activity.createdAt).toLocaleString('en-IN') : ''}
                      </div>
                    </div>
                    {activity.performedBy?.name && (
                      <div className="text-[11px] font-bold text-purple mt-0.5">{activity.performedBy.name}</div>
                    )}
                    {activity.note && (
                      <div className="mt-2 p-3 rounded-xl bg-surface2 border border-border/40 text-[14px] text-text-secondary leading-relaxed">
                        {activity.note}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default LeadDetail;
