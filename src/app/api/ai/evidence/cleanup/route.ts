import { NextRequest, NextResponse } from "next/server";
import { withAuthOnly, AuthenticatedRequest } from "@/lib/api-auth";
import { aiDeleteService } from "@/services/ai-delete-service";
import { prisma } from "@/lib/prisma";
import {
  missingFieldResponse,
  notFoundResponse,
  handleAIRouteError,
} from "@/lib/ai-route-helpers";

/**
 * POST /api/ai/evidence/cleanup
 *
 * Cleans up AI-processed documents for an evidence.
 * Calls RunPod /api/grc_delete to remove embeddings.
 */
async function handler(
  req: NextRequest,
  _context: unknown,
  session: AuthenticatedRequest["user"]
) {
  const startTime = Date.now();

  try {
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

    console.log(`[Evidence Cleanup] Starting cleanup for evidence: ${evidence.evidenceCode}`);

    // Delete all AI documents from RunPod
    const results = await aiDeleteService.deleteAllForEvidence(evidenceId, session.id);

    // Reset evidence AI status
    await aiDeleteService.resetEvidenceAIStatus(evidenceId);

    const latencyMs = Date.now() - startTime;
    const successCount = results.filter((r) => r.status === "deleted").length;

    console.log(`[Evidence Cleanup] Completed for ${evidence.evidenceCode}: ${successCount}/${results.length} documents deleted in ${latencyMs}ms`);

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
    return handleAIRouteError(error, {
      route: "Evidence Cleanup",
      startTime,
      userId: session.id,
    });
  }
}

export const POST = withAuthOnly(handler);
