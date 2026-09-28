import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { leadsApi } from '../../api/leadsApi';
import { DashboardSkeleton, Tag } from '../../components/ui';
import { formatWhen, scheduleFor } from '../../utils/leadSchedule';
import { callMeta } from '../../components/modals/LeadHistoryModal';

const statusVariant = (status = '') => {
  if (status === 'converted') return 'green';
  if (status.includes('meeting')) return 'blue';
  if (status === 'followup' || status === 'new') return 'amber';
  if (status === 'lost' || status === 'not_interested') return 'red';
  return 'gray';
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

        <div className="lg:col-span-2 space-y-6">
        {/* The lead's own remarks: the sheet's Remarks column on import, and every
            feedback note logged since. Kept separate from the activity log below,
            which records what happened rather than what was said. */}
        {(lead.remarks || lead.feedback?.length > 0) && (
          <div className="card border-border/40 shadow-sm">
            <div className="card-header border-border/40">
              <h2 className="text-sm font-black text-text-primary uppercase">Remarks</h2>
            </div>
            <div className="p-5 space-y-3">
              {lead.remarks && (
                <div className="p-4 rounded-xl bg-amber/5 border border-amber/20 text-[14px] text-text-primary leading-relaxed">
                  {lead.remarks}
                </div>
              )}
              {[...(lead.feedback || [])].reverse().map((f, i) => (
                // The import copies the sheet remark into feedback too, so the
                // identical first entry is skipped rather than shown twice.
                f.note && f.note !== lead.remarks ? (
                  <div key={f._id || i} className="p-4 rounded-xl bg-surface2 border border-border/40">
                    <div className="text-[14px] text-text-secondary leading-relaxed">{f.note}</div>
                    {f.createdAt && (
                      <div className="text-[11px] font-bold text-text-muted mt-1.5">
                        {new Date(f.createdAt).toLocaleString('en-IN')}
                      </div>
                    )}
                  </div>
                ) : null
              ))}
            </div>
          </div>
        )}

        <div className="card border-border/40 shadow-sm">
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
                      <div className="flex items-center gap-2 flex-wrap">
                        {callMeta(activity) && (
                          <span
                            className="text-[11px] font-bold px-1.5 py-0.5 rounded-md"
                            style={{ color: callMeta(activity).color, background: `${callMeta(activity).color}14` }}
                          >
                            📞 {callMeta(activity).label}
                          </span>
                        )}
                        <div className="text-sm font-black text-text-primary capitalize">{(activity.action || 'updated').replace(/_/g, ' ')}</div>
                      </div>
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
    </div>
  );
};

export default LeadDetail;
