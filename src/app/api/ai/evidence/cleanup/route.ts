import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { aiDeleteService } from "@/services/ai-delete-service";
import { prisma } from "@/lib/prisma";
import {
  unauthorizedResponse,
  missingFieldResponse,
  notFoundResponse,
  errorResponse,
} from "@/lib/ai-route-helpers";

/**
 * POST /api/ai/evidence/cleanup
 *
 * Cleans up AI-processed documents for an evidence.
 * Calls RunPod /api/grc_delete to remove embeddings.
 */
export async function POST(req: NextRequest) {
  const startTime = Date.now();

  try {
    const session = await auth();
    if (!session?.user) {
      return unauthorizedResponse();
    }
    const userId = session.user.id;

    const body = await req.json();
    const { evidenceId } = body;

    if (!evidenceId) {
      return missingFieldResponse("evidenceId");
    }

    // Verify evidence exists
    const evidence = await prisma.evidence.findUnique({
      where: { id: evidenceId },
      select: { evidenceCode: true, name: true },
    });

    if (!evidence) {
      return notFoundResponse("Evidence");
    }

    console.log(
      `[Evidence Cleanup] Starting cleanup for evidence: ${evidence.evidenceCode}`
    );

    // Delete all AI documents from RunPod
    const results = await aiDeleteService.deleteAllForEvidence(
      evidenceId,
      userId
    );

    // Reset evidence AI status
    await aiDeleteService.resetEvidenceAIStatus(evidenceId);

    const latencyMs = Date.now() - startTime;
    const successCount = results.filter((r) => r.status === "deleted").length;

    console.log(
      `[Evidence Cleanup] Completed for ${evidence.evidenceCode}: ${successCount}/${results.length} documents deleted in ${latencyMs}ms`
    );

    return NextResponse.json({
      success: true,
      evidenceCode: evidence.evidenceCode,
      cleanupDetails: results,
      summary: {
        total: results.length,
        deleted: successCount,
        failed: results.length - successCount,
      },
      latencyMs,
    });
  } catch (error: unknown) {
    const latencyMs = Date.now() - startTime;
    const err = error as { message?: string; status?: number };

    console.error("[Evidence Cleanup] Error:", err.message);

    return errorResponse(err.message || "Failed to perform evidence cleanup", err.status || 500, {
      details: `Cleanup failed after ${latencyMs}ms`,
    });
  }
}
