# Internal Audit Management System — Implementation Reference

A concise, source-anchored technical reference for the Internal Audit module. Every claim below is grounded in the current code with `file:line` references so anything can be traced end-to-end without guessing.

Read it top-to-bottom on day one. After that, use it as a lookup: the module sections stand alone.

---

## Contents
1. [Strategic Plan](#strategic-plan)
2. [Operational Plan](#operational-plan)
3. [Audit Engagement](#audit-engagement)
4. [Audit Report](#audit-report)
5. [Report Feedback Survey (QAIP)](#report-feedback-survey-qaip)
6. [Architecture](#architecture)
7. [Folder Structure](#folder-structure)
8. [Authentication & Authorization](#authentication--authorization)
9. [Prisma Models & Relationships](#prisma-models--relationships-internal-audit)
10. [Common Issues & Troubleshooting](#common-issues--troubleshooting)
11. [Must-Know Files](#must-know-files)
12. [Setup & Run](#setup--run)
13. [Pending Work](#pending-work)

---

## Strategic Plan

**Business purpose.** Multi-year (3/4/5-year) risk-based internal-audit strategy. Each planned audit is added from a fully assessed risk, ranked by residual score, and scheduled across plan years — awaiting manual sign-off from an approving authority.

### User flow
1. Head-of-Audit opens Strategic Plan → sees Risk Assessment table of fully-assessed risks not yet planned.
2. Clicks **Add Plan** → captures duration (3/4/5 yrs), audit type, reason, notes.
3. Save → route finds/creates the plan for that duration, appends the item, re-ranks by residual score, clamps years, and auto-syncs the matching operational plans.
4. Head-of-Audit optionally edits/deletes items, opens the view dialog, prints, uploads the signed copy → plan status → **Approved**.
5. Revoke returns the plan to **Draft** and nulls the signed copy.

### Main pages / components
- `src/app/(protected)/internal-audit/strategic-plan/page.tsx` — list, Add-Plan dialog, Create dialog, View dialog with per-year tables, approval section, Edit/Delete item dialogs.

### APIs
| Route | Purpose |
|---|---|
| `GET /api/internal-audit/strategic-plans` | List (tenant + AuditHead scoped); filters `status`, `search` |
| `POST /api/internal-audit/strategic-plans` | Create; with `generateFromRisk` seeds items from `InternalAuditRisk` in residual-score order and buckets across years |
| `GET /api/internal-audit/strategic-plans/[id]` | Fetch one (strips `signedCopyData`) |
| `PUT /api/internal-audit/strategic-plans/[id]` | Update metadata / replace items — refused when Approved |
| `DELETE /api/internal-audit/strategic-plans/[id]` | Delete plan + cascade items |
| `POST /api/internal-audit/strategic-plans/[id]/approve` | Upload signed copy, set Approved, encrypt bytes via raw SQL |
| `DELETE /api/internal-audit/strategic-plans/[id]/approve` | Revoke, revert to Draft |
| `GET /api/internal-audit/strategic-plans/[id]/signed-copy` | Download signed copy (DB → disk fallback, decrypts) |
| `GET /api/internal-audit/strategic-plans/assessed-risks` | Assessed risks not yet planned |
| `POST /api/internal-audit/strategic-plans/add-risk` | Attach assessed risk, re-rank, auto-sync operational plans |
| `PATCH /api/internal-audit/strategic-plans/items/[itemId]` | Edit title/type/year/notes (year clamped to plan range) |
| `DELETE /api/internal-audit/strategic-plans/items/[itemId]` | Remove item — refused when parent Approved |

### Database models (`prisma/schema.prisma:3979-4034`)
- **`AuditStrategicPlan`** — `customerAccountId`, `auditHeadId?`, `planCode` (SAP###), `durationYears (3|4|5)`, `startYear`, `status`, `generatedFromRisk`, `approvedByName/At`, `signedCopy{Path,Name,Data}`. Unique on `(customerAccountId, planCode)`. Cascade on `items[]`; also owns `operationalPlans[]`.
- **`AuditStrategicPlanItem`** — `strategicPlanId`, `year`, `title`, `departmentId?`, `auditableEntityId?`, `riskId?`, `auditType?`, `residualScore?`, `riskLevel?`, `priorityRank?`, `reasonForScheduling?`, `notes?`. Loose FKs (no cascades from Department/Risk).

### Important business logic
- **Plan-code allocator** scans `SAP\d+$` suffix per tenant and increments (`route.ts:81-93`).
- **Risk-based seeding** only accepts risks with both `inherentScore` and `residualScore` populated; buckets `perYear = ceil(total/durationYears)` across the plan span (`route.ts:98-127`).
- **Add-Risk** only accepts `assessmentStatus === "Assessed"`; prefers `assessmentResidualScore` (rounded) over legacy `residualScore` (`add-risk/route.ts:41-60`).
- **One plan per `(auditHead, durationYears)`** — picking a new duration spawns a new plan (`add-risk/route.ts:66-98`).
- **Dedup by `riskId`** — every add triggers re-order by `residualScore desc` within a year, sequential `priorityRank`, and year clamping to `[startYear, startYear+durationYears-1]` (`add-risk/route.ts:126-143`).
- **Approval** writes encrypted `signedCopyData` via raw SQL + `maybeEncryptBytes` (`approve/route.ts:49-51`).

### Roles & permissions
- `AuditHead` — full access (`*`).
- `AuditManager` — **view only** on strategic (cannot create).
- `Auditor` — view.
- `approve` action gates the signed-copy upload (Head only). See `src/lib/permissions.ts:441,466,511`.

### Validations & status
- `durationYears ∈ {3,4,5}` else defaults to 3.
- Item `year` clamped to `[startYear, startYear+durationYears-1]`.
- Approved plans refuse PUT and item edit/delete (409 via `loadItem`).
- **Statuses**: `Draft → Approved` (signed-copy upload) → `Draft` (revoke). `Pending Approval` is styled in the UI but never written.

---

## Operational Plan

**Business purpose.** Year-wise annual audit plan derived from a strategic plan's items for that year. Adds category, quarter, auditor assignment, per-quarter Annual-Audit-Plan fields, quarterly reports, and an approval step that auto-generates `AuditEngagement`s.

### User flow
1. Operational Plan list shows flat rows across all strategic plans → clicking a row opens `/internal-audit/operational-plan/[id]` (strategic-plan id).
2. Detail page loads the strategic plan + all its year-scoped operational plans.
3. If a year has no operational plan yet, **Generate** posts to create one, seeded with items from that year's strategic items.
4. Add/edit/delete audits; assign auditors; fill per-quarter fields; upload quarterly report docs; download Annual Audit Plan / Quarterly PDFs.
5. Approval doc upload sets the plan to **Approved** and auto-generates `AuditEngagement`s from items (idempotent, via `generateEngagementsFromOperationalPlan`).

### Main pages / components
- `src/app/(protected)/internal-audit/operational-plan/page.tsx` — list of audits across plans.
- `src/app/(protected)/internal-audit/operational-plan/[id]/page.tsx` — year-scoped detail, Add-Audit dialog, Assign-Auditors dialog, per-quarter fields, approval / report upload.

### APIs
| Route | Purpose |
|---|---|
| `GET/POST /api/internal-audit/operational-plans` | List (filters `strategicPlanId`, `year`) / create for `(strategicPlanId, year)`; seeds items and triggers dynamic translations |
| `GET/PUT/DELETE /api/internal-audit/operational-plans/[id]` | Fetch / update title+status / delete |
| `POST /api/internal-audit/operational-plans/[id]/items` | Add audit; auto-increments `priorityRank` |
| `PATCH/DELETE /api/internal-audit/operational-plans/[id]/items/[itemId]` | Update / delete item |
| `PUT /api/internal-audit/operational-plans/[id]/quarter-plan` | Save one quarter's fields into JSON `quarterPlans` |
| `POST /api/internal-audit/operational-plans/[id]/quarter-reports` | Upsert per-quarter report doc; encrypted binary via raw SQL |
| `GET /…/quarter-reports/[reportId]/doc` | Download the stored doc |
| `DELETE /…/quarter-reports/[reportId]` | Remove one quarter report |
| `POST /api/internal-audit/operational-plans/[id]/approval` | Upload approval doc → status Approved + engagement generation |
| `DELETE /…/approval` | Remove approval doc |
| `GET /…/approval-doc` | Download approval doc |
| `GET /api/internal-audit/operational-plans/[id]/annual-report` | Landscape PDF of the full Annual Audit Plan |
| `GET /…/quarter-summary/[quarter]` | Auto-generated quarterly PDF from live engagement / finding status |

### Database models (`prisma/schema.prisma:4040-4128`)
- **`AuditOperationalPlan`** — `strategicPlanId`, `year`, `planCode` (OAP###), `status`, `approvalDoc{Path,Name,Data}`, `quarterPlans: Text` (JSON). Unique on `(strategicPlanId, year)` and `(customerAccountId, planCode)`. Cascades from strategic plan.
- **`AuditOperationalPlanItem`** — `title`, `departmentId?`, `riskId?`, `auditType?`, `auditCategory?`, `plannedQuarter?`, `assignedAuditorId?`, `auditorInChargeId?`, `residualScore?`, `riskLevel?`, `proposedPeriodical?`, `estimatedHours?`, `priorityRank?`, `engagementId?` (`SetNull` to `AuditEngagement`).
- **`AuditOperationalPlanQuarterReport`** — `quarter (Q1-Q4)`, `status="Submitted"`, `reportDoc{Path,Name,Data}`. Unique on `(operationalPlanId, quarter)`.

### Important business logic
- **One operational plan per `(strategicPlanId, year)`** — POST returns 409 if it exists (`operational-plans/route.ts:105-113`).
- **Items seeded** from strategic-plan items filtered by `year === yearNum` (`:131-142`).
- **Auto-sync from strategic side** — `add-risk` on the strategic side auto-creates/appends to the operational plan for every planned year (dedup by `riskId`) (`add-risk/route.ts:145-209`).
- **Per-quarter overrides** stored as JSON on `quarterPlans`; UI resolves per-quarter overrides with fallback to item.
- **Approval** encrypts `approvalDocData` via raw SQL + `maybeEncryptBytes`, then calls `generateEngagementsFromOperationalPlan` (idempotent via `engagementId` back-link).
- **Quarter-summary PDF** is derived live from `AuditEngagement.status` + `findings.status` (open vs closed).
- **Translations** for seeded item titles triggered on plan creation via `translateRecord`.

### Roles & permissions
- `AuditHead` and `AuditManager` — full (`*`).
- `Auditor` — view.
- **No `approve` action on operational plan** — POST `/approval` is gated by `edit`.

### Validations & status
- `title` required on items.
- `quarter ∈ {Q1..Q4}` on quarter-plan / quarter-reports routes.
- Tenant validated via `validateTenantAccess` on every write.
- **Statuses**: `Draft → Approved` (approval-doc upload) → `Draft` (approval-doc delete). Quarter report status: `Submitted`.

---

## Audit Engagement

**Business purpose.** Plan, execute and track a single audit engagement end-to-end. Announcement → APM → meetings → audit program → fieldwork → findings → CAPA. Groups evidence, tasks, meetings, workpapers and findings under one auto-numbered `AUD###` record.

### User flow
1. Audit Head creates a single or multi-department batch engagement with title/scope/dept/auditor/auditee/team. Status starts **Planned**; ID assigned as `AUDnnn[.k]` (`.k` on multi-dept batches).
2. Engagement hub renders the 8-stage workflow (see `src/lib/audit-engagement-stages.ts:38-99`): announcement → apm → opening-meeting → audit-program → fieldwork → findings → discussion → closing-meeting.
3. Per stage: send announcement, fill APM + attachments, capture Opening/Discussion/Closing MoM, build the Audit Program, run fieldwork (evidence requests, AI/manual workpapers), record findings, share with auditee (Continuous or Aggregated), collect CAPA.
4. `PATCH` moves `currentStage` / `stageProgress` / `status`. Marking `Completed` auto-sets `actualEndDate`.

### Main pages / components
- List/add: `src/app/(protected)/internal-audit/audit-engagement/page.tsx`, `add/page.tsx`, `[id]/edit/page.tsx`.
- Workflow hub: `src/app/(protected)/internal-audit/engagement/[id]/page.tsx`.
- Fieldwork: `src/app/(protected)/internal-audit/fieldwork/page.tsx`, `[id]/page.tsx`, `[id]/findings/page.tsx`, `[id]/add-finding/page.tsx`, `FieldworkDetailModal.tsx`.

### APIs (selection)
| Route | Purpose |
|---|---|
| `GET/POST /api/internal-audit/engagements` | List / create; auditee filtered via evidence-request join |
| `GET/PUT/PATCH/DELETE /api/internal-audit/engagements/[id]` | Fetch, full-update, stage/status patch, delete |
| `/announcement`, `/announcement/send` | Draft + email PBC |
| `/apm` + `/apm/attachments[/id]` | APM memorandum + files |
| `/opening-meeting`, `/findings-discussion-meeting`, `/closing-meeting`, `/follow-up-meeting` + `/download`, `/template` | MoM CRUD + DOCX export |
| `/audit-program` + `/download` | 14-column program |
| `/meetings[/meetingId]` | Free-form MoM list |
| `/findings`, `/findings/ai-review`, `/findings/share-all`, `/findings/export` | Findings CRUD + async Python `findings_review` job + share flows |
| `/comments`, `/download`, `/years` | Engagement comments, PDF, years index |
| `/fieldwork`, `/fieldwork/[id]/evidence-requests`, `/ai-workpapers[/generate|/add|/download]`, `/audit-ingest`, `/audit-query` | Under `src/app/api/internal-audit/fieldwork/**` |

### Database models (`prisma/schema.prisma:3210-3874`)
- **`AuditEngagement`** (3210) — `auditId`, `engagementTitle/Objective/Scope`, `departmentId`, `auditableEntityId`, `auditTypeId`, `assignedAuditorId`, `auditeeId`, `teamMembers[]`, `plannedStart/End`, `actualStart/End`, `status`, `currentStage`, `stageProgress` (JSON), `reportingMode` (`Continuous|Aggregated`), `aiFindingsReviewOverall/JobId/At`. Unique `(customerAccountId, auditId)`.
- **`AuditEngagementAnnouncement`** (3299), **`AuditEngagementAPM`** + **`APMAttachment`** (3325, 3351), **`AuditEngagementMeeting`** (3371), **`AuditOpeningMeeting`** / **`AuditFindingsDiscussionMeeting`** / **`AuditClosingMeeting`** / **`AuditFollowUpMeeting`** / **`AuditProgram`** (3765–3874), **`EngagementComment`** (3395), **`AuditFieldwork`** (3410), **`AuditWorkpaper`** / **`AiWorkpaper`** / **`AuditEngagementTask`** (3434–3482), **`FieldworkEvidenceRequest`** + attachments (3485–3526), **`InternalAuditFinding`** + attachments (3629–3701), **`InternalAuditCAPA`** (3704).

### Important business logic
- **Multi-dept batch IDs** — `AUD012.1`, `AUD012.2`, … (`engagements/route.ts:374-395`).
- **Auditee scoping** — an auditee-only user sees only engagements where they're the assignee OR have an evidence request (`engagements/route.ts:34-73`).
- **Findings sharing**:
  - `Continuous` — each finding is shared on save (sets `sharedWithAuditeeAt`).
  - `Aggregated` — one bulk notify via `POST /findings/share-all`.
- **AI Findings Review** is asynchronous — POST kicks off, poll status every 2s up to 5 min, GET the result, persist `aiFindingReviewStatus` per finding + `aiFindingsReviewOverall` on the engagement (`findings/ai-review/route.ts:11-51`).
- **Evidence request CAPA workflow** carries `aiReviewStatus/Comment` + clarification loop fields (`schema.prisma:3492-3506`).
- **`actualEndDate` auto-fill** on Completed (`engagements/[id]/route.ts:200-203`).

### Roles & permissions
Nav: `audit.planning:view` (`src/lib/navigation.ts:309`).
- Create → `audit.planning:create`
- Edit dates/scope → `audit.planning:edit`
- Delete → `audit.planning:delete`
- View / stage-patch / fieldwork / APM / MoM / findings / AI → `audit.fieldwork:view|edit|create|delete`
- Follow-up meeting → `audit.capa:view|edit`
- Feedback survey shell → `audit.fieldwork:view|edit`
- AuditHead isolation via `getAuditHeadId` / `getAuditHeadFilter` (`api-auth.ts:18-23`).

### Validations
- Required: `engagementTitle`.
- `customerAccountId` required, else 400.
- `currentStage` restricted to `ENGAGEMENT_STAGE_KEYS`; `reportingMode ∈ {Continuous, Aggregated}`; `stageProgress` values restricted to `completed|in_progress`.
- Unique `(customerAccountId, auditId)`.

### Status / workflow
- **`AuditEngagement.status`**: `Planned` (default) → `In Progress` → `Completed` → `Cancelled`.
- **`currentStage`** cycles through the 8 keys in `src/lib/audit-engagement-stages.ts:38-99`.
- **`stageProgress[key] ∈ {completed, in_progress}`**.
- **`AuditFieldwork.status`**: `Not Started` → `In Progress` → `Review` → `Completed`.

---

## Audit Report

**Business purpose.** Generate the formal report for a `Completed` engagement: executive summary, opinion, findings, priorities, management responses. Draft → Final finalization, DRAFT watermark on download, role-restricted Publish for auditee delivery.

### User flow
From a `Completed` engagement, Audit Head triggers `POST /report/generate` (auto `RPT-NNNN`) → edits sections on `/internal-audit/report/[id]` → `handleSetStatus("Final")` finalizes (only `AuditHead`) → downloads PDF (watermark suppressed when Final/Published). Auditees see only `status='Published'` reports for their department.

### Main pages / components
- List: `src/app/(protected)/internal-audit/report/page.tsx`.
- Editor: `src/app/(protected)/internal-audit/report/[id]/page.tsx` (finalize logic at `:262-283, :766-768`).
- Preview: `src/app/(protected)/internal-audit/audit-engagement/report-preview/page.tsx`.
- Shared spec: `src/lib/internal-audit/report-shared.ts` (opinion ratings, finding types, priority table).

### APIs
| Route | Purpose |
|---|---|
| `GET /api/internal-audit/reports` | Tenant-filtered list; auditee sees only `Published` where `auditeeId=session.id` |
| `GET /api/internal-audit/reports/[id]` | Enforces `Published` + dept match for auditees |
| `POST /api/internal-audit/report/generate` | Requires `engagement.status='Completed'`, refuses if a report exists; sets `opinionRating` (`Satisfactory|Needs Improvement|Unsatisfactory`) → derives `overallResult` (Pass/Fail) |
| `GET/PATCH /api/internal-audit/report/[id]` | Fetch / edit sections; `status` transitions gated to `Draft|Final` and AuditHead-only; fire-and-forget `translateRecord` for 16 fields |
| `GET /api/internal-audit/report/[id]/download` | PDF with DRAFT watermark when not Final/Published |
| `GET /api/internal-audit/report/completed-engagements` | Engagements eligible for report generation |

### Database model (`prisma/schema.prisma:3531`)
**`AuditReport`** — `reportCode`, `engagementId` (unique), `title`, `executiveSummary`, `scope`, `scopeExclusions`, `objectives`, `methodology`, `observations`, `recommendations`, `managementResponse`, `conclusion`, `opinionRating`, `opinionSummary`, `topMessages`, `keyRisks`, `summaryKeyFindings`, `mgmtAttentionImmediate/MediumTerm`, `followUp`, `overallResult` (legacy Pass/Fail), `status`, `draftGeneratedAt`, `reviewedAt`, `publishedAt`, `reviewedBy`, `auditeeId/Name/Comment`, `reportFilePath/Name`. Unique `(customerAccountId, reportCode)`. Cascade delete with engagement.

### Important business logic
- **Report code numbering** scans all existing formats and increments (`report/generate/route.ts:7-24`).
- **DRAFT watermark** suppressed when `status ∈ {Final, Published}` (`download/route.ts:334`).
- **Reports isolated per AuditHead** via `getAuditHeadFilter` — not shared between heads.
- **Legacy `overallResult`** (Pass/Fail) kept in sync with `opinionRating`.
- **Auditee visibility** — cannot read until `status='Published'` AND `departmentId` matches.

### Roles & permissions
- Nav: `audit.reports:view`.
- APIs mix `audit.reports:view` (list) and `audit.fieldwork:view|edit|create` (generate/edit/download).
- **Only `AuditHead`** can PATCH `status` (`report/[id]/route.ts:168`).

### Validations
- `engagementId` required.
- Refuses if engagement not `Completed` or a report already exists.
- `status` restricted to `Draft|Final` on PATCH (Published set via a separate flow).

### Status / workflow
`Draft` (default) → `Review` → `Final` → `Published`. Editor UI exposes the `Draft ↔ Final` toggle. `Published` gates auditee visibility; the download watermark only appears on non-Final states.

---

## Report Feedback Survey (QAIP)

**Business purpose.** Post-engagement Quality Assurance & Improvement Program survey — auditee/management rate the audit across 6 sections plus overall satisfaction and open-ended comments.

### User flow
Open `/internal-audit/feedback-survey` → pick an engagement from the dropdown → 6 sections (A Planning, B Professionalism, C Execution, D Findings, E Reporting, F Value) load → answer 5..1/NA per row, add optional custom rows + section comments → set `overallSatisfaction` (1–5) + free-text `didWell` / `improvements` → Save (PUT upserts) → Download PDF.

### Main pages / components
- Page: `src/app/(protected)/internal-audit/feedback-survey/page.tsx`.
- Shared spec (sections/questions/labels): `src/lib/internal-audit/feedback-survey.ts`.

### APIs
| Route | Purpose |
|---|---|
| `GET /api/internal-audit/engagements/[id]/feedback-survey` | Returns empty shell if none exists |
| `PUT /api/internal-audit/engagements/[id]/feedback-survey` | Upserts by `engagementId`; JSON-stringifies `responses` / `comments` / `customRows` |
| `GET /api/internal-audit/engagements/[id]/feedback-survey/download` | PDF export |

### Database model (`prisma/schema.prisma:3878-3894`)
**`AuditFeedbackSurvey`** — `engagementId` (unique), `responses` (JSON `{questionKey: "5|4|3|2|1|NA"}`), `comments` (JSON per section), `customRows` (JSON user-added rows), `overallSatisfaction` (Int), `didWell`, `improvements`, `createdById`, `updatedById`. Indexed on `customerAccountId`.

### Important business logic
- **One row per engagement** (unique constraint enforced by upsert).
- **Ratings live outside the schema** in the shared TS constant `RATING_OPTIONS = ["5","4","3","2","1","NA"]` (`feedback-survey.ts:15`) — schema stores raw JSON.
- **`overallSatisfaction`** coerced with `Number.isFinite`; non-numeric wiped to null.
- **`customRows`** allow ad-hoc questions per section without schema changes.
- **Not anonymous** — `createdById` / `updatedById` are stamped from `session.id`. QAIP internal tool, not an anonymous survey.
- **No aggregation / scoring in code** — raw ratings persisted verbatim; PDF is the reporting surface.

### Roles & permissions
Nav: `audit.fieldwork:view`. GET → `audit.fieldwork:view`, PUT → `audit.fieldwork:edit`. No dedicated `audit.feedback` resource. Client gates Save via `usePermissions("audit.fieldwork").canEdit`.

### Validations
Only `engagementId` (tenant match) enforced server-side. Payload defensively defaulted; no required-field refusals or unique-answer validation.

### Status / workflow
No status enum. Row is create-on-first-save (`upsert`) then edited in place. No submit/lock/publish transitions.

---

## Architecture

- **Framework**: Next.js `16.1.1` App Router, React `19.2.3`, Turbopack builds.
- **UI**: shadcn/ui + Radix + Tailwind v4; charts via Recharts; forms via `react-hook-form` + Zod.
- **Auth**: NextAuth v5 beta (`^5.0.0-beta.30`), JWT strategy; session enriched from JWT.
- **ORM**: Prisma `^5.22.0` singleton at `src/lib/prisma.ts` with a field-level AES-256-GCM extension. Backend is Postgres (Neon in cloud, local pg for dev); `prisma/dev.db` (SQLite) also present.
- **i18n**: `next-intl` + custom `LanguageContext` (`src/contexts/LanguageContext.tsx`), 3 locales (EN / AR-RTL / LV) generated by `scripts/generate-translations.ts`. Dynamic user-entered data goes through a Python translation API (`src/lib/translation-config.ts`, `src/hooks/useTranslatedData.ts`).
- **Rendering**: Server components by default. Interactive pages tagged `"use client"`. Auth callbacks and Prisma always server-side.
- **Deployment**: DigitalOcean containerized. `npm start` runs `prisma db push --skip-generate && next start` (`package.json:11`) so cloud schema stays in sync with `prisma/schema.prisma` on every boot.

---

## Folder Structure

- **`src/app/(protected)/`** — every authenticated route (wraps `MainLayout`). Internal Audit lives under `src/app/(protected)/internal-audit/` with sub-features: `strategic-plan`, `operational-plan`, `audit-engagement`, `engagement/`, `fieldwork/`, `report/`, `capa-tracking/`, `follow-up/`, `feedback-survey/`, `independence/`, `audit-charter/`, `audit-universe/`, `risk-register/`, `risk-assessment/`, `risk-identification/`, `risk-universe/`, `document-library/`, `dashboard/`, `settings/`, `audit-trail/`, `account-overview/`.
- **`src/app/api/`** — REST routes. Internal Audit APIs under `src/app/api/internal-audit/` (~37 folders — engagements, capa, findings, strategic-plans, operational-plans, audit-charter, declarations, reports, ia-processes, escalation-config, scoring-config, categories, audit-types, risk-factors, …).
- **`src/app/api/cron/`** — scheduled endpoints; `due-reminders/route.ts` sends CAPA/finding due alerts. Also `escalation/`, `plan-transitions/`, `remediation-reminders/`.
- **`src/lib/`** — cross-cutting: `auth.ts`, `permissions.ts`, `api-auth.ts`, `prisma.ts`, `navigation.ts`, `audit-trail.ts`, `audit-engagement-stages.ts`, `apm-template.ts`, `charter-parser.ts`, `independence-declaration.ts`, `encryption.ts`, `notification-service.ts`.
- **`src/components/internal-audit/`** — engagement-workflow widgets (`AuditPlanningMemorandum.tsx`, `OpeningMeeting.tsx`, `ClosingMeeting.tsx`, `AuditAnnouncement.tsx`, `AuditProgram.tsx`, `FindingsCommunication.tsx`, …).
- **`src/hooks/`** — `usePermissions.ts`, `useTranslatedData.ts`, `useNotifications.ts`.
- **`src/contexts/`** — `LanguageContext`, `ModuleContext`, `LogoContext`, `ThemeContext`.
- **`prisma/`** — `schema.prisma`, `schema.sql`, `seed.ts`, `seed-internal-audit.ts`, `seed-rbac.ts`, `seed-audit-settings.ts`, `clean-internal-audit.ts`, `migrate-audit-head-data.ts`.
- **`docs/`** — `INTERNAL_AUDIT_MODULE.md` (source of truth), `INTERNAL_AUDIT_TEST_PLAN.md`, `INTERNAL_AUDIT_USER_MANUAL.md`, `INTERNAL_AUDIT_ROLE_RENAME.md`, `SECURITY.md`.
- **`scripts/`** — ops scripts (seed, backfill, smoke, encryption rotation, PDF/DOCX generators).
- **`public/`** — static assets + per-module logos (`logo-internal-audit.png`).

---

## Authentication & Authorization

### NextAuth
`src/lib/auth.ts`. Providers: Credentials + Google + Microsoft Entra ID. JWT strategy. Cookie name switches `__Secure-authjs.session-token` / `authjs.session-token` (`auth.ts:200-204`). JWT callback at line 399, session callback at 474.

### Session / JWT contents
`id`, `roles[]`, `permissions[]` (expanded via `expandRolePermissions`), `departmentId/Name`, `customerAccountId/Code/Name`, `auditHeadId`, `subscriptionStatus/Type`, module flags `isGrcAdded / isTprmAdded / isInternalAuditEnabled / isTechnicalEvidenceEnabled / isQpostComplianceEnabled`, `roleModules[]`.

### RBAC — `src/lib/permissions.ts`
- **Actions** = `view | create | edit | delete | approve` (line 8).
- **Scopes** = `all | department | own` (line 12).
- **Internal Audit resources** at lines 106–124: `audit.dashboard`, `audit.strategic-plan`, `audit.operational-plan`, `audit.planning`, `audit.independence`, `audit.fieldwork`, `audit.reports`, `audit.capa`, `audit.documents`, `audit.settings`, `audit.risk-universe`, `audit.audit-trail`, `audit.charter`, `audit.risk-register`, `audit.process`, `audit.risk-identification`, `audit.account-overview`, `audit.auditables`.
- **Roles** at lines 200–241: `AuditHead` (204), `AuditUser` (208), `AuditManager` (212), `Auditor` (216 — legacy, hidden), `Auditee` (220 — displayed as "Auditor" per rename doc), `DepartmentReviewer` (234), `DepartmentContributor` (238).
- **Matrix shape**: `Record<roleName, Array<{ resource, actions[], scope }>>`. Wildcard `*` allowed for actions or resource suffix. AuditHead perms at line 433; AuditManager at 458 (strategic-plan is view-only at 468); Auditee at 532 (department scope on fieldwork/capa/reports).

### API protection — `src/lib/api-auth.ts`
- **`withAuth(handler, { resource, action })`** — pulls session, checks `hasPermission`, injects `AuthenticatedRequest['user']`, and auto-records mutations to `AuditTrail` (line 140; auto-capture at 73–123).
- **`withAuthOnly(handler)`** — auth-only, no permission check (line 218).
- **`getTenantFilter(session)`** — enforces multi-tenant Prisma filter by `customerAccountId`; GRCAdministrators without `globalAccess` still get isolated to their own tenant (line 285).
- **`getCustomerAccountId(session)`** — throws if unset (line 326).
- **`getAuditHeadId` / `getAuditHeadFilter` / `getAuditHeadRiskFilter`** (lines 383–493) — second-tier isolation so Audit Head A cannot see Audit Head B's data within the same tenant.

### Workspace picker
`src/app/select-module/page.tsx` is shown when a user has ≥2 active module subscriptions. `moduleCode` (`prisma/schema.prisma:571-584`) on `UserRole` scopes assignments to `GRC | TPRM | INTERNAL_AUDIT | TECHNICAL_EVIDENCE`; `null` = system-wide. `auth.ts:118-145` builds `roleModules` from the intersection of `UserRole.moduleCode` and subscription flags; `inferModuleFromRoleName` recovers legacy rows.

---

## Prisma Models & Relationships (Internal Audit)

All under `prisma/schema.prisma`.

- **Planning** — `AuditStrategicPlan` (3979) → `AuditStrategicPlanItem` (4014, cascade) → `AuditOperationalPlan` (4040, one per year, `@@unique(strategicPlanId, year)`) → `AuditOperationalPlanItem` (4101, cascade); `AuditOperationalPlanQuarterReport` (4077, `@@unique(plan, quarter)`).
- **Execution** — `AuditableEntity` (3183) → `AuditEngagement` (3210, `@@unique(customerAccountId, auditId)`, owns `apm`, `announcement`, `fieldwork`, `report`, `findings`, `meetings`, `tasks`, `linkedRisks`). Auto-generated from `AuditOperationalPlanItem.engagementId` (relation `PlanItemEngagement`, 4121). Sub-forms: `AuditEngagementAPM` (3325), `AuditEngagementAnnouncement` (3299), `AuditProgram` (3848), `AuditOpeningMeeting` (3819), `AuditFindingsDiscussionMeeting` (3765), `AuditClosingMeeting` (3792), `AuditFollowUpMeeting` (3739), `AuditFieldwork` (3410), `AuditWorkpaper` (3434).
- **Findings & CAPA** — `InternalAuditFinding` (3629, cascade from engagement) → `InternalAuditCAPA` (3704, cascade from finding); `FindingAttachment` (3689). Legacy `Audit` (2677) / `AuditFinding` (2702) / `CAPA` (2723) still exist but the `InternalAudit*` variants are current.
- **Reporting** — `AuditReport` (3531, `@@unique(engagementId)`), `AuditFeedbackSurvey` (3878, one per engagement).
- **Governance docs** — `AuditCharter` (6261, `@@unique(customerAccountId)`), `AuditDeclaration` (3590, `type ∈ {Independence, Objectivity}`), `InternalAuditDocument` (3922).
- **Master data** — `AuditType`, `AuditCategory`, `AuditSubCategory`, `AuditNatureOfControl`, `AuditRiskFactor`, `AuditProbability`, `AuditImpact`, `AuditScoringRange`, `AuditScoringConfig`, `AuditPeriodicity`, `AuditEscalationConfig`, `AuditLocation`, `InternalAuditProcess` (3050), `InternalAuditProcessRisk` (3098), `InternalAuditRisk` (3114).
- **Multi-tenancy pattern** — every model carries `customerAccountId` (FK to `CustomerAccount`) plus (often) `auditHeadId`. Paired `@@index([customerAccountId])`, often `@@unique(customerAccountId, code)` for auto-generated codes (`AUD001`, `FND001`, `CAPA001`, `RPT001`, `SAP001`, `OAP001`, `DEC-0001`).
- **Immutable log** — `AuditTrail` (3899). Append-only, GET-only API, written by `recordAuditTrail()` in `src/lib/audit-trail.ts` and auto-triggered by `withAuth` (`api-auth.ts:194-201`).
- **Cron relevant to IA** — `src/app/api/cron/due-reminders/route.ts` sends `CAPA_DUE_REMINDER` for CAPA/findings due tomorrow. Also `escalation/`, `plan-transitions/`, `remediation-reminders/`.

---

## Common Issues & Troubleshooting

Reference docs (open these first):
- `docs/INTERNAL_AUDIT_MODULE.md` — inventory + RBAC matrix (source of truth). Update it on every IA change.
- `docs/INTERNAL_AUDIT_TEST_PLAN.md`, `docs/INTERNAL_AUDIT_USER_MANUAL.md`, `docs/INTERNAL_AUDIT_ROLE_RENAME.md`.

### Frequent traps
- **Role rename** — `Auditee` is labelled "Auditor" in the UI; legacy `Auditor` role is hidden (`permissions.ts:315-320`). Keys unchanged; do not chase apparent duplicates.
- **Strategic-plan create** — only `AuditHead` can create. `AuditManager` is view-only (`permissions.ts:441` vs `465`).
- **Audit Head isolation** — code that leaks one head's data to another almost always missed `getAuditHeadFilter` (`api-auth.ts:458`). Migration helper: `prisma/migrate-audit-head-data.ts` (npm script `db:migrate-audit-head`).
- **Encrypted `Bytes` fields** (signed copies, approval docs) — raw SQL bypasses the Prisma extension. Wrap with `maybeEncryptBytes` / `maybeDecryptBytes` from `@/lib/encryption`. See `docs/encryption-raw-sql-audit.md`.
- **Deploy schema drift** — `prisma db push` on start refuses destructive changes; run manually with `--accept-data-loss` on a known-good box before deploying such a change (`CLAUDE.md`).
- **No `TODO / FIXME / HACK`** markers were found under `src/app/api/internal-audit/`, `src/app/(protected)/internal-audit/`, or `src/lib/internal-audit/`.

---

## Must-Know Files

1. `src/lib/permissions.ts` — RBAC matrix.
2. `src/lib/api-auth.ts` — `withAuth`, tenant + audit-head filters.
3. `src/lib/auth.ts` — NextAuth JWT / session enrichment.
4. `src/lib/navigation.ts` — permission-filtered sidebar.
5. `src/lib/audit-trail.ts` — immutable log writer.
6. `src/lib/audit-engagement-stages.ts` — workflow stage keys.
7. `src/lib/apm-template.ts` — APM section/field structure (drives editor + print).
8. `src/lib/charter-parser.ts` — DOCX charter → editable HTML.
9. `src/lib/independence-declaration.ts` — shared declaration text.
10. `prisma/schema.prisma` — IA models at lines 2677–4128 and 6261.
11. `src/app/(protected)/internal-audit/engagement/[id]/page.tsx` — engagement workflow hub.
12. `src/components/internal-audit/AuditPlanningMemorandum.tsx` — APM editor.
13. `src/app/api/internal-audit/engagements/` — engagement CRUD + workflow sub-endpoints.
14. `src/app/api/cron/due-reminders/route.ts` — CAPA/finding SLA cron.
15. `docs/INTERNAL_AUDIT_MODULE.md` — inventory + RBAC matrix.

---

## Setup & Run

```bash
npm install                # postinstall runs prisma generate
npm run dev                # prisma db push && prisma generate && next dev on :3000
npm run db:seed            # base seed (superadmin / 1)
npm run db:seed-bts        # BTS customer sample data
npm run i18n:generate      # regen locales/*.json from init-translations
npm run build              # i18n:generate + prisma generate + next build (8 GB heap)
npm run lint
npm run test:e2e           # Playwright
npm run encrypt:migrate    # one-time encrypt existing rows
npm run encrypt:verify
```

**Cron test locally**: `curl http://localhost:3000/api/cron/due-reminders` (no auth in dev; `CRON_SECRET` bearer required in prod).

---

## Pending Work

- No `TODO / FIXME / HACK` markers in Internal Audit source paths.
- **`Contributor` role** at `permissions.ts:228-233` is marked DISABLED, retained only for back-compat. New work should use `DepartmentContributor`.
- **Legacy models** `Audit` / `AuditFinding` / `CAPA` (schema 2677–2745) co-exist with `AuditEngagement` / `InternalAuditFinding` / `InternalAuditCAPA`. Consolidation not yet done.
- **`docs/INTERNAL_AUDIT_MODULE.md`** last-updated 2026-06-16 — the update-on-change rule in `CLAUDE.md` means any IA change should touch that file.
- **Deployment section in `CLAUDE.md`** still references Vercel; the app runs on DigitalOcean. Stale copy worth pruning.
