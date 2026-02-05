import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { aiDeleteService } from "@/services/ai-delete-service";
import {
  unauthorizedResponse,
  missingFieldResponse,
  notFoundResponse,
  errorResponse,
} from "@/lib/ai-route-helpers";

/**
 * POST /api/ai/governance/cleanup
 *
 * Cleans up AI-processed documents for a policy.
 * Uses aiDeleteService for consistent delete operations.
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
        const results = await aiDeleteService.deleteAllForPolicy(policyId, userId);

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
        const latencyMs = Date.now() - startTime;
        const err = error as { message?: string; status?: number };
        console.error("[Governance Cleanup] Error:", err.message);

        return errorResponse(err.message || "Failed to perform policy cleanup", err.status || 500, {
            details: `Cleanup failed after ${latencyMs}ms`,
        });
    }
}
