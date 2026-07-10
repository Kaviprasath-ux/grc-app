# Asset Management Module

## Table of Contents

1. [Overview](#overview)
2. [What Is IT Asset Management?](#what-is-it-asset-management)
3. [The CIA Triad](#the-cia-triad)
4. [Asset Types](#asset-types)
5. [Asset Inventory](#asset-inventory)
6. [Asset Classification (CIA Scoring)](#asset-classification-cia-scoring)
7. [Asset Categories, Sub-Categories, and Groups](#asset-categories-sub-categories-and-groups)
8. [Asset Lifecycle](#asset-lifecycle)
9. [Asset Risk Scoring](#asset-risk-scoring)
10. [Department Ownership](#department-ownership)
11. [My Inventory](#my-inventory)
12. [Reports](#reports)
13. [Cross-Module Connections](#cross-module-connections)
14. [API Reference](#api-reference)
15. [Permissions](#permissions)

---

## Overview

The Asset Management module provides a centralized inventory of all IT and physical assets within the organization, paired with a CIA-based classification system that determines each asset's criticality to the business. Understanding what assets you have, who owns them, and how sensitive they are is a prerequisite for meaningful risk management and compliance.

Without a complete asset inventory, risk assessments are incomplete, compliance controls cannot be properly assigned, and an organization cannot effectively defend or recover what it does not know it has.

---

## What Is IT Asset Management?

IT Asset Management (ITAM) is the practice of systematically tracking, managing, and maintaining an inventory of an organization's assets throughout their operational life. In the context of GRC, ITAM extends beyond procurement and cost tracking to focus on:

**Security and Risk:** Understanding which assets process or store sensitive data, and therefore which assets require the strongest security controls.

**Compliance Scope:** Many regulations (ISO 27001, SOC 2, PCI DSS, HIPAA) require organizations to maintain an inventory of assets within the scope of the compliance program. You cannot design controls for systems you have not identified.

**Auditability:** Internal and external auditors will ask "show me all assets that process customer data." Without ITAM, answering this question requires manual investigation. With ITAM, it is a filtered report.

**Business Continuity:** Knowing which assets support critical business processes enables faster, more targeted recovery when incidents occur.

**License and Cost Management:** ITAM tracks software licenses, subscription expiry dates, and procurement costs, preventing compliance violations from expired licenses and optimizing IT spending.

---

## The CIA Triad

The CIA triad is the cornerstone of information security and the primary classification framework used in this module. CIA stands for **Confidentiality**, **Integrity**, and **Availability**. Every asset is scored on each of these three dimensions.

### Confidentiality

**Definition:** Confidentiality is the assurance that information is accessible only to those authorized to access it. A confidentiality breach means unauthorized parties have gained access to data they should not have seen.

**Why it matters for assets:** Different assets store or process different types of data. A system containing personal health records has high confidentiality requirements. A system containing publicly available marketing materials has low confidentiality requirements.

**Scoring considerations:**
- Does the asset store or process personally identifiable information (PII)?
- Does it hold financial records, intellectual property, or trade secrets?
- Is the data subject to regulatory protection (GDPR, UAE PDPL, HIPAA)?
- What would be the impact of unauthorized disclosure?

**Rating scale:**

| Score | Level | Meaning |
|---|---|---|
| 1 | Low | Data is public or non-sensitive; disclosure has negligible impact |
| 2 | Medium-Low | Disclosure would cause minor embarrassment or competitive disadvantage |
| 3 | Medium | Disclosure would cause significant embarrassment, limited financial damage |
| 4 | Medium-High | Disclosure would cause material financial damage or regulatory penalties |
| 5 | High | Disclosure would cause severe financial damage, legal liability, or endanger individuals |

### Integrity

**Definition:** Integrity is the assurance that information is accurate, complete, and has not been tampered with or corrupted. An integrity breach means data has been altered without authorization, either by an attacker or by a system failure.

**Why it matters for assets:** If the integrity of a financial reporting system is compromised, the organization's accounts become unreliable. If a medical device's integrity is compromised, patient safety is at risk.

**Scoring considerations:**
- How critical is the accuracy of data this asset produces or stores?
- What would be the impact of undetected data corruption?
- Are there controls to detect tampering (checksums, audit logs, digital signatures)?
- Is this asset used to make important business decisions?

**Rating scale:**

| Score | Level | Meaning |
|---|---|---|
| 1 | Low | Data corruption has negligible impact; easily detected and corrected |
| 2 | Medium-Low | Minor errors could cause small operational inconveniences |
| 3 | Medium | Data errors could cause moderate operational or financial impact |
| 4 | Medium-High | Corrupted data would cause significant business decisions to go wrong |
| 5 | High | Corruption would cause critical failures, financial loss, regulatory violations, or safety incidents |

### Availability

**Definition:** Availability is the assurance that systems and data are accessible to authorized users when needed. An availability failure means legitimate users cannot access resources they require to do their jobs.

**Why it matters for assets:** Some systems are tolerant of planned or unplanned downtime. Others are not. A customer-facing payment gateway has extreme availability requirements. An internal HR system may have more flexible uptime requirements.

**Scoring considerations:**
- How critical is this asset to daily operations?
- What is the business impact if this asset is unavailable for 1 hour, 1 day, 1 week?
- Does this asset's downtime affect external customers or only internal users?
- Is there a manual fallback process if this asset is unavailable?
- Is this asset directly connected to a Tier 1 business process (per BIA)?

**Rating scale:**

| Score | Level | Meaning |
|---|---|---|
| 1 | Low | Downtime has negligible impact; manual alternatives are readily available |
| 2 | Medium-Low | Short outages (< 1 day) are tolerable with minor workarounds |
| 3 | Medium | Outages beyond a few hours cause noticeable operational disruption |
| 4 | Medium-High | Even brief outages cause significant financial or operational impact |
| 5 | High | Any downtime causes immediate, severe consequences (revenue loss, safety risk, regulatory breach) |

### Overall CIA Score

The overall asset criticality score is calculated as an average (or weighted average, depending on configuration) of the three CIA scores:

```
Criticality Score = (C + I + A) / 3
```

Or with weights:
```
Criticality Score = (w_C × C) + (w_I × I) + (w_A × A)
```

Where weights are configured per organization (default: equal weighting).

**Criticality Tiers:**

| Score Range | Tier | Label |
|---|---|---|
| 4.5 – 5.0 | Tier 1 | Mission Critical |
| 3.5 – 4.4 | Tier 2 | Business Critical |
| 2.5 – 3.4 | Tier 3 | Important |
| 1.5 – 2.4 | Tier 4 | Standard |
| 1.0 – 1.4 | Tier 5 | Low Criticality |

---

## Asset Types

The module supports a wide range of asset types to cover the full technology landscape of modern organizations.

### Hardware Assets

**Servers:**
Physical or virtual server machines including application servers, database servers, file servers, domain controllers, and management servers. Includes both on-premises and co-located servers.

Key attributes: Hostname, IP address, operating system, CPU, RAM, storage, rack location, data center assignment.

**Endpoints:**
User computing devices including laptops, desktops, tablets, and workstations.

Key attributes: Device model, operating system, user assignment, endpoint protection status.

**Network Devices:**
Routers, switches, firewalls, load balancers, VPN concentrators, and wireless access points that form the network infrastructure.

Key attributes: Make/model, firmware version, management IP, network segment.

**Storage Devices:**
SAN arrays, NAS devices, tape libraries, and backup appliances.

Key attributes: Storage capacity, array model, replication status.

**Physical Security Devices:**
CCTV cameras, badge readers, biometric scanners, and alarm systems.

### Software Assets

**Applications:**
Business applications, ERP systems, CRM platforms, productivity software, custom-developed applications.

Key attributes: Application name, version, vendor, license type, license count, expiry date.

**Operating Systems:**
Licensed operating system installations.

**Databases:**
Database management systems (Oracle, SQL Server, PostgreSQL, MySQL) regardless of whether they run on dedicated or shared servers.

### Cloud Assets

**Cloud Services:**
SaaS platforms (Office 365, Salesforce, Workday), IaaS resources (AWS EC2, Azure VMs), and PaaS services.

Key attributes: Service name, cloud provider, account ID, region, monthly cost, data classification.

**Cloud Storage Buckets:**
Object storage (AWS S3, Azure Blob Storage, Google Cloud Storage) that may contain sensitive data.

### Data Assets

**Datasets:**
Collections of structured or unstructured data, particularly those containing personal data or sensitive business information.

Key attributes: Data classification, volume, retention period, processing location.

---

## Asset Inventory

### The Asset Registry

The asset inventory is the complete authoritative list of all assets within the organization's scope. It is the "single source of truth" for what the organization owns, manages, or uses.

**Core fields for every asset:**

| Field | Description |
|---|---|
| Asset Name | Descriptive name (e.g., "Production Payment Database") |
| Asset ID | Unique system-generated or manual identifier |
| Asset Type | Category of asset (see Asset Types above) |
| Description | Purpose and role of the asset |
| Owning Department | Which department is responsible |
| Asset Owner | Named individual with ownership responsibility |
| Location | Physical location or cloud region |
| Status | Lifecycle status (see Asset Lifecycle below) |
| Acquisition Date | When the asset was acquired or deployed |
| Last Review Date | When the asset was last reviewed |

**Extended fields:**

| Field | Description |
|---|---|
| Vendor / Manufacturer | Supplier of the asset |
| Model / Version | Specific model or version information |
| Serial Number | Hardware serial number or license key |
| IP Address | For network-connected assets |
| Operating Environment | Production, Staging, Development, Test |
| Support Contract | Support/warranty status and expiry |
| Replacement Cost | Estimated cost to replace the asset |
| Tags | Free-form labels for filtering |

### Adding Assets to the Inventory

Assets can be added:

1. **Manually** — via the Asset Management UI at **Asset Management → Asset Inventory → Add Asset**
2. **Bulk import** — via CSV upload (template provided in the UI)

For cloud environments, integration with cloud provider APIs is on the product roadmap for automated discovery.

### Asset Detail View

Each asset has a detail page showing:

- All core and extended fields
- CIA classification scores with visual indicator
- Overall criticality score and tier
- Linked risks
- Linked compliance controls
- Change history (who changed what, when)
- Related assets (parent/child relationships, dependencies)

---

## Asset Classification (CIA Scoring)

### The Classification Workflow

1. Navigate to **Asset Management → Asset Classification** or open an asset from the inventory
2. Select the asset to classify
3. Score the asset on each CIA dimension (1–5)
4. Optionally add justification notes for each score
5. The system calculates the overall criticality score automatically
6. Select the appropriate criticality tier label
7. Save the classification

### Classification Review

Asset classifications should be reviewed:
- **Annually** as part of the regular asset review cycle
- **After a significant change** to the asset (major upgrade, change in data stored, change in usage)
- **After a security incident** involving the asset
- **After a significant change in the regulatory environment**

The system tracks the date of the last classification review for each asset. Assets that have not been reviewed within the configured review period are flagged in the My Inventory view and the reports.

### Classification Data Governance

Classifications are subject to review and approval. Organizations can configure whether a second reviewer must approve a classification before it takes effect. This is important for high-criticality assets where the classification drives significant security investment decisions.

---

## Asset Categories, Sub-Categories, and Groups

### Why a Three-Level Hierarchy?

Large asset inventories (hundreds or thousands of assets) need structured organization to be manageable. The three-level hierarchy provides:

- **Categories** — the broadest grouping (e.g., "IT Infrastructure", "Business Applications", "Physical Assets")
- **Sub-Categories** — narrower groupings within a category (e.g., under "IT Infrastructure": "Servers", "Network Equipment", "Endpoints")
- **Groups** — specific groupings for operational purposes (e.g., under "Servers": "Production Database Servers", "Development Servers")

### Configuring the Hierarchy

Categories, sub-categories, and groups are configured at **Asset Management → Settings**.

This hierarchy is organization-specific. A financial institution might organize differently from a manufacturing company. The platform does not impose a fixed taxonomy.

**Example hierarchy for a technology company:**

```
IT Infrastructure
  ├── Server Infrastructure
  │     ├── Production Web Tier
  │     ├── Production Application Tier
  │     ├── Production Database Tier
  │     └── Development/Test Servers
  ├── Network Infrastructure
  │     ├── Core Network
  │     └── Perimeter Security
  └── Endpoint Devices
        ├── Executive Devices
        └── Standard Workstations

Business Applications
  ├── Core Business Systems
  │     ├── ERP
  │     └── CRM
  └── Productivity Tools

Cloud Services
  ├── AWS Production
  ├── Azure Development
  └── SaaS Applications
```

### Filtering and Reporting by Category

The category hierarchy is used throughout the module:
- Filter the asset inventory by category/sub-category/group
- Generate CIA breakdown reports by category
- Apply bulk operations (e.g., review all assets in a group)

---

## Asset Lifecycle

Assets progress through defined lifecycle states from acquisition to decommissioning.

### Lifecycle Statuses

| Status | Description |
|---|---|
| **Active** | Fully operational and in current use |
| **Under Maintenance** | Temporarily taken offline for planned maintenance or upgrades |
| **Under Review** | Being evaluated for upgrade, replacement, or decommission |
| **Inactive** | No longer actively used but not yet formally decommissioned |
| **Retired** | Formally decommissioned; kept in records for historical reference |
| **Disposed** | Physically or digitally destroyed; data wiped and hardware destroyed/donated |
| **Pending Deployment** | Acquired but not yet live in the environment |

### Lifecycle Transitions

```
Pending Deployment → Active → Under Maintenance → Active (cycle)
Active → Under Review → Active (if kept)
Active → Under Review → Inactive → Retired → Disposed
```

### Lifecycle Impact on GRC

Asset lifecycle status affects how the asset is treated in GRC activities:

- **Active** assets are fully in scope for risk assessment and compliance controls
- **Under Maintenance** assets may have reduced monitoring; vulnerabilities during maintenance windows should be tracked
- **Retired** assets must be assessed for proper data destruction before decommission
- **Disposed** assets retain their records for audit evidence (when was it disposed, how was data destroyed?)

---

## Asset Risk Scoring

### How Asset Criticality Drives Risk

The CIA criticality score of an asset directly influences how risks involving that asset are rated. When an asset with a high criticality score is exposed to a threat, the potential impact of that threat is higher than if a low-criticality asset were affected.

**Risk Impact Adjustment:**

In the risk module, when a risk is linked to an asset, the asset's criticality tier can automatically suggest or adjust the "Impact" rating of the risk. For example:

- Risk: "Unauthorized access to customer database"
- Asset: "Production Customer Database" (C=5, I=5, A=4 → Criticality: 4.67 → Tier 1 Mission Critical)
- Suggested Impact: Critical (5)

This prevents underrating risks that affect highly critical assets.

### Risk-to-Asset Linkage

From any asset's detail page, you can:

- **Link existing risks** that affect this asset
- **View linked risks** and their current status
- See the aggregate risk exposure affecting this asset

From the Risk Register, you can:
- Link risks to one or more assets they affect
- Filter risks by the assets they impact

### Asset Risk Score

The Asset Risk Score is an aggregate view of the combined risk exposure affecting an asset:

```
Asset Risk Score = Max(residual risk scores of all linked risks)
```

Or alternatively, a weighted sum approach can be configured. This score appears on the asset detail page and in asset inventory reports, providing a quick view of which assets carry the most active risk.

---

## Department Ownership

### Ownership Model

Every asset must have an owning department and ideally a named asset owner (an individual). This two-level ownership model provides:

- **Department level** — accountability for the portfolio of assets; useful for budget, strategy, and audit purposes
- **Individual level** — operational accountability for day-to-day management, patching, and configuration

### Assigning Ownership

Ownership is assigned when creating or editing an asset. The "Owning Department" field presents a drop-down of departments defined in the Organization module. The "Asset Owner" field allows selecting a user or entering a name.

### Ownership-Based Filtering

Users can filter the asset inventory by their owning department. This is important in large organizations where the full asset inventory might contain thousands of items, and most users are only responsible for a subset.

---

## My Inventory

### What Is "My Inventory"?

My Inventory is a personalized view that shows only the assets owned by the currently logged-in user or their department. It is the primary working view for asset owners who need to manage their own assets without being overwhelmed by the full organization-wide inventory.

### My Inventory Features

- **Quick access** to assets I own
- **Review reminders** — assets due for CIA classification review are highlighted
- **Action items** — assets needing attention (expired support contracts, assets in "Under Review" status)
- **Recent changes** — assets that have been modified recently
- **Linked risks** — risks associated with my assets requiring attention

### Overdue Classification Reviews

When a CIA classification has not been reviewed within the configured review period (default: 12 months), the asset is flagged in My Inventory with a reminder to review. This keeps classification data current and defensible to auditors.

---

## Reports

### Available Reports

**Asset Inventory Report:**
A complete listing of all assets with their key metadata. Can be filtered by status, department, category, criticality tier. Exportable as PDF or CSV.

**CIA Classification Report:**
For each asset, shows the C, I, and A scores and the resulting criticality tier. Can be sorted by overall score to see the most critical assets first.

**Criticality Distribution:**
A summary view showing how assets are distributed across the five criticality tiers. Presented as a donut chart (visual) and a data table. Answers: "What percentage of our assets are mission critical?"

**Asset by Department:**
For each department, lists the assets owned, with a CIA summary. Useful for department heads to understand their asset risk exposure.

**Lifecycle Status Report:**
Shows how many assets are in each lifecycle status. Useful for identifying assets that have been stuck in "Under Review" or "Inactive" for too long.

**Overdue Review Report:**
Lists all assets whose CIA classification has not been reviewed within the review period. This is a compliance gap report.

**Risk-Linked Assets:**
Shows assets that have linked risks, the count of linked risks per asset, and the severity of those risks. Identifies the riskiest assets in the portfolio.

---

## Cross-Module Connections

### Asset Management → Risk Management

Assets are linked to risks in the Risk Register. The CIA criticality of an asset informs the Impact rating of risks affecting that asset. This creates a data-driven connection between asset criticality and risk severity.

### Asset Management → Compliance

Compliance controls often apply to specific assets or asset types. For example, an encryption control applies to all assets classified as Confidentiality = 4 or 5. The asset inventory provides the list of in-scope assets for each control, enabling systematic control implementation tracking.

### Asset Management → Internal Audit

Audit programs can target asset-level audits (e.g., "Audit security configuration of all Tier 1 servers"). Audit findings can be linked to specific assets. Recurring audit findings on the same asset indicate a systemic issue.

### Asset Management → Organization

Asset ownership is linked to departments defined in the Organization module. The organizational structure determines who is responsible for which assets, enabling department-level asset risk reports.

---

## API Reference

### Asset Inventory

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/assets` | List all assets (paginated) |
| POST | `/api/assets` | Create new asset |
| GET | `/api/assets/[id]` | Get asset by ID |
| PATCH | `/api/assets/[id]` | Update asset |
| DELETE | `/api/assets/[id]` | Delete asset |

### Asset Classification

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/assets/[id]/classification` | Get CIA classification |
| POST | `/api/assets/[id]/classification` | Create/update CIA classification |

### Asset Categories

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/assets/categories` | List categories |
| POST | `/api/assets/categories` | Create category |
| GET | `/api/assets/categories/[id]/subcategories` | List sub-categories |
| GET | `/api/assets/groups` | List groups |

### Asset Reports

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/assets/reports/summary` | CIA summary statistics |
| GET | `/api/assets/reports/criticality` | Criticality distribution |
| GET | `/api/assets/reports/overdue-reviews` | Assets with overdue reviews |

---

## Permissions

| Permission Resource | Actions | Roles with Access |
|---|---|---|
| `assets.inventory` | view, create, edit, delete | CustomerAdministrator, GRCAdministrator, Contributor |
| `assets.classification` | view, create, edit | CustomerAdministrator, GRCAdministrator, Contributor, Reviewer |
| `assets.categories` | view, create, edit, delete | CustomerAdministrator, GRCAdministrator |
| `assets.reports` | view | CustomerAdministrator, GRCAdministrator, Reviewer, Contributor |
| `assets.my-inventory` | view | All authenticated users (filtered to owned assets) |

---

*Last updated: 2026-06-29*
*Module version: GRC App — GRC-MultiTenant branch*
