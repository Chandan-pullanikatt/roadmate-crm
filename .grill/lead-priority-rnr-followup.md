# Grill: Lead Priority Selector & RNR Follow-up Fix
Date: 2026-05-21

## Intent
Add a hot/warm/cold priority selector to the call feedback modal (My Work page) so executives can categorize leads after every call. Also fix RNR auto-escalation so it only applies to new leads — follow-up leads that RNR should just re-queue, not auto-reallocate.

## Constraints
- Priority selector is optional, pre-filled with the lead's current priority
- Exclamation icon shows tooltip with definitions: Hot = Interested, budget available, meeting done / Warm = Interested but undecided / Cold = Not ready / no response
- Priority must persist to the DB on every submission
- RNR for follow-up leads: re-queue only, no progressive escalation, no auto-reallocation

## Key decisions
- Decision: Pre-fill priority from `lead.priority`, default to 'warm' if unset. Reason: executives see what it currently is and only change if needed. Alternative considered: always blank — rejected, too much friction.
- Decision: Priority saved on mark_called, set_feedback, and mark_rnr transitions. Reason: every submit path must persist it. Alternative considered: separate API call — rejected, unnecessary round trip.
- Decision: Follow-up RNR re-queues next day (flat 24h delay), skips ALL progressive escalation. Reason: a lead that has already had a meeting/call and is in follow-up is a warmer relationship — auto-reallocation at 4+ RNRs would break continuity with the executive who built the relationship. Alternative considered: different threshold (e.g. 6 RNRs for followup) — rejected by user.

## Surfaced assumptions
- `lead.priority` is already a DB field (confirmed in Lead model).
- All three transition paths (mark_called, set_feedback, mark_rnr) need to save priority.
- "My Work" page = executive's MyWorkToday.jsx, feedback via ExecCallFeedbackModal.
