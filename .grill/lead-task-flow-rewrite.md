# Grill: Lead Task Flow Rewrite
Date: 2026-05-21

## Intent
Rewrite the industry manager's Lead Task Flow page (LeadFlow.jsx) to exactly match the HTML design, fix the crash that occurs when a session is selected, use real API data only, and make all action buttons functional.

## Constraints
- Strictly follow the two-column design layout
- Executive selector dropdown stays in top-right — same UI as before
- Default to first executive in the list (not blank/unselected)
- Action buttons are fully functional (industry manager can act on behalf of executive)
- No mock data anywhere

## Key decisions
- Decision: Keep executive selector dropdown. Reason: multiple executives exist under one IM. Alternative considered: navigate from executives tab — rejected, design implies in-page selection.
- Decision: Actions are functional, not view-only. Reason: user confirmed IMs need to be able to act; view-only has no value if you can't do anything. Alternative considered: view-only — rejected.
- Decision: Reuse ExecCallFeedbackModal for Call Completed / Mark RNR / Schedule Meeting. Reason: already handles all outcomes with full state machine. Alternative considered: inline confirm buttons — rejected, too much duplication.
- Decision: Escalate fires `open-modal` global event with type `escalate-lead`. Reason: consistent with all other escalation entry points in the app.

## Surfaced assumptions
- `queueData` from `leadsApi.getLeadQueue(userId)` returns an object `{ currentLead, taskSequence, todayMeetings, activityFeed, queueLength }` — NOT an array. The crash was caused by calling `.slice()` directly on this object.
- `taskSequence` is the correct array to use for the "Today's Queue" list.
- Task flow steps are derived from the current lead's `rnrCount` and `status`.
