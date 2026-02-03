import { NextRequest, NextResponse } from "next/server";
import { withAuthOnly, AuthenticatedRequest } from "@/lib/api-auth";
import aiApiClient from "@/lib/ai-api-client";
import { aiAuditService } from "@/services/ai-audit-service";
import { prisma } from "@/lib/prisma";

export const dynamic = 'force-dynamic';

/**
 * POST /api/ai/risk-semantic-match
 *
 * Submit a semantic matching job to compare AI-generated risks with existing risks.
 * Uses RunPod API: POST /api/semanticMatch_process_asset_riskV2
 *
 * Request body:
 * - processId: string (optional) - Process to generate risks for
 * - generatedRisks: array - AI-generated risks to match
 * - existingRisks: array (optional) - Existing risks from DB (auto-fetched if not provided)
 *
 * Response: { job_id, status: "queued" }
 */
async function handler(
    req: NextRequest,
    _context: any,
    session: AuthenticatedRequest['user']
) {
    const startTime = Date.now();
    const endpoint = "/api/semanticMatch_process_asset_riskV2";

    try {
        const body = await req.json();
        const { processId, generatedRisks, existingRisks } = body;

        if (!generatedRisks || !Array.isArray(generatedRisks) || generatedRisks.length === 0) {
            return NextResponse.json(
                { error: "generatedRisks array is required" },
                { status: 400 }
            );
        }

        // Fetch existing risks from DB if not provided
        let existingLibrary = existingRisks;
        if (!existingLibrary) {
            const dbRisks = await prisma.risk.findMany({
                where: {
                    ...(session.customerAccountId && { customerAccountId: session.customerAccountId }),
                },
                select: {
                    id: true,
                    riskId: true,
                    name: true,
                    description: true,
                    riskSources: true,
                    riskRating: true,
                    status: true,
                    category: { select: { id: true, name: true } },
                    type: { select: { id: true, name: true } },
                },
                take: 500, // Limit for performance
            });
            existingLibrary = dbRisks.map(r => ({
                id: r.id,
                risk_id: r.riskId,
                name: r.name,
                description: r.description,
                risk_sources: r.riskSources,
                risk_rating: r.riskRating,
                status: r.status,
                category: r.category?.name,
                type: r.type?.name,
            }));
        }

        // Prepare form data for RunPod API
        const formData = new URLSearchParams();
        formData.append("existing_library", JSON.stringify(existingLibrary));
        formData.append("generated_risk", JSON.stringify(generatedRisks));

        // Submit job to RunPod
        const response = await aiApiClient.post(endpoint, formData.toString(), {
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
        });

        const result = response.data;
        const jobId = result.job_id;
        const latency = Date.now() - startTime;

        console.log(`[AI] POST ${endpoint} → ${response.status} (job_id=${jobId})`);

        // Create job record in DB
        if (jobId) {
            await aiAuditService.createJob({
                providerJobId: jobId,
                type: 'RISK_SEMANTIC_MATCH',
                userId: session.id,
                metadata: {
                    processId,
                    generatedRisksCount: generatedRisks.length,
                    existingRisksCount: existingLibrary.length,
                }
            });
        }

        // Log operation
        await aiAuditService.logOperation({
            jobId,
            endpoint,
            method: 'POST',
            requestBody: { processId, generatedRisksCount: generatedRisks.length },
            responseBody: result,
            statusCode: response.status,
            latencyMs: latency,
            userId: session.id
        });

        return NextResponse.json({
            job_id: jobId,
            status: result.status || "queued",
            message: "Semantic matching job submitted successfully"
        });
    } catch (error: any) {
        const latency = Date.now() - startTime;
        console.log(`[AI] POST ${endpoint} → ${error.status || 500} (error: ${error.message})`);

        await aiAuditService.logOperation({
            endpoint,
            method: 'POST',
            error: error.message,
            statusCode: error.status || 500,
            latencyMs: latency,
            userId: session.id
        });

        return NextResponse.json(
            { error: "Failed to submit semantic matching job", details: error.message },
            { status: error.status || 500 }
        );
    }
}

export const POST = withAuthOnly(handler);
