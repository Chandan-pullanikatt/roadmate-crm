# Grill: Dashboard Bug Audit — All 4 Roles
Date: 2026-05-16

## Intent
Full code review of all 4 dashboards (Founder, State Manager, Industry Manager, District Executive). Find bugs, discuss each one, fix them one by one. Also answer: what is the user capacity of the CRM?

## Constraints
- Only fix what's broken — no refactoring or cleanup of working code
- Founder and State Manager: only touch if a serious bug is found (discuss first)
- Industry Manager and District Executive: full sweep, fix all bugs found
- Discuss each bug before fixing — user approves direction

## Key decisions
- Decision: review all 4 dashboards, not just IM and Executive. Reason: bugs found in Founder/State Manager testing suggest patterns that may repeat elsewhere. Alternative considered: only IM + Executive — rejected because serious errors in any dashboard should be caught.
- Decision: code review + fix, plus browser test checklist. Reason: some bugs (button state, real-time updates) require live testing to confirm.

## Surfaced assumptions
- "Working" means: page loads, no hardcoded/mock data, filters respond, buttons reset after action, managers see only their subordinates
- Bug pattern from prior testing: stale mock data not replaced, leads not reflecting immediately after add, stop-work button not resetting state
- Each manager role is scoped to their hierarchy — Industry Manager sees only their District Executives

## Open questions
- CRM user capacity (to be answered from code/infra review)

## Out of scope
- Refactoring, UI cleanup, adding new features
- Touching anything confirmed working unless it has a serious error
