/**
 * Translation Configuration
 *
 * Registry of all translatable models, their fields, and priorities.
 * Add new models here to make their data translatable.
 */

export const TARGET_LOCALES = ['ar', 'lv'] as const;
export type TargetLocale = (typeof TARGET_LOCALES)[number];

export interface TranslatableField {
  name: string;
  /** Max length hint for the translator (optional) */
  maxLength?: number;
}

export interface TranslatableModel {
  modelName: string;
  fields: TranslatableField[];
  /** Priority for bulk migration (1 = highest) */
  priority: number;
}

/**
 * Registry of all models whose user-entered data can be translated.
 * Sorted by priority (lower number = translated first during migration).
 */
export const TRANSLATABLE_MODELS: TranslatableModel[] = [
  // Priority 1 — Core GRC items visible on dashboards
  { modelName: 'Risk', fields: [{ name: 'name' }, { name: 'description' }, { name: 'riskSources' }], priority: 1 },
  { modelName: 'Control', fields: [{ name: 'name' }, { name: 'description' }, { name: 'controlQuestion' }], priority: 1 },
  { modelName: 'Framework', fields: [{ name: 'name' }, { name: 'description' }, { name: 'country' }, { name: 'industry' }], priority: 1 },
  { modelName: 'Policy', fields: [{ name: 'name' }], priority: 1 },

  // Priority 2 — Compliance & governance
  { modelName: 'Evidence', fields: [{ name: 'name' }, { name: 'description' }], priority: 2 },
  { modelName: 'Exception', fields: [{ name: 'name' }, { name: 'description' }], priority: 2 },
  { modelName: 'KPI', fields: [{ name: 'objective' }, { name: 'description' }, { name: 'dataSource' }, { name: 'calculationFormula' }], priority: 2 },
  { modelName: 'Requirement', fields: [{ name: 'name' }, { name: 'description' }], priority: 2 },
  { modelName: 'RequirementCategory', fields: [{ name: 'name' }, { name: 'description' }], priority: 2 },
  { modelName: 'GovernanceVaultDocument', fields: [{ name: 'fileName' }], priority: 2 },
  { modelName: 'GovernanceTemplate', fields: [{ name: 'name' }], priority: 2 },
  { modelName: 'Regulation', fields: [{ name: 'name' }, { name: 'version' }], priority: 2 },

  // Priority 3 — Risk management details
  { modelName: 'RiskAssessment', fields: [{ name: 'notes' }], priority: 3 },
  { modelName: 'RiskResponse', fields: [{ name: 'description' }], priority: 3 },
  { modelName: 'RiskControlMatrixEntry', fields: [{ name: 'notes' }], priority: 3 },
  { modelName: 'RiskCategory', fields: [{ name: 'name' }, { name: 'description' }], priority: 3 },
  { modelName: 'RiskType', fields: [{ name: 'name' }, { name: 'description' }], priority: 3 },
  { modelName: 'RiskThreat', fields: [{ name: 'name' }, { name: 'description' }], priority: 3 },
  { modelName: 'RiskVulnerability', fields: [{ name: 'name' }, { name: 'description' }], priority: 3 },
  { modelName: 'RiskCause', fields: [{ name: 'name' }], priority: 3 },

  // Priority 4 — Internal Audit
  { modelName: 'AuditEngagement', fields: [{ name: 'engagementTitle' }, { name: 'engagementObjective' }, { name: 'engagementScope' }, { name: 'initialObservation' }, { name: 'relatedPolicies' }], priority: 4 },
  { modelName: 'AuditableEntity', fields: [{ name: 'name' }, { name: 'description' }], priority: 4 },
  { modelName: 'InternalAuditFinding', fields: [{ name: 'title' }, { name: 'description' }, { name: 'recommendation' }, { name: 'criteria' }, { name: 'condition' }, { name: 'cause' }, { name: 'effect' }], priority: 4 },
  { modelName: 'InternalAuditCAPA', fields: [{ name: 'title' }, { name: 'description' }], priority: 4 },
  { modelName: 'AuditReport', fields: [{ name: 'title' }, { name: 'executiveSummary' }, { name: 'observations' }, { name: 'scope' }, { name: 'objectives' }, { name: 'methodology' }, { name: 'recommendations' }, { name: 'conclusion' }, { name: 'auditeeComment' }], priority: 4 },
  { modelName: 'AuditFinding', fields: [{ name: 'title' }, { name: 'description' }, { name: 'recommendation' }], priority: 4 },
  { modelName: 'FieldworkEvidenceRequest', fields: [{ name: 'title' }, { name: 'description' }], priority: 4 },
  { modelName: 'CAPA', fields: [{ name: 'title' }, { name: 'description' }], priority: 4 },
  { modelName: 'InternalAuditRisk', fields: [{ name: 'riskName' }, { name: 'riskDescription' }], priority: 4 },
  { modelName: 'FieldworkEvidenceAttachment', fields: [{ name: 'fileName' }], priority: 4 },
  { modelName: 'FindingAttachment', fields: [{ name: 'fileName' }], priority: 4 },
  { modelName: 'InternalAuditDocument', fields: [{ name: 'name' }, { name: 'fileName' }], priority: 4 },
  { modelName: 'AuditType', fields: [{ name: 'name' }], priority: 4 },
  { modelName: 'AuditCategory', fields: [{ name: 'name' }], priority: 4 },
  { modelName: 'AuditNatureOfControl', fields: [{ name: 'label' }], priority: 4 },
  { modelName: 'AuditPeriodicity', fields: [{ name: 'interval' }], priority: 4 },
  { modelName: 'AuditRiskFactor', fields: [{ name: 'label' }], priority: 4 },
  { modelName: 'AuditProbability', fields: [{ name: 'label' }], priority: 4 },
  { modelName: 'AuditImpact', fields: [{ name: 'label' }], priority: 4 },
  { modelName: 'AuditScoringRange', fields: [{ name: 'label' }], priority: 4 },

  // Priority 5 — TPRM
  { modelName: 'TPRMVendor', fields: [{ name: 'name' }, { name: 'serviceCategory' }], priority: 5 },
  { modelName: 'TPRMAssessment', fields: [{ name: 'questionnaireTemplate' }, { name: 'approverComment' }], priority: 5 },
  { modelName: 'TPRMVendorIssue', fields: [{ name: 'title' }, { name: 'description' }, { name: 'resolution' }], priority: 5 },
  { modelName: 'TPRMIssueRemediation', fields: [{ name: 'issue' }, { name: 'risk' }, { name: 'recommendation' }, { name: 'description' }], priority: 5 },
  { modelName: 'TPRMAssessmentResponse', fields: [{ name: 'assessorIssue' }, { name: 'assessorRisk' }, { name: 'assessorRecommendation' }, { name: 'assessorComment' }], priority: 5 },

  // Priority 6 — TPRM Master Data
  { modelName: 'TPRMDomain', fields: [{ name: 'name' }, { name: 'description' }], priority: 6 },
  { modelName: 'TPRMMasterQuestion', fields: [{ name: 'questionText' }, { name: 'verifaiPrompt' }, { name: 'evidence' }, { name: 'issue' }, { name: 'risk' }, { name: 'recommendation' }], priority: 6 },
  { modelName: 'TPRMQuestionnaireTemplate', fields: [{ name: 'templateName' }, { name: 'frameworkName' }], priority: 6 },
  { modelName: 'TPRMServiceCategory', fields: [{ name: 'name' }], priority: 6 },
  { modelName: 'TPRMDiscipline', fields: [{ name: 'name' }], priority: 6 },
  { modelName: 'TPRMDepartment', fields: [{ name: 'name' }], priority: 6 },
  { modelName: 'TPRMOnboardingQuestion', fields: [{ name: 'title' }, { name: 'question' }], priority: 6 },
  { modelName: 'TPRMOffboardingQuestion', fields: [{ name: 'title' }, { name: 'question' }], priority: 6 },
  { modelName: 'TPRMScorecardFactor', fields: [{ name: 'name' }], priority: 6 },
  { modelName: 'TPRMClarification', fields: [{ name: 'rejectComment' }, { name: 'amResponse' }], priority: 6 },
  { modelName: 'TPRMInternalComment', fields: [{ name: 'message' }], priority: 6 },
  { modelName: 'TPRMRemediationComment', fields: [{ name: 'message' }], priority: 6 },

  // Priority 5 — QPost Compliance (client-specific duplicated module)
  { modelName: 'QPostFramework', fields: [{ name: 'name' }, { name: 'code' }, { name: 'description' }, { name: 'type' }, { name: 'country' }, { name: 'industry' }], priority: 5 },
  { modelName: 'QPostRequirement', fields: [{ name: 'name' }, { name: 'code' }, { name: 'description' }], priority: 5 },
  { modelName: 'QPostRequirementCategory', fields: [{ name: 'name' }, { name: 'code' }, { name: 'description' }], priority: 5 },
  { modelName: 'QPostPolicy', fields: [{ name: 'name' }], priority: 5 },
  { modelName: 'QPostEvidence', fields: [{ name: 'name' }, { name: 'description' }], priority: 5 },
  { modelName: 'QPostException', fields: [{ name: 'name' }, { name: 'description' }], priority: 5 },
  { modelName: 'QPostKPI', fields: [{ name: 'objective' }, { name: 'description' }, { name: 'dataSource' }, { name: 'calculationFormula' }], priority: 5 },
  { modelName: 'QPostGovernanceVaultDocument', fields: [{ name: 'fileName' }], priority: 5 },
  { modelName: 'QPostGovernanceTemplate', fields: [{ name: 'name' }], priority: 5 },
  { modelName: 'QPostPolicyManualReview', fields: [{ name: 'comments' }, { name: 'findings' }, { name: 'recommendation' }], priority: 5 },
  { modelName: 'QPostEvidenceManualReview', fields: [{ name: 'comments' }, { name: 'findings' }, { name: 'recommendation' }], priority: 5 },

  // Priority 5 — Organization & accounts
  { modelName: 'CustomerAccount', fields: [{ name: 'name' }], priority: 5 },
  { modelName: 'User', fields: [{ name: 'fullName' }, { name: 'firstName' }, { name: 'lastName' }, { name: 'designation' }], priority: 5 },
  { modelName: 'Organization', fields: [{ name: 'name' }, { name: 'description' }, { name: 'vision' }, { name: 'mission' }, { name: 'value' }, { name: 'ceoMessage' }, { name: 'headOfficeLocation' }, { name: 'headOfficeAddress' }], priority: 5 },
  { modelName: 'Branch', fields: [{ name: 'location' }, { name: 'address' }], priority: 5 },
  { modelName: 'DataCenter', fields: [{ name: 'locationType' }, { name: 'address' }, { name: 'vendor' }], priority: 5 },
  { modelName: 'CloudProvider', fields: [{ name: 'name' }, { name: 'serviceType' }], priority: 5 },
  { modelName: 'Department', fields: [{ name: 'name' }, { name: 'description' }], priority: 5 },
  { modelName: 'Process', fields: [{ name: 'name' }, { name: 'description' }], priority: 5 },
  { modelName: 'Asset', fields: [{ name: 'name' }, { name: 'description' }], priority: 5 },
  { modelName: 'Service', fields: [{ name: 'title' }, { name: 'description' }, { name: 'serviceCategory' }, { name: 'serviceItem' }], priority: 5 },
  { modelName: 'Stakeholder', fields: [{ name: 'name' }], priority: 5 },
  { modelName: 'Issue', fields: [{ name: 'title' }, { name: 'description' }, { name: 'domain' }, { name: 'category' }], priority: 5 },

  // Priority 6 — Organization settings
  { modelName: 'OrganizationLocation', fields: [{ name: 'name' }], priority: 6 },
  { modelName: 'ProcessFrequency', fields: [{ name: 'name' }], priority: 6 },
  { modelName: 'NatureOfImplementation', fields: [{ name: 'name' }], priority: 6 },
  { modelName: 'Designation', fields: [{ name: 'name' }], priority: 6 },
  { modelName: 'UserDocumentType', fields: [{ name: 'name' }], priority: 6 },
  { modelName: 'BIACategory', fields: [{ name: 'name' }, { name: 'description' }], priority: 6 },
  { modelName: 'BIARating', fields: [{ name: 'label' }, { name: 'description' }], priority: 6 },
  { modelName: 'BIAScoringRange', fields: [{ name: 'label' }], priority: 6 },
  { modelName: 'BCPLabel', fields: [{ name: 'name' }, { name: 'description' }], priority: 6 },

  // Priority 6 — Master data / settings
  { modelName: 'ControlDomain', fields: [{ name: 'name' }], priority: 6 },
  { modelName: 'AssetCategory', fields: [{ name: 'name' }, { name: 'description' }], priority: 6 },
  { modelName: 'AssetSubCategory', fields: [{ name: 'name' }], priority: 6 },
  { modelName: 'AssetGroup', fields: [{ name: 'name' }], priority: 6 },
  { modelName: 'AssetLifecycleStatus', fields: [{ name: 'name' }, { name: 'description' }], priority: 6 },
  { modelName: 'AssetSensitivity', fields: [{ name: 'name' }, { name: 'description' }], priority: 6 },
  { modelName: 'CIARating', fields: [{ name: 'label' }], priority: 6 },

  // Priority 6 — Risk settings / rating scales
  { modelName: 'RiskLikelihood', fields: [{ name: 'title' }, { name: 'timeFrame' }, { name: 'probability' }], priority: 6 },
  { modelName: 'ImpactCategory', fields: [{ name: 'name' }], priority: 6 },
  { modelName: 'ImpactRating', fields: [{ name: 'name' }, { name: 'description' }], priority: 6 },
  { modelName: 'RiskRange', fields: [{ name: 'title' }, { name: 'description' }], priority: 6 },
  { modelName: 'VulnerabilityCategory', fields: [{ name: 'name' }], priority: 6 },
  { modelName: 'ThreatCategory', fields: [{ name: 'name' }], priority: 6 },
  { modelName: 'VulnerabilityRating', fields: [{ name: 'label' }], priority: 6 },
  { modelName: 'ControlStrength', fields: [{ name: 'name' }], priority: 6 },
  { modelName: 'RiskSubCategory', fields: [{ name: 'type' }], priority: 6 },
  { modelName: 'RiskSetting', fields: [{ name: 'label' }, { name: 'description' }], priority: 6 },
];

// Lookup maps for fast access
const modelMap = new Map<string, TranslatableModel>();
for (const model of TRANSLATABLE_MODELS) {
  modelMap.set(model.modelName, model);
}

/**
 * Get translatable field definitions for a model.
 * Returns empty array if model is not registered.
 */
export function getTranslatableFields(modelName: string): TranslatableField[] {
  return modelMap.get(modelName)?.fields ?? [];
}

/**
 * Check if a model has any translatable fields.
 */
export function isTranslatable(modelName: string): boolean {
  return modelMap.has(modelName);
}

/**
 * Get the priority level for a model (for migration ordering).
 * Returns Infinity if model is not registered.
 */
export function getModelPriority(modelName: string): number {
  return modelMap.get(modelName)?.priority ?? Infinity;
}

/**
 * Get all registered model names grouped by priority.
 */
export function getModelsByPriority(): Map<number, string[]> {
  const grouped = new Map<number, string[]>();
  for (const model of TRANSLATABLE_MODELS) {
    const list = grouped.get(model.priority) ?? [];
    list.push(model.modelName);
    grouped.set(model.priority, list);
  }
  return grouped;
}
