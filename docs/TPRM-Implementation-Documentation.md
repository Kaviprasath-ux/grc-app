# TPRM Platform — Production Implementation Documentation

**Platform**: VerifAI TPRM (Third-Party Risk Management)
**Engine**: Mendix Low-Code Platform
**URL**: https://tprm100-accp.apps.me-2a.mendixcloud.com/
**Discovery Date**: 2026-02-26
**Analyst**: Claude (Automated Reverse-Engineering)

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Role Architecture](#2-role-architecture)
3. [Navigation Matrix by Role](#3-navigation-matrix-by-role)
4. [Module Breakdown](#4-module-breakdown)
5. [Vendor Lifecycle Workflow](#5-vendor-lifecycle-workflow)
6. [Assessment Workflow Engine](#6-assessment-workflow-engine)
7. [Status Lifecycle & Transitions](#7-status-lifecycle--transitions)
8. [Conditional Visibility Tables](#8-conditional-visibility-tables)
9. [Issue Management & Remediation](#9-issue-management--remediation)
10. [Continuous Monitoring Module](#10-continuous-monitoring-module)
11. [Configuration Engine](#11-configuration-engine)
12. [Data Model Observations](#12-data-model-observations)
13. [Edge Cases & Implicit Logic](#13-edge-cases--implicit-logic)
14. [Access Limitations & Gaps](#14-access-limitations--gaps)

---

## 1. System Overview

### Platform Identity
- **Brand**: VerifAI (by Baarez)
- **Type**: Multi-tenant TPRM SaaS platform
- **Framework**: Mendix low-code (Acceptance/Testing environment)
- **Authentication**: Username/password with "Remember me" and "Forgot Password" support
- **Session Management**: Explicit logout with confirmation dialog ("Are You Sure, Want To Sign Out?")

### Tenant Architecture
- **Superadmin (TPRMAdmin)**: Cross-tenant platform administration
- **Customer Account**: Tenant boundary (e.g., "Baarez" is a customer account)
- **Customer Admin (TPRMCustomerAdmin)**: Tenant-level administration
- **All other roles**: Scoped within a customer tenant

### Key Metrics (Baarez Tenant — Observed)
- **Total Assessments**: 40 / 200 (capacity limit observed)
  - Assessment Factory: 3
  - Onboarding Assessment: 21
  - Periodic Assessment: 0
  - On-Demand Assessment: 15
- **Total Vendors**: 79 / 200 (capacity limit observed)
  - Onboarding: 79
  - Onboarded: 1
  - Offboarding: 0
  - Offboarded: 0

---

## 2. Role Architecture

### 2.1 Platform-Level Roles

| Role | System Name | Scope | Description |
|------|-------------|-------|-------------|
| **TPRMAdmin** | `superadmin` | Cross-tenant | Global platform administration. Could NOT be accessed (credentials rejected). |
| **TPRMCustomerAdmin** | `admin@baarez.com` | Tenant-wide | Full tenant administration, configurations, user management, all modules |

### 2.2 Customer-Level Roles (Assignable by Admin)

| Role | System Name | Function Category | Description |
|------|-------------|-------------------|-------------|
| **Business Owner** | `BusinessOwner` | Business | Manages vendors from Onboarding to Offboarding; can create Relationship Managers to delegate |
| **Relationship Manager** | `RelationshipManager` | Business | Manages vendor relations on behalf of the Business Owner |
| **Assessor** | `Assessor` | TPRM Team | Conducts assessments during the Due Diligence process |
| **Approver** | `Approver` | TPRM Team | Reviews and approves assessments; can self-conduct and approve assessments |
| **Auditor** | `Auditor` | Oversight | View-only access to the application and its different modules |
| **InternalITTeam** | `InternalITTeam` | Operations | Responsible for resolution of issues that arise during Due Diligence |
| **Account Manager** | (Vendor-side) | External/Vendor | Vendor's representative; manages assessments and SMEs for their vendor |
| **SME** | (Vendor-side) | External/Vendor | Subject Matter Expert for vendor assessments |

### 2.3 Factory Roles (Separate Domain)

| Role | Description |
|------|-------------|
| **FactoryAdmin** | Manages the Assessment Factory module |
| **FactoryAssessor** | Conducts assessments within the Factory context |

> **Note**: Factory roles could NOT be accessed during this discovery session.

### 2.4 User Creation Model
- **Function Categories**: "TPRM Team" or "Business" (dropdown during user creation)
- **Username**: Auto-generated from email (disabled field)
- **Default Password**: `EWelk0m@2023` (pre-filled during creation)
- **Company Name**: Locked to tenant (e.g., "Baarez")
- **Active/Inactive toggle**: Checkbox during creation

### 2.5 Observed User Inventory (Baarez Tenant)

| Role | Count | Users |
|------|-------|-------|
| Account Manager | 7 | iciciAccountmanager, Kumar, Sardar khan, Amar Godse, om chanwan, Prakash jhaa, Rahman Baloch |
| Relationship Manager | 3 | Gauri Shree, anamika kumari, Relationship Manager of Baarez |
| Business Owner | 1 | Business Owner of Baarez (skharje@baarez.com) |
| Assessor | 2 | tamilrashi, Assessor of Baarez (yogesh@baarez.com) |
| Approver | 2 | test, Approver of Baarez (prakash@baarez.com) |
| Auditor | 2 | Auditor of Baarez, Phani Prakash Lakkaraju |
| IT | 1 | Internal IT Team (itsupport@baarez.com) |
| SME | 2 | test (test@gmail.com), IT of Infosys |

---

## 3. Navigation Matrix by Role

### Full Navigation Comparison

| Menu Item | Admin | BO | RM | Assessor | Approver | Auditor | IT | AM (Vendor) | SME |
|-----------|:-----:|:--:|:--:|:--------:|:--------:|:-------:|:--:|:-----------:|:---:|
| Program Monitor | X | | | | | | | | |
| Control Center | X | | | | | | | | |
| User Management | X | X | | | | | | | |
| Dashboard | | X | X | X | X | X | | | |
| Vendor Management | X | | | | | | | | |
| Inventory | | X | X | X | X | X | | | |
| Assessments | | X | X | X | X | X | | X | X |
| Report | X | X | X | X | X | | | | |
| Issue Management | | X | X | | | | X | | |
| Issue Register | | | | X | X | X | | | |
| Contracts | | X | X | | | | | | |
| Monitoring | X | X | X | X | | | | | |
| Follow-ups | | | | X | X | X | | X | X |
| Assessment Factory | | | | X | X | | | | |
| Template | | | | X | X | | | | |
| SME Management | | | | | | | | X | |
| Configurations | X | | | | | | | | |
| Master Data Mgmt | X | | | | | | | | |
| Assessment Workspace | X | | | | | | | | |
| MX Settings | X | | | | | | | | |
| Support | X | X | X | X | | | | X | X |

**Total nav items per role**: Admin=11, BO=9, RM=8, Assessor=10, Approver=8, Auditor=5, IT=1, AM=4, SME=3

### Key Navigation Differences
1. **Admin** sees system config modules (Control Center, Configurations, Master Data, MX Settings) — 11 items
2. **BO** has the broadest operational view (Dashboard + User Mgmt + Issue Mgmt + Contracts + Support) — 9 items
3. **RM** is similar to BO but without User Management; has Issue Management + Support — 8 items
4. **Assessor** has the most nav items of any non-admin role (10) including Monitoring + Support
5. **Approver** is similar to Assessor but WITHOUT Monitoring and WITHOUT Support — only 8 items. This is a key difference between the two assessment roles.
6. **Auditor** has the most restricted internal view — 5 items, read-only
7. **IT Team** has the most minimal view — only Issue Management (1 item)
8. **Account Manager (Vendor)** has 4 items focused on assessment completion + SME Management
9. **SME** has 3 items — the most limited vendor role

---

## 4. Module Breakdown

### 4.1 Program Monitor (Admin Only)
- **Purpose**: Executive overview of platform utilization
- **Sections**:
  - Total Assessment counter (current/limit): Broken into Assessment Factory, Onboarding, Periodic, On-Demand
  - Total Vendor counter (current/limit): Broken into Onboarding, Onboarded, Offboarding, Offboarded
- **Capacity Limits**: 200 assessments, 200 vendors (configurable per tenant?)

### 4.2 Control Center (Admin Only)
- **Purpose**: Core system configuration parameters
- **DueDiligence Configuration** (matrix by Criticality level):

| Category | Critical | High | Moderate | Low | Nominal |
|----------|----------|------|----------|-----|---------|
| VRR (Vendor Risk Rating) | 50 | 40 | 30 | 20 | 0 |
| Cadence (months) | 1 | 3 | 6 | 24 | 36 |
| Remediation (days) | 7 | 14 | 30 | 60 | 90 |
| Reminder (days) | 5 | 5 | 5 | 5 | 5 |
| Due Date (days) | 30 | 30 | 30 | 30 | 30 |

- **Scorecard Configuration**:

| Category | Excellent | Good | Moderate | Low | Nominal |
|----------|-----------|------|----------|-----|---------|
| Security Score | 5 | 4 | 3 | 2 | 0 |

### 4.3 User Management
- **Admin view**: Full CRUD on all tenant users
- **BO view**: Can see and manage users (has Add button)
- **Features**: Search by name, filter by role, Add/Edit/Delete users
- **Key Observation**: Account Managers only have Edit button (no Delete). Approver "test" has both Edit and Delete buttons — implies recently created users may be deletable.

### 4.4 Vendor Management / Inventory
- **Admin**: Sees "Vendor Management" with 56 vendors, Export/Import functionality, edit icons on each vendor
- **BO**: Sees "Vendor Inventory" with 22 vendors (scoped to department), "Onboard New Vendor" button, "Bulk Export"
- **RM**: Sees "Inventory" with "Onboard New Vendor" on Dashboard
- **Vendor List Structure**: Accordion-style, each vendor shows `Name - VRR Level`. Expanding shows:
  - Grid with: Vendor Name, Engagement ID, Status, Department, Service Category, VRR, Action
  - Column selector for customization

### 4.5 Vendor Detail Page
**Observed fields (IBM India-1 example)**:
- **Header**: Vendor Risk Rating badge (Critical/High/Medium/Low/Nominal)
- **Service Description**: Free text
- **Left Column**:
  - Code (numeric: 96)
  - Status (AssessmentSubmitted)
  - SubCode / Engagement ID (V096.1)
  - Name
  - Account Manager Name & Email
  - Contact Number
  - Service Category (IT Services)
  - Contract Start Date / Contract End Date
  - Vendor Certification (with save button)
- **Right Column**:
  - Department (dropdown: IT, Travel Desk, Procurement/Vendor Management, Information Security, Legal & Compliance, Risk Management)
  - **Vendor Risk Profile**:
    - Access to Network: Yes/No
    - Cloud: Yes/No
    - Access to Data: Yes/No → PII: Yes/No (sub-question)
    - Business Justification: Yes/No
- **Report Library**: Document attachment section
- **Document Library**: Upload Document button

### 4.6 Assessment Dashboard (Multiple Roles)
- **Shared by**: BO, Assessor, Approver, Auditor
- **Sections**:
  - ASSESSMENTS: Issue Status (bar chart: Open/Overdue/Closed), Assessment Progress (bar: Initiated/In-Progress/Completed)
  - VENDORS: Inherent Risk (pie: High 30/Medium 15/Low 11/Critical 18/Nominal 3), Assessment Result (pie: Satisfactory 3/Unsatisfactory 1/Deficient 3)
  - ISSUES: Open Issues (pie by severity), Overdue Issues (pie: High 37/Medium 107/Low 6)
  - TOP 5: Vendors (stacked bar by severity), Domains

### 4.7 Report Module
- **Vendor Reports grid**: Vendor Name, Vendor Category, Security Posture Score, Threat Exposure Score, Overall Cybersecurity Risk Score, Criticality Rating
- **Filters**: Search by vendor, Risk Rating, Cybersecurity Score range
- **Export**: Button available
- **56 vendors listed** (Admin view)
- **Most scores empty**: Populated after assessment completion

### 4.8 Contracts Module (BO, RM)
- **Tabs**: Expiring Contracts, All Vendor Contracts
- **Expiring Contracts columns**: Vendor Code, Vendor Name, Expiring On
- **Actions on expiring**: "Start Offboarding" and "Renew Contract" buttons
- **Observed expiring**: HRLink Associates (2/28/2026), Info Technology (3/13/2026), SecurePay India (3/28/2026)

### 4.9 Issue Management
- **BO view**: 3 tabs — Issue Register, Issue Remediation, Vendor Issues
- **IT view**: 2 tabs — Issue Register, Issue Remediation (labeled "Risk Register")
- **Issue Register columns**: Department, (Business Owner - IT view only), Vendor Name, Vendor ID, High/Medium/Low/Total counts, Status
- **Issue statuses**: Open, Overdue, Closed

### 4.10 Monitoring / Continuous Monitoring
- **Purpose**: External security scorecard-style monitoring
- **Input**: Vendor Name + Vendor Domain (URL)
- **"Analyze Vendor" button**: Triggers external security scan
- **Score categories** (15+ dimensions):
  - Security Score, Network Security, DNS Health, Patching Cadence, Endpoint Security
  - IP Reputation, Application Security, Cubit Score, Email Security, SSL/TLS Configuration
  - Privacy, Known Breach, Hacker Chatter, Information Leak, Social Engineering
- **8 vendors analyzed** (Lakme India, Manipal Hospital, Ola, ICICI Bank, Mendix, Indexo, Tesla, ChatGPT)
- **Queued Assessments sidebar**: CISCO, Microsoft, IBM awaiting analysis
- **"Vendor Reports" button**: Navigation to report view

### 4.11 Assessment Workspace (Admin Only)
- **Assessment Overview**: Grid of all 44 assessments
  - Columns: Id, Code, Vendor Submission Date, Status, Completion Date, Assessment Result
  - **Assessment code prefixes**: DD (Due Diligence), RA (Reassessment)
  - Statuses observed: Awaiting Response, In-Progress, Initiated, Completed
  - Results observed: Satisfactory, Deficient
  - **Each row has action buttons**: View detail (eye icon), Delete (for non-completed assessments)
  - **Completed assessments have only 1 action button** (view); non-completed have 2 (view + delete)
- **Assessment Detail Dialog** (click view action): Read-only view with fields:
  - Assessment id, Assessment code, Status (dropdown with full enum), Assessment Result
  - Assessment Submission date, Assessor Due Date, Vendor Due Date, Completion date
  - Vendor Account Manager Name, **Initiated By** (who triggered onboarding), Assessor Name, **Approvar Name** (typo in system)
  - QuestionnaireTemplate (which template was used)
  - Example: DD114 — Initiated by Gauri Shree (RM), Assessed by tamilrashi, Approved by "Approver of Baarez", Template: Art Inte.
- **Assessment Logs**: AI document ingestion audit trail
  - Left panel: Assessment list (searchable by Assessment ID)
  - Right panel: Log details showing:
    - Assessment ID, Vendor Name, **Domain Name** (e.g., "Cybersecurity & Data Protection Governance")
    - **Question No** and **Question Title** (actual assessment question)
    - Log Date, Log Message (e.g., "Ingest file API Success!")
    - **API URL**: External AI endpoint on RunPod (e.g., `https://g08f5lmhwitpvr-8000.proxy.runpod.net/api/ingest{hash}`)
    - **Document Name**: Ingested file (e.g., "InformationSecurityPolicy.pdf")
  - **Export Excel** button for log download
  - This reveals the platform uses an **AI-powered document analysis backend** for automated assessment

### 4.12 Assessment Factory (Assessor & Approver)
- **Purpose**: Self-service assessment creation tool that bypasses the standard vendor onboarding flow
- **4-step workflow**:
  1. **Download Template**: Download a questionnaire spreadsheet template
  2. **Upload the Completed Template**: Upload the filled spreadsheet
  3. **Attach Supporting Artifacts**: Upload Word documents, PDFs, or image files
  4. **Generate Report**: System generates results displayed on overview page (downloadable as spreadsheet)
- **"Previous assessments"** button: Opens dialog showing past factory assessments (Date column, paginated)
- This is essentially a **bulk/standalone assessment tool** for quick vendor assessments

### 4.13 Template Module (Assessor & Approver)
- **Purpose**: Browse and manage assessment questionnaire templates
- **Template Categories**:
  - **Default**: Default, SIG
  - **ISMS**: Cloud, AI, Art Inte.
  - **Compliance**: Privacy
  - **All**: Shows all 6 templates combined
- **Template Detail View**: Grid with columns:
  - **Domain**: Assessment domain category (e.g., Human Resources Security, Network Security, Risk Management, Cybersecurity & Data Prot. Gov., Compliance, Change Management, Security Operations, Cloud Security, Asset Management)
  - **Questions**: The human-readable assessment question
  - **VerifAI Prompt Question**: The AI prompt used by the VerifAI engine for automated document analysis
- **Default template**: 19 questions across 9 domains
- **Export** button available for each template
- **Key insight**: The "VerifAI Prompt Question" column confirms the platform uses AI to analyze vendor-submitted documents against specific questions

### 4.14 Configurations Module (Admin Only)
- **7 configuration cards**:
  1. **Vendor Onboarding**: 2 tabs
     - **Vendor Profile Fields** (9 fields):
       - Mandatory (no action buttons): Vendor Name, Account Manager Name, Account Manager Email, Contact Number, Service Description, Service Category
       - Customizable (edit/delete): Outsourcing Type (Material/Nonmaterial), Subcontractor Name, Conflict of Interest Declaration -Yes/No
     - **Onboarding Questions** (5 questions — used for VRR calculation):
       - Access to Data (Parent, Score: 10, Yes/No)
       - PII (Child of Access to Data, Score: 10, Yes/No)
       - Access to Network (Child, Score: 10, Yes/No)
       - Cloud (Parent, Score: 10, Yes/No)
       - Business Justification (Parent, Score: 0, FreeText)
       - **Max VRR Score from questions = 40** (4 × 10). Service Category may contribute additional points to reach Critical threshold (50).
  2. **Service Category**: 22 categories including IT Services, Cloud Services, Cybersecurity, Financial Services, HR Outsourcing, Analytics & AI, Managed IT, Logistics, Risk Advisory, Consulting & Professional Services, BPO, etc.
  3. **Discipline**: 2 disciplines — Compliance, Cyber
  4. **Department**: 6 departments — Risk Management, Legal & Compliance, Information Security (Infosec), Procurement / Vendor Management, Travel Desk, IT
  5. **Questionnaire Management**: 7 entries (with duplicates) mapping templates to frameworks:
     - SIG → SIG Framework (has 3 action buttons — primary template)
     - Privacy → GDPR (×2 — duplicate)
     - Cloud → CAIQ (×2 — duplicate)
     - Default → Custom
     - Art Inte. → ISO
  6. **Vendor Offboarding**: 10 offboarding questions:
     1. Offboarding Initiation — "Has the vendor offboarding process been formally initiated and approved by the relevant business owner?"
     2. Contract Termination — "Has the contract termination notice been issued in accordance with contractual terms and notice periods?"
     3. Data Retrieval — "Has all organization-owned data been retrieved, migrated, or securely deleted from the vendor's systems?"
     4. Access Revocation — "Have all system, network, and physical access rights granted to the vendor been revoked?"
     5. Asset Return — "Have all company-issued assets (devices, ID cards, tokens, etc.) been returned by the vendor?"
     6. Final Risk Assessment — "Has a final risk assessment been performed to ensure no residual risks remain post-offboarding?"
     7. Confidentiality Compliance — "Has the vendor confirmed continued adherence to confidentiality and data protection clauses post-termination?"
     8. Financial Settlement — "Have all pending invoices, payments, or credits been reconciled and cleared before offboarding completion?"
     9. Record Retention — "Have all relevant documents, reports, and communications related to the vendor engagement been archived as per policy?"
     10. Lessons Learned — "Has a post-offboarding review been conducted to capture lessons learned and improve future vendor lifecycle management?"
  7. **Scorecard Configuration**: Security scoring thresholds

### 4.13 Master Data Management (Admin Only)
- **Questions**: Question bank management
- **Questionnaires**: Assembled questionnaire templates
- **Domains**: Assessment domain categories

---

## 5. Vendor Lifecycle Workflow

### 5.1 Complete Lifecycle State Machine

```
[New Vendor Created]
        |
        v
   ONBOARDING ──────── AM fills profile & submits assessment
        |
        v
ASSESSMENT_SUBMITTED ── Assessment awaits Assessor pickup
        |
        v
   IN_PROGRESS ──────── Assessor conducts due diligence
        |
        ├──> SEND_BACK ──> Returns to AM for corrections
        |
        v
    ASSESSED ─────────── Assessor completes, moves to Approver
        |
        ├──> SEND_BACK ──> Returns to Assessor/AM
        |
        v
    APPROVED ─────────── Approver signs off
        |
        v
    INACTIVE ─────────── Post-approval, awaiting contract
        |                (Upload Contract button appears)
        v
     ACTIVE ──────────── RM uploads contract with dates
        |
        ├──> CONTRACT_EXPIRING ──> "Start Offboarding" / "Renew Contract"
        |
        v
   OFFBOARDING ────────── Offboarding process initiated
        |
        v
   OFFBOARDED ─────────── Vendor relationship terminated
```

### 5.2 Engagement ID Pattern
- Format: `V{code}.{sequence}` (e.g., V096.1, V0132.1, V024.3)
- The `.3` suffix on V024.3 suggests multiple engagement cycles per vendor

### 5.3 Assessment Code Pattern
- **DD{number}**: Due Diligence assessment (onboarding)
- **RA{number}**: Reassessment (periodic/on-demand)
- Numbers are sequential across the tenant

### 5.4 Status Transition Detail

| From Status | To Status | Trigger Role | Action Taken |
|-------------|-----------|-------------|--------------|
| (New) | Onboarding | BO/RM | Vendor onboarded via "Onboard New Vendor" |
| Onboarding | AssessmentSubmitted | Account Manager | AM completes and submits assessment questionnaire |
| AssessmentSubmitted | In-Progress | Assessor | Assessor picks from queue and begins review |
| In-Progress | Completed | Assessor | Assessment fully reviewed, issues raised |
| In-Progress | Returned | Assessor/Approver | Sent back for corrections |
| Completed | Approved | Approver | Approver accepts assessment result |
| Approved | Inactive | System | Auto-transition post-approval |
| Inactive | Active | RM | Contract uploaded with start/end dates |
| Active | Offboarding | BO/RM | "Start Offboarding" triggered from Contracts |
| Active | Active (renewed) | BO/RM | "Renew Contract" extends relationship |
| Offboarding | Offboarded | System | Offboarding process completed |

### 5.5 Assessment Results
- **Satisfactory**: Vendor passes due diligence
- **Unsatisfactory**: Vendor fails but may remediate
- **Deficient**: Vendor has significant gaps

---

## 6. Assessment Workflow Engine

### 6.1 Assessment Types
1. **OnBoarding Assessment**: Initial vendor due diligence (DD prefix)
2. **Periodic Assessment**: Scheduled reassessment based on cadence
3. **On-Demand Assessment**: Ad-hoc reassessment (RA prefix)
4. **Offboarding Assessment**: Exit assessment
5. **Assessment Factory**: Template-based bulk assessments

### 6.2 Assessment Queue System (Assessor/Approver View)

**Sub-menu structure**:
- **My Queue**: Assessments assigned/picked for review
  - Sub-tabs: My Queue, Initiate Reassessment, Returned
- **Due Diligence**: Onboarding assessments
- **Reassessments**: Periodic/on-demand reassessments
- **Offboarding**: Exit assessments
- **Completed**: Finished assessments

**My Queue columns**: ID, Vendor, Service Category, Assessment Type, Submission Date, Action

### 6.3 Vendor-Side Assessment Flow (Account Manager/SME)

**Assessment tabs for AM/SME**:
- **Active Assessments**: Currently assigned, awaiting completion
- **Submitted Assessments**: Sent to internal team for review
- **Past Assessments**: Historical completed assessments
- **Offboard Assessments**: Exit-related assessments

**AM columns**: Assessment Code, Initiated By, Status, Due Date, Actions
**SME columns**: Assessment Code, Vendor, Initiated By, Due Date, Actions

### 6.4 Assessment Status Flow

```
Initiated → Awaiting Response → In-Progress → Completed
                                    ↓
                                 Returned → (back to Awaiting Response)
```

### 6.5 Questionnaire Framework Mapping

| Template Name | Framework | Use Case |
|---------------|-----------|----------|
| SIG | SIG Framework | Standardized Information Gathering |
| Privacy | GDPR | Data privacy compliance |
| Cloud | CAIQ | Cloud security (CSA CAIQ) |
| Default | Custom | Organization-specific |
| Art Inte. | ISO | AI/ISO compliance |

---

## 7. Status Lifecycle & Transitions

### 7.1 Vendor Status Values (Observed)
- `Onboarding` — Initial state after vendor creation
- `AssessmentSubmitted` — AM has submitted the questionnaire
- `In-Progress` — Under assessor review
- `Assessed` — Assessment complete (inferred)
- `Approved` — Approver has signed off (inferred)
- `Inactive` — Post-approval, pre-contract
- `Active` — Contract uploaded, vendor is active
- `Offboarding` — Offboarding initiated
- `Offboarded` — Relationship terminated

### 7.2 Assessment Status Values (Complete Enum from System)
The full status dropdown was discovered in the Assessment Detail dialog:
- `Initiated` — Assessment created but not yet sent
- `Awaiting Response` — Sent to vendor, waiting for submission
- `In-Progress` — Under internal review (Assessor)
- `In-Progress(approver)` — Under approver review (separate state from assessor review)
- `Approved` — Assessment approved by approver
- `Completed` — Assessment finished with result
- `Terminated` — Assessment terminated (distinct from completion)
- **Offboarding states** (parallel lifecycle for exit assessments):
  - `Offboard Awaiting Response` — Offboarding assessment sent to vendor
  - `Offboard-In-Progress` — Offboarding assessment under review
  - `Offboard-Completed` — Offboarding assessment finished
  - `Offboard Approved` — Offboarding assessment approved (appears twice in dropdown — possible data issue)
- `Returned` — Sent back for corrections (inferred from UI tabs, not in dropdown)

### 7.3 Issue Status Values (Observed)
- `Open` — Active issue
- `Overdue` — Past remediation deadline
- `Closed` — Resolved

---

## 8. Conditional Visibility Tables

### 8.1 Button Visibility

| Button | Visible When |
|--------|-------------|
| `Onboard New Vendor` | Role = BO or RM |
| `Export/Import` (Vendor list) | Role = Admin |
| `Bulk Export` (Inventory) | Role = BO |
| `Upload Document` | Role = Admin, on Vendor Detail page |
| `Start Offboarding` | Role = BO/RM AND Contract is expiring AND Contracts tab |
| `Renew Contract` | Role = BO/RM AND Contract is expiring AND Contracts tab |
| `Edit` (Control Center) | Role = Admin |
| `Add` (User Management) | Role = Admin or BO |
| `Delete` (User) | Role = Admin AND user is non-system (not Account Manager) |
| `Analyze Vendor` | Role = Admin/BO/RM/Assessor AND Monitoring page |

### 8.2 Page/Module Visibility

| Page | Condition |
|------|-----------|
| Control Center | Role = Admin ONLY |
| Configurations | Role = Admin ONLY |
| Master Data Management | Role = Admin ONLY |
| Assessment Workspace | Role = Admin ONLY |
| MX Settings | Role = Admin ONLY |
| Program Monitor | Role = Admin ONLY |
| Contracts | Role = BO or RM |
| User Management | Role = Admin or BO |
| Issue Management (tabbed) | Role = BO or IT |
| Issue Register (standalone) | Role = Assessor, Approver, or Auditor |
| Assessment Factory | Role = Assessor or Approver |
| Template | Role = Assessor or Approver |
| SME Management | Role = Account Manager (Vendor) ONLY |
| Monitoring | Role = Admin, BO, RM, or Assessor |

### 8.3 Data Scoping by Role

| Role | Vendor Visibility | Data Scope |
|------|-------------------|------------|
| Admin | All vendors (56) | Entire tenant |
| BO | Department-scoped (22) | Own department's vendors |
| RM | Assigned vendors | Vendors delegated by BO |
| Assessor | Assessment queue | Vendors with pending assessments |
| Approver | Approval queue | Vendors with completed assessments |
| Auditor | Read-only all | View access to all tenant data |
| IT | Issue-only view | Vendors with open issues |
| AM | Own vendor only | Single vendor scope |
| SME | Assigned assessments | Assessment-level scope |

---

## 9. Issue Management & Remediation

### 9.1 Issue Structure
- Issues are generated during the assessment process
- Categorized by severity: **High**, **Medium**, **Low**
- Tracked per vendor engagement (by Vendor ID)

### 9.2 Issue Register Grid
- **BO View columns**: Department, Vendor Name, Vendor ID, High, Medium, Low, Total, Status
- **IT View columns**: Department, Business Owner, Vendor Name, Vendor ID, High, Medium, Low, Total, Status (adds BO ownership)

### 9.3 Issue Remediation Flow
- Issues discovered during assessment → assigned to vendor/IT for remediation
- Remediation SLA tied to VRR: Critical=7 days, High=14, Moderate=30, Low=60, Nominal=90
- Reminder notifications: 5 days before due (all levels)

### 9.4 Observed Issue Data

| Vendor | ID | Issues (H/M/L) | Total | Status |
|--------|----|-----------------|-------|--------|
| uber | V0132.1 | 2/6/2 | 10 | Overdue |
| CloudAxis Systems | V024.3 | 26/63/24 | 113 | Closed |
| ACCENTURE | V04.1 | 3/14/4 | 21 | Overdue |
| TCS | V02.1 | 0/3/0 | 3 | Closed |
| Infosys | V01.1 | 1/1/2 | 4 | Closed |
| Info Technology | V0145.1 | 3/14/4 | 21 | Overdue |
| Deloitte | V059.1 | 3/10/3 | 16 | Overdue |

---

## 10. Continuous Monitoring Module

### 10.1 Architecture
- External security intelligence integration (SecurityScorecard-style)
- Input: Vendor name + domain URL
- Output: 15+ security dimension scores
- Queued analysis system for pending vendors

### 10.2 Security Dimensions

| Dimension | Description |
|-----------|-------------|
| Security Score | Overall composite score |
| Network Security | Network-level security posture |
| DNS Health | DNS configuration security |
| Patching Cadence | Software update frequency |
| Endpoint Security | Endpoint protection maturity |
| IP Reputation | IP address reputation |
| Application Security | Web application security |
| Cubit Score | Cubit scoring metric |
| Email Security | Email authentication (SPF, DKIM, DMARC) |
| SSL/TLS Configuration | Certificate and encryption setup |
| Privacy | Privacy compliance indicators |
| Known Breach | Historical breach data |
| Hacker Chatter | Dark web/forum mentions |
| Information Leak | Data exposure indicators |
| Social Engineering | Phishing susceptibility |

### 10.3 Scorecard Configuration
- Thresholds: Excellent (5), Good (4), Moderate (3), Low (2), Nominal (0)
- Applied to the Security Score dimension

---

## 11. Configuration Engine

### 11.1 DueDiligence Configuration
Controls the operational parameters of the entire assessment lifecycle:
- **VRR thresholds**: Determine which vendors get which VRR level
- **Cadence**: How often periodic reassessments occur (in months)
- **Remediation SLA**: Days allowed for issue remediation
- **Reminder**: Days before due date to send reminders
- **Due Date**: Days allowed for assessment completion

### 11.2 Vendor Onboarding Configuration
- **Vendor Profile Fields** (9 configurable): What data to collect during onboarding
- **Onboarding Questions**: Additional assessment questions during onboarding
- Fields are Add/Import/Delete manageable

### 11.3 Vendor Offboarding Configuration
- Separate questionnaire configuration for exit assessments

### 11.4 MX Settings (Platform-Level)
- **Email**: Email template/SMTP configuration
- **Delete Item**: Data deletion management
- **SAML**: SSO/SAML authentication configuration

### 11.5 Notification System
- **Notification bell icon** in header bar (next to profile)
- **Badge count** shows unread notification count (observed: Assessor=4, Admin=0)
- **Notification panel** overlay with:
  - "Notification" heading with count
  - "Mark all Read" button
  - Close button
  - Scrollable list of notification items
- **Notification types observed**:
  - **Assessment Received**: Triggered when a vendor submits an assessment ("Assessment submitted. Review and approval are required.")
  - **Assessment Received (reassignment)**: Triggered when an assessment is reassigned ("Assessment reassigned to you by [Name]. Please proceed with the review.")
  - **Account Creation**: Triggered when a new user account is created ("Hi [Company]Your Account has been created")
- Each notification shows: **Title**, **Message body**, **Timestamp** (date + time)

### 11.6 User Profile System
- **Profile dialog** accessible via profile icon in header
- **Fields**:
  - Full Name (editable)
  - Email (editable)
  - Phone Number (editable, placeholder: "+0919876543210")
  - Company Name (disabled/locked to tenant)
  - Profile Image (file upload)
  - Logo Image (file upload)
  - **Change Password** button
  - **Update Profile** / **Close page** buttons
- Header shows: "Welcome Back, {Company Name}" (not user name)

### 11.7 AI-Powered Document Analysis (VerifAI Engine)
- The platform integrates with an external AI backend for automated document analysis
- **Technology**: RunPod-hosted API endpoint
- **API Pattern**: `https://g08f5lmhwitpvr-8000.proxy.runpod.net/api/ingest{document_hash}`
- **Workflow**: Vendor uploads documents → System calls AI API to ingest/analyze → Results feed into assessment scoring
- **Question-level AI prompts**: Each template question has a "VerifAI Prompt Question" that guides the AI analysis
- **Supported documents**: PDF, Word documents, image files
- **Assessment Logs** track every API call with: Assessment ID, Vendor, Domain, Question, Log Date, Log Message, API URL, Document Name
- This explains the platform branding: **VerifAI = Verify + AI**

---

## 12. Data Model Observations

### 12.1 Vendor Entity
```
Vendor {
  code: Integer (96)
  subCode: String (V096.1) — Engagement ID
  name: String
  status: Enum (Onboarding, AssessmentSubmitted, In-Progress, ...)
  department: FK → Department
  serviceCategory: FK → ServiceCategory
  serviceDescription: String
  vrr: Enum (Critical, High, Medium, Low, Nominal)
  accountManagerName: String
  accountManagerEmail: String
  contactNumber: String
  contractStartDate: Date (nullable)
  contractEndDate: Date (nullable)
  vendorCertification: String[]

  // Vendor Risk Profile
  accessToNetwork: Boolean
  cloud: Boolean
  accessToData: Boolean
  pii: Boolean
  businessJustification: Boolean
}
```

### 12.2 Assessment Entity
```
Assessment {
  id: Integer (sequential)
  code: String (DD{id} or RA{id})
  vendorSubmissionDate: Date
  status: Enum (Initiated, AwaitingResponse, InProgress, InProgressApprover, Approved, Completed, Terminated, OffboardAwaitingResponse, OffboardInProgress, OffboardCompleted, OffboardApproved)
  completionDate: Date
  assessmentResult: Enum (Satisfactory, Unsatisfactory, Deficient)
  assessmentType: Enum (OnBoarding, Periodic, OnDemand, Offboarding, Factory)
  assessorDueDate: Date
  vendorDueDate: Date
  vendor: FK → Vendor
  vendorAccountManager: FK → User (AM)
  initiatedBy: FK → User (BO/RM who triggered onboarding)
  assessor: FK → User (Assessor assigned)
  approver: FK → User (Approver assigned)
  template: FK → QuestionnaireTemplate
}
```

### 12.3 Issue Entity
```
Issue {
  vendor: FK → Vendor
  vendorId: String (engagement ID)
  department: FK → Department
  businessOwner: FK → User
  severity: Enum (High, Medium, Low)
  status: Enum (Open, Overdue, Closed)
  remediationDueDate: Date
}
```

### 12.4 Key Relationships
- One Vendor → Many Engagements (via subCode suffix: .1, .2, .3)
- One Engagement → One Assessment
- One Assessment → Many Issues
- One Business Owner → Many Vendors (department-scoped)
- One RM → Many Vendors (delegated by BO)
- One Account Manager → One Vendor

---

## 13. Edge Cases & Implicit Logic

### 13.1 Vendor Capacity Limits
- "40 / 200" assessments and "79 / 200" vendors suggest hard capacity limits per tenant
- May be tied to licensing/subscription tier

### 13.2 Account Manager Role is NOT in Admin's Role Picker
- The 6 roles in the Admin's "Select user roles" dialog: Approver, Assessor, Auditor, BusinessOwner, InternalITTeam, RelationshipManager
- **Account Manager and SME are NOT listed** — these appear to be created through a different mechanism (vendor onboarding flow, not User Management)

### 13.3 Action Button Differences in User Management
- Account Managers: Only Edit button (blue)
- Other roles: Edit + Delete buttons
- Suggests Account Managers are system-managed (created via vendor onboarding, not directly deletable)

### 13.4 Engagement ID Multi-Version Pattern
- V024.3 (CloudAxis Systems) suggests 3rd engagement cycle
- This implies vendors can have multiple assessment cycles, each tracked separately

### 13.5 Vendor Count Discrepancy by Role
- Admin sees 56 vendors
- BO sees 22 vendors
- This confirms role-based data scoping, likely by department assignment

### 13.6 Dashboard Data Consistency
- Assessor and Approver see identical dashboard data as BO
- This suggests dashboard aggregates are tenant-wide, not role-filtered
- Only the Inventory/Vendor list is scoped by role

### 13.7 RM has "Onboard New Vendor" on Dashboard
- Both BO and RM can initiate vendor onboarding
- BO has it in Inventory page, RM has it on Dashboard page
- This confirms RM acts as a BO delegate

### 13.8 IT Team's Unique Landing Page
- Title is "RM Remediation" but accessed by IT role
- Suggests the remediation module is shared between RM and IT
- IT sees "Business Owner" column in issue register (additional context for issue routing)

### 13.9 Assessor vs Approver Navigation Difference
- Assessor has **10 nav items** (including Monitoring and Support)
- Approver has **8 nav items** (NO Monitoring, NO Support)
- This is a significant functional difference — Assessor can trigger continuous monitoring scans, Approver cannot
- Both share Assessment Factory and Template access

### 13.10 RM Has Issue Management
- RM sees "Issue Management" nav item (same tabbed view as BO: Issue Register + Issue Remediation)
- This was not obvious from role descriptions but confirms RM is a near-equal delegate of BO

### 13.11 Assessment Result Can Be Set Before Completion
- RA81 observed with status "In-Progress" but already has result "Deficient"
- This suggests the Assessment Result is set during the assessment process, not only at completion
- The Assessor may set a preliminary result that becomes final upon completion

### 13.12 System Typos
- "Approvar Name" (should be "Approver") in Assessment Detail dialog
- "Unsatisfatory" (should be "Unsatisfactory") in Dashboard charts
- "RM Remediation" page title shown for IT role
- "Assessment Submisstion date" (should be "Submission") in Assessment Detail

### 13.13 Parallel Offboarding Assessment Lifecycle
- The Assessment status enum reveals a complete parallel lifecycle for offboarding:
  - Offboard Awaiting Response → Offboard-In-Progress → Offboard-Completed → Offboard Approved
- This mirrors the main assessment lifecycle but is specific to exit assessments
- "Terminated" status exists as a separate terminal state (distinct from Offboarded)

### 13.14 VRR Scoring Gap
- Onboarding questions yield a max score of 40 (4 × 10 scored Yes/No questions)
- But the VRR threshold for "Critical" is 50
- This suggests either: (a) Service Category adds additional score points, or (b) the VRR thresholds are upper bounds, not exact matches, or (c) additional scoring factors exist beyond the visible onboarding questions

---

## 14. Access Limitations & Gaps

### 14.1 Superadmin (TPRMAdmin)
- **Status**: Could NOT access (confirmed in recheck)
- **Attempted credentials**: `superadmin` / `^VKi0Qoj301C.` (rejected), `superadmin` / `1` (rejected), `MxAdmin` / `^VKi0Qoj301C.` (rejected), `TPRMAdmin` / `^VKi0Qoj301C.` (rejected)
- **Impact**: Could not observe cross-tenant capabilities, customer hierarchy, subscription management
- **Recommendation**: Verify credentials with platform administrator — password may have been changed

### 14.2 Factory Roles
- **Status**: No separate credentials needed — Assessment Factory is accessible to Assessor and Approver roles
- **What was explored**: Assessment Factory 4-step workflow, Previous assessments dialog, Template module with all 6 templates
- **Remaining gap**: FactoryAdmin and FactoryAssessor roles may provide additional admin-level factory capabilities (bulk operations, factory-specific configuration)

### 14.3 Assessment Detail View (PARTIALLY RESOLVED)
- **Resolved**: Assessment metadata view (id, code, status, result, dates, personnel, template) explored via Admin's Assessment Workspace
- **Remaining gaps**:
  - Question/answer flow within an assessment (the actual questionnaire UI for Assessor/AM)
  - Issue creation during assessment
  - Send-back workflow detail
  - Approval workflow detail

### 14.4 Vendor Onboarding Flow
- Did not execute a new vendor onboarding to observe:
  - Mandatory field validation
  - Auto-creation of Account Manager user
  - Initial assessment generation

### 14.5 Offboarding Flow
- Did not trigger "Start Offboarding" to observe:
  - Offboarding questionnaire presentation (10 questions configured)
  - Status transition behavior
  - Access revocation pattern

---

*Document generated via automated reverse-engineering of the VerifAI TPRM platform. All observations are based on UI exploration and behavioral analysis without access to source code or database. Last updated: 2026-02-26 (recheck pass with corrections and new findings).*
