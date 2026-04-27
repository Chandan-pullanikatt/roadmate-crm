# RoadMate CRM Handover Checklist

## Environment
- Copy `server/.env.example` to `.env` and fill MongoDB, JWT, client URL, and Cloudflare R2 credentials.
- Confirm production `CLIENT_URL` matches the frontend domain for CORS and Socket.io.
- Run the seed script on an empty database and verify founder login works.

## Mandatory Verification
- Client app starts and all four role dashboards load.
- Server starts without route or model errors.
- `npm test` in `server/` passes the smoke baseline.
- Production client build is run outside restricted sandbox and the result is recorded.

## Workflow QA
- Founder can create users, create leads, bulk upload CSV leads, allocate leads, approve leave, update working hours, and edit incentives.
- State manager can create industry managers, review performance, manage mapped leads, and approve subordinate leave.
- Industry manager can create executives, upload staff documents, approve executive leave, and manage lead ownership.
- Executive can start work, complete wizard flow, handle RNR retries, schedule meetings, request leave, and complete attendance.

## Data & Reporting QA
- Dashboard totals match actual lead, leave, attendance, and salary data.
- CSV report exports work for lead, performance, attendance, salary, revenue, and leave views.
- Incentive edits persist and affect salary reports.
- Uploaded lead and staff documents can be reopened through presigned download URLs.

## Client Trust Checks
- No sample leave approval cards or hard-coded IDs are visible.
- No mock placeholder document cards remain in staff document screens.
- Stale “endpoint not added” comments are removed from active code.
- Any remaining partial items are listed explicitly in the delivery note.
