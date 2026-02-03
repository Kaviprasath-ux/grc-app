import { NextRequest, NextResponse } from "next/server";
import { withAuthOnly, AuthenticatedRequest } from "@/lib/api-auth";
import aiApiClient from "@/lib/ai-api-client";
import { aiAuditService } from "@/services/ai-audit-service";
import { prisma } from "@/lib/prisma";

export const dynamic = 'force-dynamic';

interface SemanticMatchResult {
    generated_risk: {
        name: string;
        description?: string;
        risk_sources?: string;
        category?: string;
        type?: string;
        likelihood?: number;
        impact?: number;
        risk_rating?: string;
    };
    matched_existing?: {
        id: string;
        risk_id: string;
        name: string;
        similarity_score: number;
    };
    action: 'create' | 'update' | 'skip';
    similarity_score?: number;
}

/**
 * GET /api/ai/risk-semantic-match/result/{jobId}
 *
 * Get the result of a semantic matching job and persist risks to DB.
 * Uses RunPod API: GET /api/semanticMatch_process_asset_riskV2_result/{job_id}
 *
 * - Creates new risks if no semantic match found
 * - Updates existing risks if a match is found
 * - Ensures idempotency (no duplicate risks)
 */
async function handler(
    req: NextRequest,
    context: { params: Promise<{ jobId: string }> },
    session: AuthenticatedRequest['user']
) {
    const startTime = Date.now();
    const { jobId } = await context.params;
    const endpoint = `/api/semanticMatch_process_asset_riskV2_result/${jobId}`;

    try {
        if (!jobId) {
            return NextResponse.json(
                { error: "Job ID is required" },
                { status: 400 }
            );
        }

        // Fetch result from RunPod
        const response = await aiApiClient.get(endpoint);
        const result = response.data;
        const latency = Date.now() - startTime;

        console.log(`[AI] GET  ${endpoint} → completed`);

        // Get job metadata for customerAccountId
        const job = await (prisma.aIJob as any).findFirst({
            where: { providerJobId: jobId }
        });

        const customerAccountId = session.customerAccountId;
        if (!customerAccountId) {
            return NextResponse.json(
                { error: "Customer account required" },
                { status: 400 }
            );
        }

        // Process semantic matching results
        const matches: SemanticMatchResult[] = result.matches || result.results || [];
        const stats = {
            created: 0,
            updated: 0,
            skipped: 0,
            errors: 0,
        };

        const processedRisks: any[] = [];

        for (const match of matches) {
            try {
                const generatedRisk = match.generated_risk;
                const matchedExisting = match.matched_existing;
                const action = match.action || (matchedExisting ? 'update' : 'create');

                if (action === 'skip') {
                    stats.skipped++;
                    continue;
                }

                // Look up category and type by name
                let categoryId: string | null = null;
                let typeId: string | null = null;

                if (generatedRisk.category) {
                    const category = await prisma.riskCategory.findFirst({
                        where: {
                            customerAccountId,
                            name: { contains: generatedRisk.category, mode: 'insensitive' }
                        }
                    });
                    categoryId = category?.id || null;
                }

                if (generatedRisk.type) {
                    const riskType = await prisma.riskType.findFirst({
                        where: {
                            customerAccountId,
                            name: { contains: generatedRisk.type, mode: 'insensitive' }
                        }
                    });
                    typeId = riskType?.id || null;
                }

                if (action === 'update' && matchedExisting?.id) {
                    // Update existing risk
                    const updated = await prisma.risk.update({
                        where: { id: matchedExisting.id },
                        data: {
                            description: generatedRisk.description || undefined,
                            riskSources: generatedRisk.risk_sources || undefined,
                            likelihood: generatedRisk.likelihood || undefined,
                            impact: generatedRisk.impact || undefined,
                            riskRating: generatedRisk.risk_rating || undefined,
                            updatedAt: new Date(),
                        },
                        select: { id: true, riskId: true, name: true }
                    });
                    processedRisks.push({ ...updated, action: 'updated', similarity: match.similarity_score });
                    stats.updated++;
                } else {
                    // Check for duplicate before creating
                    const existingByName = await prisma.risk.findFirst({
                        where: {
                            customerAccountId,
                            name: { equals: generatedRisk.name, mode: 'insensitive' }
                        }
                    });

                    if (existingByName) {
                        stats.skipped++;
                        processedRisks.push({
                            id: existingByName.id,
                            riskId: existingByName.riskId,
                            name: existingByName.name,
                            action: 'skipped (duplicate)'
                        });
                        continue;
                    }

                    // Generate new risk ID
                    const lastRisk = await prisma.risk.findFirst({
                        where: { customerAccountId },
                        orderBy: { riskId: 'desc' },
                        select: { riskId: true }
                    });
                    const lastNum = lastRisk?.riskId
                        ? parseInt(lastRisk.riskId.replace(/\D/g, '')) || 0
                        : 0;
                    const newRiskId = `RISK-${String(lastNum + 1).padStart(4, '0')}`;

                    // Create new risk
                    const created = await prisma.risk.create({
                        data: {
                            customerAccountId,
                            riskId: newRiskId,
                            name: generatedRisk.name,
                            description: generatedRisk.description || null,
                            riskSources: generatedRisk.risk_sources || null,
                            categoryId,
                            typeId,
                            likelihood: generatedRisk.likelihood || undefined,
                            impact: generatedRisk.impact || undefined,
                            riskRating: generatedRisk.risk_rating || 'Medium',
                            status: 'Open',
                            assessmentStatus: 'Not Started',
                            responseStatus: 'Not Started',
                        },
                        select: { id: true, riskId: true, name: true }
                    });
                    processedRisks.push({ ...created, action: 'created' });
                    stats.created++;
                }
            } catch (err: any) {
                console.log(`[AI] Error processing risk: ${err.message}`);
                stats.errors++;
            }
        }

        // Update job status
        await aiAuditService.updateJobStatus(jobId, 'COMPLETED', {
            stats,
            processedCount: processedRisks.length
        });

        // Log operation
        await aiAuditService.logOperation({
            jobId,
            endpoint,
            method: 'GET',
            responseBody: { stats, processedCount: processedRisks.length },
            statusCode: response.status,
            latencyMs: Date.now() - startTime,
            userId: session.id
        });

        console.log(`[AI] Risk semantic match complete: created=${stats.created}, updated=${stats.updated}, skipped=${stats.skipped}`);

        return NextResponse.json({
            success: true,
            job_id: jobId,
            stats,
            risks: processedRisks,
        });
    } catch (error: any) {
        const latency = Date.now() - startTime;
        console.log(`[AI] GET  ${endpoint} → ${error.status || 500} (error: ${error.message})`);

        await aiAuditService.updateJobStatus(jobId, 'FAILED', null, error.message);

        await aiAuditService.logOperation({
            jobId,
            endpoint,
            method: 'GET',
            error: error.message,
            statusCode: error.status || 500,
            latencyMs: latency,
            userId: session.id
        });

        return NextResponse.json(
            { error: "Failed to get job result", details: error.message },
            { status: error.status || 500 }
        );
    }
}

export const GET = withAuthOnly(handler);
