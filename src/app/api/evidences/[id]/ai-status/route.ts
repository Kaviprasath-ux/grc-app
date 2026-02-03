import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth, validateTenantAccess, forbidden } from "@/lib/api-auth";
import { AI_CONFIG, getAIHeaders } from "@/lib/ai-config";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/evidences/[id]/ai-status
 * Get complete AI status for an evidence
 * Also polls RunPod if job is in progress
 */
export const GET = withAuth(
  async (req: NextRequest, context: RouteContext, session) => {
    try {
      const { id } = await context.params;

      // Get evidence with AI-related data
      const evidence = await prisma.evidence.findUnique({
        where: { id },
        select: {
          id: true,
          customerAccountId: true,
          aiIngestStatus: true,
          aiIngestedAt: true,
          aiReviewStatus: true,
          aiReviewedAt: true,
          evidenceAIIngestJobs: {
            orderBy: { createdAt: "desc" },
            take: 1,
            select: {
              id: true,
              runpodJobId: true,
              status: true,
              error: true,
              createdAt: true,
              completedAt: true,
            },
          },
          evidenceAIReviews: {
            orderBy: { createdAt: "desc" },
            take: 1,
            select: {
              id: true,
              status: true,
              critique: true,
              complianceSummary: true,
              complianceScore: true,
              gaps: true,
              suggestions: true,
              similarityScore: true,
              recommendations: true,
              rawResponse: true,
              createdAt: true,
              updatedAt: true,
            },
          },
        },
      });

      if (!evidence) {
        return NextResponse.json(
          { error: "Evidence not found" },
          { status: 404 }
        );
      }

      if (!validateTenantAccess(session, evidence.customerAccountId)) {
        return forbidden("Access denied to this evidence");
      }

      let latestIngestJob = evidence.evidenceAIIngestJobs[0] || null;
      const latestReview = evidence.evidenceAIReviews[0] || null;

      // If job is in progress (queued/processing), poll RunPod for actual status
      if (latestIngestJob && !["completed", "failed", "ingested"].includes(latestIngestJob.status.toLowerCase())) {
        const jobId = latestIngestJob.runpodJobId;
        const runpodUrl = `${AI_CONFIG.baseUrl}${AI_CONFIG.endpoints.ingestStatus}/${jobId}`;

        console.log(`[AI] GET  ${AI_CONFIG.endpoints.ingestStatus}/${jobId} → polling from ai-status`);

        try {
          const runpodResponse = await fetch(runpodUrl, {
            method: "GET",
            headers: getAIHeaders(),
          });

          if (runpodResponse.ok) {
            const runpodData = await runpodResponse.json();
            const newStatus = runpodData.status?.toLowerCase() || latestIngestJob.status;

            console.log(`[AI] GET  ${AI_CONFIG.endpoints.ingestStatus}/${jobId} → ${newStatus}`, JSON.stringify(runpodData));

            // Update job and evidence if status changed
            if (newStatus !== latestIngestJob.status.toLowerCase()) {
              await prisma.evidenceAIIngestJob.update({
                where: { id: latestIngestJob.id },
                data: {
                  status: newStatus,
                  error: runpodData.error || null,
                  completedAt: (newStatus === "completed" || newStatus === "failed") ? new Date() : null,
                },
              });

              await prisma.evidence.update({
                where: { id: evidence.id },
                data: {
                  aiIngestStatus: newStatus,
                  aiIngestedAt: newStatus === "completed" ? new Date() : undefined,
                  aiReviewStatus: newStatus === "completed" ? "ready" : undefined,
                },
              });

              // Update local variable for response
              latestIngestJob = { ...latestIngestJob, status: newStatus, error: runpodData.error };

              // When ingest completes, call ingest-result to fetch result and auto-trigger review
              if (newStatus === "completed") {
                console.log(`[AI] Ingest completed, calling ingest-result to fetch result and trigger review`);
                try {
                  // Call the ingest-result endpoint internally
                  const ingestResultUrl = `${req.nextUrl.origin}/api/ai/evidence/ingest-result/${jobId}`;
                  const ingestResultResponse = await fetch(ingestResultUrl, {
                    method: "GET",
                    headers: {
                      "Cookie": req.headers.get("cookie") || "",
                    },
                  });

                  if (ingestResultResponse.ok) {
                    const resultData = await ingestResultResponse.json();
                    console.log(`[AI] ingest-result response:`, JSON.stringify(resultData));

                    // If review was auto-triggered, update local evidence data
                    if (resultData.reviewTriggered) {
                      console.log(`[AI] Review auto-triggered successfully`);
                    }
                  } else {
                    console.error(`[AI] Failed to call ingest-result: ${ingestResultResponse.status}`);
                  }
                } catch (resultError) {
                  console.error(`[AI] Error calling ingest-result:`, resultError);
                }
              }
            }
          } else {
            console.log(`[AI] GET  ${AI_CONFIG.endpoints.ingestStatus}/${jobId} → ${runpodResponse.status} (error)`);
          }
        } catch (pollError) {
          console.log(`[AI] GET  ${AI_CONFIG.endpoints.ingestStatus}/${jobId} → poll error:`, pollError);
        }
      }

      // Refetch evidence to get latest review data (in case auto-trigger completed)
      const updatedEvidence = await prisma.evidence.findUnique({
        where: { id },
        select: {
          aiReviewStatus: true,
          aiReviewedAt: true,
          evidenceAIReviews: {
            orderBy: { createdAt: "desc" },
            take: 1,
            select: {
              id: true,
              status: true,
              critique: true,
              complianceSummary: true,
              complianceScore: true,
              gaps: true,
              suggestions: true,
              similarityScore: true,
              recommendations: true,
              rawResponse: true,
              createdAt: true,
              updatedAt: true,
            },
          },
        },
      });

      const finalReview = updatedEvidence?.evidenceAIReviews[0] || latestReview;
      const finalReviewStatus = updatedEvidence?.aiReviewStatus || evidence.aiReviewStatus || "NOT_READY";
      const finalReviewedAt = updatedEvidence?.aiReviewedAt || evidence.aiReviewedAt;

      // Normalize status to uppercase for UI consistency
      const normalizeIngestStatus = (status: string | null | undefined): string => {
        if (!status) return "NOT_STARTED";
        const lower = status.toLowerCase();
        switch (lower) {
          case "queued": return "QUEUED";
          case "processing": return "PROCESSING";
          case "completed": return "COMPLETED";
          case "ingested": return "INGESTED";
          case "failed": return "FAILED";
          default: return status.toUpperCase();
        }
      };

      const normalizeReviewStatus = (status: string | null | undefined): string => {
        if (!status) return "NOT_READY";
        const lower = status.toLowerCase();
        switch (lower) {
          case "ready": return "READY";
          case "in_progress": return "IN_PROGRESS";
          case "completed": return "COMPLETED";
          case "failed": return "FAILED";
          default: return status.toUpperCase();
        }
      };

      // Use updated status from polling
      const rawIngestStatus = latestIngestJob?.status || evidence.aiIngestStatus || "NOT_STARTED";
      const ingestStatus = normalizeIngestStatus(rawIngestStatus);
      const normalizedReviewStatus = normalizeReviewStatus(finalReviewStatus);

      console.log(`[AI] GET /api/evidences/${id}/ai-status → ingest: ${ingestStatus}, review: ${normalizedReviewStatus}`);

      return NextResponse.json({
        evidenceId: evidence.id,
        ingest: {
          status: ingestStatus,
          ingestedAt: evidence.aiIngestedAt?.toISOString() || null,
          latestJob: latestIngestJob
            ? {
                jobId: latestIngestJob.runpodJobId,
                status: latestIngestJob.status,
                error: latestIngestJob.error,
                createdAt: latestIngestJob.createdAt instanceof Date ? latestIngestJob.createdAt.toISOString() : latestIngestJob.createdAt,
                completedAt: latestIngestJob.completedAt instanceof Date ? latestIngestJob.completedAt.toISOString() : latestIngestJob.completedAt || null,
              }
            : null,
        },
        review: {
          status: normalizedReviewStatus,
          reviewedAt: finalReviewedAt?.toISOString() || null,
          latestReview: finalReview
            ? {
                id: finalReview.id,
                status: finalReview.status,
                critique: finalReview.critique,
                complianceSummary: finalReview.complianceSummary,
                complianceScore: finalReview.complianceScore,
                gaps: finalReview.gaps ? JSON.parse(finalReview.gaps) : null,
                suggestions: finalReview.suggestions ? JSON.parse(finalReview.suggestions) : null,
                similarityScore: finalReview.similarityScore,
                recommendations: finalReview.recommendations ? JSON.parse(finalReview.recommendations) : null,
                rawResponse: finalReview.rawResponse ? JSON.parse(finalReview.rawResponse) : null,
                createdAt: finalReview.createdAt.toISOString(),
                updatedAt: finalReview.updatedAt.toISOString(),
              }
            : null,
        },
      });
    } catch (error) {
      console.error("Error fetching AI status:", error);
      return NextResponse.json(
        { error: "Failed to fetch AI status" },
        { status: 500 }
      );
    }
  },
  { resource: "compliance.evidence", action: "view" }
);
