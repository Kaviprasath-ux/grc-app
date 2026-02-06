
import { prisma } from "@/lib/prisma";

/**
 * ai-audit-service.ts
 * 
 * Service for logging AI operations and managing AI jobs.
 */
export const aiAuditService = {
    /**
     * Logs a pre-flight or post-flight AI operation.
     */
    async logOperation(data: {
        endpoint: string;
        method?: string;
        requestBody?: any;
        responseBody?: any;
        statusCode?: number;
        latencyMs?: number;
        error?: string | object | unknown;
        userId?: string;
        jobId?: string;
    }) {
        try {
            // Convert error to string if it's an object
            let errorString: string | null = null;
            if (data.error) {
                if (typeof data.error === 'string') {
                    errorString = data.error;
                } else {
                    try {
                        errorString = JSON.stringify(data.error);
                    } catch {
                        errorString = String(data.error);
                    }
                }
            }

            return await prisma.aIOperation.create({
                data: {
                    endpoint: data.endpoint,
                    method: data.method || "POST",
                    requestBody: data.requestBody ? JSON.stringify(data.requestBody) : null,
                    responseBody: data.responseBody ? JSON.stringify(data.responseBody) : null,
                    statusCode: data.statusCode,
                    latencyMs: data.latencyMs,
                    error: errorString,
                    userId: data.userId,
                    jobId: data.jobId,
                },
            });
        } catch (err) {
            console.error("Failed to log AI operation:", err);
            return null;
        }
    },

    /**
     * Creates an AI job for tracking asynchronous tasks.
     */
    async createJob(data: {
        type: string;
        userId?: string;
        metadata?: any;
        providerJobId?: string;
    }) {
        try {
            return await (prisma.aIJob as any).create({
                data: {
                    type: data.type,
                    userId: data.userId,
                    metadata: data.metadata ? JSON.stringify(data.metadata) : null,
                    providerJobId: data.providerJobId,
                    status: "PENDING",
                } as any,
            });
        } catch (err) {
            console.error("Failed to create AI job:", err);
            return null;
        }
    },

    /**
     * Updates the status and result of an AI job.
     * jobId is the provider job id (e.g. from RunPod).
     */
    async updateJobStatus(jobId: string, status: string, result?: any, error?: string) {
        try {
            return await prisma.aIJob.update({
                where: { providerJobId: jobId },
                data: {
                    status: status,
                    ...(result !== undefined && { result: JSON.stringify(result) }),
                    ...(error !== undefined && { error: error }),
                },
            });
        } catch (err) {
            console.error("Failed to update AI job status:", err);
            return null;
        }
    },
};
