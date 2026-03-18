/**
 * Schema Metadata — Describes queryable database models for NLP-to-SQL
 *
 * Provides a structured description of the database schema that the LLM
 * can use to generate safe, structured query specifications.
 * Only exposes fields that are safe and useful for data queries.
 */

// ==================== TYPES ====================

export interface FieldMeta {
  name: string;
  type: "string" | "number" | "boolean" | "date";
  description: string;
  /** If this field references another model for joins */
  relation?: {
    model: string;
    displayField: string;
    /** Prisma relation field name (defaults to lowerFirst(model) if not specified) */
    relationField?: string;
  };
  /** Known enum/status values for this field */
  values?: string[];
  /** Whether this field can be used in aggregations */
  aggregatable?: boolean;
  /** Whether this field can be updated via agent mode (user-editable in UI forms) */
  editable?: boolean;
}

export interface ModelMeta {
  /** Prisma model name (exact casing) */
  prismaModel: string;
  /** Human-friendly name */
  displayName: string;
  /** Natural language aliases users might use */
  aliases: string[];
  /** Description for LLM context */
  description: string;
  /** Queryable fields */
  fields: FieldMeta[];
  /** Which roles can query this model (view access) */
  allowedRoles: string[] | "all";
  /** Which roles can update this model via agent mode (edit access) */
  allowedEditRoles?: string[];
  /** The code/ID field displayed to users */
  codeField?: string;
  /** The primary name/title field */
  nameField: string;
}

// ==================== QUERYABLE MODELS ====================

// ==================== ROLE-BASED ACCESS MAP ====================
// Maps each queryable model to the roles that can access it.
// Based on the UI permission matrix in permissions.ts.
//
// Product areas:
//   GRC (Compliance): Control, Framework, Requirement, Policy, Evidence
//   Organization:     Department, User, Process
//   GRC (Risk):       Risk
//   GRC (Asset):      Asset
//   Internal Audit:   AuditEngagement, InternalAuditFinding
//   TPRM:             TPRMVendor

/** Roles that can access Organization module — departments, users, processes */
const ORG_FULL_ROLES = [
  "GRCAdministrator", "CustomerAdministrator",
];

/** Roles that can view departments (most roles need department dropdowns) */
const ORG_DEPARTMENT_ROLES = [
  "GRCAdministrator", "CustomerAdministrator",
  "Reviewer", "DepartmentReviewer", "DepartmentContributor", "Contributor",
  "AuditHead", "Auditor", "Auditor", "Auditee",
];

/** Roles that can view processes */
const ORG_PROCESS_ROLES = [
  "GRCAdministrator", "CustomerAdministrator",
  "Reviewer", "DepartmentReviewer", "DepartmentContributor", "Contributor",
];

/** Roles that can access GRC Compliance module data */
const GRC_COMPLIANCE_ROLES = [
  "GRCAdministrator", "CustomerAdministrator",
  "Reviewer", "DepartmentReviewer", "DepartmentContributor", "Contributor",
];

/** Roles that can access Risk Management module data */
const GRC_RISK_ROLES = [
  "GRCAdministrator", "CustomerAdministrator",
  "Reviewer", "DepartmentReviewer", "DepartmentContributor", "Contributor",
];

/** Roles that can access Asset Management module data */
const GRC_ASSET_ROLES = [
  "GRCAdministrator", "CustomerAdministrator",
  "Reviewer", "DepartmentReviewer", "DepartmentContributor", "Contributor",
];

/** Roles that can access Internal Audit module data */
const AUDIT_ROLES = [
  "GRCAdministrator", "CustomerAdministrator",
  "AuditHead", "Auditor", "Auditor", "Auditee",
];

/** Roles that can access TPRM module data */
const TPRM_ROLES = [
  "GRCAdministrator", "CustomerAdministrator",
  "BusinessOwner", "RelationshipManager",
  "TPRMAssessor", "TPRMApprover", "TPRMAuditor",
  "TPRMAdmin", "FactoryAdmin", "FactoryAssessor",
];

/** Roles that can view Controls (includes Auditor who has compliance.controls:view) */
const CONTROL_ROLES = [...GRC_COMPLIANCE_ROLES, "Auditor"];

// ==================== EDIT ROLE GROUPS (Agent Mode) ====================
// Only roles with 'edit' action in permissions.ts can update via chatbot agent

/** Roles that can EDIT organization data (departments, users, processes) */
const ORG_EDIT_ROLES = ["GRCAdministrator", "CustomerAdministrator"];

/** Roles that can EDIT risk data */
const RISK_EDIT_ROLES = [
  "GRCAdministrator", "CustomerAdministrator",
  "Reviewer", "DepartmentReviewer", "DepartmentContributor", "Contributor",
];

/** Roles that can EDIT compliance data (controls, policies, evidence) */
const COMPLIANCE_EDIT_ROLES = [
  "GRCAdministrator", "CustomerAdministrator",
  "Reviewer", "Contributor",
];

/** Roles that can EDIT asset data */
const ASSET_EDIT_ROLES = [
  "GRCAdministrator", "CustomerAdministrator",
  "Reviewer", "DepartmentReviewer", "DepartmentContributor", "Contributor",
];

/** Roles that can EDIT audit data */
const AUDIT_EDIT_ROLES = [
  "GRCAdministrator", "CustomerAdministrator",
  "AuditHead", "Auditor",
];

/** Roles that can EDIT TPRM vendor data */
const TPRM_EDIT_ROLES = [
  "GRCAdministrator", "CustomerAdministrator",
  "TPRMAdmin", "RelationshipManager",
];

// ==================== QUERYABLE MODELS ====================

export const QUERYABLE_MODELS: ModelMeta[] = [
  // ==================== ORGANIZATION MODULE ====================
  {
    prismaModel: "Department",
    displayName: "Department",
    aliases: ["departments", "teams", "divisions", "organization departments"],
    description: "Organization departments/divisions",
    nameField: "name",
    allowedRoles: ORG_DEPARTMENT_ROLES,
    allowedEditRoles: ORG_EDIT_ROLES,
    fields: [
      { name: "name", type: "string", description: "Department name", editable: true },
      { name: "description", type: "string", description: "Department description", editable: true },
      { name: "createdAt", type: "date", description: "Date created" },
    ],
  },
  {
    prismaModel: "User",
    displayName: "User",
    aliases: ["users", "staff", "employees", "team members", "people"],
    description: "Users/employees in the organization with their roles and department assignments",
    nameField: "fullName",
    allowedRoles: ORG_FULL_ROLES,
    // No allowedEditRoles — User records are NOT updatable via chatbot agent for security
    fields: [
      // SAFE fields — no password, no email by default
      { name: "fullName", type: "string", description: "User full name" },
      { name: "firstName", type: "string", description: "First name" },
      { name: "lastName", type: "string", description: "Last name" },
      { name: "designation", type: "string", description: "Job designation/title" },
      { name: "function", type: "string", description: "Job function" },
      { name: "role", type: "string", description: "Primary role (e.g. CustomerAdministrator, Reviewer, AuditHead)" },
      { name: "language", type: "string", description: "Preferred language" },
      { name: "isActive", type: "boolean", description: "Whether user is active" },
      { name: "isBlocked", type: "boolean", description: "Whether user is blocked" },
      { name: "departmentId", type: "string", description: "Department", relation: { model: "Department", displayField: "name" } },
      { name: "lastLogin", type: "date", description: "Last login date" },
      { name: "createdAt", type: "date", description: "Date created" },
      // NOTE: password, userName, email are intentionally EXCLUDED for security
    ],
  },
  {
    prismaModel: "Process",
    displayName: "Process",
    aliases: ["processes", "business processes", "organization processes"],
    description: "Business processes with RACI assignments, risk ratings, and audit information",
    nameField: "name",
    codeField: "processCode",
    allowedRoles: ORG_PROCESS_ROLES,
    allowedEditRoles: ORG_EDIT_ROLES,
    fields: [
      { name: "processCode", type: "string", description: "Process code" },
      { name: "name", type: "string", description: "Process name", editable: true },
      { name: "description", type: "string", description: "Process description", editable: true },
      { name: "processType", type: "string", description: "Process type", values: ["Primary", "Management", "Supporting"] },
      { name: "status", type: "string", description: "Process status", values: ["Active", "Inactive"] },
      { name: "processFrequency", type: "string", description: "How often the process runs", values: ["Daily", "Weekly", "Monthly", "Quarterly", "Bi-annually", "Annually", "As needed"], editable: true },
      { name: "natureOfImplementation", type: "string", description: "Implementation type", values: ["Manual", "Automated", "Manual + Automated"], editable: true },
      { name: "riskRating", type: "string", description: "Process risk rating", values: ["Low", "Medium", "High", "Not Assessed"] },
      { name: "operationalComplexity", type: "string", description: "Operational complexity", values: ["Low", "Medium", "High"], editable: true },
      { name: "assetDependency", type: "boolean", description: "Whether process depends on an asset", editable: true },
      { name: "externalDependency", type: "boolean", description: "Whether process has external dependency", editable: true },
      { name: "externalParty", type: "string", description: "External party name (if external dependency)" },
      { name: "piiCapture", type: "boolean", description: "Whether process captures PII data", editable: true },
      { name: "departmentId", type: "string", description: "Department", relation: { model: "Department", displayField: "name" }, editable: true },
      { name: "ownerId", type: "string", description: "Process owner", relation: { model: "User", displayField: "fullName", relationField: "owner" }, editable: true },
      { name: "responsibleId", type: "string", description: "RACI: Responsible person", relation: { model: "User", displayField: "fullName", relationField: "responsible" }, editable: true },
      { name: "accountableId", type: "string", description: "RACI: Accountable person", relation: { model: "User", displayField: "fullName", relationField: "accountable" }, editable: true },
      { name: "consultedId", type: "string", description: "RACI: Consulted person", relation: { model: "User", displayField: "fullName", relationField: "consulted" }, editable: true },
      { name: "informedId", type: "string", description: "RACI: Informed person", relation: { model: "User", displayField: "fullName", relationField: "informed" }, editable: true },
      { name: "lastAuditDate", type: "date", description: "Last audit date", editable: true },
      { name: "reviewDate", type: "date", description: "Review date" },
      { name: "createdAt", type: "date", description: "Date created" },
    ],
  },
  // ==================== GRC MODULE ====================
  {
    prismaModel: "Risk",
    displayName: "Risk",
    aliases: ["risks", "risk register", "risk management"],
    description: "Risks identified in the risk register with assessment scores and status",
    nameField: "name",
    codeField: "riskId",
    allowedRoles: GRC_RISK_ROLES,
    allowedEditRoles: RISK_EDIT_ROLES,
    fields: [
      { name: "riskId", type: "string", description: "Risk code (e.g. RSK-001)" },
      { name: "name", type: "string", description: "Risk name/title", editable: true },
      { name: "description", type: "string", description: "Risk description/details", editable: true },
      { name: "riskSources", type: "string", description: "Source/origin of the risk", editable: true },
      { name: "status", type: "string", description: "Risk status", values: ["Awaiting Approval", "Pending Assessment", "Open", "In Progress", "Closed"] },
      { name: "riskRating", type: "string", description: "Risk rating level", values: ["Catastrophic", "Very High", "High", "Medium", "Low"] },
      { name: "riskScore", type: "number", description: "Risk score (likelihood × impact)", aggregatable: true },
      { name: "likelihood", type: "number", description: "Likelihood rating (1-5)", aggregatable: true },
      { name: "impact", type: "number", description: "Impact rating (1-5)", aggregatable: true },
      // Inherent / Residual / Target scores
      { name: "inherentLikelihood", type: "number", description: "Inherent likelihood rating", aggregatable: true },
      { name: "inherentImpact", type: "number", description: "Inherent impact rating", aggregatable: true },
      { name: "inherentRiskScore", type: "number", description: "Inherent risk score", aggregatable: true },
      { name: "residualLikelihood", type: "number", description: "Residual likelihood rating", aggregatable: true },
      { name: "residualImpact", type: "number", description: "Residual impact rating", aggregatable: true },
      { name: "residualRiskScore", type: "number", description: "Residual risk score", aggregatable: true },
      { name: "targetLikelihood", type: "number", description: "Target likelihood rating", aggregatable: true },
      { name: "targetImpact", type: "number", description: "Target impact rating", aggregatable: true },
      { name: "targetRiskScore", type: "number", description: "Target risk score", aggregatable: true },
      // Response
      { name: "responseStrategy", type: "string", description: "Risk response strategy", values: ["Treat", "Transfer", "Avoid", "Accept"], editable: true },
      { name: "assessmentStatus", type: "string", description: "Assessment status", values: ["Open", "In-Progress", "Draft", "Submitted", "Approved", "Rejected", "Completed"] },
      { name: "responseStatus", type: "string", description: "Response status", values: ["Open", "In-Progress", "Awaiting Approval", "Sent Back", "Completed"] },
      { name: "treatmentPlan", type: "string", description: "Risk treatment plan", editable: true },
      { name: "treatmentDueDate", type: "date", description: "Treatment due date" },
      { name: "treatmentStatus", type: "string", description: "Treatment status", values: ["Not Started", "In Progress", "Completed"] },
      // Relations
      { name: "departmentId", type: "string", description: "Department", relation: { model: "Department", displayField: "name" }, editable: true },
      { name: "categoryId", type: "string", description: "Risk category", relation: { model: "RiskCategory", displayField: "name" }, editable: true },
      { name: "typeId", type: "string", description: "Risk type", relation: { model: "RiskType", displayField: "name" }, editable: true },
      { name: "ownerId", type: "string", description: "Risk owner (person responsible for managing the risk)", relation: { model: "User", displayField: "fullName", relationField: "owner" }, editable: true },
      { name: "impactedAssetId", type: "string", description: "Impacted asset", relation: { model: "Asset", displayField: "name", relationField: "impactedAsset" }, editable: true },
      // Dates
      { name: "identifiedDate", type: "date", description: "Date risk was identified" },
      { name: "lastAssessmentDate", type: "date", description: "Last assessment date" },
      { name: "nextReviewDate", type: "date", description: "Next review date" },
      { name: "createdAt", type: "date", description: "Date created" },
    ],
  },
  {
    prismaModel: "Control",
    displayName: "Control",
    aliases: ["controls", "security controls"],
    description: "Security controls linked to frameworks with compliance status",
    nameField: "name",
    codeField: "controlCode",
    allowedRoles: CONTROL_ROLES,
    allowedEditRoles: COMPLIANCE_EDIT_ROLES,
    fields: [
      { name: "controlCode", type: "string", description: "Control code (e.g. AC-1)", editable: true },
      { name: "name", type: "string", description: "Control name/title", editable: true },
      { name: "description", type: "string", description: "Control description/details", editable: true },
      { name: "status", type: "string", description: "Compliance status", values: ["Non Compliant", "Compliant", "Not Applicable", "Partial Compliant"], editable: true },
      { name: "scope", type: "string", description: "Scope", values: ["In-Scope", "Not In-Scope"], editable: true },
      { name: "functionalGrouping", type: "string", description: "Functional grouping", values: ["Govern", "Identify", "Protect", "Detect", "Respond", "Recover"], editable: true },
      { name: "departmentId", type: "string", description: "Department", relation: { model: "Department", displayField: "name" }, editable: true },
      { name: "frameworkId", type: "string", description: "Framework", relation: { model: "Framework", displayField: "name" } },
      { name: "ownerId", type: "string", description: "Control owner (person responsible)", relation: { model: "User", displayField: "fullName", relationField: "owner" } },
      { name: "assigneeId", type: "string", description: "Control assignee (person assigned to implement/manage)", relation: { model: "User", displayField: "fullName", relationField: "assignee" }, editable: true },
      { name: "createdAt", type: "date", description: "Date created" },
    ],
  },
  {
    prismaModel: "Framework",
    displayName: "Framework",
    aliases: ["frameworks", "compliance frameworks", "standards", "regulations"],
    description: "Compliance frameworks subscribed by the organization (e.g. ISO 27001, GDPR, NCA ECC)",
    nameField: "name",
    codeField: "code",
    allowedRoles: GRC_COMPLIANCE_ROLES,
    fields: [
      { name: "code", type: "string", description: "Framework code" },
      { name: "name", type: "string", description: "Framework name (e.g. ISO 27001, GDPR)" },
      { name: "type", type: "string", description: "Framework type", values: ["Framework", "Standard", "Regulation"] },
      { name: "status", type: "string", description: "Subscription status", values: ["Subscribed", "Not Subscribed", "Suggested", "Archived"] },
      { name: "compliancePercentage", type: "number", description: "Overall compliance percentage", aggregatable: true },
      { name: "policyPercentage", type: "number", description: "Policy compliance percentage", aggregatable: true },
      { name: "evidencePercentage", type: "number", description: "Evidence compliance percentage", aggregatable: true },
      { name: "country", type: "string", description: "Country of origin" },
      { name: "industry", type: "string", description: "Industry applicability" },
      { name: "createdAt", type: "date", description: "Date created" },
    ],
  },
  {
    prismaModel: "Requirement",
    displayName: "Requirement",
    aliases: ["requirements", "framework requirements", "compliance requirements", "controls requirements"],
    description: "Requirements within compliance frameworks — each framework has multiple requirements organized hierarchically",
    nameField: "name",
    codeField: "code",
    allowedRoles: GRC_COMPLIANCE_ROLES,
    fields: [
      { name: "code", type: "string", description: "Requirement code (e.g. A.5.1, Art. 6)" },
      { name: "name", type: "string", description: "Requirement name/title" },
      { name: "requirementType", type: "string", description: "Requirement type", values: ["Mandatory", "Additional"] },
      { name: "level", type: "number", description: "Hierarchy level (1=domain, 2=requirement, 3=sub-requirement)" },
      { name: "applicability", type: "string", description: "SOA applicability", values: ["Yes", "No"] },
      { name: "implementationStatus", type: "string", description: "Implementation status", values: ["Yes", "No", "Ongoing", "N/A"] },
      { name: "controlCompliance", type: "string", description: "Control compliance", values: ["Compliant", "Non Compliant", "Partial Compliant"] },
      { name: "frameworkId", type: "string", description: "Framework this requirement belongs to", relation: { model: "Framework", displayField: "name" } },
      { name: "createdAt", type: "date", description: "Date created" },
    ],
  },
  {
    prismaModel: "Policy",
    displayName: "Policy",
    aliases: ["policies", "governance documents", "procedures"],
    description: "Governance documents including policies, standards, and procedures",
    nameField: "name",
    codeField: "code",
    allowedRoles: GRC_COMPLIANCE_ROLES,
    allowedEditRoles: COMPLIANCE_EDIT_ROLES,
    fields: [
      { name: "code", type: "string", description: "Policy code" },
      { name: "name", type: "string", description: "Policy name/title", editable: true },
      { name: "description", type: "string", description: "Policy description" },
      { name: "documentType", type: "string", description: "Document type", values: ["Policy", "Standard", "Procedure"], editable: true },
      { name: "status", type: "string", description: "Policy status", values: ["Not Uploaded", "Draft", "Approved", "Needs Review", "Published", "Pending Approval"] },
      { name: "version", type: "string", description: "Policy version" },
      { name: "departmentId", type: "string", description: "Department", relation: { model: "Department", displayField: "name" }, editable: true },
      { name: "assigneeId", type: "string", description: "Policy assignee (person responsible for the policy)", relation: { model: "User", displayField: "fullName", relationField: "assignee" }, editable: true },
      { name: "approverId", type: "string", description: "Policy approver", relation: { model: "User", displayField: "fullName", relationField: "approver" } },
      { name: "reviewDate", type: "date", description: "Next review date" },
      { name: "effectiveDate", type: "date", description: "Policy effective date" },
      { name: "createdAt", type: "date", description: "Date created" },
    ],
  },
  {
    prismaModel: "Evidence",
    displayName: "Evidence",
    aliases: ["evidences", "evidence items", "compliance evidence"],
    description: "Compliance evidence items linked to controls and frameworks",
    nameField: "name",
    codeField: "evidenceCode",
    allowedRoles: GRC_COMPLIANCE_ROLES,
    allowedEditRoles: COMPLIANCE_EDIT_ROLES,
    fields: [
      { name: "evidenceCode", type: "string", description: "Evidence code" },
      { name: "name", type: "string", description: "Evidence name/title", editable: true },
      { name: "description", type: "string", description: "Evidence description", editable: true },
      { name: "status", type: "string", description: "Evidence status", values: ["Not Uploaded", "Draft", "Validated", "Published", "Need Attention"] },
      { name: "domain", type: "string", description: "Domain area" },
      { name: "departmentId", type: "string", description: "Department", relation: { model: "Department", displayField: "name" }, editable: true },
      { name: "frameworkId", type: "string", description: "Framework", relation: { model: "Framework", displayField: "name" } },
      { name: "assigneeId", type: "string", description: "Evidence assignee (person responsible)", relation: { model: "User", displayField: "fullName" }, editable: true },
      { name: "dueDate", type: "date", description: "Due date" },
      { name: "reviewDate", type: "date", description: "Review date", editable: true },
      { name: "createdAt", type: "date", description: "Date created" },
    ],
  },
  {
    prismaModel: "Asset",
    displayName: "Asset",
    aliases: ["assets", "IT assets", "hardware", "software"],
    description: "IT and organizational assets with classification and lifecycle status",
    nameField: "name",
    codeField: "assetId",
    allowedRoles: GRC_ASSET_ROLES,
    allowedEditRoles: ASSET_EDIT_ROLES,
    fields: [
      { name: "assetId", type: "string", description: "Asset code" },
      { name: "name", type: "string", description: "Asset name", editable: true },
      { name: "description", type: "string", description: "Asset description" },
      { name: "assetType", type: "string", description: "Asset type", values: ["Hardware", "Software", "Information", "People", "Services", "Facility"] },
      { name: "status", type: "string", description: "Asset status", values: ["Active", "Retired"] },
      { name: "value", type: "number", description: "Asset monetary value", aggregatable: true },
      { name: "location", type: "string", description: "Asset location", editable: true },
      // Category hierarchy
      { name: "categoryId", type: "string", description: "Asset category (e.g. IT Equipment, Vehicles)", relation: { model: "AssetCategory", displayField: "name", relationField: "category" }, editable: true },
      { name: "subCategoryId", type: "string", description: "Asset sub-category", relation: { model: "AssetSubCategory", displayField: "name", relationField: "subCategory" }, editable: true },
      { name: "groupId", type: "string", description: "Asset group", relation: { model: "AssetGroup", displayField: "name", relationField: "group" }, editable: true },
      // Classification & sensitivity
      { name: "classificationId", type: "string", description: "Asset classification (Critical, High, Medium, Low)", relation: { model: "AssetClassification", displayField: "name", relationField: "classification" } },
      { name: "sensitivityId", type: "string", description: "Asset sensitivity (Public, Internal, Confidential, Restricted)", relation: { model: "AssetSensitivity", displayField: "name", relationField: "sensitivity" } },
      { name: "lifecycleStatusId", type: "string", description: "Lifecycle status (Active, In Use, Needs Maintenance, Retired)", relation: { model: "AssetLifecycleStatus", displayField: "name", relationField: "lifecycleStatus" }, editable: true },
      // Ownership
      { name: "departmentId", type: "string", description: "Department", relation: { model: "Department", displayField: "name" }, editable: true },
      { name: "ownerId", type: "string", description: "Asset owner", relation: { model: "User", displayField: "fullName", relationField: "owner" }, editable: true },
      { name: "custodianId", type: "string", description: "Asset custodian (person managing the asset)", relation: { model: "User", displayField: "fullName", relationField: "custodian" }, editable: true },
      // Dates
      { name: "acquisitionDate", type: "date", description: "Acquisition/purchase date", editable: true },
      { name: "nextReviewDate", type: "date", description: "Next review date", editable: true },
      { name: "createdAt", type: "date", description: "Date created" },
    ],
  },
  {
    prismaModel: "InternalAuditRisk",
    displayName: "Audit Risk",
    aliases: ["audit risks", "audit risk register", "risk identification", "internal audit risks", "audit risk assessment"],
    description: "Risks identified in the Internal Audit module's risk register with inherent and residual scoring",
    nameField: "riskName",
    codeField: "riskId",
    allowedRoles: AUDIT_ROLES,
    fields: [
      { name: "riskId", type: "string", description: "Risk code (e.g. RID001)" },
      { name: "riskName", type: "string", description: "Risk name/title" },
      { name: "status", type: "string", description: "Risk status", values: ["Open", "Closed", "Under Review"] },
      { name: "riskLevel", type: "string", description: "Risk level", values: ["Low", "Medium", "High", "Extreme"] },
      { name: "riskDescription", type: "string", description: "Description of the risk" },
      { name: "sectionProcess", type: "string", description: "Section/process area" },
      { name: "subProcess", type: "string", description: "Sub-process" },
      { name: "activity", type: "string", description: "Activity" },
      { name: "controlDescription", type: "string", description: "Description of controls in place" },
      { name: "controlEffectiveness", type: "string", description: "Control effectiveness", values: ["Effective", "Partially Effective", "Ineffective"] },
      { name: "inherentLikelihood", type: "number", description: "Inherent likelihood rating", aggregatable: true },
      { name: "inherentImpact", type: "number", description: "Inherent impact rating", aggregatable: true },
      { name: "inherentScore", type: "number", description: "Inherent risk score (likelihood × impact)", aggregatable: true },
      { name: "residualLikelihood", type: "number", description: "Residual likelihood rating", aggregatable: true },
      { name: "residualImpact", type: "number", description: "Residual impact rating", aggregatable: true },
      { name: "residualScore", type: "number", description: "Residual risk score", aggregatable: true },
      { name: "departmentId", type: "string", description: "Department", relation: { model: "Department", displayField: "name" } },
      { name: "categoryId", type: "string", description: "Audit category", relation: { model: "AuditCategory", displayField: "name" } },
      { name: "createdAt", type: "date", description: "Date created" },
    ],
  },
  {
    prismaModel: "AuditEngagement",
    displayName: "Audit Engagement",
    aliases: ["audits", "audit engagements", "internal audits", "audit plans"],
    description: "Internal audit engagements with planning and execution details",
    nameField: "engagementTitle",
    codeField: "auditId",
    allowedRoles: AUDIT_ROLES,
    allowedEditRoles: AUDIT_EDIT_ROLES,
    fields: [
      { name: "auditId", type: "string", description: "Audit code (e.g. AUD001)" },
      { name: "engagementTitle", type: "string", description: "Audit engagement title", editable: true },
      { name: "description", type: "string", description: "Engagement description", editable: true },
      { name: "engagementObjective", type: "string", description: "Audit objective", editable: true },
      { name: "engagementScope", type: "string", description: "Audit scope", editable: true },
      { name: "status", type: "string", description: "Engagement status", values: ["Planned", "In Progress", "Completed", "Cancelled"] },
      { name: "priority", type: "string", description: "Priority level", values: ["Low", "Medium", "High"], editable: true },
      { name: "auditType", type: "string", description: "Type of audit", editable: true },
      { name: "year", type: "number", description: "Audit year" },
      { name: "quarter", type: "string", description: "Quarter", values: ["Q1", "Q2", "Q3", "Q4"] },
      { name: "departmentId", type: "string", description: "Department", relation: { model: "Department", displayField: "name" }, editable: true },
      { name: "assignedAuditorId", type: "string", description: "Assigned auditor", relation: { model: "User", displayField: "fullName", relationField: "assignedAuditor" }, editable: true },
      { name: "auditeeId", type: "string", description: "Auditee (person being audited)", relation: { model: "User", displayField: "fullName", relationField: "auditee" }, editable: true },
      { name: "plannedStartDate", type: "date", description: "Planned start date", editable: true },
      { name: "plannedEndDate", type: "date", description: "Planned end date", editable: true },
      { name: "actualStartDate", type: "date", description: "Actual start date" },
      { name: "actualEndDate", type: "date", description: "Actual end date" },
      { name: "plannedHours", type: "number", description: "Planned hours", aggregatable: true },
      { name: "actualHours", type: "number", description: "Actual hours", aggregatable: true },
      { name: "createdAt", type: "date", description: "Date created" },
    ],
  },
  {
    prismaModel: "InternalAuditFinding",
    displayName: "Audit Finding",
    aliases: ["findings", "audit findings", "observations"],
    description: "Findings from internal audit engagements with severity and status",
    nameField: "finding",
    codeField: "findingId",
    allowedRoles: AUDIT_ROLES,
    allowedEditRoles: AUDIT_EDIT_ROLES,
    fields: [
      { name: "findingId", type: "string", description: "Finding code (e.g. FND001)" },
      { name: "finding", type: "string", description: "Finding title/summary", editable: true },
      { name: "description", type: "string", description: "Finding description/details", editable: true },
      { name: "severity", type: "string", description: "Severity level", values: ["Low", "Medium", "High", "Critical"], editable: true },
      { name: "status", type: "string", description: "Finding status", values: ["Open", "In Progress", "Closed", "Overdue", "Under Review"] },
      { name: "recommendation", type: "string", description: "Recommended corrective action", editable: true },
      { name: "departmentId", type: "string", description: "Department", relation: { model: "Department", displayField: "name" } },
      { name: "responsiblePerson", type: "string", description: "Person responsible for resolving the finding", editable: true },
      { name: "criteria", type: "string", description: "What should be (criteria)", editable: true },
      { name: "condition", type: "string", description: "What is (actual state)", editable: true },
      { name: "cause", type: "string", description: "Why it happened", editable: true },
      { name: "effect", type: "string", description: "The consequence", editable: true },
      { name: "identifiedDate", type: "date", description: "Date identified" },
      { name: "targetDate", type: "date", description: "Target closure date", editable: true },
      { name: "closedDate", type: "date", description: "Date finding was closed" },
      { name: "createdAt", type: "date", description: "Date created" },
    ],
  },
  {
    prismaModel: "TPRMVendor",
    displayName: "Vendor",
    aliases: ["vendors", "third parties", "third-party vendors", "suppliers"],
    description: "Third-party vendors with risk ratings and onboarding status",
    nameField: "name",
    codeField: "vendorCode",
    allowedRoles: TPRM_ROLES,
    allowedEditRoles: TPRM_EDIT_ROLES,
    fields: [
      { name: "vendorCode", type: "string", description: "Vendor code (e.g. VEN001)" },
      { name: "name", type: "string", description: "Vendor name", editable: true },
      { name: "status", type: "string", description: "Vendor status", values: ["Onboarding", "Onboarded", "Offboarding", "Offboarded"] },
      { name: "vrr", type: "string", description: "Vendor risk rating", values: ["Critical", "High", "Moderate", "Low", "Nominal"] },
      { name: "serviceCategory", type: "string", description: "Service category", editable: true },
      { name: "serviceDescription", type: "string", description: "Description of vendor services", editable: true },
      { name: "contactEmail", type: "string", description: "Vendor contact email", editable: true },
      { name: "contactPhone", type: "string", description: "Vendor contact phone", editable: true },
      { name: "departmentId", type: "string", description: "Department", relation: { model: "Department", displayField: "name" }, editable: true },
      { name: "cloud", type: "boolean", description: "Cloud-based vendor", editable: true },
      { name: "pii", type: "boolean", description: "Handles PII data", editable: true },
      { name: "accessToData", type: "boolean", description: "Has access to data", editable: true },
      { name: "accessToNetwork", type: "boolean", description: "Has access to network", editable: true },
      { name: "contractStartDate", type: "date", description: "Contract start date", editable: true },
      { name: "contractEndDate", type: "date", description: "Contract end date", editable: true },
      { name: "businessJustification", type: "string", description: "Business justification for engaging the vendor", editable: true },
      { name: "createdAt", type: "date", description: "Date created" },
    ],
  },
];

// ==================== HELPERS ====================

/**
 * Find a model by name or alias (case-insensitive).
 */
export function findModel(term: string): ModelMeta | undefined {
  const lower = term.toLowerCase();
  return QUERYABLE_MODELS.find(
    (m) =>
      m.prismaModel.toLowerCase() === lower ||
      m.displayName.toLowerCase() === lower ||
      m.aliases.some((a) => a.toLowerCase() === lower)
  );
}

/**
 * Build a compact schema description string for the LLM prompt.
 * Includes ALL models so the LLM can correctly identify the model name
 * even if the user doesn't have access — access control is enforced
 * at the validation layer, not the prompt layer.
 */
export function buildSchemaPrompt(_userRoles: string[]): string {
  const parts = QUERYABLE_MODELS.map((m) => {
    const fields = m.fields
      .map((f) => {
        let desc = `  - ${f.name} (${f.type}): ${f.description}`;
        if (f.values) desc += ` [${f.values.join(", ")}]`;
        if (f.relation) desc += ` → joins ${f.relation.model}.${f.relation.displayField}`;
        return desc;
      })
      .join("\n");
    return `${m.displayName} (table: ${m.prismaModel}):\n  Aliases: ${m.aliases.join(", ")}\n  Code field: ${m.codeField || "N/A"}, Name field: ${m.nameField}\n${fields}`;
  });

  return parts.join("\n\n");
}

/**
 * Get the list of model names the user can access based on roles.
 */
export function getAccessibleModelNames(userRoles: string[]): string[] {
  return QUERYABLE_MODELS
    .filter((m) => {
      if (m.allowedRoles === "all") return true;
      return userRoles.some((r) => m.allowedRoles.includes(r));
    })
    .map((m) => m.prismaModel);
}

/**
 * Get the list of model names the user can EDIT based on roles (for agent mode).
 */
export function getEditableModelNames(userRoles: string[]): string[] {
  return QUERYABLE_MODELS
    .filter((m) => {
      if (!m.allowedEditRoles || m.allowedEditRoles.length === 0) return false;
      return userRoles.some((r) => m.allowedEditRoles!.includes(r));
    })
    .map((m) => m.prismaModel);
}

/**
 * Get editable fields for a model (fields with editable: true).
 */
export function getEditableFields(modelMeta: ModelMeta): FieldMeta[] {
  return modelMeta.fields.filter((f) => f.editable);
}

/**
 * Build a schema prompt showing ONLY editable fields for agent mode.
 */
export function buildEditableSchemaPrompt(userRoles: string[]): string {
  const editableModels = QUERYABLE_MODELS.filter((m) => {
    if (!m.allowedEditRoles || m.allowedEditRoles.length === 0) return false;
    return userRoles.some((r) => m.allowedEditRoles!.includes(r));
  });

  const parts = editableModels.map((m) => {
    const editFields = m.fields.filter((f) => f.editable);
    if (editFields.length === 0) return null;

    const fields = editFields
      .map((f) => {
        let desc = `  - ${f.name} (${f.type}): ${f.description}`;
        if (f.values) desc += ` [valid values: ${f.values.join(", ")}]`;
        if (f.relation) desc += ` → set by name (e.g. "John Doe" or "IT Operations")`;
        return desc;
      })
      .join("\n");

    const identifiers = [m.codeField, m.nameField].filter(Boolean).join(" or ");
    return `${m.displayName} (table: ${m.prismaModel}):\n  Identify by: ${identifiers}\n  Editable fields:\n${fields}`;
  }).filter(Boolean);

  return parts.join("\n\n");
}
