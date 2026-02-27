# TPRM Platform — Understanding Validation File

**Purpose**: Allow a reviewer to validate or correct the analyst's interpretation of the system.
**Format**: Each section presents the analyst's understanding, followed by confidence level and open questions.

---

## 1. My Understanding of the Overall System

VerifAI TPRM is a **multi-tenant third-party risk management platform** built on Mendix. It manages the entire lifecycle of vendor relationships from initial onboarding through active monitoring to eventual offboarding.

The system has two tiers:
1. **Platform tier** (TPRMAdmin / Superadmin): Manages customer accounts, factory assessment templates, and cross-tenant settings
2. **Customer tier** (all other roles): Operates within a single tenant boundary (e.g., "Baarez")

The core workflow is: **Vendor Onboarding → Assessment → Review → Approval → Contract → Active Monitoring → Offboarding**

**Confidence**: HIGH (observed directly from UI)

---

## 2. My Understanding of Each Role

### TPRMAdmin (Superadmin)
**Understanding**: Platform-level administrator who manages customer accounts and cross-tenant configuration. Likely has access to a different set of modules than customer-level roles — possibly customer creation, subscription management, factory assessment setup.

**Confidence**: LOW — could not access. This is based on the role name and the existence of "Assessment Factory" visible to Assessor/Approver but not Admin.

**Question**: Does TPRMAdmin have its own separate navigation, or does it see a superset of all customer-level menus?

---

### TPRMCustomerAdmin
**Understanding**: Full tenant administrator. Manages:
- System configuration (Control Center thresholds, scorecard)
- User management (all roles except Account Manager/SME which are created via vendor onboarding)
- Vendor management (full view of all 56 vendors)
- Questionnaire templates and master data
- Assessment workspace (overview of all assessments)
- MX Settings (email, SAML, data deletion)

Does NOT see the operational dashboard that BO/Assessor/Approver see. The Admin's landing page is the Control Center, not a dashboard with charts.

**Confidence**: HIGH

**Question**: Can the Admin initiate vendor onboarding? I did not see an "Onboard New Vendor" button in the Admin's Vendor Management view — only Export/Import and edit icons.

---

### Business Owner (BO)
**Understanding**: The primary vendor relationship owner within a department. This is the role that:
- Initiates vendor onboarding ("Onboard New Vendor")
- Delegates vendor management to Relationship Managers
- Views issue management (Issue Register + Issue Remediation + Vendor Issues)
- Manages contracts (can trigger offboarding or renewal)
- Can manage users (Add user function visible)
- Sees department-scoped vendor data (22 of 56 vendors)

The BO's dashboard is chart-rich with issue status, assessment progress, vendor risk distribution, and assessment results.

**Confidence**: HIGH

**Question**: When BO creates a Relationship Manager user, is the RM automatically scoped to the BO's vendors? Or is there a separate assignment mechanism?

---

### Relationship Manager (RM)
**Understanding**: Acts as a delegate for the Business Owner with 8 nav items. Has nearly identical capabilities except:
- Cannot manage users (no User Management in nav)
- Has "Onboard New Vendor" on Dashboard (BO has it in Inventory)
- Dashboard shows Vendor Criticality bar chart and Assessment Status bar chart (simpler than BO's dashboard)
- **Has Issue Management** (Issue Register + Issue Remediation tabs, same as BO)
- **Has Support** access

I believe the RM can:
- Onboard vendors on behalf of BO
- Upload contracts to activate vendors
- Trigger offboarding/renewal via Contracts module
- View and manage issues (via Issue Management)

**Confidence**: HIGH — verified navigation in recheck

**Question**: Can an RM see ALL of the BO's vendors, or only specifically assigned ones?

---

### Assessor
**Understanding**: The internal risk assessment specialist with the broadest non-admin navigation (10 items). Key capabilities:
- **My Queue**: Assessment pickup system — assessments appear here after vendor submission
  - Sub-tabs: My Queue (active), Initiate Reassessment, Returned (sent back)
- **Due Diligence**: Onboarding assessment track
- **Reassessments**: Periodic/on-demand assessments
- **Assessment Factory**: Self-service 4-step assessment tool (Download Template → Upload → Attach Artifacts → Generate Report)
- **Template**: Assessment template browser with 6 templates across 3 categories (Default, ISMS, Compliance). Each template question has a "VerifAI Prompt Question" for AI analysis.
- **Monitoring**: Can trigger continuous monitoring scans (unique to Assessor among assessment roles)
- **Support**: Has Support access (Approver does not)
- Can see Issue Register (standalone, not tabbed like BO)
- Has Follow-ups module
- **Notification badge** observed with count of 4 — types: "Assessment Received" and "Account Creation"

I believe the assessment flow is:
1. Assessment appears in Assessor's My Queue after vendor submission
2. Assessor picks/claims the assessment (status → In-Progress)
3. Reviews questionnaire responses, raises issues
4. Can set Assessment Result during review (Satisfactory/Unsatisfactory/Deficient) — observed RA81 with "In-Progress" status but "Deficient" result
5. Completes assessment → status moves to "In-Progress(approver)"
6. Approver reviews and either approves or sends back

**Confidence**: HIGH — explored Assessment Factory, Template, notifications, and assessment detail

**Question**: Is assessment assignment manual (Assessor picks from pool) or automatic (system assigns based on rules)? The "My Queue" suggests manual pickup, but the Assessment Detail shows a named "Assessor Name" field suggesting pre-assignment.

---

### Approver
**Understanding**: Reviews completed assessments and either approves or sends back. Navigation is **similar but NOT identical to Assessor** — has 8 items vs Assessor's 10. Key difference: **Approver does NOT have Monitoring or Support**.

I believe the Approver can:
- Review assessments completed by Assessors (status = In-Progress(approver))
- Self-conduct AND approve assessments (per role description)
- Send assessments back for corrections
- Approve assessments, which triggers the vendor status transition to "Approved"

**Confidence**: MEDIUM-HIGH

**Questions**:
1. Can the Approver both assess AND approve the same vendor (conflict of interest)?
2. The role description says "self-conduct and approve" — does this bypass the Assessor step entirely?
3. Why does Approver lack Monitoring access while Assessor has it?

---

### Auditor
**Understanding**: Read-only oversight role. Most restricted internal role with only 5 nav items:
- Dashboard (same charts as BO/Assessor)
- Inventory (vendor list, likely read-only)
- Assessments (view assessment details)
- Follow-ups (view follow-up items)
- Issue Register (view issues)

Cannot modify any data. This is the compliance/audit trail viewer.

**Confidence**: HIGH

**Question**: Can the Auditor export/download reports, or is it truly view-only with no data extraction?

---

### Internal IT Team
**Understanding**: The most narrowly scoped internal role — only Issue Management (1 nav item). They see:
- Issue Register: Shows all vendors with issues, including the Business Owner responsible
- Issue Remediation: Where they work on resolving technical issues

The landing page is titled "RM Remediation" which is confusing — this may be a shared page between RM and IT roles.

**Confidence**: HIGH for what they see, MEDIUM for what they can do

**Question**: Does IT actually resolve issues (change status, add comments), or do they just view them? The role description says "resolution of issues" which implies edit access on the Issue Remediation tab.

---

### Account Manager (Vendor-Side)
**Understanding**: The vendor's representative in the system. This is NOT created via User Management but through the vendor onboarding process.

Capabilities:
- **Assessments**: Complete questionnaires (Active/Submitted/Past/Offboard tabs)
- **Follow-Ups**: Track and respond to follow-up items
- **SME Management**: Invite and manage their own Subject Matter Experts
- **Support**: Access support/help

The AM can only see their own vendor's data. They complete assessments and submit them for internal review.

**Confidence**: HIGH

**Questions**:
1. When a vendor is onboarded, is the AM account automatically created from the "Account Manager Name" and "Account Manager Email" fields?
2. Can one AM manage multiple vendors, or is it 1:1?

---

### SME (Subject Matter Expert)
**Understanding**: Invited by the Account Manager to help with specific assessment sections. Most limited role:
- **Assessments**: View and contribute to assessments (same tabs as AM: Active/Submitted/Past/Offboard)
- **Follow-Ups**: Track follow-up items
- **Support**: Get help

SME doesn't have SME Management (can't invite other SMEs — only AM can).

**Confidence**: HIGH

**Question**: Can SMEs only answer questions assigned to them, or can they see the full assessment?

---

## 3. My Understanding of the Vendor Lifecycle

### Simplified Flow
```
BO/RM creates vendor → AM fills assessment → Assessor reviews → Approver approves → RM uploads contract → Vendor active → Contract expires → Offboard or renew
```

### What I Believe Happens at Each Stage

1. **Onboarding**: BO or RM clicks "Onboard New Vendor" → fills vendor profile (name, AM details, service category, department, risk profile questions) → system creates vendor record and AM account → assessment initiated automatically

2. **Assessment Submission**: AM receives notification → completes questionnaire → submits → status changes to "AssessmentSubmitted"

3. **Assessment Review**: Assessment appears in Assessor's "My Queue" → Assessor picks it → reviews responses → raises issues (High/Medium/Low) → completes with result

4. **Approval**: Assessment moves to Approver → reviews assessment and issues → either approves or sends back → if approved, vendor status becomes "Inactive" (awaiting contract)

5. **Activation**: RM uploads contract with start/end dates → vendor status becomes "Active"

6. **Ongoing Monitoring**: Continuous monitoring scores tracked → periodic reassessments triggered by cadence settings

7. **Contract Expiry**: System shows vendor in "Expiring Contracts" tab → BO/RM chooses "Start Offboarding" or "Renew Contract"

**Confidence**: MEDIUM — I observed pieces of this but didn't execute the full flow

---

## 4. What I Believe Happens Behind the Scenes

### Assessment Auto-Generation
When a vendor is onboarded, I believe the system automatically:
1. Creates an Assessment record with DD prefix
2. Assigns the appropriate questionnaire template based on Service Category
3. Sets the assessment status to "Initiated" then "Awaiting Response"
4. Creates an Account Manager user from the provided email
5. Sends notification to the AM

### VRR Calculation (Partially Confirmed)
The Vendor Risk Rating uses a scoring system based on Onboarding Questions:
- **Access to Data** (Parent, Score: 10, Yes/No)
- **PII** (Child of Access to Data, Score: 10, Yes/No)
- **Access to Network** (Child, Score: 10, Yes/No)
- **Cloud** (Parent, Score: 10, Yes/No)
- **Business Justification** (Parent, Score: 0, FreeText — no scoring impact)

Max score from questions = 40. VRR thresholds: Critical=50, High=40, Moderate=30, Low=20, Nominal=0.

**Open question**: How does the system reach "Critical" (50) with max 40 from questions? Service Category likely contributes additional scoring.

### Issue Generation
During assessment, the Assessor likely:
1. Reviews each question/answer pair
2. Can flag items as issues with severity (High/Medium/Low)
3. Issues are auto-created with remediation due dates based on VRR-driven SLA

### Cadence-Driven Reassessment
The system likely uses the Cadence configuration to:
- Schedule periodic reassessments (Critical=monthly, High=quarterly, etc.)
- Auto-create RA-prefixed assessment records
- Place them in the Assessor queue

---

## 5. Areas of Uncertainty (Updated After Recheck)

### HIGH Uncertainty
1. **Superadmin capabilities**: Still unknown — login failed with all attempted credentials (superadmin, MxAdmin, TPRMAdmin)
2. ~~**Factory module**~~: **RESOLVED** — Assessment Factory is a 4-step self-service tool (Download Template → Upload → Attach Artifacts → Generate Report)
3. ~~**Template module**~~: **RESOLVED** — Template module shows 6 templates in 3 categories with Domain/Questions/VerifAI Prompt columns
4. **Assessment detail flow**: Partially resolved — metadata view explored (personnel, dates, template), but actual question/answer UI not observed
5. **Send-back mechanism**: Still unknown — what happens when an assessment is returned? Who can return at which stage?

### MEDIUM Uncertainty
6. **RM-BO delegation model**: How exactly does the BO delegate vendors to RMs?
7. **AM account creation**: Is it automatic during onboarding, or manual?
8. ~~**VRR calculation formula**~~: **PARTIALLY RESOLVED** — Onboarding questions have Parent/Child hierarchy with scores (max 40 from questions), VRR thresholds are 50/40/30/20/0. Gap: How does the system reach 50 for "Critical"?
9. ~~**Notification system**~~: **RESOLVED** — Two notification types: "Assessment Received" (submission + reassignment) and "Account Creation". Badge count, "Mark all Read" button, timestamps.
10. **Department scoping logic**: How does the system determine which vendors a BO sees?

### LOW Uncertainty (All Confirmed)
11. **Navigation differences**: Fully verified across all 9 accessible roles with corrections applied
12. **Status values**: Complete enum discovered from Assessment Detail dialog (12 statuses including offboard states)
13. **Issue severity model**: High/Medium/Low clearly shown
14. **Contract lifecycle**: Start Offboarding / Renew Contract clearly visible
15. **AI integration**: VerifAI uses RunPod-hosted AI for document analysis with question-level prompts

---

## 6. Observations That Need Verification

### Observation 1: Account Manager is NOT a Selectable Role
When creating a new user via User Management, the "Select user roles" dialog shows only 6 roles (Approver, Assessor, Auditor, BusinessOwner, InternalITTeam, RelationshipManager). Account Manager and SME are absent.

**My interpretation**: AM and SME accounts are created through the vendor onboarding process, not through User Management. This creates a two-track user creation model.

**Needs verification**: Is this correct? Can an Admin manually create an Account Manager?

### Observation 2: Assessor and Approver Have DIFFERENT Navigation (CORRECTED)
**Original claim**: Both roles have identical navigation. **This was WRONG.**

**Corrected finding**: Assessor has 10 nav items, Approver has 8. Key differences:
- Assessor has **Monitoring** — Approver does NOT
- Assessor has **Support** — Approver does NOT

**Updated interpretation**: Assessor is actually the broader role with more capabilities. Approver is focused purely on assessment review/approval. The Assessor can trigger continuous monitoring scans and access support, while the Approver cannot.

**Still needs verification**: What are the behavioral differences when both roles open the same assessment detail?

### Observation 3: "RM Remediation" Page Title for IT Role
The IT Team's landing page is titled "RM Remediation" in the browser tab.

**My interpretation**: This is either a shared page/microflow between RM and IT roles, or a labeling oversight in the Mendix page configuration.

**Needs verification**: Does RM also see this remediation page?

### Observation 4: Vendor Count 79 Onboarding, 1 Onboarded
Out of 79 vendors, only 1 has reached "Onboarded" (Active) status.

**My interpretation**: This is a test/acceptance environment where most vendors are still in the onboarding pipeline. The production environment would have a different distribution.

**Needs verification**: Is this expected for a testing environment?

### Observation 5: Duplicate Questionnaire Templates
The Questionnaire Management shows duplicates: two "Cloud → CAIQ" entries and two "Privacy → GDPR" entries.

**My interpretation**: Could be different versions, or a data quality issue in the test environment.

**Needs verification**: Are these intentional (e.g., different question sets under the same framework)?

---

## 7. Recommended Next Steps for Complete Discovery

### Completed in Recheck
- ~~**Obtain Factory role credentials**~~ — Assessment Factory explored via Assessor (4-step workflow documented)
- ~~**Open an assessment detail page**~~ — Assessment metadata view explored (personnel, dates, template, full status enum)
- ~~**Explore the notification system**~~ — Two notification types documented (Assessment Received, Account Creation)
- ~~**Check Vendor Offboarding configuration**~~ — All 10 offboarding questions documented

### Still Outstanding
1. **Obtain working Superadmin credentials** — Critical gap. Tried: superadmin, MxAdmin, TPRMAdmin with provided password. All failed. Password may have been changed.
2. **Walk through a complete vendor onboarding** — Execute the full flow from BO to Active status (would confirm AM auto-creation and VRR calculation)
3. **Open the actual questionnaire UI** — Click into an assessment from Assessor/AM view to see the question/answer interface (not just metadata)
4. **Test the send-back flow** — What happens when an Approver returns an assessment? Does it create a new status or revert?
5. **Trigger an offboarding** — Observe the 10 offboarding questions in action and status transitions
6. **Check the "Initiate Reassessment" tab** — How does on-demand reassessment work?
7. **Test data isolation** — Verify that AM truly only sees their own vendor
8. **Verify VRR scoring** — How does the system reach "Critical" (50) with max 40 from onboarding questions? Test with different vendor profiles.

---

*This validation file should be reviewed by someone with intimate knowledge of the TPRM platform. Please correct any misunderstandings and confirm or deny the interpretations marked as uncertain.*

*Last updated: 2026-02-26 (recheck pass — navigation matrix corrected, Assessment Factory/Template/Notifications explored, AI integration documented, VRR scoring partially resolved, offboarding questions documented).*
