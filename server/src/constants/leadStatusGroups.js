/**
 * Canonical lead-status groupings.
 *
 * Dashboards and lead lists must bucket statuses identically, otherwise the
 * headline figures stop reconciling with the underlying lists (QA BUG-004,
 * BUG-005, BUG-010). Every status in the Lead schema enum must appear in
 * exactly one group here — assertGroupsCoverEnum() enforces that.
 *
 * Mirrored on the client in client/src/constants/leadStatusGroups.js.
 * Change both together.
 */

const LEAD_STATUS_GROUPS = {
  New:        ['new'],
  'Follow-up': ['called', 'followup'],
  Meeting:    ['meeting_virtual', 'meeting_direct'],
  Converted:  ['converted'],
  Payment:    ['blocking_amount_received', 'full_amount_received', 'agreement_signed'],
  Lost:       ['lost', 'not_interested'],
  RNR:        ['rnr'],
  Escalated:  ['escalated'],
};

const GROUP_ORDER = Object.keys(LEAD_STATUS_GROUPS);

/** Flat list of every status covered by a group. */
const ALL_GROUPED_STATUSES = GROUP_ORDER.flatMap(g => LEAD_STATUS_GROUPS[g]);

/**
 * Throws if the schema enum and the groups above have drifted apart.
 * Called at startup so a new status can never silently vanish from a dashboard.
 */
const assertGroupsCoverEnum = (enumValues) => {
  const grouped = new Set(ALL_GROUPED_STATUSES);
  const missing = enumValues.filter(s => !grouped.has(s));
  const unknown = ALL_GROUPED_STATUSES.filter(s => !enumValues.includes(s));
  if (missing.length || unknown.length) {
    throw new Error(
      `leadStatusGroups is out of sync with the Lead status enum. ` +
      `Ungrouped statuses: [${missing.join(', ')}]. Unknown statuses: [${unknown.join(', ')}].`
    );
  }
};

module.exports = { LEAD_STATUS_GROUPS, GROUP_ORDER, ALL_GROUPED_STATUSES, assertGroupsCoverEnum };
