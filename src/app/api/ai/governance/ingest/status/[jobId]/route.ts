import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import aiApiClient from "@/lib/ai-api-client";
import { aiAuditService } from "@/services/ai-audit-service";
import { prisma } from "@/lib/prisma";
import { AI_ENDPOINTS } from "@/lib/ai-endpoints";
import {
  unauthorizedResponse,
  missingFieldResponse,
  errorResponse,
} from "@/lib/ai-route-helpers";

/**
 * GET /api/ai/governance/ingest/status/[jobId]
 *
 * Check the status of a policy document ingest job.
 * Aligned with RunPod /api/grc_ingest_status/{job_id} OpenAPI contract.
 */
export async function GET(
    req: NextRequest,
    context: { params: Promise<{ jobId: string }> }
) {
    const startTime = Date.now();
    let userId: string | undefined;

    try {
        const session = await auth();
        if (!session?.user) {
            return unauthorizedResponse();
        }
        userId = session.user.id;

        const { jobId } = await context.params;

        if (!jobId) {
            return missingFieldResponse("jobId");
        }

        // Call backend to check job status
        const response = await aiApiClient.get(`${AI_ENDPOINTS.INGEST_STATUS}/${jobId}`);

        const statusData = response.data as { status?: string; document_id?: string };

        // Update AIJob status in database
        await aiAuditService.updateJobStatus(
            jobId,
            statusData.status?.toUpperCase() || 'PROCESSING'
        );

        // Update Policy AI Ingest Status based on job status
        const normalizedStatus = statusData.status?.toLowerCase();
        if (normalizedStatus === 'completed' || normalizedStatus === 'success') {
            // Find policy by job ID and update
            const policy = await prisma.policy.findFirst({
                where: { aiIngestJobId: jobId },
            });

            if (policy) {
                await prisma.policy.update({
                    where: { id: policy.id },
                    data: {
                        aiIngestStatus: 'INGESTED',
                        aiIngestedAt: new Date(),
                    },
                });

                // Update PolicyAIReview status
                await prisma.policyAIReview.updateMany({
                    where: {
                        policyId: policy.id,
                        status: 'processing',
                    },
                    data: {
                        status: 'ingested',
                        documentId: statusData.document_id || jobId,
                    },
                });

                console.log(`[Governance Ingest Status] Updated policy ${policy.id} to INGESTED`);
            }
        } else if (normalizedStatus === 'failed' || normalizedStatus === 'error') {
            // Update policy to failed status
            const policy = await prisma.policy.findFirst({
                where: { aiIngestJobId: jobId },
            });

            if (policy) {
                await prisma.policy.update({
                    where: { id: policy.id },
                    data: {
                        aiIngestStatus: 'FAILED',
                    },
                });

                await prisma.policyAIReview.updateMany({
                    where: {
                        policyId: policy.id,
                        status: 'processing',
                    },
                    data: {
                        status: 'failed',
                    },
                });
            }
        } else if (normalizedStatus === 'processing' || normalizedStatus === 'queued') {
            // Update to PROCESSING if still in progress
            const policy = await prisma.policy.findFirst({
                where: { aiIngestJobId: jobId },
            });

            if (policy && policy.aiIngestStatus === 'QUEUED') {
                await prisma.policy.update({
                    where: { id: policy.id },
                    data: {
                        aiIngestStatus: 'PROCESSING',
                    },
                });
            }
        }

        const latency = Date.now() - startTime;

        // Log operation
        await aiAuditService.logOperation({
            endpoint: AI_ENDPOINTS.INGEST_STATUS,
            method: 'GET',
            requestBody: null,
            responseBody: statusData,
            userId,
            latencyMs: latency,
            statusCode: 200,
        });

        return NextResponse.json(statusData);
    } catch (error: unknown) {
        const latency = Date.now() - startTime;
        const err = error as { message?: string; response?: { status?: number }; status?: number };

        console.error("[Governance Ingest Status] Error:", err);

        await aiAuditService.logOperation({
            endpoint: AI_ENDPOINTS.INGEST_STATUS,
            method: 'GET',
            requestBody: null,
            responseBody: { error: err.message },
            userId,
            latencyMs: latency,
            statusCode: err.response?.status || err.status || 500,
        });

        return errorResponse("Unable to check processing status. Please try again.", err.response?.status || err.status || 500);
    }
}
