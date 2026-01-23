/**
 * AI Framework Generation Service
 * 
 * This service handles the 3-step async flow for AI-powered framework generation:
 * 1. Submit job
 * 2. Poll status
 * 3. Get result
 */

import type {
    FrameworkJobResponse,
    FrameworkJobStatus,
    FrameworkGenerationResult,
} from "@/types/ai-types";

/**
 * Submit a framework generation job
 * 
 * @param frameworkName - Name of the framework to generate
 * @param file - Optional document file (PDF, DOCX, XLSX, etc.)
 * @param library - Optional library identifier
 * @returns Job ID and initial status
 */
export async function generateFramework(
    frameworkName: string,
    file?: File | null,
    library?: string
): Promise<FrameworkJobResponse> {
    try {
        const formData = new FormData();
        formData.append("framework_name", frameworkName);

        if (file) {
            formData.append("attachment", file);
        }

        if (library) {
            formData.append("library", library);
        }

        console.log(`[AI Framework Service] Submitting job for: ${frameworkName}`);

        const response = await fetch("/api/ai/generate-framework", {
            method: "POST",
            body: formData,
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || "Failed to submit framework generation job");
        }

        const result: FrameworkJobResponse = await response.json();
        console.log(`[AI Framework Service] Job submitted: ${result.job_id}`);

        return result;
    } catch (error) {
        console.error("[AI Framework Service] Error submitting job:", error);
        throw error;
    }
}

/**
 * Check the status of a framework generation job
 * 
 * @param jobId - Job ID from generateFramework()
 * @returns Current job status and progress
 */
export async function checkFrameworkStatus(
    jobId: string
): Promise<FrameworkJobStatus> {
    try {
        const response = await fetch(`/api/ai/framework-status/${jobId}`);

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            // Provide status code for fine-grained polling/retry control
            const error: any = new Error(errorData.error || `Server returned ${response.status}`);
            error.status = response.status;
            throw error;
        }

        const result: FrameworkJobStatus = await response.json();

        // Backend doesn't return progress field, so default to 0
        if (result.progress === undefined || result.progress === null) {
            result.progress = 0;
        }

        return result;
    } catch (error) {
        // Silent for 404s at this level to avoid cluttering logs 
        // if the caller is expected to handle retries
        if ((error as any).status !== 404) {
            console.error("[AI Framework Service] Error checking status:", error);
        }
        throw error;
    }
}

/**
 * Get the result of a completed framework generation job
 * 
 * @param jobId - Job ID from generateFramework()
 * @returns Generated framework with requirements
 */
export async function getFrameworkResult(
    jobId: string
): Promise<FrameworkGenerationResult> {
    try {
        console.log(`[AI Framework Service] Fetching result for job: ${jobId}`);

        const response = await fetch(`/api/ai/framework-result/${jobId}`);

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || "Failed to get job result");
        }

        const result: FrameworkGenerationResult = await response.json();
        console.log(`[AI Framework Service] Result received: ${result.total_requirements} requirements`);

        return result;
    } catch (error) {
        console.error("[AI Framework Service] Error getting result:", error);
        throw error;
    }
}

/**
 * Poll job status until completion or error with exponential backoff
 * 
 * @param jobId - Job ID to poll
 * @param onProgress - Optional callback for progress updates
 * @param maxAttempts - Maximum number of polling attempts
 * @param initialIntervalMs - Initial polling interval in milliseconds
 * @returns Final job status
 */
export async function pollFrameworkStatus(
    jobId: string,
    onProgress?: (status: FrameworkJobStatus) => void,
    maxAttempts: number = 60,  // 60 attempts with exponential backoff
    initialIntervalMs: number = 2000
): Promise<FrameworkJobStatus> {
    let attempts = 0;
    let consecutive404s = 0;
    let currentInterval = initialIntervalMs;
    const MAX_CONSECUTIVE_404S = 10;
    const MAX_INTERVAL = 10000; // Cap at 10 seconds

    console.log(`[AI Polling] Starting to poll job ${jobId}`);

    while (attempts < maxAttempts) {
        try {
            const status = await checkFrameworkStatus(jobId);

            // Successfully reached the endpoint - reset counters
            consecutive404s = 0;
            currentInterval = initialIntervalMs; // Reset to initial interval on success

            console.log(`[AI Polling] Job ${jobId} status: ${status.status}`);

            if (onProgress) {
                onProgress(status);
            }

            if (status.status === "completed" || status.status === "error") {
                console.log(`[AI Polling] Job ${jobId} finished with status: ${status.status}`);
                return status;
            }
        } catch (error: any) {
            // Handle transient 404 (Next.js route rebuilding, cold start, or backend delay)
            if (error.status === 404) {
                consecutive404s++;

                // Apply exponential backoff for 404s
                currentInterval = Math.min(currentInterval * 1.5, MAX_INTERVAL);

                console.warn(
                    `[AI Polling] 404 for job ${jobId}. ` +
                    `Attempt ${consecutive404s}/${MAX_CONSECUTIVE_404S}. ` +
                    `Next retry in ${Math.round(currentInterval / 1000)}s`
                );

                if (consecutive404s >= MAX_CONSECUTIVE_404S) {
                    throw new Error(
                        "Job not found on backend. The job may have expired or failed to initialize. " +
                        "Please try submitting again."
                    );
                }
            } else if (error.status === 500) {
                // Backend error - log and retry with backoff
                console.error(`[AI Polling] Backend error (500) for job ${jobId}:`, error);
                currentInterval = Math.min(currentInterval * 1.5, MAX_INTERVAL);

                if (attempts >= maxAttempts - 1) {
                    throw new Error("Backend error occurred. Please try again later.");
                }
            } else {
                // Other errors - log and potentially retry
                console.error(`[AI Polling] Unexpected error for job ${jobId}:`, error);

                if (attempts >= maxAttempts - 1) {
                    throw new Error(error.message || "An unexpected error occurred during framework generation.");
                }
            }
        }

        // Wait before next poll (with exponential backoff if errors occurred)
        await new Promise((resolve) => setTimeout(resolve, currentInterval));
        attempts++;
    }

    throw new Error(
        "Framework generation timed out. The process may still be running on the backend. " +
        "Please check back in a few minutes or try again."
    );
}

/**
 * Complete workflow: Submit job, poll status, and get result
 * 
 * @param frameworkName - Name of the framework to generate
 * @param file - Optional document file
 * @param library - Optional library identifier
 * @param onProgress - Optional callback for progress updates
 * @returns Generated framework result
 */
export async function generateFrameworkComplete(
    frameworkName: string,
    file?: File | null,
    library?: string,
    onProgress?: (status: FrameworkJobStatus) => void
): Promise<FrameworkGenerationResult> {
    // Step 1: Submit job
    const jobResponse = await generateFramework(frameworkName, file, library);

    // Initial delay (5 seconds) to allow the backend to initialize the job
    // This is especially important for cold starts on RunPod
    console.log(`[AI Framework Service] Waiting 5s before polling job ${jobResponse.job_id}...`);
    await new Promise((resolve) => setTimeout(resolve, 5000));

    // Step 2: Poll status
    const finalStatus = await pollFrameworkStatus(
        jobResponse.job_id,
        onProgress
    );

    if (finalStatus.status === "error") {
        throw new Error(finalStatus.message || "Framework generation failed");
    }

    // Step 3: Get result
    const result = await getFrameworkResult(jobResponse.job_id);
    return result;
}
