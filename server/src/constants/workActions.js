/**
 * Lead activity actions that count as having worked a lead that day.
 *
 * Shared by attendance (day completion %) and the lead queue (which leads are
 * still pending today). Both must read the same list, otherwise a lead can be
 * "done" for attendance while the work page keeps offering it, or the reverse.
 */
const WORK_ACTIONS = [
  'called', 'rnr', 'followup_set', 'meeting_scheduled', 'meeting_done', 'meeting_confirmed',
  'converted', 'blocking_amount_received', 'full_amount_received', 'agreement_signed',
  'lost', 'not_interested', 'escalated',
];

module.exports = { WORK_ACTIONS };
