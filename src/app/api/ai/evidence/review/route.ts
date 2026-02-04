import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth, validateTenantAccess, forbidden } from "@/lib/api-auth";
import aiApiClient from "@/lib/ai-api-client";

interface RequestBody {
  evidenceId: string;
}

/**
 * POST /api/ai/evidence/review
 * Trigger AI review for ingested evidence
 * Calls RunPod /api/grc_evidence_query
 */
export const POST = withAuth(
  async (req: NextRequest, _context, session) => {
    try {
      const body: RequestBody = await req.json();
      const { evidenceId } = body;

      if (!evidenceId) {
        return NextResponse.json(
          { error: "evidenceId is required" },
          { status: 400 }
        );
      }

      // Verify evidence exists and user has access
      // Include attachments (ingested files) instead of linkedArtifacts
      const evidence = await prisma.evidence.findUnique({
        where: { id: evidenceId },
        include: {
          attachments: {
            select: {
              id: true,
              fileName: true,
            },
            orderBy: { uploadedAt: "desc" },
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

      // Verify evidence has been ingested (case-insensitive check)
      const ingestStatus = evidence.aiIngestStatus?.toUpperCase();
      if (ingestStatus !== "INGESTED" && ingestStatus !== "COMPLETED") {
        return NextResponse.json(
          { error: `Evidence must be ingested first. Current status: ${evidence.aiIngestStatus || "NOT_STARTED"}` },
          { status: 400 }
        );
      }

      // Update evidence review status
      await prisma.evidence.update({
        where: { id: evidenceId },
        data: { aiReviewStatus: "IN_PROGRESS" },
      });

      // Prepare AI query request
      // Use attachments (ingested files) for evidence_artifact - these are what was actually ingested
      const requestBody = {
        user_id: session.id,
        evidence_id: evidence.id,
        doc_type: "evidence",
        evidences: [
          {
            evidence_code: evidence.evidenceCode,
            evidence_artifact: evidence.attachments
              .map((att) => att.fileName)
              .join(", ") || evidence.evidenceCode,
          },
        ],
      };

      // Call RunPod evidence query endpoint via standardized aiApiClient
      let response;
      try {
        response = await aiApiClient.post("/api/grc_evidence_query", requestBody);
      } catch (apiError: any) {
        console.error("[Evidence Review] RunPod API failed:", apiError);

        // Update evidence review status to failed
        await prisma.evidence.update({
          where: { id: evidenceId },
          data: {
            aiReviewStatus: "FAILED",
          },
        });

        return NextResponse.json(
          {
            error: "AI review failed",
            details: apiError.rawResponse?.substring(0, 200) || apiError.message,
            requestId: apiError.requestId
          },
          { status: apiError.status || 502 }
        );
      }

      const runpodData = response.data;

      // Create AI operation record
      const aiOperation = await prisma.aIOperation.create({
        data: {
          endpoint: "/api/grc_evidence_query",
          method: "POST",
          requestBody: JSON.stringify(requestBody),
          responseBody: JSON.stringify(runpodData),
          statusCode: response.status,
          latencyMs: response.latencyMs,
          userId: session.id,
        },
      });

      // Parse AI response and create review record
      const reviewRecord = await prisma.evidenceAIReview.create({
        data: {
          evidenceId: evidence.id,
          status: "completed",
          critique: runpodData.critique || null,
          complianceSummary: runpodData.compliance_summary || null,
          complianceScore: runpodData.compliance_score || null,
          gaps: runpodData.gaps ? JSON.stringify(runpodData.gaps) : null,
          suggestions: runpodData.suggestions ? JSON.stringify(runpodData.suggestions) : null,
          similarityScore: runpodData.similarity_score || null,
          recommendations: runpodData.recommendations ? JSON.stringify(runpodData.recommendations) : null,
          rawResponse: JSON.stringify(runpodData),
          aiOperationId: aiOperation.id,
        },
      });

      // Update evidence
      await prisma.evidence.update({
        where: { id: evidenceId },
        data: {
          aiReviewStatus: "COMPLETED",
          aiReviewedAt: new Date(),
        },
      });

      return NextResponse.json({
        success: true,
        reviewId: reviewRecord.id,
        review: {
          critique: reviewRecord.critique,
          complianceSummary: reviewRecord.complianceSummary,
          complianceScore: reviewRecord.complianceScore,
          gaps: reviewRecord.gaps ? JSON.parse(reviewRecord.gaps) : null,
          suggestions: reviewRecord.suggestions ? JSON.parse(reviewRecord.suggestions) : null,
          similarityScore: reviewRecord.similarityScore,
          recommendations: reviewRecord.recommendations ? JSON.parse(reviewRecord.recommendations) : null,
        },
      });
    } catch (error: any) {
      console.error("[Evidence Review] Error:", error);

      return NextResponse.json(
        {
          error: error.message || "Failed to trigger AI review",
          details: error.rawResponse?.substring(0, 200) || String(error),
          requestId: error.requestId
        },
        { status: error.status || 500 }
      );
    }
  },
  { resource: "compliance.evidence", action: "edit" }
);
