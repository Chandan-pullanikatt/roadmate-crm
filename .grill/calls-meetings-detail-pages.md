# Grill: Calls & Meetings Detail Pages
Date: 2026-05-21

## Intent
Clicking the Calls stat card on the Overview should navigate to a dedicated Calls page showing individual call log entries (date, executive, lead, outcome, notes). Clicking Meetings should navigate to a dedicated Meetings page showing individual meeting feedback entries across all executives. Neither should redirect to the generic Staff Performance page.

## Constraints
- Pages show real activity records — individual rows per call/meeting, not aggregate counts
- Scoped to the IM's industry/state team only
- No mock data

## Key decisions
- Decision: Add a new backend endpoint `GET /dashboard/reports/activities` with a `type` param (calls/meetings). Reason: no existing endpoint returns individual LeadActivity records scoped to a team. Alternative considered: re-using `/reports/performance` — rejected, it only returns aggregated counts per exec.
- Decision: Keep the Performance page as-is, unchanged. Reason: it has its own purpose (top performers, revenue, work %); the new pages are additive. Alternative considered: removing Performance page — rejected.
- Decision: Fix Overview stat card `page` values: Calls → 'calls', Meetings → 'meetings'. Reason: both currently point to 'performance', which is wrong for the dedicated views.
- Decision: Data mismatch (Overview shows weekly, Performance shows monthly) is a labeling issue, not a bug. Calls This Week will differ from Performance monthly calls by design — no backend change needed for this.

## Surfaced assumptions
- "Meeting feedback" = the outcome the executive logged after the meeting (connected, follow-up, converted, etc.) plus any notes — stored as LeadActivity records with action containing 'meeting'.
- "Call feedback" = each LeadActivity record with action === 'called', including its outcome note.
- The IM sees all their executives' activity, not just one.
