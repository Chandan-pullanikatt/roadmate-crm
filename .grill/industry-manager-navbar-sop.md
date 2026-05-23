# Grill: Industry Manager Navbar Restructure + SOP Feature
Date: 2026-05-23

## Intent
Restructure the Industry Manager dashboard's left navbar into three labelled sections (My Works / Team / Management), split Lead Management into two scoped views, add an IM's own Attendance page, add SOP viewer pages for both IM and DE roles, and give the Founder a dedicated SOP upload section in their dashboard.

## Constraints
- Storage is already Cloudflare R2 with presigned upload/download URLs — no new storage infra needed.
- PDF, Word (.doc/.docx), and plain text files must all be supported for SOP uploads.
- Formatting must be preserved: PDFs via iframe embed, Word via server-side mammoth.js HTML conversion, text as pre-formatted display.
- One active SOP per role at a time — uploading a new document replaces the old one.

## Key decisions
- Decision: Split Lead Management into `?page=my-leads` (IM's own leads) and `?page=leads` (DE team leads). Reason: current component shows all leads visible to the IM with no scope filter. Alternative considered: tabs within one component — rejected because the user wants two separate nav items.
- Decision: "My Works → Attendance" (`?page=my-attendance`) reuses the Executive's Attendance component which calls `attendanceApi.getAttendance()` for the logged-in user. Reason: API already returns the current user's own records regardless of role. Alternative considered: building a new component — unnecessary.
- Decision: "Team → Overview" maps to the existing `DistrictExecutives` component — just renamed in the nav. Reason: confirmed by user.
- Decision: SOP is a replace-only model — one document per role, new upload overwrites old. Reason: no version history requirement stated.
- Decision: PDF files displayed via `<iframe>` with presigned R2 URL. Word files converted server-side to HTML (mammoth.js). Text files rendered as pre-formatted text. Reason: iframe preserves 100% PDF formatting; user confirmed this is acceptable.
- Decision: Founder gets a new dedicated "SOP" sidebar section with two upload slots (IM SOP + DE SOP). Reason: cleaner than burying in HR & Team. User confirmed.
- Decision: "Create Executive" removed from navbar entirely. Reason: user explicitly requested removal.
- Decision: Leave Calendar and Reports moved to Management section. Reason: user confirmed.

## Surfaced assumptions
- The existing `attendanceApi.getAttendance()` is role-agnostic and returns the calling user's own records — verified in Executive Attendance component, safe to reuse for IM's own attendance page.
- `?page=leads` (the existing Lead Management) currently shows all IM-visible leads; it will be repurposed to show only DE team leads. The new `?page=my-leads` will filter to IM's own leads only.
- The SOP model needs a new DB collection/table to store: fileKey (R2 path), fileName, fileType (pdf/docx/txt), role (industry_manager/executive), uploadedAt. No other metadata required.

## Open questions
- mammoth.js is not currently in the server dependencies — needs to be added for Word doc rendering.
- Need to confirm the backend API design for SOP: whether GET `/api/sop?role=industry_manager` requires auth and role-checking, or is accessible to all authenticated users.

## Out of scope
- SOP version history / changelog.
- IM ability to upload their own SOPs — founder-only upload.
- Tabs-within-one-page approach for Lead Management split.
