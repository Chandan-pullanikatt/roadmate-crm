/**
 * Canonical lead-status groupings — mirror of
 * server/src/constants/leadStatusGroups.js. Change both together.
 *
 * Lead lists must bucket statuses exactly the way the dashboards do, or the
 * headline numbers stop matching the lists behind them (QA BUG-004/005/010).
 */

export const LEAD_STATUS_GROUPS = {
  New:                    ['new'],
  'Follow-up':            ['called', 'followup'],
  Meeting:                ['meeting_virtual', 'meeting_direct'],
  Blocking:               ['blocking_amount_received'],
  'Full Amount Received': ['full_amount_received'],
  // Signing is the last act: it lands the lead in Converted. 'agreement_signed'
  // is grouped here only so the enum stays fully covered — recordStatus refuses
  // to leave a lead resting on it (see leadService.js).
  Converted:              ['converted', 'agreement_signed'],
  Lost:                   ['lost', 'not_interested'],
  RNR:                    ['rnr'],
  Escalated:              ['escalated'],
};

export const GROUP_ORDER = Object.keys(LEAD_STATUS_GROUPS);

/** True if `status` belongs to the named group. */
export const isInGroup = (status, group) =>
  (LEAD_STATUS_GROUPS[group] || []).includes(status);

/** URL/tab slug for a group label: 'Follow-up' -> 'follow_up'. */
export const groupParam = (label) =>
  String(label).toLowerCase().replace(/[^a-z0-9]+/g, '_');

const GROUP_PARAMS = Object.fromEntries(
  GROUP_ORDER.map(label => [groupParam(label), LEAD_STATUS_GROUPS[label]])
);

/**
 * Slugs that older links, saved tabs and bookmarks still carry. 'closing' was
 * the single bucket holding paid-but-unsigned and signed-but-unpaid before the
 * two were split into their own cards.
 */
const LEGACY_PARAMS = {
  followup: LEAD_STATUS_GROUPS['Follow-up'],
  'follow-up': LEAD_STATUS_GROUPS['Follow-up'],
  negotiation: LEAD_STATUS_GROUPS['Follow-up'],
  // 'closing' held paid-but-unsigned and signed-but-unpaid before the stages
  // were split into their own cards.
  closing: ['full_amount_received', 'agreement_signed'],
};

/**
 * Statuses a pipeline-card slug should filter the lead list to. Falls back to
 * the value itself so a raw status ('called', 'not_interested') still works.
 * Returns [] for 'all'/empty, meaning "do not filter".
 */
export const statusesForParam = (param) => {
  const key = String(param ?? '').trim().toLowerCase();
  if (!key || key === 'all') return [];
  return GROUP_PARAMS[key] || LEGACY_PARAMS[key] || [key];
};

export default LEAD_STATUS_GROUPS;
