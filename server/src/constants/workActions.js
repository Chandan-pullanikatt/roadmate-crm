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

/**
 * Actions that each stand for one CONNECTED call.
 *
 * The call feedback modal is a single-select: a staff member picks exactly one
 * outcome per call, and that outcome is what gets logged. 'called' is only the
 * outcome for a connected call where nothing else was recorded, so counting
 * 'called' alone reported the least productive calls and nothing else -- the
 * client reported Calls as 0 for staff who had connected all day (2026-09-28).
 * Every other outcome is also recorded after someone picked up, so each one
 * counts as one connected call.
 *
 * Excluded because the call never connected:
 *   rnr           - a dialled but unanswered attempt. Client decision
 *                   (2026-09-28): Calls means conversations, not dial attempts.
 *                   The attempts are still counted on their own, as the `rnr`
 *                   figure in routes/stats.js.
 *
 * Excluded because they would count a second time for one call:
 *   meeting_done  - a mode, not an outcome. Both modals log it and then log the
 *                   outcome the caller picked inside it, so the call is already
 *                   counted by that outcome.
 *   converted     - never chosen directly any more. maybeConvert() writes it
 *                   automatically alongside full_amount_received or
 *                   agreement_signed, which are the real outcomes of the call.
 *
 * Excluded because they are desk work, not a call:
 *   escalated, reallocated, created, updated.
 *
 * 'lost' stays in: the auto-lost written when RNR attempts run out carries
 * performedBy: null, so it is never attributed to anyone's call count.
 */
const CALL_ACTIONS = [
  'called', 'followup_set', 'meeting_scheduled', 'meeting_confirmed',
  'blocking_amount_received', 'full_amount_received', 'agreement_signed',
  'lost', 'not_interested',
];

/** Mongo match fragment: `{ action: { $in: CALL_ACTIONS } }`. */
const CALL_ACTION_MATCH = { $in: CALL_ACTIONS };

/** True when an activity record represents one placed call. */
const isCallAction = (action) => CALL_ACTIONS.includes(action);

module.exports = { WORK_ACTIONS, CALL_ACTIONS, CALL_ACTION_MATCH, isCallAction };
