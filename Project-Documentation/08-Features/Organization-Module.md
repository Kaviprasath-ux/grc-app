# Organization Module

## Table of Contents

1. [Overview](#overview)
2. [What Is Organizational Structure in GRC?](#what-is-organizational-structure-in-grc)
3. [Organization Profile](#organization-profile)
4. [Departments](#departments)
5. [Stakeholders](#stakeholders)
6. [Business Processes](#business-processes)
7. [Business Impact Analysis (BIA)](#business-impact-analysis-bia)
8. [Process KPIs](#process-kpis)
9. [Reports](#reports)
10. [Settings](#settings)
11. [Cross-Module Connections](#cross-module-connections)
12. [API Reference](#api-reference)
13. [Permissions](#permissions)

---

## Overview

The Organization module is the structural backbone of the GRC application. Every other module — Compliance, Risk, Internal Audit, Asset Management — depends on the organizational data established here. Before you can assess risks, map controls, or conduct audits, you must first define who you are as an organization, how you are structured, and what critical business processes you operate.

The module answers four foundational questions:

- **Who are we?** — Organization profile, size, industry, geographic presence
- **How are we structured?** — Departments, roles, stakeholder relationships
- **What do we do?** — Business processes, ownership, interdependencies
- **What matters most?** — Business Impact Analysis, RTO/RPO targets, criticality ratings

---

## What Is Organizational Structure in GRC?

In a Governance, Risk, and Compliance context, "organizational structure" means more than an org chart. It is the full map of:

- **Accountability** — which department owns which process or control
- **Scope** — which geographic locations, legal entities, or business units are in scope for compliance
- **Criticality** — which processes are essential to operations and what the consequences of disruption are
- **Relationships** — how stakeholders interact, who approves decisions, who is notified of incidents

Without this foundation, GRC activities become generic checklists. With it, every risk can be owned by a department, every control can be assigned to a stakeholder, and every audit finding can be directed to the responsible process owner.

The Organization module creates this foundation in a multi-tenant architecture: each customer account (`customerAccountId`) maintains its own completely isolated organizational data.

---

## Organization Profile

### What It Captures

The organization profile is the identity card of the company using the GRC platform. It stores high-level metadata that appears in reports, compliance submissions, and audit documentation.

**Core Fields:**

| Field | Description | Example |
|---|---|---|
| Organization Name | Legal or trading name | Acme Financial Services Ltd. |
| Industry | Industry vertical | Financial Services |
| Organization Size | Employee count band | 501–1000 employees |
| Country | Primary country of incorporation | United Arab Emirates |
| City | Primary city of operations | Dubai |
| Website | Corporate website URL | https://www.acme-financial.ae |
| Description | Brief organizational overview | Free-text summary |

**Geographic Presence:**

Organizations frequently operate across multiple locations. The profile captures:

- **Branches** — physical office locations, each with its own address, city, and country. Branches can be flagged as headquarters.
- **Data Centers** — on-premises data processing facilities, with physical address, tier classification (Tier I through Tier IV), and ownership type (owned vs. leased)
- **Cloud Providers** — cloud service providers in use (AWS, Azure, GCP, Oracle Cloud, etc.), the services consumed (IaaS, PaaS, SaaS), and the regions where data is processed. This is critical for data residency compliance under regulations such as GDPR and UAE PDPL.

### Why This Matters

Many compliance frameworks require you to document the geographic scope of your operations. ISO 27001 clause 4.3 requires you to define the scope of your ISMS. SOC 2 engagements require a description of your system. The organization profile is the single authoritative source for these disclosures.

### Editing the Profile

The profile is managed at: **Organization → Profile**

Only users with the `organization.profile` edit permission can modify the profile. Typically this is the `CustomerAdministrator` role.

---

## Departments

### What Are Departments?

Departments represent the organizational units within a company: Finance, IT, Human Resources, Legal, Operations, etc. In the GRC platform, departments serve as the primary ownership anchor for every other type of GRC record.

When you create a risk, you assign it to a department. When you schedule an audit, you target a department. When a compliance control needs an owner, that owner comes from a department. This ownership chain creates accountability and makes it possible to generate department-level GRC scorecards.

### Department Data Model

Each department record captures:

| Field | Description |
|---|---|
| Name | Department name (e.g., "Information Technology") |
| Code | Short identifier (e.g., "IT") |
| Description | Role and scope of the department |
| Head | Name of the department head or manager |
| Parent Department | For nested org structures (e.g., "IT Security" under "IT") |
| Employee Count | Approximate headcount |
| Location | Primary physical or virtual location |

### Hierarchical Structure

Departments support parent-child nesting. This allows organizations to model complex structures:

```
Operations
  ├── Supply Chain
  │     ├── Procurement
  │     └── Logistics
  └── Manufacturing
        ├── Production Line A
        └── Quality Control
```

Hierarchical department structures affect how risks and audits are scoped. An audit assigned to "Operations" can include all child departments, or each child can be audited independently.

### Departmental Ownership in GRC

The department appears as an owner field in:

- **Risks** — Which department is responsible for managing the risk?
- **Compliance Controls** — Which department implements and maintains the control?
- **Audit Engagements** — Which departments are being audited (auditees)?
- **Assets** — Which department owns the asset?
- **Business Processes** — Which department owns the process?
- **Stakeholders** — Which department does this stakeholder belong to?

Managing departments at **Organization → Departments**.

---

## Stakeholders

### What Are Stakeholders?

Stakeholders are the people who have an interest in, or a responsibility toward, GRC activities. The GRC platform tracks both internal stakeholders (employees, managers, board members) and external stakeholders (regulators, auditors, vendors, customers).

### Why Track Stakeholders?

- **Compliance reporting** requires identifying who is responsible for regulatory obligations
- **Risk management** requires assigning risk owners and mitigation owners
- **Audit management** requires identifying auditees, process owners, and reviewers
- **Governance** requires documenting who approves policies and reviews controls

### Stakeholder Types

| Type | Description | Examples |
|---|---|---|
| Internal | Employees and officers of the organization | CISO, CFO, IT Manager, Department Head |
| External | Parties outside the organization | Regulator, External Auditor, Vendor, Customer |

### Stakeholder Data Model

| Field | Description |
|---|---|
| Name | Full name |
| Title | Job title |
| Email | Primary email address |
| Phone | Contact number |
| Department | Owning department |
| Stakeholder Type | Internal or External |
| Role / Responsibility | Free-text description of their GRC role |
| Notes | Additional context |

### Stakeholder Use Across Modules

Stakeholders are referenced throughout the platform:

- **Compliance** — assigned as control owners or evidence reviewers
- **Risk** — assigned as risk owners
- **Governance Documents** — assigned as policy owners or approvers
- **Internal Audit** — added to audit teams or as auditees (though Audit module uses its own user-based team structure)

Managing stakeholders at **Organization → Stakeholders**.

---

## Business Processes

### What Are Business Processes?

A business process is a defined sequence of activities performed to achieve a specific business outcome. Examples include: order-to-cash, employee onboarding, financial close, IT change management, incident response.

In GRC terms, business processes are important because:

- **Risk assessment** needs to know what processes could be disrupted
- **Compliance controls** protect specific processes
- **Business continuity** prioritizes which processes to recover first
- **Audit programs** evaluate whether processes work as designed

### Process Inventory

The process inventory is a comprehensive catalogue of all business processes recognized by the organization. Each process record captures:

| Field | Description |
|---|---|
| Process Name | Human-readable name |
| Process Code | Unique identifier (e.g., FIN-001) |
| Category | Process category (e.g., Finance, IT, HR) |
| Description | What the process does |
| Owning Department | Which department runs the process |
| Process Owner | Named individual accountable for the process |
| Supporting Systems | IT systems or applications the process depends on |
| Regulatory Requirements | Regulations that govern this process |
| Status | Active, Under Review, Deprecated |

### RACI Matrix

For each process, a RACI (Responsible, Accountable, Consulted, Informed) matrix can be defined. This documents who plays what role in the process execution:

| Role | Meaning |
|---|---|
| **R** — Responsible | Does the work; performs the task |
| **A** — Accountable | Owns the outcome; approves the work |
| **C** — Consulted | Provides expertise or input before/during |
| **I** — Informed | Notified of progress or outcome |

RACI entries are linked to stakeholders in the stakeholder registry, creating a cross-reference between processes and people.

**Example RACI for "Financial Reporting" process:**

| Activity | CFO | Finance Manager | External Auditor | Board |
|---|---|---|---|---|
| Prepare financial statements | R | R | C | I |
| Review statements | A | R | C | I |
| Approve and sign off | A | C | I | I |
| Submit to regulator | R | A | I | I |

### Process Interdependencies

Complex organizations have processes that depend on other processes. The system allows documenting upstream and downstream dependencies:

- **Upstream** — processes that feed into this process (prerequisites)
- **Downstream** — processes that depend on outputs from this process

This dependency mapping is valuable during Business Continuity Planning because it helps identify cascading failures.

Managing processes at **Organization → Business Processes**.

---

## Business Impact Analysis (BIA)

### What Is Business Impact Analysis?

Business Impact Analysis (BIA) is a structured assessment of the potential consequences of disrupting each business process. It is the foundation of Business Continuity Planning (BCP) and Disaster Recovery (DR) programs.

The BIA asks: "If this process were unavailable for one hour, one day, one week — what would happen to the organization?" It quantifies the impact across multiple dimensions (financial, operational, reputational, regulatory) and establishes recovery targets.

### Why Conduct a BIA?

- **Prioritize recovery** — you cannot restore everything at once; BIA tells you what to restore first
- **Set realistic RTO/RPO targets** — based on actual business impact, not guesses
- **Meet regulatory requirements** — ISO 22301, SOC 2, and sector-specific regulations require documented BIA
- **Secure budget for continuity measures** — quantified impact data justifies investment in resilience
- **Inform risk assessment** — high-criticality processes correspond to high-severity risks

### RTO and RPO Explained

**Recovery Time Objective (RTO):**

RTO is the maximum acceptable length of time that a business process can be offline after a disruption before the consequences become unacceptable. It answers: "How long can we afford to be down?"

- An RTO of 4 hours means: if the process is not restored within 4 hours, the damage (financial, regulatory, reputational) becomes unacceptable.
- Short RTOs require more expensive recovery infrastructure (hot standby, real-time replication).
- Long RTOs allow for cheaper recovery approaches (daily backups, manual workarounds).

**Recovery Point Objective (RPO):**

RPO is the maximum acceptable amount of data loss measured in time. It answers: "How much data can we afford to lose?"

- An RPO of 1 hour means: the organization can accept losing up to 1 hour of transaction data.
- An RPO of 0 means: no data loss is acceptable (requires synchronous real-time replication).
- RPO drives the frequency of data backups or replication.

**Relationship between RTO and RPO:**

Both are business decisions, not technical ones. The business owner of a process determines what impact they can tolerate. IT then designs systems to meet those targets. A payment processing system might have RTO = 15 minutes and RPO = 0 (no data loss). An internal HR reporting system might have RTO = 48 hours and RPO = 24 hours.

### BIA Categories

BIA categories define the impact dimensions assessed for each process. Common categories include:

| Category | Description |
|---|---|
| Financial Impact | Direct revenue loss, additional costs, penalties |
| Regulatory/Legal Impact | Fines, reporting failures, license risks |
| Reputational Impact | Customer confidence, brand damage, media coverage |
| Operational Impact | Disruption to core operations, employee productivity |
| Customer Impact | Service degradation, SLA breaches, customer churn |
| Health and Safety | Risk to human life or wellbeing |

Organizations can configure their own BIA categories via **Organization → Settings → BIA Categories**. Each category can have a custom weight in the overall impact score calculation.

### BIA Ratings and Scoring

Each category is rated on a severity scale. The platform uses a configurable rating scale, commonly:

| Rating | Score | Meaning |
|---|---|---|
| Negligible | 1 | No meaningful impact; process can be down indefinitely |
| Minor | 2 | Small impact; workarounds exist |
| Moderate | 3 | Noticeable impact; operations degraded but functioning |
| Significant | 4 | Serious disruption; key objectives at risk |
| Critical | 5 | Severe; organization-threatening consequences |

For each process, a BIA assessment scores each category at each time horizon (e.g., 1 hour, 4 hours, 8 hours, 1 day, 3 days, 1 week). The overall criticality score is calculated as a weighted average across all categories.

**Maximum Tolerable Downtime (MTD):** The point at which the BIA scores reach an unacceptable threshold. The RTO must be less than the MTD.

### BCP Labels

BCP (Business Continuity Plan) labels categorize processes by their recovery priority tier:

| Label | Description |
|---|---|
| Tier 1 — Mission Critical | Must be recovered first; failure threatens organizational survival |
| Tier 2 — Business Critical | Must be recovered within hours; significant financial or regulatory impact |
| Tier 3 — Important | Must be recovered within 1–3 days; moderate impact |
| Tier 4 — Normal | Must be recovered within 1 week; limited impact |
| Tier 5 — Low Priority | Can be recovered after all higher tiers; minimal impact |

BCP labels drive recovery sequencing during an actual disaster event. They also inform how much investment (redundancy, backup frequency, failover capacity) is justified for each process.

### Conducting a BIA Assessment

1. Navigate to **Organization → Business Processes → [Process Name] → BIA**
2. For each configured BIA category, select the impact rating at each time horizon
3. Review the automatically calculated overall criticality score
4. Set the RTO and RPO targets based on the impact assessment
5. Assign a BCP label (Tier 1–5)
6. Document any assumptions, dependencies, or mitigation measures
7. Save and optionally submit for reviewer approval

### BIA Reports

The BIA module generates summary reports showing:

- All processes ranked by criticality score
- Distribution of processes by BCP tier
- Aggregated RTO/RPO targets by department
- Processes with no BIA assessment completed (gaps)
- Processes whose RTO/RPO targets have not been validated

---

## Process KPIs

### What Are Process KPIs?

Key Performance Indicators (KPIs) for business processes measure how well each process is performing against defined targets. Unlike compliance controls (which ask "is the control in place?"), process KPIs ask "is the process achieving its intended outcomes?"

### KPI Data Model

| Field | Description |
|---|---|
| KPI Name | What is being measured |
| Process | Which business process this KPI tracks |
| Owner | Who is responsible for reporting this KPI |
| Measurement Frequency | How often it is measured (daily, weekly, monthly, quarterly) |
| Target | The goal value |
| Threshold | Warning threshold (below this triggers a yellow status) |
| Minimum Acceptable | Red threshold (below this triggers a red/failed status) |
| Unit | Measurement unit (%, hours, count, currency) |
| Current Value | Most recently reported value |
| Status | Green, Amber, Red based on current value vs targets |

### KPI Status Logic

```
if current_value >= target:         Status = GREEN (On Target)
if threshold <= current_value < target: Status = AMBER (At Risk)
if current_value < threshold:       Status = RED (Failing)
```

### KPI Reporting

Process KPIs appear in the Organization dashboard as a summary status. Trend history is tracked so that improvements or degradations over time are visible.

KPIs connect to the GRC Dashboard, where a summary widget shows the count of green, amber, and red KPIs across all processes.

---

## Reports

The Organization module includes several built-in reports:

**Organizational Overview Report:**
- Organization profile summary
- Department list with headcounts
- Geographic presence map (branches, data centers, cloud providers)

**Process Inventory Report:**
- Full list of business processes with owners and status
- RACI summary by department

**BIA Summary Report:**
- All processes with their criticality scores, BCP tiers, RTO, and RPO
- Heat map of process criticality by department
- Gap analysis (processes missing BIA assessments)

**Stakeholder Directory:**
- Full stakeholder list with contact information and roles

Reports can be exported as PDF or CSV from the Reports section.

---

## Settings

The Organization module's settings allow administrators to configure the BIA methodology to fit the organization's needs.

### BIA Categories

Navigate to **Organization → Settings → BIA Categories** to:

- Add new impact categories relevant to your industry
- Edit category names and descriptions
- Set the weight of each category in the overall impact score (weights must sum to 100%)
- Archive categories no longer in use

**Example configuration for a financial institution:**

| Category | Weight |
|---|---|
| Financial Impact | 35% |
| Regulatory/Legal Impact | 30% |
| Reputational Impact | 20% |
| Operational Impact | 10% |
| Customer Impact | 5% |

### BIA Rating Scale

The rating scale (labels and scores for each level) can be customized. For example, an organization might prefer a 3-point scale (Low, Medium, High) or a 10-point scale for more granularity.

### BIA Methodology

Configure the overall BIA methodology including:

- Time horizons to assess (e.g., 1h, 4h, 8h, 24h, 72h, 1 week)
- Whether to use weighted or unweighted averages
- Thresholds for automatic BCP tier assignment based on score ranges
- Whether BIA requires approval before being finalized

---

## Cross-Module Connections

The Organization module is the hub of the GRC platform. Here is how its data flows into other modules:

### Departments → Risk Module

Every risk in the Risk Register is assigned an **owning department**. Risk reports can be filtered by department. Department-level risk heat maps show which departments carry the most residual risk exposure.

### Departments → Internal Audit

Audit engagements target specific departments. The Audit Universe groups auditable entities by department. Audit findings are assigned to departments for remediation tracking.

### Departments → Compliance

Compliance controls are owned by departments. When a control is not implemented, the gap is owned by the responsible department. Compliance dashboards show control coverage by department.

### Departments → Asset Management

Assets are assigned to owning departments. Asset risk scores roll up to department-level reports.

### Business Processes → Risk Assessment

Risks can be linked to the business processes they affect. BIA criticality scores inform risk impact ratings: a risk affecting a Tier 1 (Mission Critical) process should receive a higher impact score than one affecting a Tier 5 process.

### BIA → Business Continuity Planning

BIA results feed directly into BCP documentation. The RTO and RPO targets established in the BIA become the recovery targets that IT and Operations must design their systems to meet.

### Stakeholders → Governance

Policy and procedure documents assign stakeholders as owners and approvers. Stakeholder contact information is used for notification workflows (email alerts for overdue actions, expiring documents, etc.).

---

## API Reference

### Organization Profile

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/organization/profile` | Get organization profile |
| PATCH | `/api/organization/profile` | Update organization profile |

### Departments

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/organization/departments` | List all departments |
| POST | `/api/organization/departments` | Create department |
| GET | `/api/organization/departments/[id]` | Get department by ID |
| PATCH | `/api/organization/departments/[id]` | Update department |
| DELETE | `/api/organization/departments/[id]` | Delete department |

### Stakeholders

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/organization/stakeholders` | List stakeholders |
| POST | `/api/organization/stakeholders` | Create stakeholder |
| PATCH | `/api/organization/stakeholders/[id]` | Update stakeholder |
| DELETE | `/api/organization/stakeholders/[id]` | Delete stakeholder |

### Business Processes

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/organization/processes` | List processes |
| POST | `/api/organization/processes` | Create process |
| GET | `/api/organization/processes/[id]` | Get process detail |
| PATCH | `/api/organization/processes/[id]` | Update process |
| DELETE | `/api/organization/processes/[id]` | Delete process |
| GET | `/api/organization/processes/[id]/bia` | Get BIA for process |
| POST | `/api/organization/processes/[id]/bia` | Submit BIA |

### Process KPIs

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/organization/kpis` | List KPIs |
| POST | `/api/organization/kpis` | Create KPI |
| PATCH | `/api/organization/kpis/[id]` | Update KPI |
| POST | `/api/organization/kpis/[id]/record` | Record a new KPI value |

---

## Permissions

| Permission Resource | Actions | Roles with Access |
|---|---|---|
| `organization.profile` | view, edit | CustomerAdministrator, GRCAdministrator |
| `organization.departments` | view, create, edit, delete | CustomerAdministrator, GRCAdministrator, Reviewer |
| `organization.stakeholders` | view, create, edit, delete | CustomerAdministrator, GRCAdministrator, Contributor |
| `organization.processes` | view, create, edit, delete | CustomerAdministrator, GRCAdministrator, Contributor |
| `organization.bia` | view, create, edit | CustomerAdministrator, GRCAdministrator, Contributor, Reviewer |
| `organization.kpis` | view, create, edit, delete | CustomerAdministrator, GRCAdministrator, Contributor |
| `organization.settings` | view, edit | CustomerAdministrator, GRCAdministrator |

---

*Last updated: 2026-06-29*
*Module version: GRC App — GRC-MultiTenant branch*
