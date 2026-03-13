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
  /** Which roles can query this model */
  allowedRoles: string[] | "all";
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
//   GRC (Risk):       Risk
//   GRC (Asset):      Asset
//   Internal Audit:   AuditEngagement, InternalAuditFinding
//   TPRM:             TPRMVendor

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
  "AuditHead", "AuditManager", "Auditor", "Auditee",
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

// ==================== QUERYABLE MODELS ====================

export const QUERYABLE_MODELS: ModelMeta[] = [
  {
    prismaModel: "Risk",
    displayName: "Risk",
    aliases: ["risks", "risk register", "risk management"],
    description: "Risks identified in the risk register with assessment scores and status",
    nameField: "name",
    codeField: "riskId",
    allowedRoles: GRC_RISK_ROLES,
    fields: [
      { name: "riskId", type: "string", description: "Risk code (e.g. RSK-001)" },
      { name: "name", type: "string", description: "Risk name/title" },
      { name: "description", type: "string", description: "Risk description/details" },
      { name: "riskSources", type: "string", description: "Source/origin of the risk" },
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
      { name: "responseStrategy", type: "string", description: "Risk response strategy", values: ["Treat", "Transfer", "Avoid", "Accept"] },
      { name: "assessmentStatus", type: "string", description: "Assessment status", values: ["Open", "In-Progress", "Draft", "Submitted", "Approved", "Rejected", "Completed"] },
      { name: "responseStatus", type: "string", description: "Response status", values: ["Open", "In-Progress", "Awaiting Approval", "Sent Back", "Completed"] },
      { name: "treatmentPlan", type: "string", description: "Risk treatment plan" },
      { name: "treatmentDueDate", type: "date", description: "Treatment due date" },
      { name: "treatmentStatus", type: "string", description: "Treatment status", values: ["Not Started", "In Progress", "Completed"] },
      // Relations
      { name: "departmentId", type: "string", description: "Department", relation: { model: "Department", displayField: "name" } },
      { name: "categoryId", type: "string", description: "Risk category", relation: { model: "RiskCategory", displayField: "name" } },
      { name: "typeId", type: "string", description: "Risk type", relation: { model: "RiskType", displayField: "name" } },
      { name: "ownerId", type: "string", description: "Risk owner (person responsible for managing the risk)", relation: { model: "User", displayField: "fullName", relationField: "owner" } },
      { name: "impactedAssetId", type: "string", description: "Impacted asset", relation: { model: "Asset", displayField: "name", relationField: "impactedAsset" } },
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
    fields: [
      { name: "controlCode", type: "string", description: "Control code (e.g. AC-1)" },
      { name: "name", type: "string", description: "Control name/title" },
      { name: "description", type: "string", description: "Control description/details" },
      { name: "status", type: "string", description: "Compliance status", values: ["Non Compliant", "Compliant", "Not Applicable", "Partial Compliant"] },
      { name: "scope", type: "string", description: "Scope", values: ["In-Scope", "Not In-Scope"] },
      { name: "functionalGrouping", type: "string", description: "Functional grouping", values: ["Govern", "Identify", "Protect", "Detect", "Respond", "Recover"] },
      { name: "departmentId", type: "string", description: "Department", relation: { model: "Department", displayField: "name" } },
      { name: "frameworkId", type: "string", description: "Framework", relation: { model: "Framework", displayField: "name" } },
      { name: "ownerId", type: "string", description: "Control owner (person responsible)", relation: { model: "User", displayField: "fullName", relationField: "owner" } },
      { name: "assigneeId", type: "string", description: "Control assignee (person assigned to implement/manage)", relation: { model: "User", displayField: "fullName", relationField: "assignee" } },
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
    fields: [
      { name: "code", type: "string", description: "Policy code" },
      { name: "name", type: "string", description: "Policy name/title" },
      { name: "description", type: "string", description: "Policy description" },
      { name: "documentType", type: "string", description: "Document type", values: ["Policy", "Standard", "Procedure"] },
      { name: "status", type: "string", description: "Policy status", values: ["Not Uploaded", "Draft", "Approved", "Needs Review", "Published", "Pending Approval"] },
      { name: "version", type: "string", description: "Policy version" },
      { name: "departmentId", type: "string", description: "Department", relation: { model: "Department", displayField: "name" } },
      { name: "assigneeId", type: "string", description: "Policy assignee (person responsible for the policy)", relation: { model: "User", displayField: "fullName", relationField: "assignee" } },
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
    fields: [
      { name: "evidenceCode", type: "string", description: "Evidence code" },
      { name: "name", type: "string", description: "Evidence name/title" },
      { name: "description", type: "string", description: "Evidence description" },
      { name: "status", type: "string", description: "Evidence status", values: ["Not Uploaded", "Draft", "Validated", "Published", "Need Attention"] },
      { name: "domain", type: "string", description: "Domain area" },
      { name: "departmentId", type: "string", description: "Department", relation: { model: "Department", displayField: "name" } },
      { name: "frameworkId", type: "string", description: "Framework", relation: { model: "Framework", displayField: "name" } },
      { name: "assigneeId", type: "string", description: "Evidence assignee (person responsible)", relation: { model: "User", displayField: "fullName" } },
      { name: "dueDate", type: "date", description: "Due date" },
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
    fields: [
      { name: "assetId", type: "string", description: "Asset code" },
      { name: "name", type: "string", description: "Asset name" },
      { name: "description", type: "string", description: "Asset description" },
      { name: "assetType", type: "string", description: "Asset type", values: ["Hardware", "Software", "Information", "People", "Services", "Facility"] },
      { name: "status", type: "string", description: "Asset status", values: ["Active", "Retired"] },
      { name: "value", type: "number", description: "Asset monetary value", aggregatable: true },
      { name: "location", type: "string", description: "Asset location" },
      // Category hierarchy
      { name: "categoryId", type: "string", description: "Asset category (e.g. IT Equipment, Vehicles)", relation: { model: "AssetCategory", displayField: "name", relationField: "category" } },
      { name: "subCategoryId", type: "string", description: "Asset sub-category", relation: { model: "AssetSubCategory", displayField: "name", relationField: "subCategory" } },
      { name: "groupId", type: "string", description: "Asset group", relation: { model: "AssetGroup", displayField: "name", relationField: "group" } },
      // Classification & sensitivity
      { name: "classificationId", type: "string", description: "Asset classification (Critical, High, Medium, Low)", relation: { model: "AssetClassification", displayField: "name", relationField: "classification" } },
      { name: "sensitivityId", type: "string", description: "Asset sensitivity (Public, Internal, Confidential, Restricted)", relation: { model: "AssetSensitivity", displayField: "name", relationField: "sensitivity" } },
      { name: "lifecycleStatusId", type: "string", description: "Lifecycle status (Active, In Use, Needs Maintenance, Retired)", relation: { model: "AssetLifecycleStatus", displayField: "name", relationField: "lifecycleStatus" } },
      // Ownership
      { name: "departmentId", type: "string", description: "Department", relation: { model: "Department", displayField: "name" } },
      { name: "ownerId", type: "string", description: "Asset owner", relation: { model: "User", displayField: "fullName", relationField: "owner" } },
      { name: "custodianId", type: "string", description: "Asset custodian (person managing the asset)", relation: { model: "User", displayField: "fullName", relationField: "custodian" } },
      // Dates
      { name: "acquisitionDate", type: "date", description: "Acquisition/purchase date" },
      { name: "nextReviewDate", type: "date", description: "Next review date" },
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
    fields: [
      { name: "auditId", type: "string", description: "Audit code (e.g. AUD001)" },
      { name: "engagementTitle", type: "string", description: "Audit engagement title" },
      { name: "description", type: "string", description: "Engagement description" },
      { name: "engagementObjective", type: "string", description: "Audit objective" },
      { name: "engagementScope", type: "string", description: "Audit scope" },
      { name: "status", type: "string", description: "Engagement status", values: ["Planned", "In Progress", "Completed", "Cancelled"] },
      { name: "priority", type: "string", description: "Priority level", values: ["Low", "Medium", "High"] },
      { name: "auditType", type: "string", description: "Type of audit" },
      { name: "year", type: "number", description: "Audit year" },
      { name: "quarter", type: "string", description: "Quarter", values: ["Q1", "Q2", "Q3", "Q4"] },
      { name: "departmentId", type: "string", description: "Department", relation: { model: "Department", displayField: "name" } },
      { name: "assignedAuditorId", type: "string", description: "Assigned auditor", relation: { model: "User", displayField: "fullName", relationField: "assignedAuditor" } },
      { name: "auditeeId", type: "string", description: "Auditee (person being audited)", relation: { model: "User", displayField: "fullName", relationField: "auditee" } },
      { name: "plannedStartDate", type: "date", description: "Planned start date" },
      { name: "plannedEndDate", type: "date", description: "Planned end date" },
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
    fields: [
      { name: "findingId", type: "string", description: "Finding code (e.g. FND001)" },
      { name: "finding", type: "string", description: "Finding title/summary" },
      { name: "description", type: "string", description: "Finding description/details" },
      { name: "severity", type: "string", description: "Severity level", values: ["Low", "Medium", "High", "Critical"] },
      { name: "status", type: "string", description: "Finding status", values: ["Open", "In Progress", "Closed", "Overdue", "Under Review"] },
      { name: "recommendation", type: "string", description: "Recommended corrective action" },
      { name: "departmentId", type: "string", description: "Department", relation: { model: "Department", displayField: "name" } },
      { name: "responsiblePerson", type: "string", description: "Person responsible for resolving the finding" },
      { name: "identifiedDate", type: "date", description: "Date identified" },
      { name: "targetDate", type: "date", description: "Target closure date" },
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
    fields: [
      { name: "vendorCode", type: "string", description: "Vendor code (e.g. VEN001)" },
      { name: "name", type: "string", description: "Vendor name" },
      { name: "status", type: "string", description: "Vendor status", values: ["Onboarding", "Onboarded", "Offboarding", "Offboarded"] },
      { name: "vrr", type: "string", description: "Vendor risk rating", values: ["Critical", "High", "Moderate", "Low", "Nominal"] },
      { name: "serviceCategory", type: "string", description: "Service category" },
      { name: "serviceDescription", type: "string", description: "Description of vendor services" },
      { name: "contactEmail", type: "string", description: "Vendor contact email" },
      { name: "contactPhone", type: "string", description: "Vendor contact phone" },
      { name: "departmentId", type: "string", description: "Department", relation: { model: "Department", displayField: "name" } },
      { name: "cloud", type: "boolean", description: "Cloud-based vendor" },
      { name: "pii", type: "boolean", description: "Handles PII data" },
      { name: "accessToData", type: "boolean", description: "Has access to data" },
      { name: "accessToNetwork", type: "boolean", description: "Has access to network" },
      { name: "contractStartDate", type: "date", description: "Contract start date" },
      { name: "contractEndDate", type: "date", description: "Contract end date" },
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
