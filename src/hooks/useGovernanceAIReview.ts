"use client";

import { useState, useCallback, useRef, useEffect } from "react";

export type GovernanceAIPhase =
    | 'idle'
    | 'checking'
    | 'ingesting'
    | 'polling'
    | 'reviewing'
    | 'complete'
    | 'error';

export interface GovernanceAIReviewResult {
    success: boolean;
    compliance_score?: number;
    compliance_summary?: string;
    total_controls?: number;
    compliant_controls?: number;
    gaps?: Array<{ control_code: string; issue: string }>;
    recommendations?: Array<{ control_code: string; recommendation: string }>;
    raw_response?: unknown;
}

export interface IngestCheckResult {
    isIngested: boolean;
    ingestStatus: string;
    jobId: string | null;
    documentId: string | null;
    latestReview: {
        id: string;
        status: string;
        documentId: string | null;
    } | null;
}

interface UseGovernanceAIReviewOptions {
    policyId: string;
    onIngestStart?: () => void;
    onIngestComplete?: (documentId: string) => void;
    onReviewStart?: () => void;
    onReviewComplete?: (result: GovernanceAIReviewResult) => void;
    onError?: (error: string) => void;
    pollInterval?: number;
    maxPollAttempts?: number;
}

interface UseGovernanceAIReviewReturn {
    // State
    phase: GovernanceAIPhase;
    progress: number;
    ingestStatus: string | null;
    reviewResult: GovernanceAIReviewResult | null;
    error: string | null;
    jobId: string | null;

    // Actions
    startAIReview: (file?: File) => Promise<void>;
    reset: () => void;
}

/**
 * Hook for managing Governance AI Review workflow
 *
 * ARCHITECTURE: This hook orchestrates the full ingest → review flow:
 * 1. Check if document is already ingested
 * 2. If not, ingest the document (upload to RunPod)
 * 3. Poll for ingest completion
 * 4. Perform AI review
 * 5. Return results
 *
 * Usage:
 * const {
 *   phase,
 *   progress,
 *   reviewResult,
 *   error,
 *   startAIReview,
 *   reset,
 * } = useGovernanceAIReview({
 *   policyId: id,
 *   onReviewComplete: (result) => setAiReviewResult(result),
 *   onError: (error) => toast.error(error),
 * });
 */
export function useGovernanceAIReview(
    options: UseGovernanceAIReviewOptions
): UseGovernanceAIReviewReturn {
    const {
        policyId,
        onIngestStart,
        onIngestComplete,
        onReviewStart,
        onReviewComplete,
        onError,
        pollInterval = 3000,
        maxPollAttempts = 120, // 6 minutes max
    } = options;

    const [phase, setPhase] = useState<GovernanceAIPhase>('idle');
    const [progress, setProgress] = useState(0);
    const [ingestStatus, setIngestStatus] = useState<string | null>(null);
    const [reviewResult, setReviewResult] = useState<GovernanceAIReviewResult | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [jobId, setJobId] = useState<string | null>(null);

    const pollingRef = useRef<NodeJS.Timeout | null>(null);
    const attemptRef = useRef(0);
    const mountedRef = useRef(true);

    // Cleanup on unmount
    useEffect(() => {
        mountedRef.current = true;
        return () => {
            mountedRef.current = false;
            if (pollingRef.current) {
                clearTimeout(pollingRef.current);
            }
        };
    }, []);

    const stopPolling = useCallback(() => {
        if (pollingRef.current) {
            clearTimeout(pollingRef.current);
            pollingRef.current = null;
        }
        attemptRef.current = 0;
    }, []);

    const reset = useCallback(() => {
        stopPolling();
        setPhase('idle');
        setProgress(0);
        setIngestStatus(null);
        setReviewResult(null);
        setError(null);
        setJobId(null);
    }, [stopPolling]);

    /**
     * Check if policy document is already ingested
     */
    const checkIngestStatus = useCallback(async (): Promise<IngestCheckResult> => {
        const response = await fetch(`/api/ai/governance/ingest-check?policyId=${policyId}`);
        if (!response.ok) {
            throw new Error('Failed to check ingest status');
        }
        return response.json();
    }, [policyId]);

    /**
     * Get the latest policy attachment file
     */
    const getPolicyAttachment = useCallback(async (): Promise<File | null> => {
        // Fetch policy with attachments
        console.log('[GovernanceAIReview] Fetching policy:', policyId);
        const response = await fetch(`/api/policies/${policyId}`);
        if (!response.ok) {
            console.error('[GovernanceAIReview] Failed to fetch policy:', response.status);
            return null;
        }
        const policy = await response.json();
        console.log('[GovernanceAIReview] Policy fetched, attachments:', policy.attachments);

        // Check for attachments
        const attachments = policy.attachments || [];
        if (attachments.length === 0) {
            console.warn('[GovernanceAIReview] No attachments found in policy');
            return null;
        }

        // Get the latest attachment
        const latestAttachment = attachments[attachments.length - 1];
        console.log('[GovernanceAIReview] Latest attachment:', latestAttachment);

        // PolicyAttachment uses 'filePath' field (e.g., "/uploads/policies/file.docx")
        const fileUrl = latestAttachment.filePath || latestAttachment.fileUrl || latestAttachment.url;

        if (!fileUrl) {
            console.warn('[GovernanceAIReview] Attachment has no filePath/fileUrl:', latestAttachment);
            return null;
        }

        console.log('[GovernanceAIReview] Fetching file from:', fileUrl);
        // Fetch the file
        const fileResponse = await fetch(fileUrl);
        if (!fileResponse.ok) {
            console.error('[GovernanceAIReview] Failed to fetch file:', fileResponse.status, fileResponse.statusText);
            return null;
        }

        const blob = await fileResponse.blob();
        console.log('[GovernanceAIReview] File fetched, size:', blob.size, 'type:', blob.type);
        const fileName = latestAttachment.fileName || latestAttachment.name || 'policy-document.pdf';
        return new File([blob], fileName, { type: blob.type });
    }, [policyId]);

    /**
     * Ingest the policy document
     * If file is not provided, the server will read from disk using the policy's attachment
     */
    const ingestDocument = useCallback(async (file?: File): Promise<{ jobId: string; documentId: string }> => {
        const formData = new FormData();
        formData.append('policyId', policyId);
        if (file) {
            formData.append('file', file);
        }

        const response = await fetch('/api/ai/governance/ingest', {
            method: 'POST',
            body: formData,
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to ingest document');
        }

        const data = await response.json();
        return {
            jobId: data.job_id,
            documentId: data.document_id,
        };
    }, [policyId]);

    /**
     * Poll for ingest completion
     */
    const pollIngestStatus = useCallback(async (currentJobId: string): Promise<string> => {
        return new Promise((resolve, reject) => {
            const poll = async () => {
                if (!mountedRef.current) {
                    reject(new Error('Component unmounted'));
                    return;
                }

                if (attemptRef.current >= maxPollAttempts) {
                    reject(new Error('Ingest timed out'));
                    return;
                }

                attemptRef.current++;
                setProgress(Math.min(10 + (attemptRef.current / maxPollAttempts) * 40, 50));

                try {
                    const response = await fetch(`/api/ai/governance/ingest/status/${currentJobId}`);
                    if (!response.ok) {
                        throw new Error('Failed to check ingest status');
                    }

                    const data = await response.json();
                    setIngestStatus(data.status);

                    if (data.status === 'completed' || data.status === 'COMPLETED') {
                        stopPolling();
                        // Fetch the result to get document ID
                        const resultResponse = await fetch(`/api/ai/governance/ingest/result/${currentJobId}`);
                        if (resultResponse.ok) {
                            const resultData = await resultResponse.json();
                            resolve(resultData.document_id || currentJobId);
                        } else {
                            resolve(currentJobId);
                        }
                    } else if (data.status === 'failed' || data.status === 'FAILED' || data.status === 'error') {
                        stopPolling();
                        reject(new Error(data.error || 'Ingest failed'));
                    } else {
                        // Continue polling
                        pollingRef.current = setTimeout(poll, pollInterval);
                    }
                } catch (err: any) {
                    // Retry on transient errors
                    if (attemptRef.current < maxPollAttempts) {
                        pollingRef.current = setTimeout(poll, pollInterval);
                    } else {
                        stopPolling();
                        reject(err);
                    }
                }
            };

            poll();
        });
    }, [maxPollAttempts, pollInterval, stopPolling]);

    /**
     * Perform the AI review
     */
    const performReview = useCallback(async (): Promise<GovernanceAIReviewResult> => {
        const response = await fetch('/api/ai/governance/review', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ policyId }),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || errorData.details || 'Failed to perform AI review');
        }

        return response.json();
    }, [policyId]);

    /**
     * Main entry point - orchestrates the full flow
     */
    const startAIReview = useCallback(async (file?: File) => {
        if (!mountedRef.current) return;

        reset();
        setPhase('checking');
        setProgress(5);

        try {
            // Step 1: Check if already ingested
            console.log('[GovernanceAIReview] Checking ingest status...');
            const ingestCheck = await checkIngestStatus();

            if (!mountedRef.current) return;

            // If already ingested or completed, skip to review
            if (ingestCheck.isIngested) {
                console.log('[GovernanceAIReview] Document already ingested, skipping to review');
                setProgress(60);
                setPhase('reviewing');
                onReviewStart?.();

                const result = await performReview();

                if (!mountedRef.current) return;

                setProgress(100);
                setReviewResult(result);
                setPhase('complete');
                onReviewComplete?.(result);
                return;
            }

            // Step 2: Need to ingest first
            // Note: If no file is provided, the server will read from disk using the attachment
            if (!mountedRef.current) return;

            // Step 3: Ingest the document (server will read file from disk if not provided)
            console.log('[GovernanceAIReview] Ingesting document...');
            setPhase('ingesting');
            setProgress(10);
            onIngestStart?.();

            const { jobId: newJobId, documentId } = await ingestDocument(file || undefined);

            if (!mountedRef.current) return;

            setJobId(newJobId);

            // If no job ID returned, ingest was synchronous
            if (!newJobId) {
                console.log('[GovernanceAIReview] Ingest was synchronous');
                setProgress(50);
                onIngestComplete?.(documentId);
            } else {
                // Step 4: Poll for ingest completion
                console.log('[GovernanceAIReview] Polling for ingest completion...');
                setPhase('polling');

                try {
                    const finalDocumentId = await pollIngestStatus(newJobId);

                    if (!mountedRef.current) return;

                    setProgress(50);
                    onIngestComplete?.(finalDocumentId);
                } catch (pollError: any) {
                    throw new Error(`Ingest failed: ${pollError.message}`);
                }
            }

            // Step 5: Perform the review
            if (!mountedRef.current) return;

            console.log('[GovernanceAIReview] Performing AI review...');
            setPhase('reviewing');
            setProgress(60);
            onReviewStart?.();

            const result = await performReview();

            if (!mountedRef.current) return;

            setProgress(100);
            setReviewResult(result);
            setPhase('complete');
            onReviewComplete?.(result);

        } catch (err: any) {
            if (!mountedRef.current) return;

            console.error('[GovernanceAIReview] Error:', err);
            setError(err.message);
            setPhase('error');
            onError?.(err.message);
        }
    }, [
        reset,
        checkIngestStatus,
        getPolicyAttachment,
        ingestDocument,
        pollIngestStatus,
        performReview,
        onIngestStart,
        onIngestComplete,
        onReviewStart,
        onReviewComplete,
        onError,
    ]);

    return {
        phase,
        progress,
        ingestStatus,
        reviewResult,
        error,
        jobId,
        startAIReview,
        reset,
    };
}
