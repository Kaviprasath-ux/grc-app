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
  { modelName: 'Control', fields: [{ name: 'name' }, { name: 'description' }], priority: 1 },
  { modelName: 'Framework', fields: [{ name: 'name' }, { name: 'description' }], priority: 1 },
  { modelName: 'Policy', fields: [{ name: 'title' }, { name: 'description' }], priority: 1 },

  // Priority 2 — Compliance & governance
  { modelName: 'Evidence', fields: [{ name: 'name' }, { name: 'description' }], priority: 2 },
  { modelName: 'Exception', fields: [{ name: 'title' }, { name: 'description' }, { name: 'justification' }], priority: 2 },
  { modelName: 'KPI', fields: [{ name: 'name' }, { name: 'description' }], priority: 2 },
  { modelName: 'Requirement', fields: [{ name: 'name' }, { name: 'description' }], priority: 2 },
  { modelName: 'RequirementCategory', fields: [{ name: 'name' }, { name: 'description' }], priority: 2 },
  { modelName: 'GovernanceVaultDocument', fields: [{ name: 'title' }, { name: 'description' }], priority: 2 },
  { modelName: 'Regulation', fields: [{ name: 'name' }, { name: 'description' }], priority: 2 },

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
  { modelName: 'AuditEngagement', fields: [{ name: 'title' }, { name: 'objective' }, { name: 'scope' }], priority: 4 },
  { modelName: 'AuditableEntity', fields: [{ name: 'name' }, { name: 'description' }], priority: 4 },
  { modelName: 'InternalAuditFinding', fields: [{ name: 'title' }, { name: 'description' }, { name: 'recommendation' }], priority: 4 },
  { modelName: 'InternalAuditCAPA', fields: [{ name: 'title' }, { name: 'description' }], priority: 4 },
  { modelName: 'AuditReport', fields: [{ name: 'title' }, { name: 'executiveSummary' }], priority: 4 },
  { modelName: 'AuditFinding', fields: [{ name: 'title' }, { name: 'description' }, { name: 'recommendation' }], priority: 4 },
  { modelName: 'CAPA', fields: [{ name: 'title' }, { name: 'description' }], priority: 4 },
  { modelName: 'InternalAuditRisk', fields: [{ name: 'name' }, { name: 'description' }], priority: 4 },

  // Priority 5 — Organization & assets
  { modelName: 'User', fields: [{ name: 'fullName' }], priority: 5 },
  { modelName: 'Organization', fields: [{ name: 'name' }, { name: 'description' }], priority: 5 },
  { modelName: 'Department', fields: [{ name: 'name' }, { name: 'description' }], priority: 5 },
  { modelName: 'Process', fields: [{ name: 'name' }, { name: 'description' }], priority: 5 },
  { modelName: 'Asset', fields: [{ name: 'name' }, { name: 'description' }], priority: 5 },
  { modelName: 'Service', fields: [{ name: 'title' }, { name: 'description' }], priority: 5 },
  { modelName: 'Stakeholder', fields: [{ name: 'name' }], priority: 5 },
  { modelName: 'Issue', fields: [{ name: 'title' }, { name: 'description' }], priority: 5 },

  // Priority 6 — Organization settings
  { modelName: 'OrganizationLocation', fields: [{ name: 'name' }], priority: 6 },
  { modelName: 'ProcessFrequency', fields: [{ name: 'name' }], priority: 6 },
  { modelName: 'NatureOfImplementation', fields: [{ name: 'name' }], priority: 6 },
  { modelName: 'Designation', fields: [{ name: 'name' }], priority: 6 },
  { modelName: 'BIACategory', fields: [{ name: 'name' }, { name: 'description' }], priority: 6 },
  { modelName: 'BIARating', fields: [{ name: 'label' }, { name: 'description' }], priority: 6 },
  { modelName: 'BIAScoringRange', fields: [{ name: 'label' }], priority: 6 },
  { modelName: 'BCPLabel', fields: [{ name: 'name' }, { name: 'description' }], priority: 6 },

  // Priority 6 — Master data / settings
  { modelName: 'ControlDomain', fields: [{ name: 'name' }, { name: 'description' }], priority: 6 },
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
