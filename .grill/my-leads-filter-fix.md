# Grill: My Works → Lead Management filter fix
Date: 2026-05-23

## Intent
The "My Works → Lead Management" page should show only leads where `owner = IM's own user ID` — leads the IM is personally working. Currently it shows zero results because (a) the IM has no way to assign a lead to themselves in the Add Lead modal, and (b) the stat cards / tab counts still show all-industry numbers instead of personal totals.

## Key decisions
- Decision: Add "Assign to myself" as the first option in the IM's Add Lead allocation dropdown, setting `ownerId = currentUser._id`. Reason: this is the only way an IM can become the `owner` of a lead. Alternative considered: a separate "take lead" flow — rejected as unnecessary complexity.
- Decision: Pass `owner: ownerScope` to the `getCounts()` call when `ownerScope` is set, so tab counts reflect the scoped view. Reason: currently counts are always industry-wide regardless of scope.
- Decision: Replace the dashboard API stat cards with count-derived stats when `ownerScope` is active, since `getIndustryManagerDashboard()` has no owner filter. Reason: avoids a new backend endpoint.

## Surfaced assumptions
- The `owner=self` backend filter is already correctly implemented (from the previous build session).
- IMs genuinely have 0 leads with `owner = IM._id` because the Add Lead modal never offered that option.
