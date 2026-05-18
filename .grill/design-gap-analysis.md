# Grill: Design Gap Analysis — Executive & Industry Manager Dashboards
Date: 2026-05-17

## Intent
Ensure both dashboards implement every feature shown in the HTML design files. Extra features already in the implementation are fine; missing ones must be added.

## Constraints
- Tackle Executive dashboard first, then Industry Manager
- Backend already returns revenueToday, hotPipelineCount, completionPct, and points for executive — no server changes needed for gap fixes
- Keep existing stat cards plus add missing ones (7 total on Start My Work, not replace)

## Key decisions
- Decision: Keep Calls card + add Revenue Today + Hot Pipeline (7 cards instead of matching design's 6). Reason: user prefers more data visible over strict design fidelity for this specific element.
- Decision: Use placeholder pages for Earnings & Payouts and Company Policies — design itself shows placeholders ("coming soon"). No real content to build.

## Executive Dashboard gaps confirmed
1. Sidebar missing "RESOURCES" section with three nav links: Hierarchy Status, Earnings & Payouts, Company Policies
2. ExecutiveDashboard.jsx missing routes: `earnings`, `policies`
3. Two new page components needed: Earnings.jsx, CompanyPolicies.jsx
4. MyWorkToday.jsx stat grid: add Revenue Today card + Hot Pipeline card (both data fields exist in backend response)
5. Attendance card: rename COMPLETION → Attendance, add payout warning logic (if completionPct < 50 → Half-Day Payout warning)

## Industry Manager dashboard gaps
To be analyzed after Executive is complete.
