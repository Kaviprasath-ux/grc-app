# Compliance Module

## Table of Contents

1. [What is Compliance?](#what-is-compliance)
2. [Common Compliance Frameworks](#common-compliance-frameworks)
3. [The Compliance Hierarchy](#the-compliance-hierarchy)
4. [Compliance Scoring — CMM Maturity Model](#compliance-scoring--cmm-maturity-model)
5. [Framework Management](#framework-management)
6. [Requirements](#requirements)
7. [Controls](#controls)
8. [Evidence Collection and Review](#evidence-collection-and-review)
9. [Exceptions and Waivers](#exceptions-and-waivers)
10. [Governance Documents](#governance-documents)
11. [KPIs (Key Performance Indicators)](#kpis-key-performance-indicators)
12. [Statement of Applicability (SOA)](#statement-of-applicability-soa)
13. [Regulatory Intelligence](#regulatory-intelligence)
14. [Reports and Analytics](#reports-and-analytics)

---

## What is Compliance?

**Compliance** means conforming to external regulations, industry standards, and internal policies that govern how an organisation must operate. Non-compliance can result in regulatory fines, legal liability, reputational damage, loss of business licences, or data breaches.

### Types of Compliance Obligations

| Type | Examples | Who requires it |
|------|---------|----------------|
| Legal/Regulatory | GDPR, HIPAA, SOX | Government/regulators |
| Industry Standards | ISO 27001, SOC 2, PCI-DSS | Certification bodies |
| Contractual | Customer security requirements | Clients/partners |
| Internal | Company policies, codes of conduct | Board/management |

### The Compliance Problem at Scale

Organisations typically face **dozens of overlapping frameworks**, each with hundreds of requirements. Without a system to manage this, teams:
- Track compliance in spreadsheets that quickly become outdated.
- Duplicate effort by collecting the same evidence for multiple frameworks.
- Miss deadlines for evidence review or control assessments.
- Have no way to report aggregate compliance posture to the board.

The Compliance module solves this by centralising all frameworks, requirements, controls, and evidence in one place, with automated workflows and reporting.

---

## Common Compliance Frameworks

### ISO 27001 — Information Security Management

**Issued by:** International Organization for Standardization (ISO)

**What it covers:** A systematic approach to managing sensitive company information so it remains secure. It includes people, processes, and IT systems by applying a risk management process.

**Structure:**
- **Clauses 4–10:** Mandatory requirements (Context, Leadership, Planning, Support, Operation, Evaluation, Improvement).
- **Annex A:** 93 controls organised into 4 themes (Organisational, People, Physical, Technological).

**Why organisations seek it:** ISO 27001 certification demonstrates to customers, partners, and regulators that information security is managed systematically. Required by many government and enterprise procurement processes.

**Key compliance evidence:**
- Risk assessments and risk treatment plans.
- Information security policies.
- Control implementation records.
- Internal audit reports.
- Management review minutes.

### SOC 2 — Service Organization Control

**Issued by:** American Institute of CPAs (AICPA)

**What it covers:** Security, availability, processing integrity, confidentiality, and privacy controls for service organisations that store or process customer data.

**Structure:** Built around **Trust Services Criteria (TSC)**:
- CC (Common Criteria) — Security
- A (Availability)
- PI (Processing Integrity)
- C (Confidentiality)
- P (Privacy)

**SOC 2 Type I vs Type II:**
- **Type I** — Point-in-time assessment: controls are designed suitably.
- **Type II** — Period assessment (usually 6–12 months): controls operated effectively throughout the period.

**Why organisations seek it:** Required by most US enterprise SaaS customers. Demonstrates that customer data is handled securely.

### GDPR — General Data Protection Regulation

**Issued by:** European Union

**What it covers:** Protection of personal data of EU/EEA residents, regardless of where the processing organisation is based.

**Key principles:**
- Lawfulness, fairness, and transparency
- Purpose limitation
- Data minimisation
- Accuracy
- Storage limitation
- Integrity and confidentiality (security)
- Accountability

**Key requirements in the system:**
- Data Subject Rights processes (access, erasure, portability requests)
- Privacy Impact Assessments (PIAs)
- Data processing records
- Breach notification procedures (72-hour obligation)
- Data transfer safeguards (SCCs, adequacy decisions)

**Penalties:** Up to €20 million or 4% of global annual turnover (whichever is greater).

### PCI-DSS — Payment Card Industry Data Security Standard

**Issued by:** PCI Security Standards Council (Visa, Mastercard, Amex, etc.)

**What it covers:** Security of cardholder data (credit/debit card numbers, CVVs, PINs).

**12 Requirements:**
1. Install and maintain network security controls.
2. Apply secure configurations to all system components.
3. Protect stored account data.
4. Protect cardholder data with strong cryptography in transit.
5. Protect systems from malicious software.
6. Develop and maintain secure systems and software.
7. Restrict access to system components and cardholder data by business need.
8. Identify users and authenticate access.
9. Restrict physical access to cardholder data.
10. Log and monitor all access.
11. Test security of systems and networks regularly.
12. Support information security with organisational policies and programs.

**Why it matters:** Any organisation that accepts or processes card payments must comply or face fines and potential loss of payment processing capabilities.

---

## The Compliance Hierarchy

The compliance module is built around a five-level hierarchy:

```
Framework
  └── Category (Requirement Category)
        └── Requirement
              └── Control
                    └── Evidence
```

### Level 1: Framework

The top-level container. Examples: "ISO 27001:2022", "SOC 2 Type II", "GDPR".

Each framework has:
- A name, version, and description.
- A validity period.
- An associated certification body.
- An overall compliance score (calculated from child controls).

### Level 2: Category (Requirement Category)

High-level groupings within a framework. Example: within ISO 27001, "Annex A — Organisational Controls" and "Clause 8 — Operation" are categories.

### Level 3: Requirement

Specific, testable obligations. Example: "A.8.2 — Privileged Access Rights: The allocation and use of privileged access rights shall be restricted and managed."

Each requirement has:
- A unique code (e.g., A.8.2)
- Description of what must be done
- Applicability (can be marked as not applicable with a justification)
- Link to one or more controls

### Level 4: Control

The specific safeguard or process implemented to meet the requirement. Controls can be mapped to multiple requirements across multiple frameworks (cross-framework mapping reduces duplicate work).

Each control has:
- A control code (e.g., CTRL-0042)
- Description of the control
- Control owner (responsible user)
- Implementation status
- **Maturity score (0–5)**
- Linked evidence items
- Review frequency and next review date

### Level 5: Evidence

The proof that a control is operating effectively. Evidence items can be:
- Documents (policies, procedures, configuration files)
- Screenshots (access control lists, system settings)
- Records (access logs, incident reports, training completion records)
- Test results (vulnerability scan reports, penetration test findings)

---

## Compliance Scoring — CMM Maturity Model

The GRC application uses the **Capability Maturity Model (CMM)** to score controls on a scale of 0–5.

| Level | Name | Description |
|-------|------|-------------|
| **0** | Non-Existent | No control exists. The requirement is not addressed at all. |
| **1** | Initial | Controls exist but are ad hoc, reactive, undocumented, and inconsistent. Success depends on heroic individual effort. |
| **2** | Developing | Controls are partially documented and partially implemented. Some processes are repeatable but not standardised. |
| **3** | Defined | Controls are fully documented, standardised, and consistently implemented across the organisation. |
| **4** | Managed | Controls are measured and monitored with quantitative metrics. Management uses data to improve performance. |
| **5** | Optimised | Continuous improvement is embedded. Controls are proactively optimised using feedback and benchmarking. |

### Overall Compliance Score

The framework's overall compliance score is the weighted average of all its control maturity scores:

```
Framework Score = Sum(control score × weight) / Sum(weights)
```

If all controls are equally weighted:
```
Framework Score = Average of all control maturity scores (as a percentage)
                = (Sum of scores / (count × 5)) × 100
```

Example: 10 controls with average maturity 3.5 → Score = (3.5/5) × 100 = **70%**

---

## Framework Management

### Subscribing to a Pre-Built Framework

The GRC system ships with pre-built frameworks for ISO 27001, SOC 2, GDPR, PCI-DSS, and others. To use a framework:

1. Navigate to **Compliance → Frameworks**.
2. Click **"Add Framework"** or **"Subscribe"**.
3. Select the framework from the library.
4. The framework's full requirement structure is imported into your tenant.
5. You can customise applicability and add custom controls.

### Importing a Custom Framework

For frameworks not in the library, or for proprietary control standards:
1. Prepare a CSV or Excel file with the framework structure (Category, Requirement Code, Requirement Description, Control Code, Control Description).
2. Use the **"Import"** button in the Frameworks page.
3. The system creates all requirements and controls in the hierarchy.

### Creating a Framework Manually

1. Click **"New Framework"**.
2. Enter framework name, version, and description.
3. Add categories manually.
4. Add requirements under each category.
5. Add controls under each requirement.

---

## Requirements

Requirements represent specific obligations within a framework. The Requirements page provides:

### Viewing Requirements

**URL:** `/compliance/frameworks/[id]/requirements`

- Requirements are displayed in a tree or table grouped by category.
- Each requirement shows: code, description, number of linked controls, and overall compliance percentage.
- Requirements can be marked as **Not Applicable** with a justification (important for frameworks like ISO 27001 where not all Annex A controls apply to every organisation).

### Not Applicable Justification

When a requirement is marked not applicable:
1. The reason must be documented (stored in `RequirementException`).
2. The requirement's controls are excluded from compliance score calculations.
3. This decision is reflected in the **Statement of Applicability**.

---

## Controls

Controls are the heart of the compliance module.

### Control Implementation Workflow

```
New Control Created (Maturity: 0)
          ↓
Control Owner Assigned
          ↓
Implementation Started (Maturity: 1–2)
          ↓
Evidence Collected
          ↓
Control Reviewed by Compliance Team (Maturity: 3+)
          ↓
Periodically Re-evaluated (Maturity may increase/decrease)
```

### Control Fields

| Field | Description |
|-------|-------------|
| Control Code | Unique identifier (e.g., CTRL-0042) |
| Name | Short title |
| Description | Full description of what the control does |
| Owner | User responsible for maintaining this control |
| Domain | Control domain (e.g., Access Control, Cryptography) |
| Strength | Control strength assessment (from `ControlStrength` master data) |
| Implementation Date | When the control was first put in place |
| Review Frequency | How often the control must be re-assessed |
| Next Review Date | Calculated from last review + frequency |
| Maturity Level | 0–5 CMM score |
| Status | Not Started / Planned / In Progress / Implemented / Under Review |
| Evidence Count | Number of linked evidence items |

### Cross-Framework Control Mapping

A single control can be linked to requirements from multiple frameworks:
- Control "MFA on all privileged accounts" may satisfy ISO 27001 A.8.2, SOC 2 CC6.1, and PCI-DSS 8.3.
- When evidence is submitted for this control, it satisfies all three frameworks simultaneously.
- This dramatically reduces the compliance team's workload.

**API:** `GET/POST /api/compliance/controls`

---

## Evidence Collection and Review

### What is Compliance Evidence?

Evidence is the documentation that proves a control is operating effectively. Without evidence, a control's maturity score is theoretical — it might be designed correctly but there is no proof it is working.

### Evidence Lifecycle

```
Created → Assigned → In Progress → Submitted → Under Review → Approved
                                                           ↓
                                                       Rejected (cycle back)
```

### Evidence Fields

| Field | Description |
|-------|-------------|
| Name | Descriptive name (e.g., "Q3 Access Review Results") |
| Evidence Code | Auto-generated (e.g., EVD-0042) |
| Control | Linked control |
| Type | Document / Screenshot / Log / Certificate / Report / Other |
| Due Date | When the evidence must be submitted |
| Assignee | The user responsible for collecting and uploading evidence |
| Reviewer | The user who will review and approve the submission |
| Status | Not Started / In Progress / Submitted / Approved / Rejected |
| Attachments | Uploaded files (encrypted at rest) |
| Notes | Comments from assignee or reviewer |

### Automated Due Date Reminders

The `due-reminders` cron job runs daily at 8:00 AM UTC and sends `EVIDENCE_DUE_REMINDER` to evidence assignees whose items are due within the next 24 hours.

### Periodic Evidence Collection

Many controls require evidence on a recurring schedule:
- **Monthly:** Access logs, backup test results.
- **Quarterly:** Access reviews, vulnerability scans.
- **Annually:** Penetration tests, security awareness training completion.

The system tracks `nextDueDate` per evidence item and prompts reassignment/collection at each interval.

**API:** `GET/POST /api/compliance/evidence`

---

## Exceptions and Waivers

### What is a Compliance Exception?

Sometimes an organisation cannot fully meet a requirement — due to technical limitations, cost, or business risk trade-offs. An **exception** (or **waiver**) is a formal, documented acknowledgement that a requirement will not be met, along with:
- The reason for non-compliance.
- The residual risk accepted.
- Compensating controls put in place to reduce that risk.
- An expiry date (exceptions should be temporary).
- The approver who accepted the risk.

### Exception Workflow

1. Compliance officer identifies a requirement that cannot be met.
2. Creates an exception request with rationale and compensating controls.
3. The exception is submitted for approval (to `CustomerAdministrator` or `Reviewer`).
4. If approved, the requirement is flagged as "Exception" in all dashboards.
5. The exception has an expiry date — when it expires, the compliance team is notified to either fix the gap or re-apply for the exception.
6. If rejected, the team must implement the control.

**URL:** `/compliance/exceptions`

**API:** `GET/POST /api/exceptions`

---

## Governance Documents

Governance documents (policies, procedures, standards, guidelines) are managed in the **Governance Vault**.

### Policy vs Procedure

| Type | Description | Example |
|------|-------------|---------|
| **Policy** | High-level principle or rule that management has approved. States what must be done, not how. | "All employees must use MFA to access corporate systems." |
| **Procedure** | Step-by-step instructions for how to implement a policy. | "How to enrol in MFA using Google Authenticator." |
| **Standard** | Mandatory specification of technical requirements. | "Password minimum length: 14 characters." |
| **Guideline** | Advisory recommendations (not mandatory). | "Recommended: use a password manager." |

### Approval Workflow

Governance documents go through a review and approval cycle:

```
Draft → Submitted for Review → Under Review → Approved (Published)
                                           ↓
                                      Rejected → Draft (revised)
```

The `POLICY_APPROVED` and `POLICY_REJECTED` email notifications are sent at each stage.

### Periodic Review

Each policy has a **review frequency** (typically annual). When the review date arrives:
1. The system creates a new review task assigned to the policy owner.
2. `REVIEW_DUE_REMINDER` is sent 24 hours before the review deadline.
3. The owner reviews the policy, makes amendments if needed, and resubmits for approval.
4. This creates a version history showing every revision with its approval record.

**URL:** `/compliance/governance`

---

## KPIs (Key Performance Indicators)

KPIs provide quantitative measures of compliance programme performance.

### Example Compliance KPIs

| KPI Name | Measure | Target | Frequency |
|----------|---------|--------|-----------|
| Evidence Submission Rate | % of evidence submitted on time | > 90% | Monthly |
| Control Maturity Score | Average CMM score | > 3.5 | Quarterly |
| Overdue Evidence Items | Count of overdue evidence | 0 | Weekly |
| Exception Rate | % of requirements with exceptions | < 5% | Monthly |
| Open Findings (from IA) | Count of unresolved audit findings | < 10 | Monthly |

### KPI Breaches

When a KPI threshold is breached, the system:
1. Creates a `KPI_BREACH` notification for the assigned owner.
2. Sends an email alert.
3. Logs the breach in the KPI history for trend analysis.

**URL:** `/compliance/kpis`

---

## Statement of Applicability (SOA)

The **Statement of Applicability** is a formal document required by ISO 27001 (and other frameworks). It lists every control in the framework and states, for each:
- Whether the control is **applicable** or **not applicable** to the organisation.
- The **reason** for not-applicable decisions.
- The **implementation status** of each applicable control.
- The **justification** for inclusion or exclusion.

The SOA is generated automatically from the framework data in the system and can be exported as a PDF for certification purposes.

**URL:** `/compliance/soa`

---

## Regulatory Intelligence

The Regulatory Intelligence section tracks updates to regulations and standards:
- New regulation publications (e.g., NIS2 Directive, new GDPR guidance).
- Changes to existing standards (e.g., ISO 27001:2022 update from 2013 edition).
- Regulatory alerts relevant to the organisation's industry or geography.

**URL:** `/compliance/regulations`

Each regulation alert can be linked to requirements so the compliance team can assess the impact on the existing control framework and plan remediation.

---

## Reports and Analytics

### Compliance Status Report

Shows the overall compliance posture:
- Per-framework compliance score.
- Trend over time (improving/declining).
- Controls by status (Not Started / Implemented / Under Review).
- Evidence by status (Approved / Overdue / Pending).

**URL:** `/compliance/reports/status`

### Gap Analysis Report

Shows where the organisation is non-compliant:
- Controls with maturity < 3 (below "Defined").
- Requirements with no controls mapped.
- Overdue evidence items.
- Active exceptions.

### Evidence Status Report

A tabular view of all evidence items:
- Filterable by status, control, assignee, due date.
- Exportable to Excel/CSV for offline review.

### Compliance Dashboard

The main compliance dashboard (at `/compliance`) shows:
- Compliance score gauges per active framework.
- Recent activity feed (approvals, evidence submissions, new findings).
- Upcoming due dates (evidence, policy reviews).
- Heat map of controls by maturity level.
