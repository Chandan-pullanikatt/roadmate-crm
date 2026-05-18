# Grill: IM My Work — Call Feedback Modal + UI Refinement
Date: 2026-05-18

## Intent
Make the Industry Manager's "My Work" page behave like the design: action buttons (Call Done, RNR, Meeting) must open a Call Feedback modal to collect notes/outcome/follow-up before submitting. Also align the page layout with the design's card proportions.

## Key decisions
- Decision: Use a popup modal for call feedback. Reason: matches design exactly. Alternative considered: inline panel.
- Decision: All 4 UI changes required: remove Lead Sources column (move it under the queue in right column), action buttons as 2x2 grid, active lead card with 2-col layout, performance/strategy as 50/50 split.

## Surfaced assumptions
- The backend already supports all outcome types via `transitionLead` with `set_feedback` + `nextAction`.
- Suggested follow-up dates come from `leadsApi.getSuggestedDates()`.
- The "Escalate" action already works via existing `openModal('update-lead')` or a separate escalate action.

## Behavior spec for the modal
- Opens when any action button is clicked (pre-selects the relevant outcome)
- Shows lead name/company in header
- Outcome chips: Connected ✅, Follow-up 📞, Meeting 🎥, RNR 📵, Converted 🏆, Not Interested ✗
- Notes textarea: always shown
- Conditional sections:
  - Follow-up → show suggested dates + time slot (Morning/Afternoon/Evening) + custom date option
  - Meeting → meeting type (Direct/Virtual) + datetime + link (virtual only) + invite manager
  - Converted → strategy note textarea + revenue amount field
  - Not Interested → strategy reflection textarea
- Submit → calls transitionLead with appropriate action + payload → moves to next lead

## Layout changes
- Active Lead + [Queue + Lead Sources] → equal 50/50 two-column grid
- Lead Sources moves into right column, stacked below the queue
- Lead table → full width (remove Lead Sources separate section)
- Performance + Strategy → 50/50 split (was 3:2)
- Action buttons → 2×2 grid (Call Done + RNR | Meeting Set + Skip/Escalate)
