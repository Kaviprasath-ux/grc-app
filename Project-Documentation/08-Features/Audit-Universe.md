# Audit Universe

## Table of Contents

1. [What is an Audit Universe?](#what-is-an-audit-universe)
2. [Why the Audit Universe Matters](#why-the-audit-universe-matters)
3. [Visual Organisation Map](#visual-organisation-map)
4. [Core Data Models](#core-data-models)
5. [Three Entity Types](#three-entity-types)
6. [Stat Cards Dashboard](#stat-cards-dashboard)
7. [Audit Status Visualisation](#audit-status-visualisation)
8. [Budget Tracking](#budget-tracking)
9. [Detail Table](#detail-table)
10. [Dynamic Translation of Category Names](#dynamic-translation-of-category-names)
11. [API Reference](#api-reference)
12. [How Categories Link to Processes and Risks](#how-categories-link-to-processes-and-risks)
13. [How to Add a New Auditable Entity](#how-to-add-a-new-auditable-entity)

---

## What is an Audit Universe?

The **Audit Universe** is a complete, structured inventory of every entity within an organisation that is potentially subject to internal audit. It represents the total population of auditable activities, processes, systems, departments, and functions.

Think of it as the organisation's **audit master list** — before you can plan which audits to conduct, you need to know everything that *could* be audited. Without this list:
- Audits happen reactively and inconsistently.
- Some high-risk areas might never be audited.
- There is no way to track audit coverage over time.

### Example Audit Universe Entries

| Category | Auditable Entity |
|----------|-----------------|
| Finance | Accounts Payable Process |
| Finance | Financial Reporting |
| Finance | Treasury and Cash Management |
| IT | Information Security Controls |
| IT | Network Infrastructure |
| IT | Change Management Process |
| HR | Recruitment and Onboarding |
| HR | Payroll Processing |
| Operations | Procurement and Vendor Selection |
| Operations | Contract Management |
| Compliance | Regulatory Reporting |
| Compliance | Privacy (GDPR) Controls |

---

## Why the Audit Universe Matters

### Risk-Based Audit Planning

Modern internal audit follows a **risk-based approach**: audit resources are concentrated on the highest-risk areas. To implement this, you must first enumerate all possible areas (the audit universe), then rank them by risk level. High-risk entities get audited more frequently; low-risk entities less so.

### Coverage Tracking

The Audit Universe enables tracking of **audit coverage** — what percentage of auditable entities have been reviewed in a given period. Regulatory bodies and Audit Committees often expect near-100% coverage over a multi-year strategic plan horizon.

### Repeatable Framework

Without a defined audit universe, each year's audit plan is built from scratch. With the audit universe, planning becomes systematic: review the list, assess current risk levels, and select which entities to audit next.

---

## Visual Organisation Map

**URL:** `/internal-audit/audit-universe`

The page's primary visual feature is an **Organisation Map** — a tree diagram (similar to an org chart) that shows the hierarchical relationship between categories and their auditable entities.

### Tree Layout

```
Organisation
├── Finance
│   ├── Accounts Payable  [Planned]
│   ├── Financial Reporting  [Completed]
│   └── Treasury  [Not Scheduled]
├── IT
│   ├── Information Security  [In Progress]
│   ├── Network Infrastructure  [Near Budget]
│   └── Change Management  [Planned]
└── HR
    ├── Recruitment  [Completed]
    └── Payroll  [Over Budget]
```

Each entity node in the tree is colour-coded by audit status (see [Audit Status Visualisation](#audit-status-visualisation)).

Clicking on an entity node shows a detail popover with:
- Last audit date
- Risk level (from the Risk Universe)
- Budget (planned vs actual hours)
- Linked audit engagement (if any)

---

## Core Data Models

### AuditCategory

```prisma
model AuditCategory {
  id                String            @id @default(cuid())
  customerAccountId String
  name              String            // e.g., "Finance", "IT", "HR"
  description       String?
  sortOrder         Int               @default(0)

  auditableEntities AuditableEntity[]
  engagements       AuditEngagement[]

  createdAt         DateTime          @default(now())
  updatedAt         DateTime          @updatedAt
}
```

### AuditableEntity

```prisma
model AuditableEntity {
  id                String          @id @default(cuid())
  customerAccountId String
  categoryId        String
  category          AuditCategory   @relation(...)

  name              String          // Entity display name
  description       String?
  riskLevel         String?         // High, Medium, Low
  auditFrequency    String?         // Annual, Biennial, etc.
  lastAuditDate     DateTime?
  nextAuditDate     DateTime?

  // Related processes and risks
  processes         Process[]       @relation("AuditableEntityProcesses")
  risks             InternalAuditRisk[] @relation("AuditableEntityRisks")
  engagements       AuditEngagement[]

  createdAt         DateTime        @default(now())
  updatedAt         DateTime        @updatedAt
}
```

---

## Three Entity Types

The Audit Universe page aggregates data from three related entity types:

### 1. Processes

**Source table:** `Process`

Processes are the operational activities of the organisation that are linked to auditable entities. For example, the "Accounts Payable" auditable entity might link to the "Invoice Processing" and "Payment Approval" processes.

Processes come from the **Organisation module** (Process Register) and are linked to the Audit Universe to show which business processes fall under each audit scope.

**Why it matters:** Auditors need to understand the processes they are testing. Linking processes to the audit universe ensures the audit program is built around real operational activities, not abstract categories.

### 2. Risks (InternalAuditRisk)

**Source table:** `InternalAuditRisk`

These are risks maintained by the Internal Audit function (distinct from the enterprise Risk Register used by the Risk Management module). They represent the Internal Audit team's assessment of what could go wrong in each auditable entity.

**Why separate from the enterprise risk register?** Internal Audit maintains its own risk view to preserve independence. The enterprise risk register is owned by management (first and second lines). Internal Audit's risk universe is its own assessment tool used to prioritise audit coverage.

### 3. Audit Engagements

**Source table:** `AuditEngagement`

Audit engagements link back to the auditable entities they cover. This allows the audit universe view to show, for each entity:
- How many times it has been audited historically.
- The most recent engagement's status and outcome.
- Whether an engagement is currently active (in progress).

---

## Stat Cards Dashboard

The top of the Audit Universe page shows four summary cards:

| Card | What it shows |
|------|--------------|
| **Categories** | Total number of AuditCategory records for this tenant |
| **Processes** | Total number of processes linked to auditable entities |
| **Risks** | Total number of InternalAuditRisk records |
| **Total Audits** | Total number of AuditEngagement records (all statuses) |

These cards give the AuditHead an at-a-glance picture of the breadth of the audit function.

---

## Audit Status Visualisation

Each auditable entity is colour-coded in the organisation map based on its current audit engagement status:

| Status | Colour | Meaning |
|--------|--------|---------|
| **Planned** | Blue | An engagement is scheduled but has not started fieldwork yet |
| **In Progress** | Amber/Orange | Active fieldwork is underway |
| **Near Budget** | Yellow | The engagement is within 10% of its planned hours budget |
| **Completed** | Green | The final report has been issued and the engagement is closed |
| **Over Budget** | Red | The engagement has exceeded its planned hours budget |
| **Not Scheduled** | Grey | No current or planned engagement for this entity |

### Why Budget Colours Matter

Internal Audit teams have a finite number of audit days per year. When an engagement runs over budget, it consumes capacity that was allocated to other audits. Flagging "Near Budget" and "Over Budget" entities in the Audit Universe view allows the AuditHead to take corrective action early (e.g., scope reduction, additional resources, timeline extension).

---

## Budget Tracking

For each auditable entity, budget tracking shows:

- **Planned Hours** — the number of audit hours budgeted for the engagement.
- **Actual Hours** — hours logged by auditors against the engagement.
- **Variance** — planned minus actual (negative = over budget).
- **Burn Rate** — percentage of budget consumed.

### Budget Status Rules

| Condition | Status Label |
|-----------|-------------|
| Actual < 90% of Planned | In Progress (normal) |
| Actual ≥ 90% of Planned | Near Budget |
| Actual > 100% of Planned | Over Budget |

Budget data is sourced from timesheets or manual hour logging within the engagement record. If no budget is set, the entity shows no budget status indicator.

---

## Detail Table

Below the organisation map, a full table lists every auditable entity with columns:

| Column | Description |
|--------|-------------|
| Entity Name | The display name of the auditable entity |
| Category | Which AuditCategory it belongs to |
| Risk Level | High / Medium / Low (from the latest risk assessment) |
| Last Audit Date | Date the most recent engagement was completed |
| Next Audit Date | Scheduled date for the next engagement |
| Audit Frequency | How often this entity should be audited |
| Status | Current engagement status (if active) |
| Linked Processes | Count of processes linked to this entity |
| Linked Risks | Count of risks associated with this entity |
| Actions | Edit / View Engagements / Add Engagement buttons |

The table is sortable by any column and filterable by category, risk level, and status.

---

## Dynamic Translation of Category Names

Audit category names are user-entered data (not hardcoded UI text), so they are handled by the **dynamic translation system** rather than the static `t()` function.

When an AuditHead creates a category named "Information Technology" in English, the system:
1. Saves the name to the `AuditCategory` table.
2. Calls `triggerTranslation('AuditCategory', id, { name: 'Information Technology' })`.
3. The Python translation backend generates Arabic ("تكنولوجيا المعلومات") and Latvian ("Informācijas tehnoloģijas") versions.
4. Translations are stored in the `DynamicTranslation` table.

When an Arabic-language user views the Audit Universe page:
1. `useTranslatedData(categories, { modelName: 'AuditCategory' })` fetches translations.
2. Category names are displayed in Arabic.
3. The organisation map tree labels update accordingly.

---

## API Reference

### GET /api/internal-audit/audit-universe

Fetches all data needed to render the Audit Universe page: categories, auditable entities, processes, risks, and engagements with their budget status.

**Authentication:** Required (AuditHead, AuditManager, Auditor roles)

**Response shape:**
```json
{
  "categories": [
    {
      "id": "clx_cat_001",
      "name": "Finance",
      "description": "Financial management and reporting functions",
      "auditableEntities": [
        {
          "id": "clx_ent_001",
          "name": "Accounts Payable",
          "riskLevel": "High",
          "lastAuditDate": "2024-09-15T00:00:00.000Z",
          "nextAuditDate": "2025-09-15T00:00:00.000Z",
          "processCount": 3,
          "riskCount": 5,
          "latestEngagement": {
            "id": "clx_eng_001",
            "status": "In Progress",
            "plannedHours": 80,
            "actualHours": 65,
            "budgetStatus": "Normal"
          }
        }
      ]
    }
  ],
  "stats": {
    "totalCategories": 6,
    "totalProcesses": 28,
    "totalRisks": 47,
    "totalAudits": 34
  }
}
```

---

## How Categories Link to Processes and Risks

### Categories → Processes

The `Process` model (from the Organisation module) has an optional `auditCategoryId` field that links it to an AuditCategory. This means:
- When browsing the Audit Universe, you see which business processes fall under each audit category.
- When creating an audit program, the auditor can see which processes are in scope.

### Categories → Risks (InternalAuditRisk)

`InternalAuditRisk` records are created by the Internal Audit team and linked to specific `AuditableEntity` records (and through them, to categories). This allows the Risk Universe page to show risk distribution across categories.

### Categories → Engagements

`AuditEngagement` records reference an `AuditCategory` (and optionally a specific `AuditableEntity`). This is what drives the colour-coded status in the organisation map — the engagement's status determines the colour shown for each entity node.

---

## How to Add a New Auditable Entity

### Via the UI (Recommended)

1. Navigate to **Internal Audit → Audit Universe**.
2. Click **"Add Entity"** or the **"+"** button in the organisation map.
3. Fill in the form:
   - **Category** — select from existing categories (or create a new category first).
   - **Entity Name** — e.g., "Treasury and Cash Management".
   - **Description** — brief description of what is covered.
   - **Risk Level** — initial assessment: High / Medium / Low.
   - **Audit Frequency** — Annual / Biennial / Triennial.
4. Click **Save**.
5. The entity appears in the organisation map under its category.

### Linking Processes

After creating the entity:
1. Go to the Organisation module → Processes.
2. Edit the relevant process.
3. In the process form, set the **Audit Category** field to link it to the auditable entity.

### Adding Risks

To associate risks with the entity:
1. Navigate to **Internal Audit → Risk Universe**.
2. Click **"Add Risk"**.
3. Link the risk to the relevant auditable entity.
4. Set the risk score (likelihood × impact).

### Creating an Engagement

Once the entity exists in the Audit Universe, create an engagement to schedule its audit:
1. Navigate to **Internal Audit → Engagements**.
2. Click **"New Engagement"**.
3. Select the auditable entity from the dropdown.
4. Fill in scope, dates, budget, and team.
5. Save — the entity's status in the Audit Universe map updates to "Planned".
