import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth, validateTenantAccess, forbidden } from "@/lib/api-auth";
import { AI_CONFIG, getAIHeaders } from "@/lib/ai-config";

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
      const evidence = await prisma.evidence.findUnique({
        where: { id: evidenceId },
        include: {
          linkedArtifacts: {
            include: {
              artifact: {
                select: {
                  artifactCode: true,
                  name: true,
                },
              },
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

      // Verify evidence has been ingested
      if (evidence.aiIngestStatus !== "INGESTED") {
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
      const requestBody = {
        user_id: session.id,
        evidence_id: evidence.id,
        doc_type: "evidence",
        evidences: [
          {
            evidence_code: evidence.evidenceCode,
            evidence_artifact: evidence.linkedArtifacts
              .map((la) => `${la.artifact.artifactCode}: ${la.artifact.name}`)
              .join(", ") || "",
          },
        ],
      };

      // Call RunPod evidence query endpoint
      const runpodUrl = `${AI_CONFIG.baseUrl}${AI_CONFIG.endpoints.evidenceQuery}`;
      console.log(`Calling RunPod AI review: ${runpodUrl}`);

      const runpodResponse = await fetch(runpodUrl, {
        method: "POST",
        headers: getAIHeaders(),
        body: JSON.stringify(requestBody),
      });

      if (!runpodResponse.ok) {
        const errorText = await runpodResponse.text();
        console.error("RunPod AI review failed:", errorText);

        // Update evidence review status to failed
        await prisma.evidence.update({
          where: { id: evidenceId },
          data: {
            aiReviewStatus: "FAILED",
          },
        });

        return NextResponse.json(
          { error: "AI review failed", details: errorText },
          { status: 502 }
        );
      }

      const runpodData = await runpodResponse.json();

      // Create AI operation record
      const aiOperation = await prisma.aIOperation.create({
        data: {
          endpoint: runpodUrl,
          method: "POST",
          requestBody: JSON.stringify(requestBody),
          responseBody: JSON.stringify(runpodData),
          statusCode: runpodResponse.status,
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
    } catch (error) {
      console.error("Error triggering AI review:", error);

      // Try to update evidence status to failed
      try {
        const body: RequestBody = await req.json();
        await prisma.evidence.update({
          where: { id: body.evidenceId },
          data: { aiReviewStatus: "FAILED" },
        });
      } catch (e) {
        // Ignore update errors
      }

      return NextResponse.json(
        { error: "Failed to trigger AI review", details: String(error) },
        { status: 500 }
      );
    }
  },
  { resource: "compliance.evidence", action: "edit" }
);
