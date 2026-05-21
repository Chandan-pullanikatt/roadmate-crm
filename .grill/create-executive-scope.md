# Grill: Create Executive form scope
Date: 2026-05-22

## Intent
Restrict the "Onboard Executive" button on the Industry Manager's MyWork page so it only creates District Executives — removing the role dropdown and renaming the form title to "Create Executive".

## Constraints
The `create-exec` modal is shared across Founder, State Manager, and Industry Manager contexts. State Manager pages pass `role: 'industry-manager'` to create Industry Managers through the same form. That flow must not break.

## Key decisions
- Decision: Scope the restriction to Industry Manager context only using a `roleLocked` flag, not a global form change. Reason: the modal is shared; gutting the dropdown globally would break Founder and State Manager flows. Alternative considered: removing the dropdown entirely from GlobalModals — rejected because State Manager's IndustryManagers page depends on it.
- Decision: Detect "locked" context via `prefill.role` being set (only Industry Manager buttons pass a `prefill` with a role). Reason: zero changes required to other callers; the signal already exists in the data.

## Surfaced assumptions
- The `create-exec` modal is shared across roles — this was not obvious from the MyWork page alone.
- Founder and State Manager contexts legitimately need to create Industry Managers through the same modal.
