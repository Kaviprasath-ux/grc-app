/**
 * AI Compliance Service Layer
 * 
 * Business logic for Compliance AI operations including:
 * - Policy document ingestion (async)
 * - Policy generation and regeneration
 * - Self-assessment queries
 * - Control code matching
 * - AI data cleanup
 */

import { createFormData } from '@/lib/ai-api-client';

// ==================== TYPE DEFINITIONS ====================

export interface PolicyIngestRequest {
    base_id: string;
    doc_type: string;
    file_code: string;
    document_id: string;
    files: File[];
}

export interface PolicyIngestJobResponse {
    job_id: string;
    status: string;
    message?: string;
}

export interface PolicyIngestStatusResponse {
    status: 'queued' | 'processing' | 'completed' | 'error';
    message?: string;
}

export interface PolicyIngestResultResponse {
    status: string;
    documents_processed?: number;
    embeddings_created?: number;
    message: string;
}

export interface GeneratePolicyRequest {
    document_type: string;
    document_name: string;
    framework_names: string[];
    mapped_controls: string[];
    template: File;
}

export interface GeneratePolicyResponse {
    status: string;
    policy_document_base64?: string;
    download_url?: string;
    message?: string;
}

export interface RegeneratePolicyRequest {
    document_type: string;
    document_name: string;
    framework_names: string[];
    missing_controls: string[];
    policy_document: File;
}

export interface RegeneratePolicyResponse {
    previous_content: string;
    new_content: string;
    regenerated_policy_base64: string;
}

export interface SelfAssessmentRequest {
    question: string;
    userId: string;
}

export interface SelfAssessmentResponse {
    answer: string;
    confidence?: number;
    sources?: string[];
}

export interface ControlCodeQueryRequest {
    description: string;
}

export interface ControlCodeQueryResponse {
    control_code?: string;
    matched_controls?: Array<{
        code: string;
        description: string;
        similarity_score: number;
    }>;
}

export interface CleanupPolicyRequest {
    base_id: string;
    doc_type: string;
    document_id: string;
    file_name: string;
}

export interface CleanupPolicyResponse {
    status: string;
    message: string;
}

// ==================== POLICY INGEST ====================

/**
 * Ingest policy documents for AI analysis
 * 
 * @param request - Policy ingest parameters with files
 * @returns Job ID for tracking async operation
 */
export async function ingestPolicyDocuments(
    request: PolicyIngestRequest
): Promise<PolicyIngestJobResponse> {
    try {
        const formData = new FormData();
        formData.append('base_id', request.base_id);
        formData.append('doc_type', request.doc_type);
        formData.append('file_code', request.file_code);
        formData.append('document_id', request.document_id);

        request.files.forEach(file => {
            formData.append('files', file);
        });

        const response = await fetch('/api/ai/governance/ingest', {
            method: 'POST',
            body: formData,
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to ingest policy documents');
        }

        return await response.json();
    } catch (error: any) {
        console.error('[AI Compliance Service] Error ingesting policy documents:', error);
        throw error;
    }
}

/**
 * Check the status of a policy ingest job
 * 
 * @param jobId - Job ID from ingestPolicyDocuments
 * @returns Current job status
 */
export async function checkIngestStatus(
    jobId: string
): Promise<PolicyIngestStatusResponse> {
    try {
        const response = await fetch(`/api/ai/governance/ingest/status/${jobId}`);

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to check ingest status');
        }

        return await response.json();
    } catch (error: any) {
        console.error('[AI Compliance Service] Error checking ingest status:', error);
        throw error;
    }
}

/**
 * Get the result of a completed policy ingest job
 * 
 * @param jobId - Job ID from ingestPolicyDocuments
 * @returns Ingest result with statistics
 */
export async function getIngestResult(
    jobId: string
): Promise<PolicyIngestResultResponse> {
    try {
        const response = await fetch(`/api/ai/governance/ingest/result/${jobId}`);

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to get ingest result');
        }

        return await response.json();
    } catch (error: any) {
        console.error('[AI Compliance Service] Error getting ingest result:', error);
        throw error;
    }
}

// ==================== POLICY GENERATION ====================

/**
 * Generate a new policy document using AI
 * 
 * @param request - Policy generation parameters
 * @returns Generated policy document (base64 or download URL)
 */
export async function generatePolicy(
    request: GeneratePolicyRequest
): Promise<GeneratePolicyResponse> {
    try {
        const formData = new FormData();
        formData.append('document_type', request.document_type);
        formData.append('document_name', request.document_name);

        request.framework_names.forEach(name => {
            formData.append('framework_names', name);
        });

        request.mapped_controls.forEach(control => {
            formData.append('mapped_controls', control);
        });

        formData.append('template', request.template);

        const response = await fetch('/api/ai/governance/generate-policy', {
            method: 'POST',
            body: formData,
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to generate policy');
        }

        return await response.json();
    } catch (error: any) {
        console.error('[AI Compliance Service] Error generating policy:', error);
        throw error;
    }
}

// ==================== POLICY REGENERATION ====================

/**
 * Regenerate an existing policy document with missing controls
 * 
 * @param request - Policy regeneration parameters
 * @returns Regenerated policy with previous and new content
 */
export async function regeneratePolicy(
    request: RegeneratePolicyRequest
): Promise<RegeneratePolicyResponse> {
    try {
        const formData = new FormData();
        formData.append('document_type', request.document_type);
        formData.append('document_name', request.document_name);

        request.framework_names.forEach(name => {
            formData.append('framework_names', name);
        });

        request.missing_controls.forEach(control => {
            formData.append('missing_controls', control);
        });

        formData.append('policy_document', request.policy_document);

        const response = await fetch('/api/ai/governance/regenerate-policy', {
            method: 'POST',
            body: formData,
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to regenerate policy');
        }

        return await response.json();
    } catch (error: any) {
        console.error('[AI Compliance Service] Error regenerating policy:', error);
        throw error;
    }
}

// ==================== SELF-ASSESSMENT ====================

/**
 * Run AI-powered self-assessment query
 * 
 * @param question - User's question about compliance/policy
 * @param userId - Current user ID
 * @returns AI-generated answer with confidence and sources
 */
export async function runSelfAssessment(
    question: string,
    userId: string
): Promise<SelfAssessmentResponse> {
    try {
        const response = await fetch('/api/ai/compliance/self-assessment', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ question, userId }),
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to run self-assessment');
        }

        return await response.json();
    } catch (error: any) {
        console.error('[AI Compliance Service] Error running self-assessment:', error);
        throw error;
    }
}

// ==================== CONTROL CODE QUERY ====================

/**
 * Query control codes by description using AI semantic matching
 * 
 * @param description - Control description to match
 * @returns Matched control codes with similarity scores
 */
export async function queryControlCode(
    description: string
): Promise<ControlCodeQueryResponse> {
    try {
        const response = await fetch('/api/ai/compliance/control-code-query', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ description }),
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to query control code');
        }

        return await response.json();
    } catch (error: any) {
        console.error('[AI Compliance Service] Error querying control code:', error);
        throw error;
    }
}

// ==================== CLEANUP ====================

/**
 * Delete AI embeddings and data for a policy document
 * 
 * @param request - Cleanup parameters
 * @returns Cleanup status
 */
export async function cleanupPolicyAIData(
    request: CleanupPolicyRequest
): Promise<CleanupPolicyResponse> {
    try {
        const response = await fetch('/api/ai/governance/cleanup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(request),
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to cleanup AI data');
        }

        return await response.json();
    } catch (error: any) {
        console.error('[AI Compliance Service] Error cleaning up AI data:', error);
        throw error;
    }
}

// ==================== POLLING HELPER ====================

export interface PollOptions {
    maxWaitTime?: number;
    pollInterval?: number;
    onStatusUpdate?: (status: PolicyIngestStatusResponse) => void;
}

/**
 * Poll a policy ingest job until completion
 * 
 * @param jobId - Job ID to poll
 * @param options - Polling configuration
 * @returns Final ingest result
 */
export async function pollIngestJob(
    jobId: string,
    options: PollOptions = {}
): Promise<PolicyIngestResultResponse> {
    const {
        maxWaitTime = 120000, // 2 minutes
        pollInterval = 3000,  // 3 seconds
        onStatusUpdate
    } = options;

    const startTime = Date.now();

    while (true) {
        if (Date.now() - startTime > maxWaitTime) {
            throw new Error('Policy ingest job timed out');
        }

        const status = await checkIngestStatus(jobId);

        if (onStatusUpdate) {
            onStatusUpdate(status);
        }

        if (status.status === 'completed') {
            return await getIngestResult(jobId);
        } else if (status.status === 'error') {
            throw new Error(status.message || 'Policy ingest job failed');
        }

        // Wait before next poll
        await new Promise(resolve => setTimeout(resolve, pollInterval));
    }
}
