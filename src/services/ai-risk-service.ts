/**
 * AI Risk Service Layer
 *
 * Business logic for AI risk operations including:
 * - Risk generation from process/asset data
 * - Semantic matching with existing risk library
 * - Async job polling and status checking
 */

import aiApiClient from '@/lib/ai-api-client';
import { AI_POLLING, AI_ERRORS } from '@/lib/ai-config';
import { AI_ENDPOINTS } from '@/lib/ai-endpoints';
import {
    RiskGenerationRequest,
    RiskGenerationResponse,
    SemanticMatchingJobResponse,
    SemanticMatchingStatusResponse,
    SemanticMatchingResultResponse,
    ExistingLibrary,
    GeneratedRiskData,
} from '@/types/ai-types';

// ==================== RISK GENERATION ====================

/**
 * Generate AI-powered risks for a process
 *
 * @param request - Process and asset details
 * @returns Generated risks with threats, controls, and vulnerabilities
 */
export async function generateProcessRisks(
    request: RiskGenerationRequest
): Promise<RiskGenerationResponse> {
    try {
        console.log('[AI Service] Calling risk generation API with:', request);

        const response = await aiApiClient.post(
            AI_ENDPOINTS.GENERATE_RISK,
            request
        );

        console.log('[AI Service] Risk generation response:', response.data);
        return response.data as RiskGenerationResponse;
    } catch (error: unknown) {
        const err = error as { message?: string; status?: number; statusText?: string; data?: { detail?: string }; url?: string };
        console.error('[AI Service] Error generating process risks:', {
            message: err.message,
            status: err.status,
            statusText: err.statusText,
            data: err.data,
            url: err.url
        });

        throw new Error(
            err.data?.detail ||
            err.message ||
            'Failed to generate process risks'
        );
    }
}

// ==================== SEMANTIC MATCHING ====================

/**
 * Submit a semantic matching job
 *
 * @param existingLibrary - Existing risk library (controls, threats, vulnerabilities, risks)
 * @param generatedRisk - Newly generated risks to match
 * @returns Job ID and initial status
 */
export async function submitSemanticMatching(
    existingLibrary: ExistingLibrary,
    generatedRisk: GeneratedRiskData
): Promise<SemanticMatchingJobResponse> {
    try {
        // Convert objects to JSON strings as required by the API
        // Use URLSearchParams for application/x-www-form-urlencoded
        const params = new URLSearchParams();
        params.append('existing_library', JSON.stringify(existingLibrary));
        params.append('generated_risk', JSON.stringify(generatedRisk));

        const response = await aiApiClient.post(
            AI_ENDPOINTS.SEMANTIC_MATCH,
            params.toString(),
            {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
            }
        );

        return response.data as SemanticMatchingJobResponse;
    } catch (error: unknown) {
        const err = error as { data?: { detail?: string }; message?: string };
        console.error('Error submitting semantic matching job:', err);
        throw new Error(
            err.data?.detail ||
            err.message ||
            'Failed to submit semantic matching job'
        );
    }
}

/**
 * Check the status of a semantic matching job
 *
 * @param jobId - Job ID from submitSemanticMatching
 * @returns Current job status
 */
export async function checkSemanticMatchingStatus(
    jobId: string
): Promise<SemanticMatchingStatusResponse> {
    try {
        const response = await aiApiClient.get(
            `${AI_ENDPOINTS.SEMANTIC_MATCH_STATUS}/${jobId}`
        );

        return response.data as SemanticMatchingStatusResponse;
    } catch (error: unknown) {
        const err = error as { data?: { detail?: string }; message?: string };
        console.error('Error checking semantic matching status:', err);
        throw new Error(
            err.data?.detail ||
            err.message ||
            'Failed to check semantic matching status'
        );
    }
}

/**
 * Get the results of a completed semantic matching job
 *
 * @param jobId - Job ID from submitSemanticMatching
 * @returns Matched risks with similarity scores
 */
export async function getSemanticMatchingResult(
    jobId: string
): Promise<SemanticMatchingResultResponse> {
    try {
        const response = await aiApiClient.get(
            `${AI_ENDPOINTS.SEMANTIC_MATCH_RESULT}/${jobId}`
        );

        return response.data as SemanticMatchingResultResponse;
    } catch (error: unknown) {
        const err = error as { data?: { detail?: string }; message?: string };
        console.error('Error getting semantic matching result:', err);
        throw new Error(
            err.data?.detail ||
            err.message ||
            'Failed to get semantic matching result'
        );
    }
}

// ==================== POLLING HELPER ====================

export interface PollOptions {
    /** Maximum time to poll in milliseconds (default from AI_POLLING config) */
    maxWaitTime?: number;
    /** Interval between status checks in milliseconds (default from AI_POLLING config) */
    pollInterval?: number;
    /** Callback for status updates */
    onStatusUpdate?: (status: SemanticMatchingStatusResponse) => void;
}

/**
 * Poll for semantic matching job completion
 *
 * This helper automatically polls the status endpoint until the job
 * completes or times out.
 *
 * @param jobId - Job ID to poll
 * @param options - Polling configuration
 * @returns Final results when job completes
 * @throws Error if job fails or times out
 */
export async function pollSemanticMatching(
    jobId: string,
    options: PollOptions = {}
): Promise<SemanticMatchingResultResponse> {
    const {
        maxWaitTime = AI_POLLING.DEFAULT_MAX_WAIT_MS,
        pollInterval = AI_POLLING.DEFAULT_INTERVAL_MS,
        onStatusUpdate,
    } = options;

    const startTime = Date.now();

    while (true) {
        // Check if we've exceeded max wait time
        if (Date.now() - startTime > maxWaitTime) {
            throw new Error(AI_ERRORS.POLLING_TIMEOUT);
        }

        // Check job status
        const status = await checkSemanticMatchingStatus(jobId);

        // Notify callback of status update
        if (onStatusUpdate) {
            onStatusUpdate(status);
        }

        // Handle different statuses
        if (status.status === 'completed') {
            // Job completed, get results
            return await getSemanticMatchingResult(jobId);
        } else if (status.status === 'error') {
            throw new Error(status.error || 'Semantic matching job failed');
        } else if (status.status === 'not_found') {
            throw new Error(AI_ERRORS.JOB_NOT_FOUND);
        }

        // Job still processing, wait before next check
        await new Promise(resolve => setTimeout(resolve, pollInterval));
    }
}
