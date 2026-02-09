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
 * GET /api/ai/governance/ingest/result/[jobId]
 *
 * Get the result of a completed policy document ingest job.
 * Aligned with RunPod /api/grc_ingest_result/{job_id} OpenAPI contract.
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

        // Call backend to get job result
        const response = await aiApiClient.get(`${AI_ENDPOINTS.INGEST_RESULT}/${jobId}`);

        const resultData = response.data as { document_id?: string; status?: boolean | string };

        // Update AIJob status to COMPLETED with result
        await aiAuditService.updateJobStatus(
            jobId,
            'COMPLETED',
            JSON.stringify(resultData)
        );

        // Update Policy and PolicyAIReview with result
        const policy = await prisma.policy.findFirst({
            where: { aiIngestJobId: jobId },
        });

        if (policy) {
            // Update policy to INGESTED
            await prisma.policy.update({
                where: { id: policy.id },
                data: {
                    aiIngestStatus: 'INGESTED',
                    aiIngestedAt: new Date(),
                },
            });

            // Update PolicyAIReview with document ID
            await prisma.policyAIReview.updateMany({
                where: {
                    policyId: policy.id,
                    status: { in: ['processing', 'queued'] },
                },
                data: {
                    status: 'ingested',
                    documentId: resultData.document_id || jobId,
                },
            });

            console.log(`[Governance Ingest Result] Updated policy ${policy.id} with document ID: ${resultData.document_id || jobId}`);
        }

        const latency = Date.now() - startTime;

        // Log operation
        await aiAuditService.logOperation({
            endpoint: AI_ENDPOINTS.INGEST_RESULT,
            method: 'GET',
            requestBody: null,
            responseBody: resultData,
            userId,
            latencyMs: latency,
            statusCode: 200,
        });

        return NextResponse.json(resultData);
    } catch (error: unknown) {
        const latency = Date.now() - startTime;
        const err = error as { message?: string; response?: { status?: number }; status?: number };

        console.error("[Governance Ingest Result] Error:", err);

        await aiAuditService.logOperation({
            endpoint: AI_ENDPOINTS.INGEST_RESULT,
            method: 'GET',
            requestBody: null,
            responseBody: { error: err.message },
            userId,
            latencyMs: latency,
            statusCode: err.response?.status || err.status || 500,
        });

        return errorResponse("Failed to get ingest result", err.response?.status || err.status || 500, {
            details: err.message,
        });
    }
}
