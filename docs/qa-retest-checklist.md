# QA Re-Test Checklist

Re-test of the 20 bugs raised on 20 July 2026. All fixes are live on
`roadmate-crm.netlify.app` (frontend) and `roadmate-crm.onrender.com` (API).

**Before starting:** hard-refresh the browser (Ctrl+Shift+R) and keep DevTools
→ Console open throughout. If anything fails, please paste the **full** console
error text, not a screenshot — one bug below was misdiagnosed for a whole round
because the URL in a screenshot was cut off.

---

## Read this first — expected changes that are NOT bugs

Three things will look different. None of them are regressions.

1. **Follow-up and Lost counts have gone up.** Follow-up now reads ~482 where
   the list used to say ~317; Lost reads ~82 where it said ~69. The lists were
   previously undercounting — they ignored the `called` and `not_interested`
   statuses. The dashboard figure was the correct one. Please do not re-file
   this as a data mismatch.

2. **The Lead Pipeline row now has 9 boxes, not 7.** `Payment` and `Escalated`
   are new. They exist so the boxes add up to the "All" total.

3. **Leave calendars show no holidays.** The holiday table in the database is
   empty for all 7 states — nobody has entered 2026 holidays yet. The page
   loading with no holidays is correct behaviour. This is pending data entry,
   not a code fix.

Also: **Revenue shows ₹0** because no lead in the system has ever had a revenue
amount recorded. The page is reporting an empty dataset accurately.

---

## Founder

| Bug | What to check | Expected |
|---|---|---|
| BUG-001 | Sidebar → **Revenue** (now under District Executives, in Overview) | Revenue Dashboard loads. Does **not** bounce back to the main dashboard. |
| BUG-002 | Founder dashboard → Revenue Generated card → **View Analysis** | Same Revenue Dashboard opens. |
| BUG-003 | Click the **State Managers**, **Industry Managers**, **Sales Staff** cards — on the card body and the label, not just the number | A drill-down list opens for each. |
| BUG-004 | Lead Pipeline **Follow-up** vs the leads list filtered to Follow-up | Both show the same number (~482). See note 1 above. |
| BUG-005 | Lead Pipeline **Lost** vs the leads list filtered to Lost | Both show the same number (~82). |
| BUG-020 | Have an IM assign a task to a district executive, then log in as Founder → **Tasks** | The IM's task is visible to the Founder. |

## Industry Manager

| Bug | What to check | Expected |
|---|---|---|
| BUG-010 | Lead Management — add up the tab counts | The tabs sum exactly to the **All** count. |
| BUG-011 | **My Attendance** with Console open | No 500 errors. Attendance data renders. |
| BUG-012 | **My Performance** with Console open | No yellow chart-sizing warning. |
| BUG-014 | Attendance → **Export** | A CSV file actually downloads. |
| BUG-009 | Overview → District Executives → **Filter** | Opens a district list and filters the table. |
| BUG-019 | Overview → Upcoming Events | A **Today / Tomorrow** toggle appears and both work. |
| BUG-016 | Add Lead → mobile number — try typing 15 digits | Stops at 10 digits (for +91). |
| BUG-017 | Add Lead using a phone number that already exists | Orange **"Possible duplicate lead"** warning showing the existing lead, with a **Create anyway** button. Clicking it saves the lead. This is intentional — duplicates are warned about, not blocked. |
| BUG-018 | Create a task with **yesterday's** deadline, then open **Overdue** | The task appears in Overdue. |

## All roles

| Bug | What to check | Expected |
|---|---|---|
| BUG-007 | Login page → **Forgot password?** | A recovery explainer appears. See note below. |
| BUG-008 | Settings → Change Password — type slowly in New Password | Every character stays in the box. Focus no longer jumps after each keystroke. |
| BUG-006 / BUG-013 | **Notification bell**, in Lead Management and Staff Performance | See "needs your input" below. |

---

## Needs your input

**BUG-006 / BUG-013 (notification bell) — not resolved.** We could not find
anything wrong with the bell in the code, and could not reproduce the failure.
The original report said only "all bell icons are not responding". Please try
it and tell us specifically:

- does **nothing at all** happen, or
- does a panel **flash and disappear**, or
- does it work now?

Also note which page and which browser. That detail decides where we look next.

---

## Closed differently than reported

**BUG-015 (404 when requesting leave) — not a bug.** Submitting a leave request
was never broken. The 404s visible in the console on that page came from the
leave *calendar*, which has been fixed. Please confirm leave submission works.

**BUG-012 severity lowered.** It was a chart rendering warning, not a data
problem. Fixed regardless.

**BUG-007 partially addressed.** There is now a visible recovery path, and
managers can reset a subordinate's password. True self-service reset by email
is **not** built — the project has no email provider configured. Decide whether
that is needed before launch.
