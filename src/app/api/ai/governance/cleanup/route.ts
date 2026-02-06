import { NextRequest, NextResponse } from "next/server";
import { withAuthOnly, AuthenticatedRequest } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { aiDeleteService } from "@/services/ai-delete-service";
import {
  missingFieldResponse,
  notFoundResponse,
  handleAIRouteError,
} from "@/lib/ai-route-helpers";

/**
 * POST /api/ai/governance/cleanup
 *
 * Cleans up AI-processed documents for a policy.
 * Uses aiDeleteService for consistent delete operations.
 */
async function handler(
  req: NextRequest,
  _context: unknown,
  session: AuthenticatedRequest["user"]
) {
  const startTime = Date.now();

  try {
    const body = await req.json();
    const { policyId } = body;

    if (!policyId) {
      return missingFieldResponse("policyId");
    }

    // Verify policy exists
    const policy = await prisma.policy.findUnique({
      where: { id: policyId },
      select: { code: true },
    });

    if (!policy) {
      return notFoundResponse("Policy");
    }

    console.log(`[Governance Cleanup] Starting cleanup for policy: ${policy.code}`);

    // Use aiDeleteService for consistent delete operations
    const results = await aiDeleteService.deleteAllForPolicy(policyId, session.id);

    // Reset policy AI status using the service
    await aiDeleteService.resetPolicyAIStatus(policyId);

    const latencyMs = Date.now() - startTime;
    const successCount = results.filter(r => r.status === 'deleted').length;

    console.log(`[Governance Cleanup] Completed for ${policy.code}: ${successCount}/${results.length} documents deleted in ${latencyMs}ms`);

    return NextResponse.json({
      success: true,
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
      route: "Governance Cleanup",
      startTime,
      userId: session.id,
    });
  }
}

export const POST = withAuthOnly(handler);
