/**
 * TypeScript type definitions for AI Risk Evaluation APIs
 *
 * These types define the request/response structures for:
 * 1. Risk Generation API
 * 2. Semantic Matching API (3-step async flow)
 */

// ==================== RISK GENERATION API ====================

export interface ProcessDetails {
    Process_name: string;
    Process_description: string;
    Department?: string;
}

export interface AssetsDetails {
    Asset_group_name: string;
}

export interface RiskGenerationRequest {
    Process_Details?: ProcessDetails;
    Assets_Details?: AssetsDetails;
}

// Risk item from API response
export interface RiskItem {
    // Actual API fields
    Risk_name?: string;
    Risk_description?: string;
    Risk_category?: string;
    Inherent_risk_rating?: string;
    Threats?: any[];
    // Legacy fields (for backward compatibility)
    title?: string;
    description?: string;
    level?: string;
    inherent_likelihood?: string;
    inherent_impact?: string;
}

// Response from /api/generate_process_asset_risk_v2
// Actual API returns: {risks: [...], status: "success"}
export interface RiskGenerationResponse {
    risks?: RiskItem[];  // API returns 'risks' not 'generated_risks'
    status?: string;     // API returns 'status': 'success'
    // Legacy fields (for backward compatibility)
    generated_risks?: RiskItem[];
    total_risks?: number;
    status_code?: string | number;
    timestamp?: string;
    department?: string;
    specific_audit_focus?: string;
    // Allow any additional fields from the API
    [key: string]: any;
}

// ==================== SEMANTIC MATCHING API ====================

// Library structures
export interface ControlLibraryItem {
    Control_Name: string;
    Control_Code: string;
}

export interface ThreatLibraryItem {
    Threats_name: string;
    Threats_code: string;
}

export interface VulnerabilityLibraryItem {
    Vulnerabilities_name: string;
    Vulnerabilities_code: string;
}

export interface RiskLibraryItem {
    Risk_name: string;
    Risk_code: string;
}

export interface ExistingLibrary {
    Control_Library: ControlLibraryItem[];
    Threats_library: ThreatLibraryItem[];
    Vulnerabilities_library: VulnerabilityLibraryItem[];
    Risk_Library: RiskLibraryItem[];
}

// Generated risk structures
export interface GeneratedControl {
    ControlName: string;
    control_functionalGrouping: string;
}

export interface GeneratedThreat {
    threat_name: string;
    controls: GeneratedControl[];
    Vulnerabilities: string[];
}

export interface GeneratedRisk {
    Risk_name: string;
    Risk_description: string;
    Risk_category: string;
    Inherent_risk_rating: string;
    Threats: GeneratedThreat[];
}

export interface GeneratedRiskData {
    risks: GeneratedRisk[];
}

// Semantic matching request
export interface SemanticMatchingRequest {
    existing_library: string; // JSON string of ExistingLibrary
    generated_risk: string;   // JSON string of GeneratedRiskData
}

// Semantic matching responses
export interface SemanticMatchingJobResponse {
    job_id: string;
    status: 'queued' | 'processing' | 'completed' | 'error' | 'not_found';
}

export interface SemanticMatchingStatusResponse {
    job_id: string;
    status: 'queued' | 'processing' | 'completed' | 'error' | 'not_found';
    error?: string | null;
}

// Matched result structures
export interface MatchedControl {
    ControlName: string;
    control_functionalGrouping: string;
    Is_Matched: boolean;
    Matched_Control_Code?: string;
    Similarity_Score?: number;
}

export interface MatchedVulnerability {
    vulnerability_name: string;
    Is_Matched: boolean;
    Matched_Vulnerability_Code?: string;
    Similarity_Score?: number;
}

export interface MatchedThreat {
    threat_name: string;
    Is_Matched: boolean;
    Matched_Threat_Code?: string;
    Similarity_Score?: number;
    controls: MatchedControl[];
    Vulnerabilities: MatchedVulnerability[];
}

export interface MatchedRisk {
    Risk_name: string;
    Risk_description: string;
    Risk_category: string;
    Is_Matched: boolean;
    Matched_Risk_Code?: string;
    Similarity_Score?: number;
    Inherent_risk_rating: string;
    Threats: MatchedThreat[];
}

export interface SemanticMatchingResults {
    risks: MatchedRisk[];
}

export interface SemanticMatchingResultResponse {
    results?: SemanticMatchingResults;
    status: 'success' | 'processing' | 'not_found' | 'error';
    job_id?: string;
    error?: string | null;
    message?: string;
}

// ==================== HELPER TYPES ====================

export type JobStatus = 'queued' | 'processing' | 'completed' | 'error' | 'not_found';

export interface ApiError {
    message: string;
    status?: number;
    details?: unknown;
}

// ==================== RISK SEMANTIC MATCH API (Aliases for backward compatibility) ====================

export interface RiskSemanticMatchJobResponse {
    job_id: string;
    status: 'queued' | 'processing' | 'completed' | 'error';
    message?: string;
}

export interface RiskSemanticMatchStatus {
    job_id: string;
    status: 'queued' | 'processing' | 'completed' | 'error' | 'not_found';
    message?: string;
    error?: string | null;
}

export interface RiskSemanticMatchResult {
    results?: SemanticMatchingResults;
    status: 'success' | 'processing' | 'not_found' | 'error';
    job_id?: string;
    error?: string | null;
    message?: string;
}

// ==================== FRAMEWORK GENERATION API ====================

export interface FrameworkJobResponse {
    job_id: string;
    status: 'queued' | 'processing' | 'completed' | 'error';
    message?: string;
}

export interface FrameworkJobStatus {
    job_id: string;
    status: 'queued' | 'processing' | 'completed' | 'error';
    progress?: number;
    message?: string;
}

export interface FrameworkRequirement {
    code: string;
    name: string;
    description: string;
    category?: string;
    subcategory?: string;
}

export interface FrameworkGenerationResult {
    framework_name: string;
    framework_code?: string;
    requirements: FrameworkRequirement[];
    total_requirements: number;
    requirements_count?: number;
    status: 'success' | 'error';
    message?: string;
    data?: any;
}

// Risk Semantic Match types
export interface RiskSemanticMatchJobResponse {
  job_id: string;
  status: string;
  message?: string;
}

export interface RiskSemanticMatchStatus {
  job_id?: string;
  status: 'queued' | 'processing' | 'completed' | 'error';
  message?: string;
  progress?: number;
}

export interface GeneratedRisk {
  id?: string;
  name: string;
  description?: string;
  category?: string;
  likelihood?: number;
  impact?: number;
  [key: string]: any;
}

export interface RiskSemanticMatchResult {
  status: string;
  message?: string;
  matched_count?: number;
  new_count?: number;
  data?: any;
}
