# Internal Audit Management System — User Manual

| | |
|---|---|
| **Document title** | Internal Audit Management System — User Manual |
| **Audience** | Customer Admin, Audit Head, Audit Member, Auditor |
| **Version** | 1.0 (Draft) |
| **Date** | _Insert date_ |
| **Status** | For client delivery |
| **Source of truth** | Derived from the implemented application (`docs/INTERNAL_AUDIT_MODULE.md`, `src/lib/navigation.ts`, `src/lib/permissions.ts`, Internal Audit pages & APIs). No features are invented; unverifiable details are marked `⚠️ TODO`. |

> **How to read this manual.** Chapters 1–3 orient you (overview, roles, navigation). Chapter 4 is the **per-role guide** (what each role does). Chapter 5 is the **per-module reference** (every page in detail — written once and cross-referenced). Chapter 6 is the **end-to-end audit lifecycle**. The Appendix holds the full access matrix, status reference, and glossary. Every page has a **Screenshot placeholder** followed by a description of each visible section.

---

## Table of Contents

1. [Introduction](#1-introduction)
2. [Role Map & Module Map](#2-role-map--module-map)
3. [Navigation & Common UI](#3-navigation--common-ui)
4. [Per-Role Guide](#4-per-role-guide)
   - 4.1 [Customer Admin](#41-customer-admin)
   - 4.2 [Audit Head](#42-audit-head)
   - 4.3 [Audit Member (Audit Manager)](#43-audit-member-audit-manager)
   - 4.4 [Auditor (Auditee)](#44-auditor-auditee)
5. [Per-Module Reference](#5-per-module-reference)
   - 5.1 [Dashboard](#51-dashboard)
   - 5.2 [Audit Universe](#52-audit-universe)
   - 5.3 [Risk Register](#53-risk-register)
   - 5.4 [Risk Assessment](#54-risk-assessment)
   - 5.5 [Strategic Plan](#55-strategic-plan)
   - 5.6 [Operational (Annual) Plan & Annual Audit Plan](#56-operational-annual-plan--annual-audit-plan)
   - 5.7 [Audit Engagement (Planning)](#57-audit-engagement-planning)
   - 5.8 [Engagement Workflow](#58-engagement-workflow)
     - 5.8.1 Announcement
     - 5.8.2 Audit Planning Memorandum (APM)
     - 5.8.3 Opening Meeting
     - 5.8.4 Audit Program
     - 5.8.5 Fieldwork
     - 5.8.6 Findings
     - 5.8.7 Findings Discussion
     - 5.8.8 Closing Meeting
   - 5.9 [Audit Report](#59-audit-report)
   - 5.10 [Follow-up & CAPA Tracking](#510-follow-up--capa-tracking)
   - 5.11 [Feedback Survey](#511-feedback-survey)
   - 5.12 [Independence & Objectivity](#512-independence--objectivity)
   - 5.13 [Audit Charter](#513-audit-charter)
   - 5.14 [Document Library](#514-document-library)
   - 5.15 [Audit Trail](#515-audit-trail)
   - 5.16 [Audit Settings (Master Data)](#516-audit-settings-master-data)
   - 5.17 [User Management](#517-user-management)
   - 5.18 [Notifications](#518-notifications)
   - 5.19 [Reports & Analytics](#519-reports--analytics)
6. [End-to-End Audit Lifecycle](#6-end-to-end-audit-lifecycle)
7. [Appendix](#7-appendix)

---

## 1. Introduction

The **Internal Audit Management System** digitises the full internal-audit lifecycle — from building the audit universe and assessing risk, through multi-year and annual planning, to conducting engagements, issuing reports, and tracking corrective actions. It implements this flow:

```
Audit Universe → Risk Register → Risk Assessment → Strategic Plan →
Operational (Annual) Plan → Engagements → Engagement Workflow
(Announcement → APM → Opening Meeting → Audit Program → Fieldwork →
 Findings → Findings Discussion → Closing Meeting) →
Audit Report → Feedback Survey → Follow-up / CAPA → Automated Monitoring
```

**Languages.** Every page is available in **English, Arabic (RTL), and Latvian**. Switch language from the globe selector in the top header.

**Access control.** What you can see and do is governed by your **role**. Menus are permission-filtered: you only see the menu items your role is allowed to open. The authoritative permission matrix lives in `src/lib/permissions.ts`; this manual mirrors it (see Appendix A).

> **Note:** This system uses **role display names** that differ from the internal keys. The role shown as **"Auditor"** is internally the `Auditee` role, and the conducting auditor assigned to an engagement is labelled **"Audit Manager."** This manual uses the **display names** clients see.

---

## 2. Role Map & Module Map

### 2.1 Role Map (business term → system role)

| Business role (this manual) | System role (`permissions.ts`) | Notes |
|---|---|---|
| **Customer Admin** | `CustomerAdministrator` | Org administrator. Manages audit master data/settings (full CRUD) and the Risk Register (full CRUD). Not the audit-execution workflow. Sees org-wide **Audit Trail**. |
| **Audit Head** | `AuditHead` | Head of Audit / Audit Director. **Full** access to the entire IA module. **Only role that can create a Strategic Plan.** Settings view-only. |
| **Audit Member** | `AuditManager` | Audit team member who plans and conducts engagements. Same as Audit Head **except cannot create a Strategic Plan** (view-only). **Can fully edit the Operational Plan.** Displayed as **"Audit Manager"** when assigned to conduct an engagement. |
| **Auditor** | `Auditee` *(displayed as "Auditor")* | Department contact under audit. **Department-scoped**: Fieldwork (view/edit), Reports (view), CAPA (view/edit). No dashboard, plans, universe, or settings. |

> **⚠️ Note on "Audit Member":** "Audit Member" is not a literal system role. Based on responsibilities (plans/conducts engagements, edits the Operational Plan), it maps to **`AuditManager`**. If your deployment intends "Audit Member" to mean the view-only `AuditUser` role instead, confirm with the team and swap the mapping. `> ⚠️ TODO: confirm intended mapping with the team.`

Other roles exist in the system but are out of scope for this manual: `Auditor` (legacy key, retired/hidden), `AuditUser` (view-only observer), `GRCAdministrator` (system account overview), `DepartmentReviewer`/`DepartmentContributor` (department-scoped read-only risk register).

### 2.2 Module Map (requested module → real page)

| Requested module | Real page / location | Type |
|---|---|---|
| Dashboard | `/internal-audit/dashboard` | Standalone page |
| Annual Audit Plan | PDF generated from the **Operational Plan** ("Generate Annual Report") | Output of Operational Plan |
| Strategic Plan | `/internal-audit/strategic-plan` | Standalone page |
| Operational Plan | `/internal-audit/operational-plan` (year detail `/operational-plan/[id]`) | Standalone page |
| Audit Engagement | `/internal-audit/audit-engagement` (workflow `/engagement/[id]`) | Standalone + workflow |
| Opening Meeting | Engagement Workflow **step 3** | Workflow step |
| Risk Assessment | `/internal-audit/risk-assessment` (5-step wizard); feeds Strategic Plan | Standalone page |
| Fieldwork | Engagement Workflow **step 5** (also `/fieldwork/[id]`) | Workflow step |
| Findings | Engagement Workflow **step 6** | Workflow step |
| Discussion Meeting | **Findings Discussion** — Engagement Workflow **step 7** | Workflow step |
| Recommendations | Captured **inside Findings** and tracked in **CAPA / Follow-up** | Sub-feature |
| Closing Meeting | Engagement Workflow **step 8** | Workflow step |
| Audit Report | `/internal-audit/report` | Standalone page |
| Follow-up | `/internal-audit/follow-up` (+ CAPA Tracking) | Standalone page |
| Audit Trail | `/internal-audit/audit-trail` | Standalone page |
| User Management | `/internal-audit/organization/users` | Standalone page |
| Notifications | In-app inbox (bell icon) + email | Cross-cutting |
| Reports | Audit Report + Dashboard analytics + Annual/Quarterly report PDFs | Multiple |

**The 8-step Engagement Workflow** (fixed order): **Announcement → Audit Planning Memorandum → Opening Meeting → Audit Program → Fieldwork → Findings → Findings Discussion → Closing Meeting.** *Report* and *Follow-up* are **not** steps — they are separate sidebar items.

---

## 3. Navigation & Common UI

**Screenshot:** *Insert screenshot here*

Common elements on every authenticated page:

| Area | Description |
|---|---|
| **Left sidebar** | Permission-filtered navigation. You only see menu items your role can open. Internal Audit items are grouped under the **Internal Audit** section; **Follow-up** is a separate top-level item. |
| **Top header** | Global search, **language selector** (EN/AR/LV), help/chatbot, **notifications bell** (in-app inbox), and the user menu (profile, log out). |
| **Breadcrumb** | Shows your location, e.g. *Internal Audit › Audit Trail*. |
| **Content area** | The active page. Lists use searchable, sortable, paginated tables; forms use inline fields with **Save** actions and toast confirmations. |

**Internal Audit sidebar items** (subject to permission): Dashboard, Audit Universe, Audit Charter, Risk Identification, Risk Register, Risk Assessment, Strategic Plan, Operational Plan, Audit Engagement, Independence & Objectivity, Report, Feedback Survey, Document Library, **Audit Trail**, Audit Settings; plus the **Internal Audit › Organization** sub-section (Profile, Process, Users, Reports, Organization Settings) and the top-level **Follow-up**.

> **💡 Tip:** If you expect a menu and don't see it, it's a permission gate, not a bug — your role isn't granted that resource. See Appendix A.

---

## 4. Per-Role Guide

### 4.1 Customer Admin

#### Role Overview
- **Purpose.** Organisation administrator. Sets up and maintains **audit master data** and the **Risk Register**, and oversees activity across the organisation.
- **Responsibilities.** Maintain Audit Settings (types, categories, sub-categories, periodicity, scoring config, escalation), maintain the Risk Register and Process Inventory, manage users, and monitor the org-wide **Audit Trail**.
- **Permissions (from `permissions.ts`).**

| Resource | View | Create | Edit | Delete | Scope |
|---|:--:|:--:|:--:|:--:|---|
| Audit Settings (Master Data) | ✓ | ✓ | ✓ | ✓ | all |
| Risk Register (`audit.risk-register`) | ✓ | ✓ | ✓ | ✓ | all |
| Process Inventory (`audit.process`) | ✓ | ✓ | ✓ | ✓ | all |
| Organization (profile, users, dept, settings) | ✓ | ✓ | ✓ | ✓ | all |
| **Audit Trail** | ✓ | — | — | — | **all (org-wide)** |
| Audit execution workflow (plans, engagements, fieldwork, reports) | — | — | — | — | — |

#### Navigation
- **Menus available:** Organization (Profile, Users, Process, Settings), Audit Settings, Risk Register, **Audit Trail**, and master-data pages. Does **not** see the audit-execution menus (Strategic/Operational Plan, Engagements, Fieldwork, Reports).
- **Dashboard:** Customer Admin does **not** have the Internal Audit operational dashboard.
- **Modules accessible:** Audit Settings, Risk Register, Process Inventory, User Management, Audit Trail (org-wide). See Chapter 5 for each.

### 4.2 Audit Head

#### Role Overview
- **Purpose.** Head of Audit / Audit Director — owns the audit function end to end.
- **Responsibilities.** Build the audit universe, oversee risk assessment, **create the Strategic Plan**, generate and approve Operational Plans, oversee engagements, **finalize audit reports**, and drive follow-up.
- **Permissions.** **Full** across the IA module (Dashboard, Universe, Risk, **Strategic Plan create**, Operational Plan, Engagements, Independence, Fieldwork, Findings/CAPA, Reports, Documents). **Settings view-only.** **Audit Trail:** own activity only (`scope: own`).

#### Navigation
- **Menus available:** all Internal Audit menus + Follow-up. Dashboard available.
- **Modules accessible:** every module in Chapter 5.

> **Note:** Audit Head is the **only** role that can **create** a Strategic Plan and the role that can **finalize** an Audit Report (Draft → Final).

### 4.3 Audit Member (Audit Manager)

#### Role Overview
- **Purpose.** Audit team member who plans and conducts engagements.
- **Responsibilities.** Edit the **Operational Plan**, run the **engagement workflow** (announcement, APM, meetings, audit program, fieldwork, findings), and prepare reports for the Audit Head to finalize. Conducts the engagement as the assigned **"Audit Manager."**
- **Permissions.** Same as Audit Head **except cannot create a Strategic Plan** (view-only). **Can fully edit the Operational Plan.** Settings view-only. **Audit Trail:** own activity only.

#### Navigation
- **Menus available:** all IA menus + Follow-up; Strategic Plan is read-only.
- **Modules accessible:** every module in Chapter 5, with Strategic Plan view-only.

### 4.4 Auditor (Auditee)

#### Role Overview
- **Purpose.** Department contact for the area under audit (the auditee). Displayed in the UI as **"Auditor."**
- **Responsibilities.** Respond to evidence (PBC) requests, participate in fieldwork, review shared findings, and track corrective actions for their department.
- **Permissions (department-scoped).** Fieldwork (view/edit), Reports (view), CAPA/Findings (view/edit) — **limited to their own department**. No dashboard, plans, universe, or settings. **Audit Trail:** own activity only.

#### Navigation
- **Menus available:** Fieldwork, Reports, CAPA/Follow-up (department-scoped), Audit Trail (own).
- **Modules accessible:** Fieldwork, Findings/CAPA, Reports — see Chapter 5.

> **⚠️ Warning:** Auditor (Auditee) access is **department-scoped**. They see only records for their own department and cannot reach planning, the universe, or settings.

---

## 5. Per-Module Reference

> Each module below follows the same structure: **Purpose · Who can access · Prerequisites · Screenshot · Sections · Fields · Buttons/Actions · Steps · Workflow & Status · Validation · System behavior · Notes/Tips.** Where a specific field list, validation message, or status value could not be confirmed from the code, it is marked `⚠️ TODO`.

### 5.1 Dashboard

- **Purpose.** At-a-glance view of audit health: risk heatmap, CAPA status, audit stats, auditor schedule, annual-plan timeline, with drill-down.
- **Who can access.** Audit Head, Audit Member (`audit.dashboard`). Not Customer Admin or Auditor.
- **Prerequisites.** Data exists (risks, plans, engagements).

**Screenshot:** *Insert screenshot here*

- **Sections.** Risk heatmap; CAPA status summary; audit statistics cards; auditor schedule; annual-plan timeline. Each supports drill-down to the underlying records. `⚠️ TODO: confirm exact card list & labels from the dashboard page.`
- **Buttons/Actions.** Drill-down links open the related module.
- **System behavior.** Read-only analytics; reflects current data.
- **💡 Tip:** Use the heatmap to spot high-residual risks before planning.

### 5.2 Audit Universe

- **Purpose.** Inventory of auditable areas, organised by **Audit Category → Processes / Risks / Audits**.
- **Who can access.** Audit Head/Member full; Audit User view; (`audit.auditables`).
- **Prerequisites.** Audit categories and processes defined in Settings.

**Screenshot:** *Insert screenshot here*

- **Sections.** Stat cards (Categories, Processes, Risks, Total Audits); a tree/table grouped by category.
- **Field descriptions.**

| Column | Description |
|---|---|
| Process/System/Entity | The auditable item |
| Department | Owning department |
| Description | What it covers |
| Last Audit Date | Most recent audit |
| Audit Frequency (Years) | Planned cadence |
| Regulatory Requirement | Applicable regulation |
| Notes | Free text |

- **System behavior.** An audit appears under a category when linked via `auditCategoryId` on the engagement, or via a risk's `engagementId`.

### 5.3 Risk Register

- **Purpose.** Central register of internal-audit risks, auto-sorted by residual risk (highest first).
- **Who can access.** Audit Head/Member full; Audit User view; **Customer Admin CRUD**; Department reviewer/contributor view (dept).
- **Prerequisites.** Processes and categories defined.

**Screenshot:** *Insert screenshot here*

- **Field descriptions (key fields).**

| Field | Description |
|---|---|
| Risk ID | Auto identifier (e.g. RID001) |
| Process link | Associated process |
| Title / Description | Risk statement |
| Category / Sub-category | Classification (from Settings) |
| Source · Cause/Driver · Consequence | Risk anatomy |
| Inherent likelihood/impact/rating | Pre-control assessment |
| Residual likelihood/impact/rating | Post-control assessment |
| Control effectiveness | Strength of controls |
| Related law · Policy reference · Document links | References |

- **Buttons/Actions.** Create / Edit / Delete risk; open assessment (see 5.4).
- **System behavior.** List re-sorts by residual risk automatically.
- **💡 Tip:** A risk must be **assessed** (see 5.4) before it can enter the Strategic Plan.

### 5.4 Risk Assessment

- **Purpose.** Assess each risk through a **5-step wizard** to produce a residual score and risk level; assessed risks become eligible for the Strategic Plan.
- **Who can access.** Audit Head/Member (`audit.risk-assessment`).
- **Prerequisites.** The risk exists in the Risk Register.

**Screenshot:** *Insert screenshot here*

- **Wizard steps.** 1) Risk Context → 2) Likelihood → 3) Impact → 4) Risk Rating (Control Effectiveness + calculated score) → 5) Summary. In-progress assessments are saved/restored from local storage.
- **Buttons/Actions.**

| Action | When shown | What it does |
|---|---|---|
| **Initiate Assessment** | Risk not assessed | Opens the wizard |
| **Resume** | Assessment in progress | Re-opens the saved wizard |
| **Re-assess** | Already assessed | Re-runs the wizard |

- **Workflow & status.** `assessmentStatus`: **Not Assessed → Assessed**. Saving the wizard calls `PATCH /api/internal-audit/risks/[id]/assess`, which writes `assessmentResidualScore`, `assessmentStatus = "Assessed"`, and derives `riskLevel` from the configured scoring ranges.
- **System behavior — important.** A risk appears in the **Strategic Plan → Risk Assessment** section (and can be added to a plan) **only when `assessmentStatus = "Assessed"`** — i.e. you completed and saved the wizard. Legacy inherent/residual values alone do **not** make a risk "assessed."
- **⚠️ Warning:** "Initiate Assessment" only **opens** the wizard — you must complete all steps and **save** the final step. Until then the status stays *Not Assessed* and the risk will not appear in the Strategic Plan.

### 5.5 Strategic Plan

- **Purpose.** Multi-year (3/4/5-year), risk-based audit strategy. Assessed risks are added here and bucketed across plan years by residual score.
- **Who can access.** **Audit Head — create**; Audit Member / Auditor — **view**.
- **Prerequisites.** At least one **assessed** risk (see 5.4).

**Screenshot:** *Insert screenshot here*

#### Sections
1. **Risk Assessment** (top) — assessed risks **not yet added to a plan**, each with an **Add Plan** button. Columns: Risk ID, Risk, Department, Risk Level, Actions. A **Risk Level** filter narrows the list.
2. **Strategic Plan** (below) — the audits already added to the plan (Audit, Type, Duration, Actions), with **Edit/Remove** per item.

#### Add Plan dialog — fields

| Field | Required | Values | Description |
|---|:--:|---|---|
| Audit Type | — | From Audit Settings | The audit type/category dropdown |
| Duration | ✓ | 3 / 4 / 5 Years | Routes the risk to the plan of that duration (creates the plan if none exists) |
| Reason for Scheduling | — | Text | Why this audit is scheduled |
| Notes | — | Text | Free notes |

- **Buttons/Actions.** **Add Plan** (per assessed risk) → opens dialog → **Save** adds the risk as a plan item and **auto-syncs** it into the matching Operational (annual) plan year. **Edit / Remove** on plan items. **Upload signed copy** (records Minister approval). **Print**.
- **Workflow & status.** Plan status: **Draft → Approved**. Approval is **external** (the Minister approves outside the system); uploading the **signed copy** + approver name marks the plan **Approved**. There is intentionally **no in-app "submit for approval"** step.
- **Validation.** A risk can only be added when it is assessed (`assessmentStatus = "Assessed"`); otherwise the action is rejected.
- **System behavior.** Adding a risk re-ranks items by residual score within each year and creates/updates the corresponding Operational Plan. **Clicking a plan year opens the Annual (Operational) Plan.**
- **Note:** Once a risk is added to a plan it **leaves** the Risk Assessment section (it now lives in the plan list) — this prevents adding the same risk twice.

### 5.6 Operational (Annual) Plan & Annual Audit Plan

- **Purpose.** Year-by-year annual plans derived from the Strategic Plan — one Operational Plan per year — where audits are scheduled by quarter, resourced, and approved.
- **Who can access.** Audit Head full; **Audit Member full edit**; Auditor view.
- **Prerequisites.** A Strategic Plan with audits for that year.

**Screenshot:** *Insert screenshot here*

#### Page layout
- **Year selector** (All Years / specific year) and one **Year block** per plan year. Each year block header shows status (**Draft / Approved**) and actions.
- **Per-year actions (header):** **Generate Annual Report** (PDF — the *Annual Audit Plan*), **Assign Audit Managers**, **Upload Approval** (sign-off document), **Delete**. If no plan exists for a year: **Generate Operational Plan**.
- **Quarter sections (Q1–Q4).** Inside each year, audits are grouped under **Q1, Q2, Q3, Q4**. Each quarter has its **own "+ Add Audit"** button. An **Unscheduled** bucket holds audits with no quarter.
- **Per-quarter audit table.** Columns: #, Audit, Category, Audit Manager, Actions (delete).
- **Per-quarter planning panel** (below each quarter's audits): **Residual Risk Score · Risk Classification · Proposed Periodical · Estimated Hours · Auditor in Charge** — inline-editable, saved per quarter.
- **Quarterly Reports section.** Q1–Q4 cards to **auto-generate** a quarterly report PDF and/or upload/replace/download a manual report.

#### Add Audit dialog — fields

| Field | Required | Values | Description |
|---|:--:|---|---|
| Audit Title | ✓ | Text | Name of the audit |
| Audit Category | — | From Audit Settings (`/api/internal-audit/categories`) | Category dropdown |
| Notes | — | Text | Free notes |
| (Quarter) | — | Implied by the section's Add Audit button | The audit is placed in that quarter |

- **Buttons/Actions.**

| Button | What it does | Result |
|---|---|---|
| Generate Operational Plan | Builds the year's plan from the strategic plan | Year block populated |
| + Add Audit (per quarter) | Opens the Add Audit dialog for that quarter | New audit row in the quarter |
| Assign Audit Managers | Assigns the conducting auditor per audit | On plan approval, the engagement is auto-assigned to that auditor and they are notified |
| Generate Annual Report | Produces the **Annual Audit Plan PDF** (landscape, 14 columns: Priority Order, Process/Entity, Department, Audit Type, Residual risk score, Risk Classification, Proposed Periodical, Estimated Hours, Auditor in Charge, First–Fourth Quarter marks, Status) | PDF download |
| Upload Approval | Attaches the signed approval document | Plan status → Approved |

- **Workflow & status.** Plan status: **Draft → Approved**. **On approval, one Engagement is auto-created per planned audit** (idempotent, traceable to the plan item).
- **Validation.** Audit Title required.
- **System behavior.** Quarter planning fields persist per (plan, quarter). Approval triggers engagement generation + auditor assignment + notification.
- **💡 Tip:** Use **Assign Audit Managers** before approval so engagements are auto-assigned on approval.

### 5.7 Audit Engagement (Planning)

- **Purpose.** The list of all planned audits — engagements **plus** operational-plan audit items not yet converted to engagements — and the entry point into the engagement workflow.
- **Who can access.** Audit Head/Member full; Audit User view (`audit.planning`).
- **Prerequisites.** Operational Plan audits (planned) or approved plans (engagements).

**Screenshot:** *Insert screenshot here*

- **Sections.** A consolidated table of planned audits; items not yet an engagement show a **Planned** badge with plan code · year · quarter. Source: `/api/internal-audit/audit-planning/planned-audits`.
- **Add Engagement form.** Includes a **mandatory Audit Category** dropdown (from Audit Settings); stored as `auditCategoryId`. Assign auditor & auditee; per-quarter timelines/schedules.
- **Buttons/Actions.** **Edit** (opens the engagement workflow hub `/engagement/[id]`); create/edit engagement; assign auditor/auditee.
- **System behavior.** Opening an engagement loads the **8-step workflow stepper** (see 5.8).

### 5.8 Engagement Workflow

The engagement hub (`/internal-audit/engagement/[id]`) is a **single-page stepper** with per-step progress. The 8 steps are below. The whole hub is governed by the `audit.fieldwork` permission (Audit Head/Member edit; Auditor department-scoped view/edit where applicable).

**Screenshot:** *Insert screenshot here* — the stepper header (steps 1–8) and the active step panel.

> **System behavior — completion & lock.** When **every** step is complete, the **Closing Meeting** step shows **"Finish and Generate Report"** → prompts for **Overall Result (Pass/Fail)** → marks the engagement **Completed** and generates the report. The engagement status also auto-completes when all steps are done, and **once the report is generated the engagement becomes read-only** (Edit changes to View).

#### 5.8.1 Announcement
- **Purpose.** Send the formal audit announcement (with the PBC list) to management.
- **Sections/Fields.** Recipients (a **dropdown of Internal Audit users**, multi-select, email auto-filled) **plus "Add External Recipient"** (Name + Email, on the right); Commence Date; Subject; Message (auto-filled from engagement data).
- **Buttons/Actions.** **Save Draft**; **Send Announcement** (emails all recipients via SMTP + sends the auditee an in-app + email notification; **locks** the announcement once sent).
- **Status.** Draft → Sent (locked).

#### 5.8.2 Audit Planning Memorandum (APM)
- **Purpose.** Full 17-section planning memorandum (mirrors the standard APM template).
- **Sections/Fields.** Audit Program Overview (Audit Title / Department / Period) + 17 sections broken into **discrete labelled fields** (e.g. Purpose & Alignment, Risk Focus, trigger-factor checkboxes, audit approach, **Risk & Control matrix**: Objective / Risk / Control / Audit Procedure / Risk Rating / Control Type / Control Frequency, team & man-days, phases). Pre-filled with boilerplate that auditors customise.
- **Buttons/Actions.** **Save**; **Download / Print** (print-ready memorandum); attach audit-program documents (encrypted at rest).

#### 5.8.3 Opening Meeting
- **Purpose.** Record the **Audit Task Opening Meeting Minutes**.
- **Sections.** Meeting Details (Management / Department / Audit Task Number / Assignment Title / History / Venue); Objective; **Attendees** (Name / Job Title / Management / Signature); **Topics discussed** (pre-filled agenda: Objectives, Scope, Timeline, Key Contacts, Data Availability); **Agreed actions** (Action / Official / Implementation Date).
- **Buttons/Actions.** **Save** (`PUT …/opening-meeting`); **Export PDF**.

#### 5.8.4 Audit Program
- **Purpose.** The detailed audit program.
- **Sections.** A. Overview (Title/Department/Period); B. Instructions (editable boilerplate); **C. Detailed Audit Program** — editable 14-column table with add/delete rows (Objective / Process-Subprocess / Risk / Control / Control Type / Test Type / Audit Procedure / Sampling Method / Sample Size / Evidence Required / Result / Conclusion / Exception / Working Paper Ref); D. Review & Approval (Prepared/Reviewed/Approved by + dates).
- **Buttons/Actions.** **Save** (`PUT …/audit-program`); **Export PDF** (landscape).

#### 5.8.5 Fieldwork
- **Purpose.** Workpapers, evidence (PBC) requests, evidence upload, review/approval, AI review. Renders **inline** within the workflow.
- **Who.** Audit Head/Member; **Auditor (Auditee)** department-scoped view/edit.
- **Buttons/Actions.** Create workpapers; raise/respond to PBC evidence requests; upload evidence; review/approve; AI review. `⚠️ TODO: confirm exact button labels from the fieldwork page.`

#### 5.8.6 Findings
- **Purpose.** Record audit findings and share them with the auditee.
- **Add Finding dialog — fields.** Title / Severity / Criteria / Condition / Cause / Effect / Recommendation / **Responsible Person (required, from `/api/users/my-auditees`)** / Status / Target Date. (Findings are created **here**, not in Fieldwork.)
- **Communication modes (toggle, both functional).**
  - **Continuous** — share each finding individually; stamps `sharedWithAuditeeAt` and sends a per-finding inbox+email notification.
  - **Aggregated** — per-finding sharing is **blocked (409)**; instead **"Share consolidated draft with auditee"** shares all findings at once with **one** "Draft Detailed Report Shared" notification.
- **Status (per finding).** `status` values: **Open** (default) → **In Progress** → **Under Review** (set while a submitted CAPA awaits AI review) → **Closed**. A separate `aiReviewStatus` (e.g. *Satisfactory*) tracks the AI review outcome and is **not** the same as `status`. Findings also carry a shared/un-shared state (`sharedWithAuditeeAt`).

#### 5.8.7 Findings Discussion
- **Purpose.** Record **Findings Discussion Meeting Minutes**.
- **Sections.** Meeting Details; Attendees; **Notes Discussed** (Note / Degree of Risk / Management Response / Proposed Action); **Agreed Actions** (Implementation Date / Official / Procedure).
- **Buttons/Actions.** **Save** (`PUT …/findings-discussion-meeting`); **Export PDF**.

#### 5.8.8 Closing Meeting
- **Purpose.** Record **Closing Meeting Minutes** and finalize the engagement.
- **Sections.** Meeting Details; Attendees; Summary of Audit Results (Key Note / Degree of Risk / Recommendation / Management Response); Decisions taken (Implementation Date / Official / Decision).
- **Buttons/Actions.** **Save**; **Export PDF**; **Finish and Generate Report** (when all steps complete) → Overall Result (Pass/Fail) → engagement **Completed** + report generated → navigates to **Report**.

### 5.9 Audit Report

- **Purpose.** The formal audit report generated from a completed engagement.
- **Who can access.** Audit Head/Member full; Audit User & Auditor view; **only Audit Head can finalize**.
- **Prerequisites.** A completed engagement (report generated from Closing Meeting).

**Screenshot:** *Insert screenshot here*

- **Sections.** Reports list with **All / Draft / Final / Pending** tabs (with counts); per-row status badge; report detail page.
- **Buttons/Actions.**

| Action | Who | Effect |
|---|---|---|
| Generate (from Closing Meeting) | Audit Head/Member | Creates the report as **Draft** |
| **Finalize Report** | **Audit Head** | Status **Draft → Final** |
| **Revert to Draft** | **Audit Head** | Status **Final → Draft** |
| **Download PDF** | All with view | **Draft PDF carries a diagonal "DRAFT" watermark**; Final PDF has none |

- **Workflow & status.** `status`: **Draft → Final** (and back). Transition via `PATCH /api/internal-audit/report/[id]` (AuditHead-only).
- **⚠️ Warning:** Only the **Audit Head** can finalize or revert a report. A Draft PDF is clearly watermarked **DRAFT**.

### 5.10 Follow-up & CAPA Tracking

- **Purpose.** Track implementation of recommendations / corrective & preventive actions after the report.
- **Who can access.** Audit Head/Member full; Auditor (Auditee) view/edit (dept); Audit User view.
- **Prerequisites.** An engagement with findings/recommendations.

**Screenshot:** *Insert screenshot here*

- **Follow-up landing page.** Engagements in a Risk-Register-style table (search + department/status filters), each with **Open** → detail `/internal-audit/follow-up/[id]`.
- **Follow-up Meeting Form (detail).** Meeting details, attendees, **recommendation-implementation status grid** (rows pre-filled from the engagement's findings). Due dates with **auto-overdue** flagging + progress %.
- **Buttons/Actions.** **Save**; **Print**; **Export PDF**.
- **Status (per recommendation).** **Open / In Progress / Implemented / Closed.**
- **CAPA Tracking** is its own page: findings + corrective/preventive actions, evidence, AI review.

### 5.11 Feedback Survey

- **Purpose.** Post-engagement QAIP feedback survey (Internal Audit Engagement Feedback Survey).
- **Who can access.** Internal Audit users (`audit.fieldwork:view`).
- **Prerequisites.** A selected engagement.

**Screenshot:** *Insert screenshot here*

- **Sections.** Engagement selector; **Sections A–F** (Engagement Planning / Professionalism & Communication / Audit Execution / Findings & Recommendations / Reporting / Value Provided) — each question rated **5 / 4 / 3 / 2 / 1 / N/A** with a per-section **Comments** box and an **Add Row** button to add custom questions; **Overall Satisfaction (1–5)**; two open questions ("What did the audit team do particularly well?" / "What improvements would you recommend?").
- **Buttons/Actions.** **Add Row** (per section); **Save** (`PUT …/feedback-survey`); **Export PDF**.

### 5.12 Independence & Objectivity

- **Purpose.** Auditor **Independence** and **Objectivity** declarations (IIA standards).
- **Who can access.** Audit Head/Member full; Auditor view/create/edit; Audit User view.

**Screenshot:** *Insert screenshot here*

- **Sections.** Declarant info; fixed declaration statements; result (Confirmed / Potential impairment, or No threats / Potential threat) with explanation; typed signature; Audit Head/Manager review & sign-off.
- **Status.** **Draft → Submitted → Reviewed.**
- **Buttons/Actions.** Save; **Print / Save as PDF** (dedicated print view, row **Print** action or View dialog).

### 5.13 Audit Charter

- **Purpose.** Maintain the audit charter from an uploaded `.docx`; blue text runs become editable inline fields.
- **Who can access.** Audit Head/Member/Auditor upload + edit; Audit User view.

**Screenshot:** *Insert screenshot here*

- **Buttons/Actions.** **Upload** charter (`.docx`); edit inline (blue) fields; **Save** (`PATCH …/audit-charter`). Static text is read-only.

### 5.14 Document Library

- **Purpose.** Upload, categorise, and AI-search audit documents.
- **Who can access.** Audit Head/Member/Auditor full; Audit User view (`audit.documents`).
- **Buttons/Actions.** Upload; categorize; AI search & ingest. `⚠️ TODO: confirm exact controls from the page.`

**Screenshot:** *Insert screenshot here*

### 5.15 Audit Trail

- **Purpose.** Immutable, append-only activity log for traceability and accountability.
- **Who can access.** All IA roles (`audit.audit-trail:view`). **Customer Admin** sees **all** org activity; everyone else sees **only their own**.
- **Prerequisites.** None — entries are auto-captured.

**Screenshot:** *Insert screenshot here*

- **Sections.** Filter bar (Customer Admin only sees **User Name** + **User Role** filters) — **Search**, User Name, User Role, **Action Type**, **Module Name**, **From/To Date**; a sortable, paginated grid.
- **Columns.** # · User Name · User Role · Action · Module/Entity · Date & Time.
- **Captured actions.** Create / Update / Delete / Approve / Login / Logout / … — auto-captured: every successful mutating API request is logged, and Login/Logout are logged on sign-in/out.
- **Buttons/Actions.** Sort (click a column header); paginate (10/25/50/100 per page); **Clear** filters.
- **Workflow & status.** None — read-only. The API exposes **GET only**.
- **⚠️ Warning:** Logs are **read-only** and cannot be edited or deleted by any user.
- **System behavior.** Standard users (`scope: own`) are restricted to `where userId = self`; Customer Admin (`scope: all`) sees the whole organisation and gets the user/role filters.

### 5.16 Audit Settings (Master Data)

- **Purpose.** Maintain the master data that drives the whole module.
- **Who can access.** **Customer Admin CRUD**; Audit Head/Member/Auditor **view-only**.

**Screenshot:** *Insert screenshot here*

- **Sections.** Audit types, **categories**, sub-categories, periodicity, nature of controls, risk-assessment/scoring config, escalation rules; **Departments** master data.
- **System behavior.** Categories/types feed dropdowns across Strategic/Operational Plans, Engagements, and the Audit Universe.
- **💡 Tip:** Configure scoring ranges before assessments so `riskLevel` is derived correctly.

### 5.17 User Management

- **Purpose.** Create and manage users and assign roles.
- **Who can access.** Customer Admin (Organization › Users); `organization.users`.
- **Buttons/Actions.** Create user; assign role(s); activate/deactivate. `⚠️ TODO: confirm exact fields and the role picker options from the Users page.`

**Screenshot:** *Insert screenshot here*

> **Note:** The legacy `Auditor` role and the `Auditee` key are handled specially — `Auditee` is shown as **"Auditor"** in the picker, and the retired `Auditor` key is hidden from new assignments.

### 5.18 Notifications

- **Purpose.** Keep actors informed of events (announcements, shared findings, due dates, escalations).
- **Where.** In-app **inbox** (bell icon, top header) + **email** (SMTP).
- **System-generated examples.** Announcement sent → auditee notified; finding shared (continuous) → per-finding notification; consolidated draft shared (aggregated) → single notification; auditor assigned on plan approval → notified; automated cron reminders (due dates, escalation, remediation). `⚠️ TODO: confirm the full notification catalogue.`

**Screenshot:** *Insert screenshot here*

### 5.19 Reports & Analytics

- **Audit Report** — see 5.9.
- **Annual Audit Plan PDF** — generated from the Operational Plan (see 5.6).
- **Quarterly Report PDF** — auto-generated per quarter (planned audits, engagement status, findings open/total) or uploaded manually.
- **Dashboard analytics** — see 5.1.
- **Meeting/Memorandum PDFs** — Opening Meeting, APM, Audit Program, Findings Discussion, Closing Meeting, Follow-up, Feedback Survey each export to PDF.

---

## 6. End-to-End Audit Lifecycle

The table shows who performs each action and what the system does next.

| # | Actor (role) | Action | System response | Next actor |
|---|---|---|---|---|
| 1 | Customer Admin | Configure **Audit Settings** (types, categories, scoring) and maintain the **Risk Register** | Master data + risks available | Audit Head/Member |
| 2 | Audit Head / Member | **Assess risks** (5-step wizard) | `assessmentStatus = Assessed`, residual score + risk level set | Audit Head |
| 3 | Audit Head | **Create Strategic Plan**; **Add Plan** assessed risks (with duration, reason, notes) | Risks bucketed by year; matching **Operational Plans** auto-synced | Audit Head |
| 4 | Audit Head | Record Minister approval by **uploading the signed copy** | Strategic Plan → **Approved** | Audit Member |
| 5 | Audit Member | Open the year's **Operational Plan**, add audits per **quarter**, set per-quarter planning fields, **Assign Audit Managers** | Annual plan populated | Audit Head |
| 6 | Audit Head | **Upload Approval** on the Operational Plan | Plan → **Approved**; **one Engagement auto-created per planned audit**; assigned auditor notified | Audit Member |
| 7 | Audit Member (Audit Manager) | Open the **Engagement**; run the 8-step workflow: **Announcement** (notify auditee) → **APM** → **Opening Meeting** → **Audit Program** → **Fieldwork** | Each step saved; auditee notified on announcement | Auditor (Auditee) |
| 8 | Auditor (Auditee) | Respond to **PBC evidence** requests; participate in fieldwork (department-scoped) | Evidence attached/reviewed | Audit Member |
| 9 | Audit Member | Record **Findings**; **share** with auditee (Continuous or Aggregated) | Auditee notified (per-finding or consolidated) | Auditor (Auditee) |
| 10 | Audit Member + Auditor | **Findings Discussion** meeting minutes | Saved; PDF available | Audit Member |
| 11 | Audit Member | **Closing Meeting**; **Finish and Generate Report** (Overall Result Pass/Fail) | Engagement → **Completed**; report created as **Draft**; engagement becomes **read-only** | Audit Head |
| 12 | Audit Head | **Finalize Report** | Report → **Final** (no DRAFT watermark) | Audit Head/Member |
| 13 | Audit Member | **Follow-up / CAPA**: track recommendation implementation (Open → In Progress → Implemented → Closed) | Overdue flagging + progress %; reminders via cron | Auditor (Auditee) |
| 14 | Auditee / Audit team | **Feedback Survey** (QAIP) | Saved per engagement; PDF export | — |
| — | All | Every mutating action + Login/Logout | Recorded in the **Audit Trail** | Customer Admin (oversight) |

**Screenshot:** *Insert screenshot here* — a swimlane diagram of the lifecycle.

---

## 7. Appendix

### Appendix A — Role × Module Access Matrix

Legend: **F** = Full · **V** = View · **V/E** = View+Edit · **CRUD** = create/read/update/delete · **—** = none · _(dept)_ = department-scoped.

| Resource (page) | Customer Admin | Audit Head | Audit Member (Mgr) | Auditor (Auditee) |
|---|---|---|---|---|
| Dashboard | — | F | F | — |
| Audit Universe | — | F | F | — |
| Risk Register | CRUD | F | F | — |
| Risk Assessment | — | F | F | — |
| Strategic Plan | — | **F (create)** | **V** | — |
| Operational Plan | — | F | **F** | — |
| Audit Engagement | — | F | F | — |
| Independence & Objectivity | — | F | F | — |
| Fieldwork | — | F | F | **V/E** _(dept)_ |
| Findings / CAPA | — | F | F | **V/E** _(dept)_ |
| Reports | — | F | F | **V** _(dept)_ |
| Document Library | — | F | F | — |
| Feedback Survey | — | F | F | V |
| **Audit Trail** | **V (all org)** | V (own) | V (own) | V (own) |
| Audit Settings | **CRUD** | V | V | — |
| User Management | F | — | — | — |

> Full authority is `src/lib/permissions.ts`. The `Auditor`/`Auditee` display rename is documented in `INTERNAL_AUDIT_ROLE_RENAME.md`.

### Appendix B — Status Reference

| Entity | Statuses |
|---|---|
| Risk assessment (`assessmentStatus`) | Not Assessed · Assessed |
| Strategic Plan | Draft · Approved |
| Operational Plan | Draft · Approved |
| Engagement | (in progress) · Completed |
| Audit Report (`status`) | Draft · Final (list also has Pending tab) |
| Independence/Objectivity declaration | Draft · Submitted · Reviewed |
| Follow-up recommendation | Open · In Progress · Implemented · Closed |
| Finding (`status`) | Open (default) · In Progress · Under Review · Closed |
| Finding AI review (`aiReviewStatus`) | e.g. Satisfactory · (pending) — separate from `status` |

### Appendix C — Glossary

| Term | Meaning |
|---|---|
| **PBC** | "Provided By Client" — evidence requested from the auditee |
| **APM** | Audit Planning Memorandum |
| **CAPA** | Corrective And Preventive Action |
| **QAIP** | Quality Assurance and Improvement Program (Feedback Survey) |
| **Audit Manager** | Display label for the conducting auditor assigned to an engagement |
| **Auditor (display)** | The `Auditee` role — the department contact under audit |

### Appendix D — Notes for the documentation team

Items marked `⚠️ TODO` above need a quick code/UX confirmation before final client delivery:
- Dashboard card list & labels
- Fieldwork button labels and Document Library controls
- Exact Finding status enum
- Full notification catalogue
- User Management fields and role-picker options

---

## Appendix E — Button Behavior Reference (on-click)

This appendix documents **what happens when each button is clicked** — the validation performed, the API called, the resulting state change, and the **exact** on-screen message (success/error text shown as a toast, quoted verbatim from the application). Messages are translated to your active language (EN/AR/LV).

> **General Save pattern.** Unless noted, a **Save** button: (1) collects the form fields, (2) sends them to the page's API endpoint, (3) on success shows a green success toast and the data is persisted (the form stays open with saved values), (4) on failure shows a red error toast and nothing is saved.

### E.1 Strategic Plan
| Button | On click — validation → API → result | Success message | Error message |
|---|---|---|---|
| **Add Plan** (on an assessed risk) | Opens the Add Plan dialog for that risk | — | — |
| **Save** (in Add Plan dialog) | Server checks the risk is assessed (`assessmentStatus = "Assessed"`) → `POST /strategic-plans/add-risk` (riskId, durationYears, auditType, reason, notes) → risk added to the matching-duration plan and **auto-synced** to that year's Operational Plan; dialog closes; lists refresh | "Added to strategic plan" | "Failed to add to strategic plan" |
| **Edit** (plan item) → **Save** | `PATCH /strategic-plans/items/[id]` (title/type/year/notes) | "Audit updated" | "Failed to update audit" |
| **Remove** (plan item) | Deletes the item (`DELETE …/items/[id]`); the risk returns to the Risk Assessment section | "Audit removed from plan" | "Failed to remove audit" |
| **Create Strategic Plan** | `POST /strategic-plans` (title, duration, start year, …) | "Strategic plan created" | "Failed to create strategic plan" |
| **Upload signed copy** (approve) | Validates a file is chosen, then uploads it + approver name; plan → **Approved** | "Strategic plan approved" | "Please select the signed copy to upload" / "Failed to approve plan" |
| **Revoke approval** | Clears approval; plan → Draft | "Approval revoked" | "Failed to revoke approval" |
| **Delete** (plan) | Deletes the strategic plan | "Strategic plan deleted" | "Failed to delete strategic plan" |

### E.2 Operational (Annual) Plan
| Button | On click — validation → API → result | Success message | Error message |
|---|---|---|---|
| **Generate Operational Plan** | `POST /operational-plans` (strategicPlanId, year) → builds the year's plan from the strategic plan | "Operational plan generated" | "Failed to generate operational plan" |
| **+ Add Audit** (per quarter) | Opens the Add Audit dialog with the quarter pre-set | — | — |
| **Add** (in Add Audit dialog) | Validates **Audit Title** is non-empty → `POST …/operational-plans/[id]/items` (title, auditCategory, plannedQuarter, notes) → audit added under that quarter | "Audit added" | "Please enter an audit title" / "Failed to add audit" |
| **Assign Audit Managers** → **Save** | `PATCH …/items/[itemId]` per changed row (assignedAuditorId) | "Auditors assigned" | "Failed to assign auditors" |
| **Generate Annual Report** | Opens the **Annual Audit Plan PDF** (`/operational-plans/[id]/annual-report`) in a new tab (download) | — (file opens) | — |
| **Upload Approval** | Uploads the approval document → plan **Approved** → **one engagement auto-created per planned audit**; assigned auditors notified | (file upload confirmation) | `⚠️ TODO: confirm approval toast text` |
| Per-quarter field (Residual Risk Score / Risk Classification / Proposed Periodical / Estimated Hours / Auditor in Charge) | Inline edit; on blur/change → `PUT …/operational-plans/[id]/quarter-plan` (optimistic — value updates immediately, no full reload) | — (silent save) | "Failed to save quarter plan" (and the value reverts) |
| **Delete** (audit row / plan) | Confirm dialog → deletes the item/plan | — | — |

### E.3 Engagement Workflow
| Button | On click — validation → API → result | Success message | Error message |
|---|---|---|---|
| **Mark complete & continue** (a step) | Records that step complete → advances the stepper (`PATCH …/engagements/[id]` stageProgress) | "Step marked complete" | "Failed to update workflow" |
| (Step tab) | Switches the active step | "Current step updated" | — |
| **Finish and Generate Report** (Closing Meeting, when all steps done) | Prompts for **Overall Result (Pass/Fail)** → `POST /report/generate` → engagement **Completed** + report created as **Draft** → navigates to the Report section; engagement becomes **read-only** | "Report generated. Opening the Report section." | "Failed to generate report" |

#### E.3.1 Announcement (step 1)
| Button | On click — validation → API → result | Success message | Error message |
|---|---|---|---|
| **Add External Recipient** | Reveals Name + Email inputs | — | — |
| **Add** (external recipient) | Validates the email format; adds the recipient to the list (deduped) | — | "Enter a valid email address" |
| **Save Draft** | `PUT …/engagements/[id]/announcement` (recipients, subject, body, date) | "Announcement saved" | "Failed to save announcement" |
| **Send Announcement** | Emails all valid recipients via SMTP + notifies the auditee (inbox+email); **locks** the announcement | "Announcement sent" | "Failed to send announcement" |

#### E.3.2 APM / Opening Meeting / Audit Program / Findings Discussion / Closing Meeting (Save + PDF)
| Step | **Save** → API | Success message | Error message | PDF button |
|---|---|---|---|---|
| Audit Planning Memorandum | `PUT …/audit-program` *(APM content)* | "Audit planning memorandum saved" | "Failed to save audit planning memorandum" | **Download/Print** opens the print view |
| Opening Meeting | `PUT …/opening-meeting` | "Opening meeting form saved" | "Failed to save opening meeting form" | **Export PDF** (`/opening-meeting/download`) |
| Audit Program | `PUT …/audit-program` | "Audit program saved" | "Failed to save audit program" | **Export PDF** (landscape) |
| Findings Discussion | `PUT …/findings-discussion-meeting` | "Findings discussion minutes saved" | "Failed to save findings discussion minutes" | **Export PDF** |
| Closing Meeting | `PUT …/closing-meeting` | "Closing meeting minutes saved" | "Failed to save closing meeting minutes" | **Export PDF** |

#### E.3.3 Findings (step 6)
| Button | On click — validation → API → result | Success message | Error message |
|---|---|---|---|
| **Add Finding** (Continuous mode) / **Add Row** (Aggregated) | Validates **Title** and **Responsible Person** are filled → `POST …/fieldwork/[id]/findings` | "Finding added successfully" | "Finding title is required" / "Responsible person is required" / "Failed to add finding" |
| **Communication mode** toggle (Continuous / Aggregated) | `PATCH` the engagement's `reportingMode` | "Communication mode updated" | "Failed to update communication mode" |
| **Share** (a finding — Continuous) | `POST …/findings/[id]/share` → stamps `sharedWithAuditeeAt`, notifies auditee | "Finding shared with auditor" | "Failed to share finding" |
| **Unshare** (a finding) | `DELETE …/findings/[id]/share` | "Finding unshared" | "Failed to unshare finding" |
| **Share consolidated draft** (Aggregated) | `POST …/engagements/[id]/findings/share-all` → one consolidated notification | (shared) | "Failed to share consolidated draft" |
| **Recall** consolidated draft | `DELETE …/findings/share-all` | "Consolidated draft recalled" | "Failed to recall consolidated draft" |
| **Export Excel** | Opens the findings export (scoped to the current mode) | — (file opens) | — |

### E.4 Audit Report
| Button | On click — validation → API → result | Success message | Error message |
|---|---|---|---|
| **Generate Report** (Reports list, for a completed engagement) | `POST /report/generate` → report created as **Draft** | "Report generated successfully" | "Failed to generate report" |
| **Save** (report detail) | `PATCH /report/[id]` (report content) | "Report saved successfully" | "Failed to save report" |
| Auditor comment **Save** | Saves the comment | "Auditor comment saved successfully" | "Failed to save auditor comment" |
| **Finalize Report** *(Audit Head only)* | `PATCH /report/[id]` `{status:"Final"}` → status **Draft → Final** (PDF loses the DRAFT watermark) | "Report finalized" | "Failed to update report status" |
| **Revert to Draft** *(Audit Head only)* | `PATCH /report/[id]` `{status:"Draft"}` | "Report reverted to draft" | "Failed to update report status" |
| **Download PDF** | `GET /report/[id]/download` → Draft = diagonal **DRAFT** watermark; Final = clean | — (file opens) | "Failed to download report" |

### E.5 Follow-up & CAPA Tracking
| Button | On click — validation → API → result | Success message | Error message |
|---|---|---|---|
| **Save** (Follow-up Meeting Form) | Persists the form + recommendation-status grid (`AuditFollowUpMeeting`) | `⚠️ TODO: confirm follow-up save toast` | — |
| **Print / Export PDF** (Follow-up) | Generates the PDF | — (file opens) | — |
| CAPA **Submit** | Submits the CAPA / documents for review | "Documents submitted for Audit Head review" / "CAPA submitted (AI review pending)" | "Failed to update finding" |
| CAPA **Save / Update** finding | `PATCH` the finding | "Finding updated successfully" | "Failed to update finding" |
| CAPA **Delete** finding | Confirm → deletes the finding | "Finding deleted successfully" | "Failed to delete finding" |
| CAPA upload / delete attachment | Uploads or removes evidence | "Attachment deleted" | "Failed to upload files" / "Failed to delete attachment" |

### E.6 Feedback Survey
| Button | On click — validation → API → result | Success message | Error message |
|---|---|---|---|
| **Add Row** (a section) | Adds an editable custom-question row (client-side; persisted on Save) | — | — |
| **Save** | `PUT …/engagements/[id]/feedback-survey` (responses, comments, customRows, overall, open answers) | "Feedback survey saved" | "Failed to save feedback survey" |
| **Export PDF** | Saves first, then opens the survey PDF (`/feedback-survey/download`) | "Feedback survey saved" (then file opens) | "Failed to save feedback survey" |

### E.7 Document Library
| Button | On click — validation → API → result | Success message | Error message |
|---|---|---|---|
| **Ingest / Upload** | Uploads + ingests the document for AI search | "Document ingested successfully" / "Document ingestion started" | "Document ingestion failed" / "Failed to start ingestion" |
| **Search** | Validates a query is entered → runs AI search | "Search completed" | "Please enter a query" / "Search failed" |

### E.8 Audit Trail
| Control | On click — behavior |
|---|---|
| Column header (User Name / User Role / Action / Module / Date & Time) | Toggles sort ascending/descending on that column |
| Filters (Search / User Name / User Role / Action Type / Module / From–To Date) | Re-queries the grid (server-side filter); resets to page 1 |
| **Clear** | Resets all filters and search |
| Page size / Previous / Next | Paginates the grid |
| *(No create/edit/delete buttons exist — the trail is read-only.)* | — |

> **Note on remaining `⚠️ TODO`s:** the few items above are buttons whose exact toast text I did not capture in this pass (e.g. the Operational Plan approval upload and the Follow-up Save). They follow the **General Save pattern** but the verbatim message should be confirmed from the page before final delivery.

---

*End of document.*
