"use client";

import { useState, useCallback, useRef } from "react";
import type {
    RiskSemanticMatchJobResponse,
    RiskSemanticMatchStatus,
    RiskSemanticMatchResult,
    GeneratedRisk,
} from "@/types/ai-types";

interface UseRiskSemanticMatchOptions {
    onComplete?: (result: RiskSemanticMatchResult) => void;
    onError?: (error: string) => void;
    onRegistered?: (result: RiskSemanticMatchResult) => void;
    pollInterval?: number;
    maxPollAttempts?: number;
    autoRegister?: boolean; // Default: false - require explicit registration
}

interface UseRiskSemanticMatchReturn {
    submitJob: (generatedRisks: GeneratedRisk[], processId?: string) => Promise<void>;
    registerRisks: (processId?: string) => Promise<RiskSemanticMatchResult | null>;
    status: RiskSemanticMatchStatus | null;
    result: RiskSemanticMatchResult | null;
    isLoading: boolean;
    isPolling: boolean;
    isRegistering: boolean;
    error: string | null;
    reset: () => void;
}

/**
 * Hook for managing AI Risk Semantic Matching workflow
 *
 * ARCHITECTURE: This hook follows the decoupled flow:
 * 1. submitJob() - Submit risks for semantic matching
 * 2. Poll until complete - Returns preview results (no DB writes)
 * 3. registerRisks() - Explicitly persist to database
 *
 * Usage:
 * const {
 *   submitJob,
 *   registerRisks,
 *   status,
 *   result,
 *   isLoading,
 *   isRegistering,
 *   error
 * } = useRiskSemanticMatch({
 *   onComplete: (result) => setShowMatchResults(true),
 *   onRegistered: (result) => router.push('/risks/register'),
 *   onError: (error) => toast.error(error),
 * });
 *
 * // Step 1: Submit for matching
 * await submitJob(generatedRisks, processId);
 *
 * // Step 2: User reviews results in UI
 *
 * // Step 3: User confirms, then register
 * await registerRisks(processId);
 */
export function useRiskSemanticMatch(
    options: UseRiskSemanticMatchOptions = {}
): UseRiskSemanticMatchReturn {
    const {
        onComplete,
        onError,
        onRegistered,
        pollInterval = 3000,
        maxPollAttempts = 120, // 6 minutes max
        autoRegister = false,
    } = options;

    const [status, setStatus] = useState<RiskSemanticMatchStatus | null>(null);
    const [result, setResult] = useState<RiskSemanticMatchResult | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isPolling, setIsPolling] = useState(false);
    const [isRegistering, setIsRegistering] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const pollingRef = useRef<NodeJS.Timeout | null>(null);
    const attemptRef = useRef(0);
    const processIdRef = useRef<string | undefined>(undefined);
    const jobIdRef = useRef<string | undefined>(undefined);

    const stopPolling = useCallback(() => {
        if (pollingRef.current) {
            clearTimeout(pollingRef.current);
            pollingRef.current = null;
        }
        setIsPolling(false);
        attemptRef.current = 0;
    }, []);

    const reset = useCallback(() => {
        stopPolling();
        setStatus(null);
        setResult(null);
        setIsLoading(false);
        setIsRegistering(false);
        setError(null);
        processIdRef.current = undefined;
        jobIdRef.current = undefined;
    }, [stopPolling]);

    /**
     * Register the semantic match results to the database.
     * This is the ONLY action that writes to the database.
     */
    const registerRisks = useCallback(async (processId?: string): Promise<RiskSemanticMatchResult | null> => {
        if (!result) {
            setError("No semantic match results to register");
            onError?.("No semantic match results to register");
            return null;
        }

        setIsRegistering(true);
        setError(null);

        try {
            const response = await fetch("/api/ai/risk-semantic-match/register", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    processId: processId || processIdRef.current,
                    semanticResult: result,
                    jobId: jobIdRef.current,
                }),
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || "Failed to register risks");
            }

            const registrationResult: RiskSemanticMatchResult = await response.json();
            setResult(registrationResult);
            setIsRegistering(false);
            onRegistered?.(registrationResult);
            return registrationResult;
        } catch (err: any) {
            setError(err.message);
            setIsRegistering(false);
            onError?.(err.message);
            return null;
        }
    }, [result, onError, onRegistered]);

    const fetchResult = useCallback(async (jobId: string) => {
        try {
            // Fetch result WITHOUT persisting (read-only)
            const response = await fetch(`/api/ai/risk-semantic-match/result/${jobId}`);
            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || "Failed to fetch result");
            }
            const data: RiskSemanticMatchResult = await response.json();
            setResult(data);
            setIsLoading(false);
            stopPolling();

            // If autoRegister is true, automatically register after fetching result
            if (autoRegister) {
                console.warn('[DEPRECATED] autoRegister=true is deprecated. Use explicit registerRisks() call for better UX.');
                // Register in the background
                setTimeout(() => {
                    registerRisks(processIdRef.current);
                }, 0);
            }

            onComplete?.(data);
        } catch (err: any) {
            setError(err.message);
            setIsLoading(false);
            stopPolling();
            onError?.(err.message);
        }
    }, [onComplete, onError, stopPolling, autoRegister, registerRisks]);

    const pollStatus = useCallback(async (jobId: string) => {
        if (attemptRef.current >= maxPollAttempts) {
            setError("Job timed out");
            setIsLoading(false);
            stopPolling();
            onError?.("Job timed out after maximum attempts");
            return;
        }

        attemptRef.current++;

        try {
            const response = await fetch(`/api/ai/risk-semantic-match/status/${jobId}`);
            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || "Failed to check status");
            }

            const data: RiskSemanticMatchStatus = await response.json();
            setStatus(data);

            if (data.status === "completed") {
                await fetchResult(jobId);
            } else if (data.status === "error") {
                setError(data.message || "Job failed");
                setIsLoading(false);
                stopPolling();
                onError?.(data.message || "Job failed");
            } else {
                // Continue polling
                pollingRef.current = setTimeout(() => pollStatus(jobId), pollInterval);
            }
        } catch (err: any) {
            // Retry on transient errors
            if (attemptRef.current < maxPollAttempts) {
                pollingRef.current = setTimeout(() => pollStatus(jobId), pollInterval);
            } else {
                setError(err.message);
                setIsLoading(false);
                stopPolling();
                onError?.(err.message);
            }
        }
    }, [maxPollAttempts, pollInterval, fetchResult, stopPolling, onError]);

    const submitJob = useCallback(async (
        generatedRisks: GeneratedRisk[],
        processId?: string
    ) => {
        reset();
        setIsLoading(true);
        processIdRef.current = processId;

        try {
            const response = await fetch("/api/ai/risk-semantic-match", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ generatedRisks, processId }),
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || "Failed to submit job");
            }

            const data: RiskSemanticMatchJobResponse = await response.json();
            jobIdRef.current = data.job_id;
            setStatus({ job_id: data.job_id, status: "queued" });
            setIsPolling(true);

            // Start polling
            pollingRef.current = setTimeout(() => pollStatus(data.job_id), pollInterval);
        } catch (err: any) {
            setError(err.message);
            setIsLoading(false);
            onError?.(err.message);
        }
    }, [reset, pollInterval, pollStatus, onError]);

    return {
        submitJob,
        registerRisks,
        status,
        result,
        isLoading,
        isPolling,
        isRegistering,
        error,
        reset,
    };
}
