import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth, validateTenantAccess, forbidden } from "@/lib/api-auth";
import aiApiClient from "@/lib/ai-api-client";
import { AI_ENDPOINTS } from "@/lib/ai-endpoints";
import {
  notFoundResponse,
  errorResponse,
  isTerminalStatus,
} from "@/lib/ai-route-helpers";

interface RouteContext {
  params: Promise<{ jobId: string }>;
}

/**
 * GET /api/ai/evidence/ingest-status/[jobId]
 * Poll ingest job status from RunPod
 *
 * RunPod Endpoint: GET /api/grc_ingest_status/{jobId}
 */
export const GET = withAuth(
  async (req: NextRequest, context: RouteContext, session) => {
    try {
      const { jobId } = await context.params;

      // Find ingest job
      const ingestJob = await prisma.evidenceAIIngestJob.findUnique({
        where: { runpodJobId: jobId },
        include: {
          evidence: {
            select: {
              id: true,
              customerAccountId: true,
            },
          },
        },
      });

      if (!ingestJob) {
        return notFoundResponse("Ingest job");
      }

      if (!validateTenantAccess(session, ingestJob.evidence.customerAccountId)) {
        return forbidden("Access denied to this evidence");
      }

      // If already completed or failed, return cached status
      const currentStatus = ingestJob.status.toLowerCase();
      if (isTerminalStatus(currentStatus)) {
        return NextResponse.json({
          job_id: ingestJob.runpodJobId,
          status: currentStatus,
          error: ingestJob.error || null,
        });
      }

      // Call RunPod status endpoint via standardized aiApiClient
      let response;
      try {
        response = await aiApiClient.get(`${AI_ENDPOINTS.INGEST_STATUS}/${jobId}`);
      } catch (apiError: unknown) {
        const err = apiError as { message?: string; requestId?: string; status?: number };
        console.error(`[Evidence Ingest Status] API error:`, err);

        // Update job to failed
        await prisma.evidenceAIIngestJob.update({
          where: { id: ingestJob.id },
          data: {
            status: "failed",
            error: `Status check failed: ${err.message}`,
            completedAt: new Date(),
          },
        });

        await prisma.evidence.update({
          where: { id: ingestJob.evidenceId },
          data: { aiIngestStatus: "failed" },
        });

        return errorResponse(err.message || "Status check failed", err.status || 502, {
          jobId,
          currentStatus: "failed",
          requestId: err.requestId,
        });
      }

      // Response: { "job_id": "...", "status": "completed", "error": null }
      const runpodData = response.data as { status?: string; error?: string | null };
      const newStatus = runpodData.status?.toLowerCase() || "queued";

      // Update job status
      const updatedJob = await prisma.evidenceAIIngestJob.update({
        where: { id: ingestJob.id },
        data: {
          status: newStatus,
          error: runpodData.error || null,
          completedAt: (newStatus === "completed" || newStatus === "failed") ? new Date() : null,
        },
      });

      // Update evidence status
      await prisma.evidence.update({
        where: { id: ingestJob.evidenceId },
        data: {
          aiIngestStatus: newStatus,
          aiIngestedAt: newStatus === "completed" ? new Date() : undefined,
          aiReviewStatus: newStatus === "completed" ? "ready" : undefined,
        },
      });

      // AUTO-FETCH RESULT: When status becomes "completed", fetch and store the result
      let resultData = null;
      if (newStatus === "completed") {
        try {
          // Check if result already exists
          const existingResult = await prisma.evidenceAIIngestResult.findUnique({
            where: { jobId: jobId },
          });

          if (!existingResult) {
            // Fetch result from RunPod via standardized aiApiClient
            console.log(`[Evidence Ingest Status] AUTO-FETCH result for job ${jobId}`);

            try {
              const resultResponse = await aiApiClient.get(`${AI_ENDPOINTS.INGEST_RESULT}/${jobId}`);
              const resultJson = resultResponse.data as {
                job_id?: string;
                document_id?: string;  // Capture if RunPod returns a document_id
                result?: { messages?: unknown[]; status?: boolean };
              };
              const messages = resultJson.result?.messages || [];
              const returnedDocId = resultJson.document_id || null;

              // Store the result
              await prisma.evidenceAIIngestResult.create({
                data: {
                  evidenceId: ingestJob.evidenceId,
                  jobId: jobId,
                  extractedText: JSON.stringify(messages),
                  embeddings: null,
                  metadata: JSON.stringify({ status: resultJson.result?.status }),
                  indexingStatus: resultJson.result?.status ? "success" : "failed",
                },
              });

              // Update job with result and returned document_id
              await prisma.evidenceAIIngestJob.update({
                where: { id: ingestJob.id },
                data: {
                  result: JSON.stringify(resultJson),
                  returnedDocumentId: returnedDocId,  // Track RunPod's returned document_id
                },
              });

              resultData = resultJson;
              console.log(`[Evidence Ingest Status] AUTO-FETCH result stored for job ${jobId}`);
            } catch (fetchError: unknown) {
              const fetchErr = fetchError as { message?: string };
              console.error(`[Evidence Ingest Status] AUTO-FETCH result failed:`, fetchErr.message);
            }
          }
        } catch (autoFetchError) {
          console.error("[Evidence Ingest Status] AUTO-FETCH result error:", autoFetchError);
          // Don't fail the status request, just log the error
        }
      }

      return NextResponse.json({
        job_id: updatedJob.runpodJobId,
        status: updatedJob.status,
        error: updatedJob.error || null,
        resultFetched: resultData !== null,
      });
    } catch (error: unknown) {
      const err = error as { message?: string; requestId?: string; status?: number };
      console.error("[Evidence Ingest Status] Error:", err);
      return errorResponse(err.message || "Failed to poll ingest status", err.status || 500, {
        requestId: err.requestId,
      });
    }
  },
  { resource: "compliance.evidence", action: "view" }
);
