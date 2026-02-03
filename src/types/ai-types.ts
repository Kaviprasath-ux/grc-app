/**
 * ai-types.ts
 *
 * Common types for AI service communications.
 */

export type ExistingLibrary = any;
export type GeneratedRiskData = any;

// Framework generation types
export interface FrameworkJobResponse {
  job_id: string;
  status: string;
  message?: string;
}

export interface FrameworkJobStatus {
  status: 'queued' | 'processing' | 'completed' | 'error';
  message?: string;
  progress?: number;
}

export interface FrameworkGenerationResult {
  status: string;
  framework_name?: string;
  requirements_count?: number;
  total_requirements?: number;
  message: string;
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
