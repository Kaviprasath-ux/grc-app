# Internal Audit Module — Implementation & Access Guide

_Last updated: 2026-06-16_

This document describes **what is implemented** in the Internal Audit (IA) module
and the **role-based access privileges** — which user can access what.

It is the single reference for the IA module. The authoritative source for access
control is `src/lib/permissions.ts`; this document mirrors it.

---

## 1. Module Overview

The Internal Audit module implements the full audit lifecycle:

```
Audit Universe → Risk Register → Risk Assessment / Heatmap →
Strategic Plan → Operational (Annual) Plan → Engagements →
Engagement Workflow (Announcement → APM → Opening Meeting → Audit Program →
Fieldwork → Findings → Findings Discussion → Closing Meeting)
→ Independence & Objectivity (sidebar) → Report (sidebar) → Feedback Survey (sidebar)
→ Follow-up / CAPA (sidebar) → Automated Monitoring
```

**Feedback Survey** (`/internal-audit/feedback-survey`, nav after Report): the QAIP
**Internal Audit Engagement Feedback Survey** — pick an engagement, rate Sections
A–F (Engagement Planning / Professionalism / Audit Execution / Findings &
Recommendations / Reporting / Value Provided) on a 5–1 / N/A scale with per-section
comments, plus Overall Satisfaction (1–5) and two open questions. Saved per
engagement (model `AuditFeedbackSurvey`, `PUT /api/internal-audit/engagements/[id]/feedback-survey`)
with **Export PDF** (`/feedback-survey/download`).

**Independence & Objectivity** (`/internal-audit/independence`, resource
`audit.independence`): auditor **Independence Declaration** and **Objectivity
Declaration** forms aligned to the IIA Global Internal Audit Standards. Audit
team members record declarant info, fixed declaration statements, a result
(Confirmed / Potential impairment, or No threats / Potential threat) with
explanation, and a typed signature; an Audit Head / Manager reviews and signs
off (status Draft → Submitted → Reviewed). Stored in the `AuditDeclaration`
model (`type` = Independence | Objectivity), tenant + audit-head isolated.
Each declaration can be **printed / saved as PDF** via a dedicated print view
(`/internal-audit/independence/[id]/print`, opened from the row **Print** action
or the View dialog) — a formal declaration document using the browser print
dialog (no server dependency). Shared statement/result text lives in
`src/lib/independence-declaration.ts` so the form and the printout never drift.

**Audit Trail** (`/internal-audit/audit-trail`, resource `audit.audit-trail`): an
immutable, append-only activity log. Each record captures User Name, User Role,
Action (Create / Update / Delete / Approve / Login / Logout / …), Module/Entity,
Record Identifier, and Date & Time. **Auto-captured** — `withAuth` records every
successful mutating request (non-`view` action, 2xx) and NextAuth `events`
record Login/Logout (`src/lib/audit-trail.ts`, model `AuditTrail`). **Scope**:
standard users (`scope: own`) see only their own activity; Customer Admin and
senior audit roles (`scope: all`) see all activity within their organization,
with filters (User Name, User Role, Action Type, Module, Date range) + free-text
search, sortable columns, and pagination. **Read-only** — the API exposes GET
only (no create/update/delete), so logs cannot be modified or removed by users.

All pages are available in **English, Arabic (RTL), and Latvian**.

---

## 2. Implemented Features

### 2.1 Foundation & Master Data
| Feature | Where | Notes |
|---|---|---|
| **Audit Charter** | `/internal-audit/audit-charter` | Upload a `.docx` charter document; blue-colored text runs are auto-detected as editable fields (inline inputs). Static text is read-only. Field values are saved per tenant (`AuditCharter` DB model). AuditHead / AuditManager / Auditor can upload + edit; AuditUser view-only. API: `GET/PATCH /api/internal-audit/audit-charter`, `POST /api/internal-audit/audit-charter/upload`. Parser: `src/lib/charter-parser.ts` (uses mammoth for DOCX→HTML + blue-span detection). |
| **Audit Universe** | `/internal-audit/audit-universe` | Org-chart grouped by **Audit Category** → Processes / Risks / Audits under each category. Stat cards: Categories, Processes, Risks, Total Audits. **Table columns**: Process/System/Entity, Department, Description, Last Audit Date, Audit Frequency (Years), Regulatory Requirement, Notes. Audits appear under a category if linked via `auditCategoryId` on the engagement OR via a risk's `engagementId`. |
| **Risk Register** | `/internal-audit/risk-register` | Risk ID, process link, title, description, category/sub-category, source, cause/driver, consequence, inherent & residual likelihood/impact/rating, control effectiveness, related law, policy reference, document links. **Auto-sorted by residual risk (highest first).** |
| **Risk Assessment** | `/internal-audit/risk-assessment` | Dedicated listing of all Internal Audit risks with a 5-step assessment wizard per risk. Steps: Risk Context → Likelihood → Impact → Risk Rating (Control Effectiveness + calculated score) → Summary. Supports localStorage save/restore for in-progress assessments. Actions: "Initiate Assessment" (not-assessed), "Resume" (in-progress), "Re-assess" (already assessed). Calls `PATCH /api/internal-audit/risks/[id]/assess`. |
| **Risk Identification / Risk Universe** | `/internal-audit/risk-identification`, `/risk-universe` | AI-assisted risk suggestions |
| **Process Inventory** | `/internal-audit/organization/process` | Process ID, name, **audit category (mandatory — from Audit Settings)**, owner, department, supporting documents, link to IA risks. Accessible to **AuditHead** (full CRUD) and CustomerAdministrator. Navigation visible to AuditHead via `audit.process:view`. |
| **Departments** | `/internal-audit/settings/departments` | Department master data |
| **Settings / Master Data** | `/internal-audit/settings` | Audit types, categories, sub-categories, periodicity, nature of controls, risk-assessment config, escalation rules |

### 2.2 Planning
| Feature | Status | Notes |
|---|---|---|
| **Strategic Audit Plan** | ✅ | 3/4/5-year duration dropdown; **auto-generated from risk levels** (ordered by residual score, year-bucketed, priority-ranked); created by the Audit Director and **approved externally by the Minister** — uploading the signed copy (with approver name) marks the plan **Approved** (no in-app approval workflow); **print** option; approved plans visually highlighted; **click a year → opens the Annual Plan** |
| **Operational (Annual) Plan** | ✅ | Year-wise from the strategic plan (one per year); **view all vs selected year**; add/delete audits; **Assign Auditors** (per-audit auditor dropdown — on plan approval the engagement is auto-assigned to that auditor and they are notified); **upload approval document** |
| **Quarterly Reports** | ✅ | Per operational-plan year, a Q1–Q4 section inside each year block. **Auto-generate** a quarterly audit report PDF (summarizing that quarter's planned audits, engagement status, and findings open/total) via the Generate action; **plus** optional upload/replace/download/delete of a manual report document (encrypted, mirrors the approval-doc pattern) |

### 2.3 Engagements
| Feature | Status | Notes |
|---|---|---|
| **Auto-generate engagements** | ✅ | On operational-plan **approval**, one engagement is created per planned audit (idempotent, traceable back to the plan item) |
| **Engagement management** | ✅ | Create/edit, assign auditor & auditee, per-quarter timelines/schedules. Add Engagement form includes a mandatory **Audit Category** dropdown (fetched from Audit Settings `/api/internal-audit/categories`); stored as `auditCategoryId` on `AuditEngagement`. |
| **Consolidated planned audits** | ✅ | Audit Planning lists **all** planned audits together regardless of year/quarter/approval: engagements **plus** operational-plan audit items not yet converted to engagements (shown with a **Planned** badge + plan code · year · quarter). Source: `/api/internal-audit/audit-planning/planned-audits` |
| **Engagement Workflow Hub** | ✅ | Single-page stepper across the full lifecycle with per-step progress tracking (`/internal-audit/engagement/[id]`) |

### 2.4 Engagement Workflow Steps
| Step | Status | Notes |
|---|---|---|
| **Announcement** | ✅ | Templated notification email (auto-filled from engagement data); save draft / send; locked once sent. **Multiple recipients** — a primary Recipient (Name/Email) plus an **Additional Recipients** list (add/remove Name+Email rows, stored as JSON in `AuditEngagementAnnouncement.additionalRecipients`). On **Send**, the announcement is emailed to all valid recipients (primary + additional, deduped) via `sendEmail` (SMTP), and the auditee still gets the in-app + email notification. |
| **Audit Planning Memorandum (APM)** | ✅ | **Audit Program Overview** (Audit Title / Department / Period) + full **17-section memorandum** mirroring `APM_Final.docx`. Each section is broken into **discrete labeled input fields** (not one free-text box) — e.g. §1 Purpose & Alignment / Assurance Provided / Risk Focus; §2 Plan Year + Justification + **trigger-factor checkboxes** + Conclusion; §13 Opening Meeting / Ongoing Engagement / Issue Validation / Closing Meeting / Reporting; §14 Start/End date, Team, Man-days + Planning/Fieldwork/Reporting phases + Resource Allocation; §7 Audit Approach + focus list + **Risk & Control matrix** (Objective / Risk / Control / Audit Procedure / Risk Rating / Control Type / Control Frequency). Each field is pre-filled with the DOCX boilerplate auditors customize. The section/field layout is defined once in `APM_STRUCTURE` (`src/lib/apm-template.ts`) and drives both the editor and the print view; content stored as JSON (`{ sections, triggerFactors, frameworkRows }`) in `AuditEngagementAPM.content` with a normalizer that backfills missing fields and migrates legacy single-string content. **Download / Print** opens a print-ready memorandum (`/internal-audit/engagement/[id]/apm-print`). Plus audit-program document attachments (encrypted at rest). |
| **Opening Meeting** | ✅ | **Audit Task Opening Meeting Minutes** — structured fillable form (model `AuditOpeningMeeting`, one per engagement). Sections: **Meeting Details** (Management / Department / Audit Task Number / Assignment Title / History / Meeting Venue), **Objective of the meeting** (free text, default boilerplate), **Attendees** (Name / Job Title / Management / Signature), **Topics discussed** (#, Subject, Details/Notes — pre-filled with the standard agenda: Audit Objectives, Scope, Timeline, Key Contacts, Data Availability), **Agreed actions** (#, Action required, Official, Implementation Date). **Save** (`PUT /api/internal-audit/engagements/[id]/opening-meeting`), **Print** and **Export PDF** (pdf-lib, `/opening-meeting/download`). |
| **Audit Program** | ✅ | Structured fillable **Audit Program** form (model `AuditProgram`, one per engagement) following the standard template: **A. Audit Program Overview** (Audit Title / Department / Period), **B. Instructions** (default boilerplate, editable), **C. Detailed Audit Program** — editable 14-column table with add/delete rows (Objective / Process-Subprocess / Risk / Control / Control Type / Test Type / Audit Procedure / Sampling Method / Sample Size / Evidence Required / Result / Conclusion / Exception / Working Paper Ref), **D. Review & Approval** (Prepared/Reviewed/Approved by + dates). **Save** (`PUT /api/internal-audit/engagements/[id]/audit-program`), **Print** and **Export PDF** (landscape pdf-lib, `/audit-program/download`). |
| **Fieldwork** | ✅ | Workpapers, evidence (PBC) requests, evidence upload, review/approval, AI review. Renders **inline inside the engagement workflow** (Fieldwork step) — no navigation away. The view is exported as `FieldworkDetailsView({ embedded })` from `fieldwork/[id]/page.tsx`; `embedded` hides its own breadcrumb/header. The standalone `/internal-audit/fieldwork/[id]` route still works. |
| **Findings** | ✅ | **Add Finding** — an "Add Finding" button in this step opens a dialog (Title / Severity / Criteria / Condition / Cause / Effect / Recommendation / Responsible Person (required, from `/api/users/my-auditees`) / Status / Target Date) and creates the finding via `POST /api/internal-audit/fieldwork/[id]/findings`. (Findings are created here, not in Fieldwork.) Communication mode toggle, **both modes functional**: **Continuous** — share each finding individually (`POST/DELETE /api/internal-audit/findings/[id]/share`), stamps `sharedWithAuditeeAt` and sends the auditee a per-finding inbox+email notification. **Aggregated** — per-finding sharing is **blocked server-side (409)**; instead a single **"Share consolidated draft with auditee"** action (`POST/DELETE /api/internal-audit/engagements/[id]/findings/share-all`) shares all findings at once and sends **one consolidated** "Draft Detailed Report Shared" notification. Mode persists on the engagement (`reportingMode`). **AI Findings Review** — an **"AI Finding Summary"** button submits all of the engagement's findings to the external Python AI (`POST /api/internal-audit/engagements/[id]/findings/ai-review`, which orchestrates the 3-part async job `findings_review_async` → `findings_review_status/{job}` → `findings_review_result/{job}`). The single response is split into an **overall compliance roll-up** (status / confidence / status breakdown / compliance rate — replaces the button in place) and a **per-finding verdict** surfaced as a per-finding **"Review"** button + dialog (compliance status, confidence, reasoning, verification notes, cited policy evidence excerpts). Results are persisted: overall on `AuditEngagement.aiFindingsReviewOverall` (+ `aiFindingsReviewJobId`, `aiFindingsReviewedAt`), per finding on `InternalAuditFinding.aiFindingReview` (+ `aiFindingReviewStatus`, `aiFindingReviewedAt`) and re-hydrated via `GET` of the same route. Distinct from the CAPA evidence review (`aiReviewStatus`/`aiReviewDescription`). |
| **Findings Discussion** | ✅ | **Findings Discussion Meeting Minutes** — inline fillable form (model `AuditFindingsDiscussionMeeting`). Editable sections with add/delete rows: Meeting Details (Management / Department / Audit Task Number / Assignment Title / History / Meeting Venue), Attendees (Name / Job Title / Management / Signature), **Notes Discussed** (Note / Degree of Risk / Management Response / Proposed Action), **Agreed Actions** (Implementation Date / Official / Procedure). **Save** (`PUT /api/internal-audit/engagements/[id]/findings-discussion-meeting`), **Print** and **Export PDF** (pdf-lib, `/findings-discussion-meeting/download`). The legacy Download-Template/Upload(Excel) path (`POST` + `/template`) is retained server-side but removed from the UI. |
| **Closing Meeting** | ✅ | **Closing Meeting Minutes** — inline fillable form (model `AuditClosingMeeting`). Editable sections with add/delete rows: Meeting Details, Attendees, Summary of Audit Results (Key Note / Degree of Risk / Recommendation / Management Response), Decisions taken (Implementation Date / Official / Decision). **Save** (`PUT /api/internal-audit/engagements/[id]/closing-meeting`), **Print** and **Export PDF** (pdf-lib, `/closing-meeting/download`). The legacy Download-Template/Upload(Excel) path is retained server-side but removed from the UI. **Finish & Generate Report** — once every other step is complete, the Closing Meeting step shows a single **"Finish and Generate Report"** button (replacing Mark-complete) → prompts for Overall Result (Pass/Fail) → marks the engagement **Completed** + generates the report (`POST /api/internal-audit/report/generate`) and navigates to the **Report** section where it now appears. |

> **Note:** The engagement workflow stepper is **8 steps**. **Report** and **Follow-up** are no longer steps in the stepper — they are accessed from the Internal Audit sidebar (`Report`, and `Follow-up` which points to the CAPA Tracking page). See §2.5.

### 2.5 Reporting, Monitoring & Support
| Feature | Status | Notes |
|---|---|---|
| **Audit Reports** | ✅ | Generated as **Draft** (status `Draft`); **AuditHead** can **Finalize Report** (→ status `Final`) or **Revert to Draft** from the report list dialog and the report detail page. The Reports list has **All / Draft / Final / Pending tabs** (with counts) plus a per-row Draft/Final/Pending status badge. **PDF download** available in both states: **Draft PDFs carry a visible diagonal "DRAFT" watermark**, **Final PDFs have none** (`/api/internal-audit/report/[id]/download`). Status transition via `PATCH /api/internal-audit/report/[id]` (`status` field, AuditHead-only). |
| **CAPA Tracking** | ✅ | Findings + corrective/preventive actions, evidence, AI review |
| **Follow-up** | ✅ | **Separate top-level sidebar menu** (sibling to Internal Audit, module `INTERNAL_AUDIT`) at `/internal-audit/follow-up` — hosts the Follow-up Meeting Form. CAPA Tracking remains its own page/menu, unchanged. |
| **Follow-up Meeting Form** | ✅ | Follow-up landing page lists engagements in a Risk-Register-style table (search + department/status filters) with an **Open** action per row → detail page `/internal-audit/follow-up/[id]`. The detail page is the per-engagement fillable form (meeting details, attendees, recommendation-implementation status grid); recommendation rows pre-fill from the engagement's findings; status = Open / In Progress / Implemented / Closed; due dates with auto-overdue flagging + progress %; **Save** (persisted, model `AuditFollowUpMeeting`), **Print**, and **Export PDF** (pdf-lib) |
| **Dashboard & Analytics** | ✅ | Risk heatmap, CAPA status, audit stats, auditor schedule, annual-plan timeline, drill-down |
| **Document Library** | ✅ | Upload, categorize, AI search & ingest |
| **Standards Q&A (Chatbot)** | ✅ | The AI Help Chatbot answers questions from the **IIA Global Internal Audit Standards (2024)**. The PDF is chunked (`scripts/extract-gias-standards.py` → `scripts/data/gias-2024-standards.json`) and embedded into `ChatbotKBArticle` with `productScope="audit"`, `source="document"` via `npm run db:seed-gias`. RAG retrieval is RBAC-filtered, so these answers surface **only for internal-audit users** (GRC-only/TPRM users get zero hits). See `src/lib/chatbot/CHATBOT-DOCUMENTATION.md` → *Document Ingestion*. |
| **Automated Monitoring** | ✅ | Cron jobs: due-date reminders, escalation, remediation reminders, plan transitions |
| **Internationalization** | ✅ | All IA UI in English / Arabic / Latvian |

### 2.6 Known Gaps
None outstanding against the MOF requirements.

**Design note — strategic plan approval:** the Minister approves the plan
**outside the system**, so there is intentionally **no in-app approval workflow**
(no "submit for approval" / "pending approval" queue). The Audit Director creates
the plan and records the Minister's approval by uploading the signed copy, which
marks the plan Approved.

---

## 3. Roles & Access Privileges

### 3.1 Role Summary

> **Display rename (2026-06-22):** the `Auditee` role is shown to users as
> **"Auditor"**, the legacy `Auditor` role is hidden, and the conducting
> `assignedAuditor` is labeled **"Audit Manager"** in the UI and generated
> documents. This is a **display-only** change — internal keys are unchanged.
> See **[`INTERNAL_AUDIT_ROLE_RENAME.md`](INTERNAL_AUDIT_ROLE_RENAME.md)** for
> the full rationale, file list, and reversal steps.

| Role | Intended user | Summary of Internal Audit access |
|---|---|---|
| **AuditHead** (Head of Audit) | Audit director / head | Full access to the entire IA module. **Only role that can create a Strategic Plan.** Settings are view-only. |
| **AuditManager** | Audit manager | Same as AuditHead **except cannot create a Strategic Plan** (view-only). **Can fully edit the Operational Plan.** Settings view-only. |
| **Auditor** (legacy — retired) | — | Internal role key kept for backward compatibility with existing assignments, but **hidden from all role pickers** (organization Users page and the Assign Role dialog). No longer offered for new assignments. Permissions unchanged for any user who still holds it. |
| **Auditee** *(displayed as "Auditor")* | Department contact under audit | **Department-scoped**, limited to Fieldwork (view/edit), Reports (view), and CAPA (view/edit). No dashboard, plans, universe, or settings. The internal role key stays `Auditee` (DB, permission matrix, API auth all unchanged); only the **user-facing label** is "Auditor" via `getRoleDisplayName()` in `src/lib/permissions.ts`. |
| **AuditUser** | Basic/observer audit user | View-only across universe, risk, planning, fieldwork, reports, CAPA, documents. No dashboard, plans, or settings. |
| **CustomerAdministrator** | Org administrator | Manages **audit master data/settings** (full CRUD) and the **risk register** (full CRUD). Not the audit execution workflow. |
| **GRCAdministrator** | System administrator | System-level **account overview** only — not the customer audit workflow. |
| **DepartmentReviewer / DepartmentContributor** | Department staff | **View-only** access to the risk register, scoped to their department. |

### 3.2 Access Matrix

Legend: **F** = Full (view/create/edit/delete, plus approve where applicable) · **V** = View only · **V/E** = View + Edit · **CRUD** = view/create/edit/delete · **—** = No access · _(dept)_ = limited to the user's own department.

| Resource (page) | AuditHead | AuditManager | Auditor | AuditUser | Auditee | CustomerAdmin | GRCAdmin | Dept Reviewer/Contributor |
|---|---|---|---|---|---|---|---|---|
| Dashboard | F | F | F | — | — | — | — | — |
| Audit Universe | F | F | F | V | — | — | — | — |
| Risk Identification | F | F | F | V | — | — | — | — |
| Risk Register | F | F | F | V | — | CRUD | — | V _(dept)_ |
| Risk Assessment | F | F | F | — | — | — | — | — |
| Risk Universe | F | F | F | — | — | — | — | — |
| Process Inventory | F | F | F | V | — | CRUD | — | V _(dept)_ |
| **Strategic Plan** | **F (create)** | **V** | V | — | — | — | — | — |
| **Operational Plan** | F | **F** | **V** | — | — | — | — | — |
| Audit Planning (Engagements) | F | F | F | V | — | — | — | — |
| **Independence & Objectivity** | **F** | **F** | **V/C/E** | **V** | — | — | — | — |
| Fieldwork | F | F | F | V | **V/E** _(dept)_ | — | — | — |
| Findings / CAPA Tracking | F | F | F | V | **V/E** _(dept)_ | — | — | — |
| Reports | F | F | F | V | **V** _(dept)_ | — | — | — |
| Document Library | F | F | F | V | — | — | — | — |
| Settings / Master Data | V | V | V | — | — | **CRUD** | — | — |
| Account Overview | — | — | — | — | — | — | **F** | — |

### 3.3 Notes on Scope
- **`all` scope** — the user sees all records in the customer account.
- **`department` scope** — the user only sees records for their own department (applies to Auditee and the Department roles).
- The **engagement workflow hub** (Announcement, APM, meetings, findings communication) is governed by the `audit.fieldwork` permission, so AuditHead/AuditManager/Auditor can edit it and Auditee has department-scoped view/edit where applicable.

---

## 4. Reference
- **Permission source of truth:** `src/lib/permissions.ts`
- **Route → permission mapping:** `src/lib/navigation.ts`
- **Engagement lifecycle stages:** `src/lib/audit-engagement-stages.ts`
- **Prisma models:** `prisma/schema.prisma` (Internal Audit section)
