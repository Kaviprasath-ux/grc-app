import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface CreateAIOperationParams {
    jobId?: string;
    endpoint: string;
    method: string;
    requestBody?: any;
    responseBody?: any;
    statusCode?: number;
    latencyMs?: number;
    error?: string;
    userId?: string;
}

/**
 * AI Audit Service
 * 
 * Responsible for persisting AI operation logs and job tracking data.
 */
export const aiAuditService = {
    /**
     * Log an atomic AI operation
     */
    async logOperation(params: CreateAIOperationParams) {
        try {
            return await prisma.aIOperation.create({
                data: {
                    jobId: params.jobId,
                    endpoint: params.endpoint,
                    method: params.method,
                    requestBody: params.requestBody ? JSON.stringify(params.requestBody) : null,
                    responseBody: params.responseBody ? JSON.stringify(params.responseBody) : null,
                    statusCode: params.statusCode,
                    latencyMs: params.latencyMs,
                    error: params.error,
                    userId: params.userId,
                },
            });
        } catch (error) {
            console.error('[AI Audit Service] Failed to log operation:', error);
            // We don't throw here to avoid failing the business process due to logging failure
        }
    },

    /**
     * Create a new AI Job record
     */
    async createJob(params: { providerJobId: string; type: string; userId?: string; metadata?: any }) {
        try {
            return await prisma.aIJob.create({
                data: {
                    providerJobId: params.providerJobId,
                    type: params.type,
                    userId: params.userId,
                    metadata: params.metadata ? JSON.stringify(params.metadata) : null,
                    status: 'QUEUED',
                },
            });
        } catch (error) {
            console.error('[AI Audit Service] Failed to create job:', error);
            throw error;
        }
    },

    /**
     * Update an existing AI Job status
     */
    async updateJobStatus(providerJobId: string, status: string, resultPath?: string) {
        try {
            return await prisma.aIJob.update({
                where: { providerJobId },
                data: {
                    status,
                    resultPath,
                    updatedAt: new Date(),
                },
            });
        } catch (error) {
            console.error('[AI Audit Service] Failed to update job status:', error);
        }
    }
};
