# Grill: SM→IM lead visibility fix
Date: 2026-05-23

## Intent
Leads created by the State Manager and assigned to the Industry Manager should appear in the IM's "My Works → Lead Management" (owner=self) view.

## Key decisions
- Decision: Skip `query.industry` scope when `owner === 'self'` (GET list + counts). Reason: `owner = IM._id` is already maximally specific; the industry scope adds a redundant AND that breaks cross-role assignments.
- Decision: In POST /api/leads, look up the assigned owner's profile and auto-inherit `industry` (and `state` if missing). Reason: correct attribution at creation time prevents future mismatch for all queries, not just owner=self.
- Decision: In the SM's Add Lead form, auto-populate `industry` from the selected IM's profile when an IM is chosen. Reason: prevents the bad data from ever being saved.

## Surfaced assumptions
- The POST route already sets `payload.state` when SM creates a lead, but never sets `payload.industry`. This was an intentional scoping rule that has a side-effect when the lead is assigned cross-role.
- The industry scope on GET was designed to prevent IMs from seeing other industry's leads, but it was not designed to handle cross-role assignment.
