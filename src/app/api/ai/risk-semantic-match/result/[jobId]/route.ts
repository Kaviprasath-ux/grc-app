import { NextRequest, NextResponse } from "next/server";
import { withAuthOnly, AuthenticatedRequest } from "@/lib/api-auth";
import aiApiClient from "@/lib/ai-api-client";
import { aiAuditService } from "@/services/ai-audit-service";
import { prisma } from "@/lib/prisma";
import { AI_ENDPOINTS } from "@/lib/ai-endpoints";
import {
  missingFieldResponse,
  badRequestResponse,
  errorResponse,
} from "@/lib/ai-route-helpers";
import type { MatchedRisk, SemanticMatchingResults } from "@/types/ai-types";

export const dynamic = 'force-dynamic';

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

    try {
        if (!jobId) {
            return missingFieldResponse("jobId");
        }

        // Fetch result from RunPod
        const response = await aiApiClient.get(`${AI_ENDPOINTS.SEMANTIC_MATCH_RESULT}/${jobId}`);
        // API returns { results: { risks: MatchedRisk[] }, status: "success" }
        const rawResult = response.data as { results?: SemanticMatchingResults; risks?: MatchedRisk[] };

        console.log(`[Risk Semantic Match Result] Job ${jobId} completed`);
        console.log(`[Risk Semantic Match Result] Raw result structure:`, Object.keys(rawResult));

        const customerAccountId = session.customerAccountId;
        if (!customerAccountId) {
            return badRequestResponse("Customer account required");
        }

        // Extract risks from the response - handle different possible formats
        let matchedRisks: MatchedRisk[] = [];
        if (rawResult.results?.risks) {
            matchedRisks = rawResult.results.risks;
        } else if (rawResult.risks) {
            matchedRisks = rawResult.risks;
        } else if (Array.isArray(rawResult)) {
            matchedRisks = rawResult as MatchedRisk[];
        }

        console.log(`[Risk Semantic Match Result] Processing ${matchedRisks.length} risks`);

        const stats = {
            created: 0,
            updated: 0,
            skipped: 0,
            errors: 0,
        };

        interface ProcessedRisk {
            id?: string;
            riskId?: string;
            name: string;
            matchedCode?: string;
            similarity?: number;
            action: string;
        }
        const processedRisks: ProcessedRisk[] = [];

        for (const matchedRisk of matchedRisks) {
            try {
                // If Is_Matched is true, the risk already exists in the library - skip it
                if (matchedRisk.Is_Matched && matchedRisk.Matched_Risk_Code) {
                    stats.skipped++;
                    processedRisks.push({
                        name: matchedRisk.Risk_name,
                        matchedCode: matchedRisk.Matched_Risk_Code,
                        similarity: matchedRisk.Similarity_Score,
                        action: 'skipped (matched existing)',
                    });
                    continue;
                }

                // Look up category by name
                let categoryId: string | null = null;
                if (matchedRisk.Risk_category) {
                    const category = await prisma.riskCategory.findFirst({
                        where: {
                            customerAccountId,
                            name: { contains: matchedRisk.Risk_category, mode: 'insensitive' }
                        }
                    });
                    categoryId = category?.id || null;
                }

                // Check for duplicate by name before creating
                const existingByName = await prisma.risk.findFirst({
                    where: {
                        customerAccountId,
                        name: { equals: matchedRisk.Risk_name, mode: 'insensitive' }
                    }
                });

                if (existingByName) {
                    stats.skipped++;
                    processedRisks.push({
                        id: existingByName.id,
                        riskId: existingByName.riskId,
                        name: existingByName.name,
                        action: 'skipped (duplicate by name)',
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

                // Create new risk (Is_Matched = false means this is a new unique risk)
                const created = await prisma.risk.create({
                    data: {
                        customerAccountId,
                        riskId: newRiskId,
                        name: matchedRisk.Risk_name,
                        description: matchedRisk.Risk_description || null,
                        riskSources: "AI-Generated (Semantic Match)",
                        categoryId,
                        riskRating: matchedRisk.Inherent_risk_rating || 'Medium',
                        status: 'Open',
                        assessmentStatus: 'Not Started',
                        responseStatus: 'Not Started',
                    },
                    select: { id: true, riskId: true, name: true }
                });

                // Also create associated threats if present
                if (matchedRisk.Threats && matchedRisk.Threats.length > 0) {
                    for (const threat of matchedRisk.Threats) {
                        // Create or find threat
                        const existingThreat = await prisma.riskThreat.findFirst({
                            where: {
                                customerAccountId,
                                name: threat.threat_name,
                            }
                        });

                        const threatRecord = existingThreat || await prisma.riskThreat.create({
                            data: {
                                customerAccountId,
                                name: threat.threat_name,
                                description: "AI-identified threat",
                            }
                        });

                        // Link threat to risk
                        await prisma.riskThreatMapping.create({
                            data: {
                                riskId: created.id,
                                threatId: threatRecord.id,
                            }
                        }).catch(() => {
                            // Ignore duplicate mapping errors
                        });

                        // Create associated controls
                        if (threat.controls) {
                            for (const control of threat.controls) {
                                const existingControl = await prisma.control.findFirst({
                                    where: {
                                        customerAccountId,
                                        name: control.ControlName,
                                    }
                                });

                                if (!existingControl) {
                                    const newControl = await prisma.control.create({
                                        data: {
                                            customerAccountId,
                                            controlCode: `CTL-AI-${Math.random().toString(36).substring(2, 7).toUpperCase()}`,
                                            name: control.ControlName,
                                            functionalGrouping: control.control_functionalGrouping || "protect",
                                            status: "Non Compliant",
                                            description: "AI suggested control",
                                        }
                                    });

                                    // Link control to risk
                                    await prisma.controlRisk.create({
                                        data: {
                                            controlId: newControl.id,
                                            riskId: created.id,
                                        }
                                    }).catch(() => {
                                        // Ignore duplicate mapping errors
                                    });
                                }
                            }
                        }
                    }
                }

                processedRisks.push({ ...created, action: 'created' });
                stats.created++;
            } catch (err: unknown) {
                const processErr = err as { message?: string };
                console.error(`[Risk Semantic Match Result] Error processing risk:`, processErr.message);
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
            endpoint: AI_ENDPOINTS.SEMANTIC_MATCH_RESULT,
            method: 'GET',
            responseBody: { stats, processedCount: processedRisks.length },
            statusCode: response.status,
            latencyMs: Date.now() - startTime,
            userId: session.id
        });

        console.log(`[Risk Semantic Match Result] Complete: created=${stats.created}, updated=${stats.updated}, skipped=${stats.skipped}`);

        return NextResponse.json({
            success: true,
            job_id: jobId,
            stats,
            risks: processedRisks,
        });
    } catch (error: unknown) {
        const latency = Date.now() - startTime;
        const err = error as { message?: string; status?: number };
        console.error(`[Risk Semantic Match Result] Error:`, err);

        await aiAuditService.updateJobStatus(jobId, 'FAILED', null, err.message);

        await aiAuditService.logOperation({
            jobId,
            endpoint: AI_ENDPOINTS.SEMANTIC_MATCH_RESULT,
            method: 'GET',
            error: err.message,
            statusCode: err.status || 500,
            latencyMs: latency,
            userId: session.id
        });

        return errorResponse("Failed to get job result", err.status || 500, {
            details: err.message,
        });
    }
}

export const GET = withAuthOnly(handler);
