# Internal Audit — UAT Test Plan

_Last updated: 2026-06-16_

End-to-end test flow for the Internal Audit module, following the MOF audit
lifecycle. Run top-to-bottom. Each step lists the **role** to use, the
**action**, and what to **verify**. Use the **Result** column to track Pass/Fail.

> Companion reference: feature inventory and the role-based access matrix live in
> [`INTERNAL_AUDIT_MODULE.md`](./INTERNAL_AUDIT_MODULE.md).

---

## 0. Setup (once)

1. Start the app: `npm run dev` → http://localhost:3000
2. Log in as **superadmin / 1**.
3. **Create users & roles** (Org → User Management) — at least one of each to test access:
   - **AuditHead** (Head of Audit) — main driver
   - **AuditManager**
   - **Auditor**
   - **Auditee** (assigned to a department)
4. Ensure **Departments** and **Processes** exist (IA → Settings → Departments; IA → Organization → Process).

> Tip: keep two browsers / incognito windows open to switch roles quickly.

---

## 1. Foundation _(role: AuditHead)_

| # | Action | Verify | Result |
|---|---|---|---|
| 1.1 | IA → **Audit Universe** | Auditable entities (departments/processes/IT areas) listed | ☐ |
| 1.2 | IA → **Risk Register** → add 3–4 risks with different residual scores | List is **auto-sorted, highest residual risk on top** | ☐ |
| 1.3 | IA → Risk Identification / Risk Universe | Risk data visible; AI suggestions work | ☐ |
| 1.4 | IA → **Settings** | Audit types, categories, sub-categories, periodicity, escalation editable | ☐ |

---

## 2. Strategic Plan _(role: AuditHead)_

> The Minister approves the plan **externally**; there is no in-app approval
> workflow. Uploading the Minister's **signed copy** records the approval.

| # | Action | Verify | Result |
|---|---|---|---|
| 2.1 | IA → **Strategic Plan** → Create | **Duration dropdown** offers 3 / 4 / 5 years | ☐ |
| 2.2 | Generate from risk | Items **auto-populate from risks**, spread across years, ranked by residual score | ☐ |
| 2.3 | Open the plan | Each **year** shows its audits; **"Open Annual Plan"** link present | ☐ |
| 2.4 | As AuditManager/Auditor, open same plan | **View-only** (cannot create a strategic plan) | ☐ |
| 2.5 | As AuditHead: enter "Approved By" + upload **signed copy** → Upload & Approve | Status → **Approved**, row highlighted **green**, signed-copy download appears | ☐ |
| 2.6 | Click **Print** | Print-friendly view renders | ☐ |

---

## 3. Operational (Annual) Plan _(role: AuditHead or AuditManager)_

| # | Action | Verify | Result |
|---|---|---|---|
| 3.1 | From Strategic Plan, click **Open Annual Plan** on a year | Lands on Operational Plan pre-filtered to that plan + year | ☐ |
| 3.2 | Generate the operational plan for a year | One plan per year (generating the same year twice is blocked) | ☐ |
| 3.3 | Toggle **All Years** vs a specific year | List filters correctly | ☐ |
| 3.4 | **Add** an audit; **Delete** an audit | Items update | ☐ |
| 3.5 | **Upload Approval** document → plan becomes Approved | **Toast: "N engagement(s) generated"** — engagements auto-created | ☐ |

---

## 4. Engagements _(role: AuditHead)_

| # | Action | Verify | Result |
|---|---|---|---|
| 4.1 | IA → **Audit Planning** | Auto-created engagements appear (one per planned audit), with quarter/dates | ☐ |
| 4.2 | Open an engagement → assign **Auditor** and **Auditee** | Saved; assignee notified | ☐ |
| 4.3 | Click the **Workflow** icon on a row | Opens the **Engagement Workflow hub** (stepper) | ☐ |

---

## 5. Engagement Workflow hub — walk the stepper _(role: AuditHead/Auditor)_

Open `/internal-audit/engagement/[id]`. After each step, click **"Mark complete & continue"** and confirm the **"N/10 steps complete"** badge increments.

| # | Step | What to verify | Result |
|---|---|---|---|
| 5.1 | **Announcement** | Template pre-fills (Dear [Auditee]…). **Save Draft**, then **Send Announcement** (confirm) → status **Sent**, fields lock, auditee notified | ☐ |
| 5.2 | **APM** | Fill scope/objectives/methodology/timeline + dates; **upload an audit-program document**; download it back; set status Finalized | ☐ |
| 5.3 | **Opening Meeting** | Add **Minutes of Meeting** (date, attendees, agenda, minutes, decisions); edit; delete | ☐ |
| 5.4 | **Audit Program** | See **"Audit Program Overview: N procedures"**; generate AI workpapers; **Download Audit Program** (PDF opens) | ☐ |
| 5.5 | **Fieldwork** | Add workpapers; create **evidence (PBC) requests**; upload evidence; run review | ☐ |
| 5.6 | **Findings** | Toggle **Continuous vs Aggregated**. Continuous: **Share with auditee** → green "Shared" badge + notified; **Unshare** reverts. Aggregated: no share buttons | ☐ |
| 5.7 | **Findings Discussion** | Add **Minutes of Meeting** (validate facts / action plans / responses) | ☐ |
| 5.8 | **Report** | Download while **Draft → PDF has "DRAFT" watermark**. Set **Final** → download → **no watermark** | ☐ |
| 5.9 | **Closing Meeting** | Add **Minutes of Meeting** | ☐ |
| 5.10 | **Follow-up** | Opens CAPA tracking (section 6) | ☐ |

---

## 6. Follow-up / CAPA & Recommendation Tracking _(role: AuditHead/Auditor)_

| # | Action | Verify | Result |
|---|---|---|---|
| 6.1 | IA → **CAPA Tracking** | Findings with status, target date, responsible person; filter by department/status/search | ☐ |
| 6.2 | Edit a CAPA, upload evidence, run AI review | Status updates | ☐ |
| 6.3 | Click **Implementation Recommendation Document** | PDF lists findings + recommendations + responsible + target date + status, **respecting active filters** | ☐ |

---

## 7. Reporting, Dashboard & Monitoring

| # | Action | Verify | Result |
|---|---|---|---|
| 7.1 | IA → **Dashboard** | Risk heatmap, CAPA status, auditor schedule, annual-plan timeline render | ☐ |
| 7.2 | IA → **Document Library** | Upload / search / AI ingest | ☐ |
| 7.3 | (Optional) Hit `http://localhost:3000/api/cron/due-reminders` | Returns OK; reminders fire | ☐ |

---

## 8. Role-Based Access Checks

Log in as each role and confirm the privilege matrix:

| Test | AuditHead | AuditManager | Auditor | Auditee | Result |
|---|---|---|---|---|---|
| Create **Strategic Plan** | allowed | view-only | view-only | no access | ☐ |
| Edit **Operational Plan** | ✅ | ✅ | view-only | ✗ | ☐ |
| Dashboard / Universe / Planning | ✅ | ✅ | ✅ | ✗ | ☐ |
| Fieldwork / CAPA / Reports | ✅ | ✅ | ✅ | ✅ **(own dept only)** | ☐ |
| Settings | view | view | view | ✗ | ☐ |

> **Auditee negative test:** the Auditee should ONLY see Fieldwork, CAPA, and Reports
> for **their department** — no dashboard, plans, universe, or settings. ☐

---

## 9. Internationalization (i18n)

| # | Action | Verify | Result |
|---|---|---|---|
| 9.1 | Switch language to **Arabic** on IA pages (engagement hub, CAPA, strategic plan) | Labels translate; layout flips **RTL** | ☐ |
| 9.2 | Switch language to **Latvian** | Labels translate | ☐ |

---

## Quick smoke test (~10 min)

Risk Register → Strategic Plan (create → submit → approve) → Operational Plan
(approve → engagements auto-created) → open Engagement hub → Announcement (send)
→ APM → Fieldwork (1 finding) → Report (Draft = watermark, Final = clean) → CAPA
→ Implementation Recommendation Document.
