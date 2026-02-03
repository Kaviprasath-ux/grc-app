import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth, validateTenantAccess, forbidden } from "@/lib/api-auth";
import { AI_CONFIG, getAIHeaders } from "@/lib/ai-config";

interface RouteContext {
  params: Promise<{ jobId: string }>;
}

/**
 * GET /api/ai/evidence/ingest-status/[jobId]
 * Poll ingest job status from RunPod
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
        return NextResponse.json(
          { error: "Ingest job not found" },
          { status: 404 }
        );
      }

      if (!validateTenantAccess(session, ingestJob.evidence.customerAccountId)) {
        return forbidden("Access denied to this evidence");
      }

      // If already completed or failed, return cached status
      const currentStatus = ingestJob.status.toLowerCase();
      if (currentStatus === "completed" || currentStatus === "failed") {
        return NextResponse.json({
          job_id: ingestJob.runpodJobId,
          status: currentStatus,
          error: ingestJob.error || null,
        });
      }

      // Call RunPod status endpoint
      const runpodUrl = `${AI_CONFIG.baseUrl}${AI_CONFIG.endpoints.ingestStatus}/${jobId}`;
      console.log(`[AI] GET  ${AI_CONFIG.endpoints.ingestStatus}/${jobId} → polling`);

      const runpodResponse = await fetch(runpodUrl, {
        method: "GET",
        headers: getAIHeaders(),
      });
      console.info(`[AI] Response Status: ${runpodResponse.status}`);
      

      if (!runpodResponse.ok) {
        const errorText = await runpodResponse.text();
        console.log(`[AI] GET  ${AI_CONFIG.endpoints.ingestStatus}/${jobId} → ${runpodResponse.status} (error)`);

        // Update job to failed
        await prisma.evidenceAIIngestJob.update({
          where: { id: ingestJob.id },
          data: {
            status: "failed",
            error: `Status check failed: ${errorText}`,
            completedAt: new Date(),
          },
        });

        await prisma.evidence.update({
          where: { id: ingestJob.evidenceId },
          data: { aiIngestStatus: "failed" },
        });

        return NextResponse.json(
          { job_id: jobId, status: "failed", error: errorText },
          { status: 502 }
        );
      }

      // Response: { "job_id": "...", "status": "completed", "error": null }
      const runpodData = await runpodResponse.json();
      const newStatus = runpodData.status?.toLowerCase() || "queued";

      console.log(`[AI] GET  ${AI_CONFIG.endpoints.ingestStatus}/${jobId} → ${newStatus}`, JSON.stringify(runpodData));

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

      return NextResponse.json({
        job_id: updatedJob.runpodJobId,
        status: updatedJob.status,
        error: updatedJob.error || null,
      });
    } catch (error) {
      console.error("Error polling ingest status:", error);
      return NextResponse.json(
        { error: "Failed to poll ingest status", details: String(error) },
        { status: 500 }
      );
    }
  },
  { resource: "compliance.evidence", action: "view" }
);
