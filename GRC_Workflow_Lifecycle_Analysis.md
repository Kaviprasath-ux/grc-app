# GRC Application - Workflow & Lifecycle Analysis

## Document Overview
This document provides a comprehensive analysis of all workflows, lifecycles, and role-based actions within the GRC (Governance, Risk, and Compliance) Application based on the Technical Documentation.

---

## Table of Contents
1. [Application Roles Overview](#1-application-roles-overview)
2. [Governance (Policy/Standard/Procedure) Lifecycle](#2-governance-policystandardprocedure-lifecycle)
3. [Evidence Lifecycle](#3-evidence-lifecycle)
4. [Risk Management Lifecycle](#4-risk-management-lifecycle)
5. [Exception Management Lifecycle](#5-exception-management-lifecycle)
6. [Business Impact Analysis (BIA) Lifecycle](#6-business-impact-analysis-bia-lifecycle)
7. [Control Lifecycle](#7-control-lifecycle)
8. [Framework & Compliance Lifecycle](#8-framework--compliance-lifecycle)
9. [Asset Management Lifecycle](#9-asset-management-lifecycle)
10. [KPI Lifecycle](#10-kpi-lifecycle)

---

## 1. Application Roles Overview

Based on the documentation, the following roles interact with the system:

| Role | Primary Responsibilities |
|------|-------------------------|
| **GRC Administrator** | System configuration, master data management, framework setup |
| **Security Manager** | Control management, policy oversight, compliance monitoring |
| **Risk Owner** | Risk identification, assessment, treatment planning |
| **Department Head/Reviewer** | Approval workflows, departmental oversight |
| **Assignee/Contributor** | Task execution, evidence collection, document preparation |
| **Approver** | Review and approval of submissions |
| **Process Owner** | Process documentation, BIA execution |

---

## 2. Governance (Policy/Standard/Procedure) Lifecycle

### 2.1 Governance Document Types
- **Policy** - High-level organizational directives
- **Standard** - Technical specifications and requirements
- **Procedure** - Step-by-step operational instructions

### 2.2 Status Flow
```
Not Uploaded --> Draft --> Submitted for Approval --> Approved --> Published
                   ^                                      |
                   |                                      |
                   +---------- Sent Back (Resend) --------+
```

### 2.3 Detailed Workflow Steps

#### Step 1: Create Governance Document (3-Step Wizard)
| Step | Name | Actions | Role |
|------|------|---------|------|
| 1 | Policy Information | Enter title, category (Policy/Standard/Procedure), description, select department | Creator/Assignee |
| 2 | Assignments & Details | Link controls, select domain, assign owner | Creator/Assignee |
| 3 | Review Information | Set review frequency, recurrence, preview & save | Creator/Assignee |

**Microflows:** `ACT_CreatePolicy_Step1`, `ACT_PolicyStep2`, `ACT_PolicyStep3`, `ACT_SavePolicy`

#### Step 2: Assign Approvers
- Select department to filter available approvers
- Choose approver(s) from the filtered list
- Approvers are notified via email

**Microflows:** `GovernanceApprover_Email`, `OC_Set_ReviewDate_Policy`

#### Step 3: Upload Document/Generate with AI
- **Manual Upload:** Upload existing policy document
- **AI Generation:** Use AI to generate policy document from template
- **Link from Vault:** Select existing document from Information Security Vault

**Microflows:** `ACT_UploadPolicyDocument`, `CWS_GereratePolicy_2`

#### Step 4: Submit for Approval
| Action | Performer | Result |
|--------|-----------|--------|
| Submit for Approval | Creator/Assignee | Status changes to "Awaiting Approval", notification sent to approvers |

**Microflows:** `ACT_SubmitForApproval_Policy`, `SUB_CreateActivityLog`

#### Step 5: Approver Actions
| Action | Performer | Result |
|--------|-----------|--------|
| **Approve** | Approver | Status changes to "Approved", AI ingestion triggered |
| **Send Back (Resend)** | Approver | Status reverts to "Draft", comments sent to creator |

**Microflows:**
- Approve: `ACT_ApprovePolicy`, `CWS_IngestPolicyDocument`
- Resend: `ACT_Resend_Policy`

#### Step 6: Publish
| Action | Performer | Result |
|--------|-----------|--------|
| Add Signature | Authorized Publisher | Digital signature added |
| Publish | Authorized Publisher | Status changes to "Published", compliance checks run |

**Microflows:** `ACT_Open_policiesSignature`, `ACT_PublishPolicy`, `SUB_Check_ControlCompliant`

#### Step 7: Post-Publication Actions
- **Unpublish:** Revert published document back to draft
- **AI Review:** Run AI compliance review on document
- **View Activity Logs:** Track all actions performed

### 2.4 Activity Logging
All actions are logged automatically via `SUB_CreateActivityLog`:
- Document creation
- Status changes
- Approvals/Rejections
- Publishing events
- AI reviews

---

## 3. Evidence Lifecycle

### 3.1 Status Flow
```
Not Uploaded --> Draft --> Published
                   |
                   v
            [KPI Tracking]
                   |
                   v
    Scheduled --> Achieved/Missed/Overdue
```

### 3.2 Detailed Workflow Steps

#### Step 1: Create Evidence (3-Step Wizard)
| Step | Name | Actions | Role |
|------|------|---------|------|
| 1 | Evidence Details | Enter title, description, select department, assign owner | Creator |
| 2 | Controls | Link related controls from domain | Creator |
| 3 | Review Information | Set review frequency, KPI settings, preview & save | Creator |

**Microflows:** `ACT_Create_Evidence`, `ACT_EvidenceDetail_Step2`, `ACT_EvidenceDetail_Step3`, `ACT_Save_Evidence`

#### Step 2: Configure KPI (if applicable)
- Enable KPI tracking (`KPI_Required = true`)
- Set Expected KPI Value
- Define KPI Objective, Data Source, Measurement Formula

#### Step 3: Add Attachments
| Action | Performer | Result |
|--------|-----------|--------|
| Add Attachment | Assignee | Upload supporting documents |
| Link Artifacts | Assignee | Link existing artifacts from vault |

**Microflows:** `ACT_AddEvidenceAttachment`, `ACT_LinkArtifacts`

#### Step 4: Publish Evidence
| Action | Performer | Result |
|--------|-----------|--------|
| Add Signature | Publisher | Digital signature required |
| Publish | Publisher | Status changes to "Published", control compliance updated |

**Microflows:** `ACT_OpenEvidenceSignature`, `ACT_Publish_Evidence`, `SUB_Check_ControlCompliant`

#### Step 5: AI Review (Optional)
- Start AI Review to analyze evidence document
- AI validates evidence against control requirements
- Results displayed for review

**Microflows:** `ACT_StartAIReview_Evidence_Delay`, `CWS_IngestEvidenceDocument`, `CWS_EvidenceQuery`

### 3.3 Evidence Validation Workflow
```
Evidence Created --> Submit for Validation --> Validated
                           |                      |
                           v                      v
                      Send Back            [Published]
                           |
                           v
                    Resubmit with Comments
```

| Action | Performer | Microflow |
|--------|-----------|-----------|
| Submit for Validation | Assignee | `ACT_SubmitforValidation` |
| Validate | Reviewer | `ACT_Validated_EvidenceCycle` |
| Send Back | Reviewer | `ACT_SentBack_EvidenceCycle` |
| Resubmit | Assignee | `ACT_ReSubmitforValidationWithComment` |

---

## 4. Risk Management Lifecycle

### 4.1 Risk Status Flow
```
                                    +---> Treat --+
                                    |             |
Open --> Assessment Pending --> Assessed --> Transfer --> Awaiting Approval --> Completed
                                    |             |
                                    +---> Avoid ---+
                                    |             |
                                    +---> Accept --+
```

### 4.2 Risk Assessment Workflow (6-Step Wizard)

#### Step 1: Risk Context
- Define risk context and scope
- Link to Asset or Process

**Page:** `RiskAssessment_Step1`

#### Step 2: Likelihood Assessment
- Select likelihood rating based on predefined scale
- Historical data consideration

**Page:** `RiskAssessment_Step2`
**Microflow:** `ACT_Set_RiskAsessLikelihoodRating`

#### Step 3: Impact Assessment
- Assess impact across multiple categories
- Calculate impact rating

**Page:** `RiskAssessment_Step3`
**Microflow:** `ACT_ShowRiskAssessment_Step3`

#### Step 4: Vulnerability Assessment
- Select vulnerability rating
- Consider existing controls

**Page:** `RiskAssessment_Step4`
**Microflow:** `ACT_Set_RiskAsessVulenarbiltyRating`

#### Step 5: Risk Rating Calculation
- **Inherent Risk Rating** = Impact x Likelihood x Vulnerability
- System calculates score and displays on gauge chart
- Due date calculated based on risk score range

**Page:** `RiskAssessment_Step5`
**Microflow:** `DC_CrateeGouzeHelperRiskAssessment`

#### Step 6: Risk Summary
- View Inherent Risk Rating
- View Overall Control Rating
- Calculate Residual Risk Rating
- **Residual Risk** = Inherent Risk adjusted by Control Effectiveness

**Page:** `RiskAssement_Summary`
**Microflows:** `DS_GaugeChartHelper_OverallControlRating`, `DS_GaugeChartHelper_ResidualRiskRating`

### 4.3 Risk Response Strategy Workflow

#### Response Types and Status Flow:
Each response type (Treat, Transfer, Avoid, Accept) follows:
```
Open --> In-Progress --> Awaiting Approval --> Completed
```

#### Actions by Role:

| Action | Performer | Description | Microflow |
|--------|-----------|-------------|-----------|
| Create Risk Response | Risk Owner | Select response strategy, plan controls | `ACT_SaveRiskresponse` |
| Add Planned Controls | Risk Owner | Link or create new controls | `ACT_Control_New_Step1` |
| Submit for Approval | Risk Owner | Send to approver for review | `VAL_SubmitForApprovslRisk` |
| Approve | Approver | Approve risk response plan | `ACT_ApproveRisk` |
| Send Back | Approver | Request changes with comments | `ACT_SentBack_RiskResponse` |
| Respond/Update Status | Risk Owner | Change risk status | `ACT_ChangeRiskStatus` |

### 4.4 Risk Treatment Planning
When response is "Treat":
- **Planned Controls:** Add new or existing controls to mitigate risk
- **Budget Allocation:** Track Estimated Budget vs Amount Used
- **Timeline Tracking:** Monitor Days Remaining, Overdue Days
- **Completion Percentage:** Track progress of each planned control

**Charts Available:**
- Risk Treatment Chart (completion %)
- Budget Allocation vs Used
- Days Remaining Chart
- Residual Risk Rating
- Planned Residual Risk Rating

### 4.5 Risk Reassessment
After a risk is closed, it can be reassessed:

**Microflow:** `ACT_ShowRiskAssessment_ReAssess`

---

## 5. Exception Management Lifecycle

### 5.1 Exception Types
- **Policy Exception** - Deviation from policy requirements
- **Control Exception** - Deviation from control implementation
- **Compliance Exception** - Deviation from compliance requirements

### 5.2 Status Flow
```
Pending --> Approved --> Authorized --> Submitted for Closure --> Closed
    |          |
    |          v
    |      Risk Accepted
    |          |
    +--------> Denied
               |
               v
           Overdue
```

### 5.3 Detailed Workflow Steps

#### Step 1: Create Exception
| Field | Description |
|-------|-------------|
| Category | Policy/Control/Compliance |
| Department | Select department |
| Approver | Select from department approvers |
| Justification | Reason for exception |
| Duration | Exception validity period |

**Microflow:** `ACT_Create_Exception`, `ACT_SaveException`

#### Step 2: Approval Process
| Action | Performer | Result | Microflow |
|--------|-----------|--------|-----------|
| Approve | Approver | Status → Approved | `ACT_ApproveException` |
| Deny | Approver | Status → Denied, requires justification | `ACT_DenyException` |

#### Step 3: Authorization
| Action | Performer | Result | Microflow |
|--------|-----------|--------|-----------|
| Authorize | Authorized User | Status → Authorized | `ACT_AuthorizedException` |

#### Step 4: Create Compensating Controls
- Define compensating controls to mitigate exception risk
- Link controls to exception

**Page:** `CreateCompensatingControls`

#### Step 5: Closure Process
| Action | Performer | Result | Microflow |
|--------|-----------|--------|-----------|
| Attach Proof of Closure | Assignee | Upload closure documentation | `ACT_AddExceptionAttachment` |
| Submit for Closure | Assignee | Status → Submitted for Closure | `ACT_ExceptionSubmitForClosure` |
| Close Exception | Approver | Status → Closed | `ACT_ExceptionClose` |

### 5.4 Exception Resend (Send Back)
- Approver can send back exception with comments
- Owner reviews comments and resubmits

**Microflows:** `ACT_Resend_Exception`, `ACT_Resend_Exception_FromOwner`

---

## 6. Business Impact Analysis (BIA) Lifecycle

### 6.1 Status Flow
```
Process Created --> BIA Assessment Started --> Submit for Approval --> Approved --> Completed
                                                      |
                                                      v
                                                 Sent Back
                                                      |
                                                      v
                                              Review & Resubmit
```

### 6.2 Detailed Workflow Steps

#### Step 1: Create Process (3-Step Wizard)
| Step | Name | Actions |
|------|------|---------|
| 1 | Info | Process name, description, department |
| 2 | Process Flow | Define process flow diagram |
| 3 | Process RACI | Define Responsible, Accountable, Consulted, Informed |

**Microflows:** `ACT_AddNewProcess`, `ACT_ProcessStep2`, `ACTProcessStep3`, `NaN_saveprocess`

#### Step 2: Perform BIA
- Click "Perform BIA" button on process
- Navigate to BIA assessment page
- Rate each category (Confidentiality, Integrity, Availability, etc.)

**Microflow:** `Sub_Create_BIAAssessment_2`

#### Step 3: Calculate BIA Rating
- System calculates BIA Risk Rating based on selected ratings
- Scoring methods: High of All, Addition of All, Product of All

**Microflow:** `CAL_BIARiskRating_Process`

#### Step 4: Submit for Approval
| Action | Performer | Description |
|--------|-----------|-------------|
| Select Department | User | Filter available approvers |
| Select Approver | User | Choose from department approvers |
| Submit | User | Send to approver |

**Microflow:** `ACT_SubmitForApprovalProcess`

#### Step 5: Approver Actions
| Action | Result | Microflow |
|--------|--------|-----------|
| Approve | Process BIA completed, View Only mode | `ACT_ApprovedProcess` |
| Send Back | Returns to user with comments | `ACT_SentBack_BIA` |

---

## 7. Control Lifecycle

### 7.1 Control Status
- **Not Applicable** - Control not in scope
- **Not Started** - Implementation not begun
- **Ongoing** - Implementation in progress
- **Implemented** - Fully implemented

### 7.2 Compliance Status
- **Compliant** - All requirements met (Evidence + Policy published)
- **Partially Compliant** - Some requirements met
- **Non-Compliant** - Requirements not met

### 7.3 Control Creation (3-Step Wizard)

| Step | Name | Fields | Role |
|------|------|--------|------|
| 1 | Control Information | Control ID, Title, Description, Domain, Functional Grouping | Creator |
| 2 | Assignments & Details | Department, Assignee, Owner, Nature of Implementation | Creator |
| 3 | Review Information | Review Frequency, Start Date, Target Date | Creator |

**Microflows:** `ACT_Control_New_Step1`, `ACT_Control_New_Step2`, `ACT_Control_New_Step3`, `ACT_Save_Control`

### 7.4 Control Compliance Calculation
A control is marked **Compliant** when:
1. All linked Evidence has status = "Published"
2. All linked Policies have status = "Published"

**Microflow:** `SUB_Check_ControlCompliant`

### 7.5 Control Linkages
Controls can be linked to:
- Requirements (Framework)
- Policies/Standards/Procedures
- Evidence
- Risks
- Exceptions

---

## 8. Framework & Compliance Lifecycle

### 8.1 Framework Setup Workflow

#### Step 1: Create Framework
- Enter Framework Name, Description, Version
- Select Framework Type

**Microflow:** `ACT_CreateNewFramework`, `ACT_SaveFrameworks_3`

#### Step 2: Import Requirements
- Download template
- Fill requirement details
- Import Excel file
- Optionally use AI to get control codes

**Microflows:** `ACT_Import_Requirement`, `CWS_GetControlCode`

#### Step 3: Link Controls to Requirements
- Select controls per requirement
- Define scope (In Scope/Not in Scope)

**Microflow:** `ACT_SecurityManager_SelectControl`

### 8.2 Statement of Applicability (SOA)
- View all requirements with linked controls
- Check compliance status per requirement
- Export SOA report

**Microflow:** `ACT_ExportRequirements`

### 8.3 Compliance Calculation
```
Compliance % = (Compliant Controls / Total Controls) x 100
```

**Microflows:** `DS_FrameworkControlChart`, `CAL_CompliantornOt`

---

## 9. Asset Management Lifecycle

### 9.1 Asset Inventory Workflow

#### Step 1: Create Asset
| Field | Description |
|-------|-------------|
| Asset Name | Unique identifier |
| Category | Asset category (Hardware, Software, etc.) |
| Subcategory | Specific classification |
| Asset Group | Grouping for management |
| Owner | Responsible person |
| Life Cycle Status | Current status in lifecycle |

**Microflow:** `ACT_Create_Asset_New`, `ACT_SaveAssestInventory`

### 9.2 Asset Classification Workflow

#### Step 1: Create Classification
- Define Sensitivity level
- Rate Confidentiality, Integrity, Availability (CIA)

#### Step 2: CIA Rating Calculation
- Scoring methods: High of All, Addition of All, Product of All
- System calculates overall classification

**Microflow:** `ACT_AssetClassification`

#### Step 3: AI Risk Generation
- After classification, generate AI-based risks
- System identifies potential threats and vulnerabilities

**Microflow:** `ACTGenerateAssetRisk`, `CWS_GenerateProcessAssessRisk`

---

## 10. KPI Lifecycle

### 10.1 KPI Status Flow
```
Scheduled --> Achieved (if Actual >= Expected)
          --> Missed (if Actual < Expected)
          --> Overdue (if past Review Date without data)
```

### 10.2 KPI Configuration
- Enable KPI on Evidence or Process (`KPI_Required = true`)
- Set Expected KPI Value
- Define KPI Objective, Data Source, Measurement Formula

### 10.3 KPI Tracking Workflow

#### Monthly/Quarterly/Yearly Entry:
| Action | Performer | Description |
|--------|-----------|-------------|
| Enter Actual Value | Assignee | Input achieved KPI score |
| Upload Support Document | Assignee | Attach proof of achievement |
| Save | Assignee | System calculates status |

**Microflow:** `ACT_SaveKPIScore`

#### Status Calculation:
```
If Expected > Actual → Missed
If Expected <= Actual → Achieved
If Review Date > Current Date (no data) → Overdue
Else → Scheduled
```

### 10.4 KPI Planned Actions (for Missed KPIs)
When KPI status is "Missed":

| Action | Performer | Microflow |
|--------|-----------|-----------|
| Raise Planned Action | Assignee | `ACT_RaiseActionPlan` |
| Create Action | Assignee | `ACT_Create_NewPlannedAction_EvidenceKPI` |
| Submit for Approval | Assignee | `ACT_saveplannedContolaction` |
| Approve | Approver | `ACT_ApprovedPlannedKPIAction` |
| Send Back | Approver | `ACT_SentBack_PlannedKPIAction` |

---

## Summary: Role-Action Matrix

| Workflow | Creator | Assignee | Approver | Publisher |
|----------|---------|----------|----------|-----------|
| **Governance** | Create, Edit | Upload Docs | Approve/Resend | Publish |
| **Evidence** | Create | Add Attachments | Validate | Publish |
| **Risk** | Create | Assess, Treat | Approve/Resend | - |
| **Exception** | Create | Add Compensating Controls | Approve/Deny/Authorize | Close |
| **BIA** | Create Process | Perform BIA | Approve/Resend | - |
| **Control** | Create | Implement | - | - |
| **Framework** | Create, Import | Link Controls | - | - |
| **Asset** | Create | Classify | - | - |
| **KPI** | Configure | Enter Values | Approve Actions | - |

---

## Activity Logging

All workflows maintain complete audit trails via `SUB_CreateActivityLog`:
- User who performed action
- Timestamp
- Action type
- Before/After values
- Comments (if applicable)

Viewable via Activity Log pages for each module.

---

## Notifications & Emails

The system sends automated notifications for:
- Task assignments
- Approval requests
- Approvals/Rejections
- Status changes
- Overdue items
- KPI alerts

**Common Email Microflows:**
- `SUB_CreateNotificationForUser`
- `SUBCreateEmail`
- Various module-specific email microflows

---

## AI Capabilities

| Feature | Description | API Endpoint |
|---------|-------------|--------------|
| Policy Generation | Generate policy document from template | `/api/generate_policy/` |
| Policy Review | AI compliance review of policy | `/api/grc_policy_query` |
| Evidence Review | AI validation of evidence | `/api/grc_evidence_query` |
| Control Code Query | Get control codes from AI | `/api/control_code_query` |
| Risk Generation | Generate risks from assets/processes | `/api/generate_process_asset_risk` |
| Framework Generation | Generate framework structure | `/api/generate_framework_job` |
| Document Ingestion | Ingest documents for AI processing | `/api/grc_ingest` |

---

---

## 11. Role-Wise Pages & Actions (Detailed Access Matrix)

### 11.1 All Roles in the System

| Role | Description | Scope |
|------|-------------|-------|
| **GRCAdministrator** | Full system access, manages customer accounts, system-level compliance | All |
| **CustomerAdministrator** | Organization-level admin, manages users, settings, organization data | All (within customer) |
| **AuditHead** | Full access to Internal Audit module | All |
| **AuditManager** | Manages audits, assigns auditors, reviews findings | All |
| **AuditUser** | Basic audit module access (view-only) | All |
| **Auditor** | Conducts audits, creates findings | All |
| **Auditee** | Limited access - Fieldwork, CAPA Tracking, Reports only | Department |
| **Reviewer** | Reviews and approves compliance, risk, asset content | All |
| **Contributor** | Creates and edits content across modules | All |
| **DepartmentReviewer** | Reviews content within own department | Department |
| **DepartmentContributor** | Creates/edits content within own department | Department |

---

### 11.2 GRCAdministrator

**Description:** System-level management, manages multiple customers/organizations

#### Pages Accessible:
| Module | Page | Actions |
|--------|------|---------|
| GRC | Customer Accounts | View, Create, Edit, Delete |
| GRC | Customers | View, Create, Edit, Delete |
| Compliance | Framework | View, Create, Edit, Delete |
| Compliance | Controls | View, Create, Edit, Delete |
| Compliance | Governance | View, Create, Edit, Delete |
| Compliance | Evidence | View, Create, Edit, Delete |
| Compliance | Domain | View, Create, Edit, Delete |
| Compliance | Master Data (Settings) | View, Create, Edit, Delete |

#### Key Actions:
- Create and manage customer accounts
- Configure compliance frameworks for customers
- Manage master data (controls, domains, governance templates)
- Import/export framework requirements
- AI-based control code generation

---

### 11.3 CustomerAdministrator

**Description:** Organization-level administrator managing their organization

#### Pages Accessible:
| Module | Page | Actions |
|--------|------|---------|
| Organization | Dashboard | View |
| Organization | Profile | View, Create, Edit |
| Organization | Context (Stakeholders, Issues) | View, Create, Edit, Delete |
| Organization | Users | View, Create, Edit, Delete |
| Organization | Process | View, Create, Edit, Delete |
| Organization | Settings | View, Create, Edit, Delete |
| Organization | Reports | View, Export |
| Compliance | Framework | View |
| Asset Management | All | View |
| Risk Management | All | View |
| Internal Audit | Risk Register | View |
| Internal Audit | Settings | View |

#### Key Actions:
- Manage organization profile (branches, data centers, cloud providers)
- Create and manage users with account limits
- Configure departments, services, BIA categories
- Manage stakeholders and issues
- Create and manage processes with BIA
- View compliance and risk dashboards

---

### 11.4 AuditHead

**Description:** Full authority over Internal Audit module

#### Pages Accessible:
| Module | Page | Actions |
|--------|------|---------|
| Internal Audit | Dashboard | View |
| Internal Audit | Audit Universe | View, Create, Edit, Delete |
| Internal Audit | Risk Identification | View, Create, Edit, Delete |
| Internal Audit | Risk Register | View, Create, Edit, Delete, Approve |
| Internal Audit | Audit Planning | View, Create, Edit, Delete, Approve |
| Internal Audit | Fieldwork | View, Create, Edit, Delete, Approve |
| Internal Audit | Report | View, Create, Edit, Delete, Approve |
| Internal Audit | CAPA Tracking | View, Create, Edit, Delete, Approve |
| Internal Audit | Document Library | View, Create, Edit, Delete |
| Internal Audit | Settings | View, Create, Edit, Delete |
| Internal Audit | Risk Universe | View, Create, Edit, Delete |

#### Key Actions:
- Full CRUD on all audit entities
- Approve audit plans and findings
- Manage audit settings and configurations
- Close audits and CAPAs
- Generate and approve audit reports

---

### 11.5 AuditManager

**Description:** Manages audits, assigns auditors, reviews findings

#### Pages Accessible:
| Module | Page | Actions |
|--------|------|---------|
| Internal Audit | Dashboard | View |
| Internal Audit | Audit Universe | View, Create, Edit |
| Internal Audit | Risk Identification | View, Create, Edit |
| Internal Audit | Risk Register | View, Create, Edit |
| Internal Audit | Audit Planning | View, Create, Edit, Delete, Approve |
| Internal Audit | Fieldwork | View, Create, Edit, Approve |
| Internal Audit | Report | View, Create, Edit, Delete, Approve |
| Internal Audit | CAPA Tracking | View, Create, Edit, Delete, Approve |
| Internal Audit | Document Library | View, Create, Edit |

**No Access To:** Settings, Risk Universe

#### Key Actions:
- Create and manage audit plans
- Assign auditors to engagements
- Review and approve fieldwork findings
- Manage CAPA tracking
- Generate audit reports

---

### 11.6 Auditor

**Description:** Conducts audits, creates findings

#### Pages Accessible:
| Module | Page | Actions |
|--------|------|---------|
| Organization | Dashboard | View |
| Organization | Process | View |
| Compliance | Controls | View |
| Internal Audit | Dashboard | View |
| Internal Audit | Audit Universe | View |
| Internal Audit | Risk Identification | View |
| Internal Audit | Risk Register | View |
| Internal Audit | Audit Planning | View |
| Internal Audit | Fieldwork | View, Create, Edit |
| Internal Audit | Report | View, Create |
| Internal Audit | CAPA Tracking | View, Edit |
| Internal Audit | Document Library | View, Create |

**No Access To:** Settings, Risk Universe

#### Key Actions:
- View assigned audits
- Create and document findings
- Upload evidence and documents
- Update CAPA status
- View processes and controls for audit context

---

### 11.7 AuditUser

**Description:** Basic audit module access (primarily view-only)

#### Pages Accessible:
| Module | Page | Actions |
|--------|------|---------|
| Organization | Dashboard | View |
| Internal Audit | Dashboard | View |
| Internal Audit | Audit Universe | View |
| Internal Audit | Risk Identification | View |
| Internal Audit | Risk Register | View |
| Internal Audit | Audit Planning | View |
| Internal Audit | Fieldwork | View |
| Internal Audit | Report | View |
| Internal Audit | CAPA Tracking | View |
| Internal Audit | Document Library | View |

**No Access To:** Settings, Risk Universe

#### Key Actions:
- View audit dashboards and reports
- Monitor audit progress
- View findings and CAPAs

---

### 11.8 Auditee

**Description:** Responds to audits, limited access (department-scoped)

#### Pages Accessible:
| Module | Page | Actions |
|--------|------|---------|
| Internal Audit | Fieldwork | View, Edit (dept only) |
| Internal Audit | Report | View (dept only) |
| Internal Audit | CAPA Tracking | View, Edit (dept only) |

**Excluded From:** Dashboard, Audit Universe, Risk Identification, Risk Register, Audit Planning, Document Library, Settings, Risk Universe, AND all other modules (Organization, Compliance, Asset, Risk)

#### Key Actions:
- Respond to fieldwork findings in their department
- View audit reports related to their department
- Update CAPA status for assigned actions
- Add evidence/comments to findings

---

### 11.9 Reviewer

**Description:** Reviews and approves compliance, risk, and asset content (no admin access)

#### Pages Accessible:
| Module | Page | Actions |
|--------|------|---------|
| Organization | Dashboard | View |
| Organization | Context | View |
| Organization | Process | View |
| Compliance | Dashboard | View |
| Compliance | Framework | View |
| Compliance | Controls | View |
| Compliance | Governance | View |
| Compliance | Evidence | View |
| Compliance | Exceptions | View |
| Compliance | KPI | View |
| Compliance | Risk Matrix | View |
| Asset Management | Dashboard | View |
| Asset Management | Inventory | View |
| Asset Management | Classification | View |
| Asset Management | Reports | View |
| Risk Management | Dashboard | View |
| Risk Management | Register | View |
| Risk Management | Assessment | View |
| Risk Management | Response | View |
| Risk Management | Reports | View |

**Excluded From:** Profile, Users, Settings (all modules), Master Data, Domain, Internal Audit (entire module)

#### Key Actions:
- Review compliance status
- Monitor risk assessments
- View asset classifications
- Review KPI performance
- Access reports across modules

---

### 11.10 Contributor

**Description:** Creates and edits content across modules

#### Pages Accessible:
| Module | Page | Actions |
|--------|------|---------|
| Organization | Dashboard | View |
| Organization | Process | View, Create, Edit |
| Compliance | Dashboard | View |
| Compliance | Framework | View |
| Compliance | Controls | View, Create, Edit |
| Compliance | Governance | View, Create, Edit |
| Compliance | Evidence | View, Create, Edit |
| Compliance | Exceptions | View, Create, Edit |
| Compliance | KPI | View, Create, Edit |
| Compliance | Risk Matrix | View |
| Asset Management | Dashboard | View |
| Asset Management | Inventory | View, Create, Edit |
| Asset Management | Classification | View, Create, Edit |
| Risk Management | Dashboard | View |
| Risk Management | Register | View, Create, Edit |
| Risk Management | Assessment | View, Create, Edit |
| Risk Management | Response | View, Create, Edit |

#### Key Actions:
- Create and edit governance documents (Policy, Standard, Procedure)
- Upload evidence and link to controls
- Create and update risks
- Perform risk assessments
- Create assets and classifications
- Create and manage exceptions
- Submit items for approval

---

### 11.11 DepartmentReviewer

**Description:** Reviews content within own department

#### Pages Accessible:
| Module | Page | Actions | Scope |
|--------|------|---------|-------|
| Organization | Dashboard | View | Department |
| Organization | Context | View | Department |
| Organization | Users | View | Department |
| Organization | Process | View, Approve | Department |
| Compliance | Dashboard | View | Department |
| Compliance | Framework | View | Department |
| Compliance | Controls | View, Approve | Department |
| Compliance | Governance | View | Department |
| Compliance | Evidence | View, Approve | Department |
| Compliance | Exceptions | View | Department |
| Compliance | KPI | View | Department |
| Asset Management | Dashboard | View | Department |
| Asset Management | Inventory | View, Approve | Department |
| Asset Management | Classification | View | Department |
| Asset Management | Reports | View | Department |
| Risk Management | Dashboard | View | Department |
| Risk Management | Register | View, Approve | Department |
| Risk Management | Assessment | View | Department |
| Risk Management | Response | View | Department |
| Risk Management | Reports | View | Department |
| Internal Audit | Risk Register | View | Department |

**Excluded From:** Profile, Settings, Domain, Master Data, Risk Matrix

#### Key Actions:
- Approve processes in their department
- Approve controls and evidence
- Approve asset inventories
- Approve risks in department
- View audit risk register for department

---

### 11.12 DepartmentContributor

**Description:** Creates/edits content within own department

#### Pages Accessible:
| Module | Page | Actions | Scope |
|--------|------|---------|-------|
| Organization | Dashboard | View | Department |
| Organization | Context | View | Department |
| Organization | Users | View | Department |
| Organization | Process | View, Create, Edit | Department |
| Compliance | Dashboard | View | Department |
| Compliance | Framework | View | Department |
| Compliance | Controls | View, Create, Edit | Department |
| Compliance | Governance | View, Create, Edit | Department |
| Compliance | Evidence | View, Create, Edit | Department |
| Compliance | Exceptions | View, Create, Edit | Department |
| Compliance | KPI | View | Department |
| Asset Management | Dashboard | View | Department |
| Asset Management | Inventory | View, Create, Edit | Department |
| Asset Management | Classification | View | Department |
| Asset Management | Reports | View | Department |
| Risk Management | Dashboard | View | Department |
| Risk Management | Register | View, Create, Edit | Department |
| Risk Management | Assessment | View, Create, Edit | Department |
| Risk Management | Response | View, Create, Edit | Department |
| Risk Management | Reports | View | Department |
| Internal Audit | Risk Register | View | Department |

**Excluded From:** Profile, Settings, Domain, Master Data, Risk Matrix

#### Key Actions:
- Create processes for their department
- Create and edit controls
- Create governance documents
- Upload evidence
- Create exceptions
- Create and assess risks (department-scoped)

---

### 11.13 Role-Action Summary Matrix

| Action | GRC Admin | Cust Admin | Audit Head | Audit Mgr | Auditor | Audit User | Auditee | Reviewer | Contributor | Dept Rev | Dept Contrib |
|--------|:---------:|:----------:|:----------:|:---------:|:-------:|:----------:|:-------:|:--------:|:-----------:|:--------:|:------------:|
| **Create Governance** | Y | - | - | - | - | - | - | - | Y | - | Y (dept) |
| **Approve Governance** | Y | - | - | - | - | - | - | - | - | - | - |
| **Publish Governance** | Y | - | - | - | - | - | - | - | - | - | - |
| **Create Evidence** | Y | - | - | - | - | - | - | - | Y | - | Y (dept) |
| **Publish Evidence** | Y | - | - | - | - | - | - | - | - | - | - |
| **Create Risk** | - | - | - | - | - | - | - | - | Y | - | Y (dept) |
| **Assess Risk** | - | - | - | - | - | - | - | - | Y | - | Y (dept) |
| **Approve Risk** | - | - | Y | Y | - | - | - | - | - | Y (dept) | - |
| **Create Exception** | - | - | - | - | - | - | - | - | Y | - | Y (dept) |
| **Approve Exception** | - | - | - | - | - | - | - | - | - | Y (dept) | - |
| **Create Asset** | - | - | - | - | - | - | - | - | Y | - | Y (dept) |
| **Create Control** | Y | - | - | - | - | - | - | - | Y | - | Y (dept) |
| **Create Audit Plan** | - | - | Y | Y | - | - | - | - | - | - | - |
| **Conduct Fieldwork** | - | - | Y | Y | Y | - | - | - | - | - | - |
| **Create Findings** | - | - | Y | Y | Y | - | - | - | - | - | - |
| **Respond to Findings** | - | - | - | - | - | - | Y | - | - | - | - |
| **Approve Findings** | - | - | Y | Y | - | - | - | - | - | - | - |
| **Manage Users** | - | Y | - | - | - | - | - | - | - | - | - |
| **Manage Settings** | Y | Y | Y | - | - | - | - | - | - | - | - |
| **View Reports** | Y | Y | Y | Y | Y | Y | - | Y | Y | Y | Y |
| **Export Data** | Y | Y | Y | Y | Y | Y | - | Y | Y | Y | Y |

---

### 11.14 Workflow Roles Mapping

#### Governance Workflow
| Stage | Role | Action |
|-------|------|--------|
| Create | Contributor, DepartmentContributor, GRCAdministrator | Create document (3-step wizard) |
| Assign Approvers | Contributor, DepartmentContributor | Select approvers from department |
| Upload Document | Contributor, DepartmentContributor | Upload or generate with AI |
| Submit for Approval | Contributor, DepartmentContributor | Submit to approver |
| Approve | Approver (selected) | Approve or Send Back |
| Publish | Publisher (GRCAdmin or designated) | Sign and publish |
| Unpublish | Publisher | Revert to draft |

#### Risk Assessment Workflow
| Stage | Role | Action |
|-------|------|--------|
| Create Risk | Contributor, DepartmentContributor | Create risk entry |
| Assess Risk | Contributor, DepartmentContributor | Complete 6-step assessment |
| Select Response | Risk Owner | Choose Treat/Transfer/Avoid/Accept |
| Plan Controls | Risk Owner | Add planned controls |
| Submit for Approval | Risk Owner | Submit response plan |
| Approve | DepartmentReviewer, AuditHead, AuditManager | Approve or Send Back |
| Complete | Risk Owner | Mark as completed |
| Reassess | Risk Owner | Trigger reassessment |

#### Exception Workflow
| Stage | Role | Action |
|-------|------|--------|
| Create | Contributor, DepartmentContributor | Create exception request |
| Assign Approver | Creator | Select department approver |
| Approve | Approver, DepartmentReviewer | Approve or Deny |
| Authorize | Senior Authority | Authorize exception |
| Add Compensating Controls | Creator | Define mitigating controls |
| Submit for Closure | Creator | Attach proof, submit |
| Close | Approver | Close exception |

#### Audit Workflow
| Stage | Role | Action |
|-------|------|--------|
| Plan | AuditHead, AuditManager | Create audit plan |
| Assign | AuditHead, AuditManager | Assign auditors |
| Conduct Fieldwork | Auditor | Execute audit procedures |
| Create Findings | Auditor | Document findings |
| Respond | Auditee | Respond to findings |
| Review | AuditManager, AuditHead | Review responses |
| Approve | AuditHead | Approve findings |
| Create CAPA | Auditor, AuditManager | Create action items |
| Track CAPA | Auditee, Auditor | Update CAPA status |
| Close CAPA | AuditManager, AuditHead | Close action items |
| Generate Report | AuditManager, AuditHead | Create audit report |

---

*Document generated from Technical Documentation GRC.docx analysis*
*Last Updated: January 2026*
