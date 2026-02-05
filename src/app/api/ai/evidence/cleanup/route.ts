import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { aiDeleteService } from "@/services/ai-delete-service";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/ai/evidence/cleanup
 *
 * Cleans up AI-processed documents for an evidence.
 * Calls RunPod /api/grc_delete to remove embeddings.
 */
export async function POST(req: NextRequest) {
  const startTime = Date.now();
  let userId: string | undefined;

  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    userId = session.user.id;

    const body = await req.json();
    const { evidenceId } = body;

    if (!evidenceId) {
      return NextResponse.json(
        { error: "evidenceId is required" },
        { status: 400 }
      );
    }

    // Verify evidence exists
    const evidence = await prisma.evidence.findUnique({
      where: { id: evidenceId },
      select: { evidenceCode: true, name: true },
    });

    if (!evidence) {
      return NextResponse.json({ error: "Evidence not found" }, { status: 404 });
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

    return NextResponse.json(
      { error: err.message || "Failed to perform evidence cleanup" },
      { status: err.status || 500 }
    );
  }
}
