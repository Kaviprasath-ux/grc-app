/**
 * ai-endpoints.ts
 *
 * Single source of truth for all RunPod AI API endpoints.
 * All AI API calls should reference these constants.
 */

// ============================================================================
// RUNPOD AI API ENDPOINTS
// ============================================================================

export const AI_ENDPOINTS = {
  // ─────────────────────────────────────────────────────────────────────────
  // Document Ingestion
  // ─────────────────────────────────────────────────────────────────────────
  INGEST: '/api/grc_ingest',
  INGEST_STATUS: '/api/grc_ingest_status',
  INGEST_RESULT: '/api/grc_ingest_result',

  // ─────────────────────────────────────────────────────────────────────────
  // Policy/Governance
  // ─────────────────────────────────────────────────────────────────────────
  POLICY_QUERY: '/api/grc_policy_query',
  GENERATE_POLICY: '/api/generate_policy/',
  REGENERATE_POLICY: '/api/regenerate_policy/',

  // ─────────────────────────────────────────────────────────────────────────
  // Evidence
  // ─────────────────────────────────────────────────────────────────────────
  EVIDENCE_QUERY: '/api/grc_evidence_query',
  EVIDENCE_VAULT_QUERY: '/api/grc_evidence_vault_query',

  // ─────────────────────────────────────────────────────────────────────────
  // Compliance Self-Assessment
  // ─────────────────────────────────────────────────────────────────────────
  SELF_ASSESSMENT_QUERY: '/api/grc_selfassesment_query',
  CONTROL_CODE_QUERY: '/api/control_code_query',

  // ─────────────────────────────────────────────────────────────────────────
  // Risk Evaluation
  // ─────────────────────────────────────────────────────────────────────────
  GENERATE_RISK: '/api/generate_process_asset_risk_v2',
  SEMANTIC_MATCH: '/api/semanticMatch_process_asset_riskV2',
  SEMANTIC_MATCH_STATUS: '/api/semanticMatch_process_asset_riskV2_status',
  SEMANTIC_MATCH_RESULT: '/api/semanticMatch_process_asset_riskV2_result',

  // ─────────────────────────────────────────────────────────────────────────
  // Control Extraction
  // ─────────────────────────────────────────────────────────────────────────
  EXTRACT_CONTROLS: '/api/extract_process_controls',

  // ─────────────────────────────────────────────────────────────────────────
  // Framework Generation
  // ─────────────────────────────────────────────────────────────────────────
  GENERATE_FRAMEWORK: '/api/generate_framework',
  GENERATE_FRAMEWORK_JOB: '/api/generate_framework_job',
  FRAMEWORK_STATUS: '/api/framework_status',
  FRAMEWORK_RESULT: '/api/framework_result',

  // ─────────────────────────────────────────────────────────────────────────
  // Internal Audit
  // ─────────────────────────────────────────────────────────────────────────
  AUDIT_INGEST: '/api/audit_ingest',
  AUDIT_INGEST_STATUS: '/api/audit_ingest_status',
  AUDIT_INGEST_RESULT: '/api/audit_ingest_result',
  AUDIT_QUERY: '/api/audit_query',
  SIMPLE_QUERY: '/api/simple_query',
  DOCUMENT_SEARCH: '/api/document_search',

  // ─────────────────────────────────────────────────────────────────────────
  // Document Library Ingestion (simple_ingest)
  // ─────────────────────────────────────────────────────────────────────────
  SIMPLE_INGEST: '/api/simple_ingest',
  SIMPLE_INGEST_STATUS: '/api/simple_ingest_status',
  SIMPLE_INGEST_RESULT: '/api/simple_ingest_result',
  RISK_SUGGEST: '/api/risk_suggest',
  GENERATE_WORKPAPERS: '/api/generate_workpapers',
  GENERATE_AUDIT_PLAN: '/api/generate_audit_plan',

  // ─────────────────────────────────────────────────────────────────────────
  // TPRM (Third-Party Risk Management)
  // ─────────────────────────────────────────────────────────────────────────
  TPRM_INGEST: '/api/ingest',
  TPRM_IMAGE: '/api/image',
  TPRM_QUERY: '/api/query',

  // ─────────────────────────────────────────────────────────────────────────
  // Translation
  // ─────────────────────────────────────────────────────────────────────────
  TRANSLATE: '/api/translate',

  // ─────────────────────────────────────────────────────────────────────────
  // Cleanup
  // ─────────────────────────────────────────────────────────────────────────
  DELETE: '/api/grc_delete',
} as const;

// Type for endpoint values
export type AIEndpoint = typeof AI_ENDPOINTS[keyof typeof AI_ENDPOINTS];

// ============================================================================
// ENDPOINT METADATA (for logging and documentation)
// ============================================================================

export const ENDPOINT_NAMES: Record<string, string> = {
  [AI_ENDPOINTS.INGEST]: 'Document Ingest',
  [AI_ENDPOINTS.INGEST_STATUS]: 'Ingest Status Check',
  [AI_ENDPOINTS.INGEST_RESULT]: 'Ingest Result Fetch',
  [AI_ENDPOINTS.POLICY_QUERY]: 'Policy Review',
  [AI_ENDPOINTS.EVIDENCE_QUERY]: 'Evidence Review',
  [AI_ENDPOINTS.EVIDENCE_VAULT_QUERY]: 'Evidence Vault Query',
  [AI_ENDPOINTS.GENERATE_POLICY]: 'Policy Generation',
  [AI_ENDPOINTS.REGENERATE_POLICY]: 'Policy Regeneration',
  [AI_ENDPOINTS.DELETE]: 'Document Cleanup',
  [AI_ENDPOINTS.GENERATE_RISK]: 'Risk Evaluation',
  [AI_ENDPOINTS.SEMANTIC_MATCH]: 'Semantic Matching',
  [AI_ENDPOINTS.SEMANTIC_MATCH_STATUS]: 'Semantic Match Status',
  [AI_ENDPOINTS.SEMANTIC_MATCH_RESULT]: 'Semantic Match Result',
  [AI_ENDPOINTS.EXTRACT_CONTROLS]: 'Control Extraction',
  [AI_ENDPOINTS.GENERATE_FRAMEWORK]: 'Framework Generation',
  [AI_ENDPOINTS.GENERATE_FRAMEWORK_JOB]: 'Framework Generation Job',
  [AI_ENDPOINTS.FRAMEWORK_STATUS]: 'Framework Status',
  [AI_ENDPOINTS.FRAMEWORK_RESULT]: 'Framework Result',
  [AI_ENDPOINTS.CONTROL_CODE_QUERY]: 'Control Code Query',
  [AI_ENDPOINTS.AUDIT_INGEST]: 'Audit Document Ingest',
  [AI_ENDPOINTS.AUDIT_INGEST_STATUS]: 'Audit Ingest Status',
  [AI_ENDPOINTS.AUDIT_INGEST_RESULT]: 'Audit Ingest Result',
  [AI_ENDPOINTS.AUDIT_QUERY]: 'Audit Query',
  [AI_ENDPOINTS.SIMPLE_QUERY]: 'Simple Query',
  [AI_ENDPOINTS.DOCUMENT_SEARCH]: 'Document Search',
  [AI_ENDPOINTS.RISK_SUGGEST]: 'Risk Suggestion',
  [AI_ENDPOINTS.GENERATE_WORKPAPERS]: 'Workpapers Generation',
  [AI_ENDPOINTS.GENERATE_AUDIT_PLAN]: 'Audit Plan Generation',
  [AI_ENDPOINTS.SIMPLE_INGEST]: 'Document Library Ingest',
  [AI_ENDPOINTS.SIMPLE_INGEST_STATUS]: 'Document Library Ingest Status',
  [AI_ENDPOINTS.SIMPLE_INGEST_RESULT]: 'Document Library Ingest Result',
  [AI_ENDPOINTS.TPRM_INGEST]: 'TPRM Document Ingest',
  [AI_ENDPOINTS.TPRM_IMAGE]: 'TPRM Image Analysis',
  [AI_ENDPOINTS.TPRM_QUERY]: 'TPRM AI Query',
  [AI_ENDPOINTS.TRANSLATE]: 'Text Translation',
};

/**
 * Get human-readable name for an endpoint
 */
export function getEndpointName(endpoint: string): string {
  // Check exact match first
  if (ENDPOINT_NAMES[endpoint]) return ENDPOINT_NAMES[endpoint];

  // Check if endpoint starts with any known pattern (for dynamic routes)
  for (const [pattern, name] of Object.entries(ENDPOINT_NAMES)) {
    if (endpoint.startsWith(pattern)) return name;
  }

  return endpoint;
}
