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
  New:                    ['new'],
  'Follow-up':            ['called', 'followup'],
  // Virtual and Direct are separate pipeline stages: they are scheduled,
  // confirmed and targeted differently, so they never share a card.
  'Virtual Meeting':      ['meeting_virtual'],
  'Direct Meeting':       ['meeting_direct'],
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

const GROUP_ORDER = Object.keys(LEAD_STATUS_GROUPS);

/** Flat list of every status covered by a group. */
const ALL_GROUPED_STATUSES = GROUP_ORDER.flatMap(g => LEAD_STATUS_GROUPS[g]);

/** URL/tab slug for a group label: 'Follow-up' -> 'follow_up'. */
const groupParam = (label) =>
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
  // 'meeting' was the single bucket holding both meeting types before they
  // were split into their own cards.
  meeting: ['meeting_virtual', 'meeting_direct'],
  // 'closing' held paid-but-unsigned and signed-but-unpaid before the stages
  // were split into their own cards.
  closing: ['full_amount_received', 'agreement_signed'],
};

/**
 * Statuses a pipeline-card slug should filter the lead list to. Falls back to
 * the value itself so a raw status ('called', 'not_interested') still works.
 * Returns [] for 'all'/empty, meaning "do not filter".
 */
const statusesForParam = (param) => {
  const key = String(param ?? '').trim().toLowerCase();
  if (!key || key === 'all') return [];
  return GROUP_PARAMS[key] || LEGACY_PARAMS[key] || [key];
};

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

module.exports = {
  LEAD_STATUS_GROUPS,
  GROUP_ORDER,
  ALL_GROUPED_STATUSES,
  groupParam,
  statusesForParam,
  assertGroupsCoverEnum,
};
