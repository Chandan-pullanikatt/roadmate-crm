/**
 * When a lead is next due, and what to call it.
 *
 * Which field holds the date depends on how the lead was created, so nothing here
 * reads a single field: `meetingAt` is only ever written by the scheduling wizard,
 * an imported lead carries `followUpDate`, and a meeting worked as an ordinary
 * follow-up keeps its meeting status (the rank lock) while its date goes to
 * `nextActionAt`. This is the same fallback chain leadService.getQueue selects the
 * day's work on — the label and the queue must never disagree about a lead.
 */

/**
 * Dates arrive both as a real appointment time and as a bare calendar day (the
 * bulk import stores midnight), so a day-only date is printed without a time
 * rather than reading "00:00".
 */
export const formatWhen = (value) => {
  if (!value) return null;
  const d = new Date(value);
  if (isNaN(d.getTime())) return null;
  const dayOnly = d.getHours() === 0 && d.getMinutes() === 0;
  return d.toLocaleString('en-IN', dayOnly
    ? { day: '2-digit', month: 'short', year: 'numeric' }
    : { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

/** [label, date] for the lead's own next commitment. */
export const scheduleFor = (lead = {}) => {
  const chain = lead.meetingAt || lead.nextActionAt || lead.followUpDate;
  switch (lead.status) {
    case 'meeting_direct':  return ['Direct Meeting', chain];
    case 'meeting_virtual': return ['Virtual Meeting', chain];
    case 'followup':
    case 'business_lead':   return ['Follow-Up Date', lead.followUpDate || lead.nextActionAt];
    case 'rnr':             return ['Next Retry', lead.nextActionAt];
    case 'escalated':       return ['Awaiting Approval Since', lead.nextActionAt];
    default:                return ['Next Action', lead.nextActionAt || lead.followUpDate];
  }
};

/** The same thing ready to render: { label, value } with a readable fallback. */
export const scheduleField = (lead) => {
  const [label, date] = scheduleFor(lead);
  return { label, value: formatWhen(date) || 'Not set' };
};
