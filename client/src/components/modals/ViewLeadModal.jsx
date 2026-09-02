import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Modal, Button } from '../ui';
import { leadsApi } from '../../api/leadsApi';
import { ACTION_META } from './LeadHistoryModal';

/**
 * Read-only view of everything recorded against a lead, plus its activity
 * trail. Opened from the Allocate / Edit row actions; Edit hands off to the
 * update modal rather than duplicating an editable form here.
 */

const formatDate = (d, withTime = false) => {
  if (!d) return null;
  const date = new Date(d);
  if (isNaN(date.getTime())) return null;
  return date.toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
    ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  });
};

const titleCase = (v) =>
  String(v || '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

const formatMoney = (n) =>
  typeof n === 'number' && n > 0 ? `₹${n.toLocaleString('en-IN')}` : null;

const Field = ({ label, value }) => {
  if (value === null || value === undefined || value === '') return null;
  return (
    <div className="min-w-0">
      <div className="text-[10px] font-bold uppercase tracking-wider text-text-muted">{label}</div>
      <div className="text-[13px] font-medium text-text-primary mt-0.5 break-words">{value}</div>
    </div>
  );
};

const Section = ({ title, children }) => {
  // Hide a whole section when every field inside it came back empty.
  const hasContent = React.Children.toArray(children).some(Boolean);
  if (!hasContent) return null;
  return (
    <div className="rounded-xl border border-border/60 bg-surface2/20 p-5">
      <div className="text-[11px] font-black uppercase tracking-widest text-text-muted mb-4">{title}</div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">{children}</div>
    </div>
  );
};

const PRIORITY_STYLES = {
  hot:  'bg-red/5 text-red border-red/20',
  warm: 'bg-amber/5 text-amber border-amber/20',
  cold: 'bg-blue/5 text-blue border-blue/20',
};

const ViewLeadModal = ({ isOpen, onClose, leadId, onEdit }) => {
  const [tab, setTab] = useState('details');

  const { data: lead, isLoading, isError } = useQuery({
    queryKey: ['lead', leadId],
    queryFn: () => leadsApi.getLeadById(leadId).then(r => r.data),
    enabled: !!leadId && isOpen,
    staleTime: 60 * 1000,
  });

  const { data: activities = [], isLoading: activityLoading } = useQuery({
    queryKey: ['lead-activity', leadId],
    queryFn: () => leadsApi.getLeadActivity(leadId).then(r => r.data),
    enabled: !!leadId && isOpen && tab === 'history',
    staleTime: 60 * 1000,
  });

  const handleClose = () => {
    setTab('details');
    onClose();
  };

  const renderDetails = () => (
    <div className="space-y-4">
      <Section title="Contact">
        <Field label="Lead Name" value={lead.name} />
        <Field label="Company" value={lead.company} />
        <Field label="Phone" value={lead.phone} />
        <Field label="Email" value={lead.email} />
      </Section>

      <Section title="Status">
        <Field label="Status" value={titleCase(lead.status)} />
        <Field label="Priority" value={titleCase(lead.priority)} />
        <Field label="Sub Status" value={titleCase(lead.subStatus)} />
        <Field label="Outcome" value={lead.outcome} />
        <Field label="Next Action" value={lead.nextAction} />
        <Field label="RNR Count" value={lead.rnrCount || null} />
      </Section>

      <Section title="Assignment">
        <Field label="Owner" value={lead.owner?.name || 'Unassigned'} />
        <Field label="Allocated By" value={lead.allocatedBy?.name} />
        <Field label="Lead Handling" value={lead.leadHandling} />
      </Section>

      <Section title="Location">
        <Field label="Country" value={lead.country} />
        <Field label="State" value={lead.state} />
        <Field label="District" value={lead.district} />
        <Field label="Region Type" value={lead.regionType} />
        <Field label="Region" value={lead.region} />
      </Section>

      <Section title="Business">
        <Field label="Industry" value={lead.industry} />
        <Field label="Lead Source" value={lead.leadSource} />
        <Field label="Partnership Category" value={lead.partnershipCategory} />
        <Field label="Revenue Category" value={titleCase(lead.revenueCategory)} />
        <Field label="Expected Revenue" value={formatMoney(lead.expectedRevenue)} />
        <Field label="Actual Revenue" value={formatMoney(lead.actualRevenue)} />
      </Section>

      <Section title="Dates">
        <Field label="Created" value={formatDate(lead.createdAt)} />
        <Field label="Last Call" value={formatDate(lead.lastCallAt, true)} />
        <Field label="Next Action Due" value={formatDate(lead.nextActionAt, true)} />
        <Field label="Follow-up" value={formatDate(lead.followUpDate)} />
        <Field label="Meeting" value={formatDate(lead.meetingAt, true)} />
        <Field label="Converted" value={formatDate(lead.convertedAt)} />
        <Field label="Blocking Amount" value={formatDate(lead.blockingDate)} />
        <Field label="Full Amount" value={formatDate(lead.fullAmountReceivedDate)} />
        <Field label="Follow-ups Done" value={lead.followUpCount || null} />
      </Section>

      <Section title="Notes">
        <Field label="Notes" value={lead.notes} />
        <Field label="Remarks" value={lead.remarks} />
        <Field label="Follow-up Notes" value={lead.followUpNotes} />
        <Field label="Strategy Note" value={lead.strategyNote} />
        <Field label="Escalation Note" value={lead.escalationNote} />
        <Field label="Reason for Loss" value={lead.reasonForLost} />
      </Section>

      {lead.feedback?.length > 0 && (
        <div className="rounded-xl border border-border/60 bg-surface2/20 p-5">
          <div className="text-[11px] font-black uppercase tracking-widest text-text-muted mb-4">
            Feedback ({lead.feedback.length})
          </div>
          <div className="space-y-2">
            {[...lead.feedback].reverse().map((f, i) => (
              <div key={f._id || i} className="bg-white rounded-lg border border-border/60 px-4 py-3">
                <div className="text-[13px] text-text-primary">{f.note}</div>
                <div className="text-[10px] font-bold text-text-muted mt-1">{formatDate(f.createdAt, true)}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {lead.documents?.length > 0 && (
        <div className="rounded-xl border border-border/60 bg-surface2/20 p-5">
          <div className="text-[11px] font-black uppercase tracking-widest text-text-muted mb-4">
            Documents ({lead.documents.length})
          </div>
          <div className="space-y-2">
            {lead.documents.map((d, i) => (
              <a
                key={d.fileKey || i}
                href={d.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between bg-white rounded-lg border border-border/60 px-4 py-3 hover:border-blue/40 transition-colors"
              >
                <span className="text-[13px] font-medium text-text-primary truncate">{d.name}</span>
                <span className="text-[10px] font-black uppercase tracking-wider text-blue shrink-0 ml-3">Open ↗</span>
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  const renderHistory = () => {
    if (activityLoading) {
      return <div className="py-12 text-center text-text-muted text-sm">Loading activity log…</div>;
    }
    if (!activities.length) {
      return <div className="py-12 text-center text-text-muted italic text-sm">No activity recorded for this lead yet.</div>;
    }
    return (
      <div className="relative">
        <div className="absolute left-5 top-0 bottom-0 w-px bg-border" />
        <div className="space-y-1">
          {activities.map((a, idx) => {
            const meta = ACTION_META[a.action] || { icon: '⚡', label: titleCase(a.action), color: '#6B7280' };
            return (
              <div key={a._id || idx} className="flex gap-4 relative pl-12 py-3">
                <div
                  className="absolute left-3.5 top-4 w-3 h-3 rounded-full border-2 border-white shadow-sm"
                  style={{ background: meta.color }}
                />
                <div className="flex-1 bg-surface2/30 rounded-xl border border-border/60 px-4 py-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-base">{meta.icon}</span>
                      <span className="text-[13px] font-bold text-text-primary">{meta.label}</span>
                    </div>
                    <span className="text-[10px] font-bold text-text-muted shrink-0">
                      {formatDate(a.createdAt, true)}
                    </span>
                  </div>
                  {a.note && <div className="text-[12.5px] text-text-secondary mt-1.5">{a.note}</div>}
                  {a.performedBy?.name && (
                    <div className="text-[10px] font-bold text-text-muted mt-1.5">by {a.performedBy.name}</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Lead Details"
      subtitle={lead ? `${lead.name}${lead.company ? ` · ${lead.company}` : ''}` : ''}
      className="modal-lg"
    >
      {isLoading ? (
        <div className="py-16 text-center text-text-muted text-sm">Loading lead…</div>
      ) : isError || !lead ? (
        <div className="py-16 text-center text-text-muted italic text-sm">
          Could not load this lead. It may have been removed.
        </div>
      ) : (
        <div className="space-y-5">
          {/* Summary strip */}
          <div className="flex flex-wrap items-center gap-2">
            <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${PRIORITY_STYLES[lead.priority] || PRIORITY_STYLES.cold}`}>
              {lead.priority || 'cold'}
            </span>
            <span className="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border border-border bg-surface2 text-text-secondary">
              {titleCase(lead.status)}
            </span>
            {lead.leadId && (
              <span className="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border border-border bg-white text-text-muted font-mono">
                {lead.leadId}
              </span>
            )}
          </div>

          {/* Tabs */}
          <div className="flex gap-2 border-b border-border">
            {[
              { id: 'details', label: 'Details' },
              { id: 'history', label: 'Activity History' },
            ].map(t => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`px-4 py-2 text-xs font-bold transition-colors border-b-2 -mb-px ${
                  tab === t.id
                    ? 'border-[#0f766e] text-[#0f766e]'
                    : 'border-transparent text-text-muted hover:text-text-primary'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="max-h-[52vh] overflow-y-auto pr-1 custom-scrollbar">
            {tab === 'details' ? renderDetails() : renderHistory()}
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-border">
            <Button variant="outline" className="bg-white" onClick={handleClose}>Close</Button>
            {onEdit && (
              <Button
                className="bg-[#0f766e] text-white border-none"
                onClick={() => { handleClose(); onEdit(lead); }}
              >
                Edit Lead
              </Button>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
};

export default ViewLeadModal;
