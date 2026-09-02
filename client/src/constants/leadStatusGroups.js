/**
 * Canonical lead-status groupings — mirror of
 * server/src/constants/leadStatusGroups.js. Change both together.
 *
 * Lead lists must bucket statuses exactly the way the dashboards do, or the
 * headline numbers stop matching the lists behind them (QA BUG-004/005/010).
 */

export const LEAD_STATUS_GROUPS = {
  New:         ['new'],
  'Follow-up': ['called', 'followup'],
  Meeting:     ['meeting_virtual', 'meeting_direct'],
  Blocking:    ['blocking_amount_received'],
  Closing:     ['full_amount_received', 'agreement_signed'],
  Converted:   ['converted'],
  Lost:        ['lost', 'not_interested'],
  RNR:         ['rnr'],
  Escalated:   ['escalated'],
};

export const GROUP_ORDER = Object.keys(LEAD_STATUS_GROUPS);

/** True if `status` belongs to the named group. */
export const isInGroup = (status, group) =>
  (LEAD_STATUS_GROUPS[group] || []).includes(status);

export default LEAD_STATUS_GROUPS;
