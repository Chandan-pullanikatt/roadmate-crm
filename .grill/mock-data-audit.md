# Grill: Mock Data Audit — All 4 Dashboards
Date: 2026-05-18

## Intent
Ensure every dashboard uses 100% real API data with no hardcoded placeholder strings, fake percentages, or mock arrays. Extra features beyond the design are fine; nothing hardcoded should remain.

## Constraints
- No backend schema changes (only new query fields added to existing endpoints)
- founderData.js is unused — delete it
- Earnings.jsx and CompanyPolicies.jsx are intentionally "coming soon" per the design HTML — leave as-is
- Meeting Performance section in executive Performance.jsx is also design-acknowledged "coming soon" — leave as-is

## Key decisions
- Decision: Add missing growth/breakdown fields to State Manager and Founder backend endpoints. Reason: Frontend has 7 hardcoded delta strings that have no real data source. Alternative: Remove the delta text entirely — rejected because it degrades UX.
- Decision: Compute `industriesCount` on the frontend from returned `industryManagerSummary` array. Reason: No extra backend query needed.
- Decision: Fix Revenue Dashboard "12.5% from previous period" and fake `count * 0.2` calculation by adding `growthPct` and `previousCount` to the revenue endpoint response.

## Hardcoded values to fix

### State Manager Overview.jsx
1. "↑ 1 added this month" → `stats.newManagersThisMonth` (add to backend)
2. "↑ 14% vs last month" for revenue → `stats.revGrowth` (ALREADY in backend, just not used)
3. `Math.floor(stats.activeLeads * 0.15)` follow-ups today → `stats.followupsToday` (add to backend)
4. "↑ 9 vs last month" for conversions → `stats.convGrowth`% (ALREADY in backend)
5. "Across 5 industries" → computed from `industryManagerSummary` array on frontend
6. "↑ 18% vs last week" for calls → `stats.callsGrowthWeek` (add to backend)
7. "→ 4 virtual, 10 direct" for meetings → `stats.meetingsVirtual` + `stats.meetingsDirect` (add to backend)

### Founder Overview.jsx
1. "↑ 18.4% MoM" for revenue → `stats.revGrowth` (add to founder backend)

### Founder RevenueDashboard.jsx
1. "12.5% from previous {period}" → `summary.growthPct` (add to revenue endpoint)
2. `Math.round(summary.count * 0.2)` new this period → `summary.previousCount` difference (add to revenue endpoint)
