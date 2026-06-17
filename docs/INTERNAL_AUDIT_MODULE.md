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
→ Report (sidebar) → Follow-up / CAPA (sidebar) → Automated Monitoring
```

All pages are available in **English, Arabic (RTL), and Latvian**.

---

## 2. Implemented Features

### 2.1 Foundation & Master Data
| Feature | Where | Notes |
|---|---|---|
| **Audit Universe** | `/internal-audit/audit-universe` | Auditable entities by department/process/IT area |
| **Risk Register** | `/internal-audit/risk-register` | Risk ID, process link, title, description, category/sub-category, source, cause/driver, consequence, inherent & residual likelihood/impact/rating, control effectiveness, related law, policy reference, document links. **Auto-sorted by residual risk (highest first).** |
| **Risk Identification / Risk Universe** | `/internal-audit/risk-identification`, `/risk-universe` | AI-assisted risk suggestions |
| **Process Inventory** | `/internal-audit/organization/process` | Process ID, name, owner, supporting documents, notes |
| **Departments** | `/internal-audit/settings/departments` | Department master data |
| **Settings / Master Data** | `/internal-audit/settings` | Audit types, categories, sub-categories, periodicity, nature of controls, risk-assessment config, escalation rules |

### 2.2 Planning
| Feature | Status | Notes |
|---|---|---|
| **Strategic Audit Plan** | ✅ | 3/4/5-year duration dropdown; **auto-generated from risk levels** (ordered by residual score, year-bucketed, priority-ranked); created by the Audit Director and **approved externally by the Minister** — uploading the signed copy (with approver name) marks the plan **Approved** (no in-app approval workflow); **print** option; approved plans visually highlighted; **click a year → opens the Annual Plan** |
| **Operational (Annual) Plan** | ✅ | Year-wise from the strategic plan (one per year); **view all vs selected year**; add/delete audits; **upload approval document** |
| **Quarterly Reports** | ✅ | Per operational-plan year, upload/replace/download/delete a report document for each quarter (Q1–Q4); shown as a section inside each year block; binary stored encrypted (mirrors the approval-doc pattern) |

### 2.3 Engagements
| Feature | Status | Notes |
|---|---|---|
| **Auto-generate engagements** | ✅ | On operational-plan **approval**, one engagement is created per planned audit (idempotent, traceable back to the plan item) |
| **Engagement management** | ✅ | Create/edit, assign auditor & auditee, per-quarter timelines/schedules |
| **Engagement Workflow Hub** | ✅ | Single-page stepper across the full lifecycle with per-step progress tracking (`/internal-audit/engagement/[id]`) |

### 2.4 Engagement Workflow Steps
| Step | Status | Notes |
|---|---|---|
| **Announcement** | ✅ | Templated notification email (auto-filled from engagement data); save draft / send to auditee; locked once sent |
| **Audit Planning Memorandum (APM)** | ✅ | Scope, objectives, methodology, timeline + audit-program document attachments (encrypted at rest) |
| **Opening Meeting** | ✅ | Minutes of Meeting (shared MoM component) |
| **Audit Program** | ✅ | Program **overview** + **download as PDF** before fieldwork; AI-generated workpapers |
| **Fieldwork** | ✅ | Workpapers, evidence (PBC) requests, evidence upload, review/approval, AI review |
| **Findings** | ✅ | Communication mode toggle — **Continuous** (share each finding with the auditee individually) vs **Aggregated** (consolidated into the report) |
| **Findings Discussion** | ✅ | Minutes of Meeting (validate facts, agree action plans, finalize responses) |
| **Closing Meeting** | ✅ | Minutes of Meeting |

> **Note:** The engagement workflow stepper is **8 steps**. **Report** and **Follow-up** are no longer steps in the stepper — they are accessed from the Internal Audit sidebar (`Report`, and `Follow-up` which points to the CAPA Tracking page). See §2.5.

### 2.5 Reporting, Monitoring & Support
| Feature | Status | Notes |
|---|---|---|
| **Audit Reports** | ✅ | Draft (watermarked) / Final report generation + PDF download |
| **CAPA Tracking** | ✅ | Findings + corrective/preventive actions, evidence, AI review |
| **Follow-up** | ✅ | **Separate top-level sidebar menu** (sibling to Internal Audit, module `INTERNAL_AUDIT`) at `/internal-audit/follow-up` — hosts the Follow-up Meeting Form. CAPA Tracking remains its own page/menu, unchanged. |
| **Follow-up Meeting Form** | ✅ | Follow-up landing page lists engagements in a Risk-Register-style table (search + department/status filters) with an **Open** action per row → detail page `/internal-audit/follow-up/[id]`. The detail page is the per-engagement fillable form (meeting details, attendees, recommendation-implementation status grid); recommendation rows pre-fill from the engagement's findings; status = Open / In Progress / Implemented / Closed; due dates with auto-overdue flagging + progress %; **Save** (persisted, model `AuditFollowUpMeeting`), **Print**, and **Export PDF** (pdf-lib) |
| **Dashboard & Analytics** | ✅ | Risk heatmap, CAPA status, audit stats, auditor schedule, annual-plan timeline, drill-down |
| **Document Library** | ✅ | Upload, categorize, AI search & ingest |
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
| Role | Intended user | Summary of Internal Audit access |
|---|---|---|
| **AuditHead** (Head of Audit) | Audit director / head | Full access to the entire IA module. **Only role that can create a Strategic Plan.** Settings are view-only. |
| **AuditManager** | Audit manager | Same as AuditHead **except cannot create a Strategic Plan** (view-only). **Can fully edit the Operational Plan.** Settings view-only. |
| **Auditor** | Auditor conducting audits | Full access to execution (planning, fieldwork, findings, CAPA, reports, documents). Strategic & Operational plans **view-only**. Settings view-only. |
| **Auditee** | Department contact under audit | **Department-scoped**, limited to Fieldwork (view/edit), Reports (view), and CAPA (view/edit). No dashboard, plans, universe, or settings. |
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
| Risk Universe | F | F | F | — | — | — | — | — |
| Process Inventory | F | F | F | V | — | — | — | — |
| **Strategic Plan** | **F (create)** | **V** | V | — | — | — | — | — |
| **Operational Plan** | F | **F** | **V** | — | — | — | — | — |
| Audit Planning (Engagements) | F | F | F | V | — | — | — | — |
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
