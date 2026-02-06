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

        // Get the highest risk ID number upfront to avoid conflicts when creating multiple risks
        const lastRisk = await prisma.risk.findFirst({
            where: { customerAccountId },
            orderBy: { riskId: 'desc' },
            select: { riskId: true }
        });
        let riskIdCounter = lastRisk?.riskId
            ? parseInt(lastRisk.riskId.replace(/\D/g, '')) || 0
            : 0;

        for (const matchedRisk of matchedRisks) {
            try {
                let riskRecord: { id: string; riskId: string; name: string } | null = null;
                let riskAction = 'created';

                // If Is_Matched is true, use the existing risk by Matched_Risk_Code
                if (matchedRisk.Is_Matched && matchedRisk.Matched_Risk_Code) {
                    const existingRisk = await prisma.risk.findFirst({
                        where: {
                            customerAccountId,
                            riskId: matchedRisk.Matched_Risk_Code,
                        },
                        select: { id: true, riskId: true, name: true }
                    });

                    if (existingRisk) {
                        riskRecord = existingRisk;
                        riskAction = 'linked (matched existing)';
                        stats.skipped++;
                        console.log(`[Risk Semantic Match Result] Linking to existing risk: ${existingRisk.riskId}`);
                    }
                }

                // If not matched or existing risk not found, check for duplicate by name
                if (!riskRecord) {
                    const existingByName = await prisma.risk.findFirst({
                        where: {
                            customerAccountId,
                            name: { equals: matchedRisk.Risk_name, mode: 'insensitive' }
                        },
                        select: { id: true, riskId: true, name: true }
                    });

                    if (existingByName) {
                        riskRecord = existingByName;
                        riskAction = 'linked (duplicate by name)';
                        stats.skipped++;
                        console.log(`[Risk Semantic Match Result] Found duplicate by name: ${existingByName.riskId}`);
                    }
                }

                // If still no risk record, create new one
                if (!riskRecord) {
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

                    // Use the counter to generate unique risk IDs within this batch
                    riskIdCounter++;
                    const newRiskId = `RISK-${String(riskIdCounter).padStart(4, '0')}`;

                    // Create new risk
                    riskRecord = await prisma.risk.create({
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
                    riskAction = 'created';
                    stats.created++;
                    console.log(`[Risk Semantic Match Result] Created new risk: ${riskRecord.riskId}`);
                }

                // Process associated threats if present
                if (matchedRisk.Threats && matchedRisk.Threats.length > 0 && riskRecord) {
                    for (const threat of matchedRisk.Threats) {
                        let threatRecord: { id: string; name: string } | null = null;

                        // If threat Is_Matched, use existing threat by Matched_Threat_Code (threatId field)
                        if (threat.Is_Matched && threat.Matched_Threat_Code) {
                            const existingThreat = await prisma.riskThreat.findFirst({
                                where: {
                                    customerAccountId,
                                    threatId: threat.Matched_Threat_Code,
                                },
                                select: { id: true, name: true }
                            });
                            if (existingThreat) {
                                threatRecord = existingThreat;
                                console.log(`[Risk Semantic Match Result] Linked to existing threat by code: ${threat.Matched_Threat_Code} -> ${existingThreat.name}`);
                            } else {
                                console.log(`[Risk Semantic Match Result] Threat code ${threat.Matched_Threat_Code} not found, will search by name or create new`);
                            }
                        }

                        // If not matched, try to find by name or create new
                        if (!threatRecord) {
                            const existingThreat = await prisma.riskThreat.findFirst({
                                where: {
                                    customerAccountId,
                                    name: threat.threat_name,
                                },
                                select: { id: true, name: true }
                            });

                            if (existingThreat) {
                                threatRecord = existingThreat;
                                console.log(`[Risk Semantic Match Result] Linked to existing threat by name: ${existingThreat.name}`);
                            } else {
                                threatRecord = await prisma.riskThreat.create({
                                    data: {
                                        customerAccountId,
                                        name: threat.threat_name,
                                        description: "AI-identified threat",
                                    },
                                    select: { id: true, name: true }
                                });
                                console.log(`[Risk Semantic Match Result] Created new threat: ${threatRecord.name}`);
                            }
                        }

                        // Link threat to risk (if not already linked)
                        await prisma.riskThreatMapping.create({
                            data: {
                                riskId: riskRecord.id,
                                threatId: threatRecord.id,
                            }
                        }).catch(() => {
                            // Ignore duplicate mapping errors
                        });

                        // Process associated controls
                        if (threat.controls) {
                            for (const control of threat.controls) {
                                let controlRecord: { id: string; name: string } | null = null;

                                // If control Is_Matched, use existing control by Matched_Control_Code
                                if (control.Is_Matched && control.Matched_Control_Code) {
                                    const existingControl = await prisma.control.findFirst({
                                        where: {
                                            customerAccountId,
                                            controlCode: control.Matched_Control_Code,
                                        },
                                        select: { id: true, name: true }
                                    });
                                    if (existingControl) {
                                        controlRecord = existingControl;
                                        console.log(`[Risk Semantic Match Result] Using existing control: ${control.Matched_Control_Code}`);
                                    }
                                }

                                // If not matched, try to find by name or create new
                                if (!controlRecord) {
                                    const existingControl = await prisma.control.findFirst({
                                        where: {
                                            customerAccountId,
                                            name: control.ControlName,
                                        },
                                        select: { id: true, name: true }
                                    });

                                    if (existingControl) {
                                        controlRecord = existingControl;
                                        console.log(`[Risk Semantic Match Result] Linked to existing control by name: ${existingControl.name}`);
                                    } else {
                                        const controlCode = `CTL-AI-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
                                        controlRecord = await prisma.control.create({
                                            data: {
                                                customerAccountId,
                                                controlCode,
                                                name: control.ControlName,
                                                functionalGrouping: control.control_functionalGrouping || "protect",
                                                status: "Non Compliant",
                                                description: "AI suggested control",
                                            },
                                            select: { id: true, name: true }
                                        });
                                        console.log(`[Risk Semantic Match Result] Created new control: ${controlCode} - ${controlRecord.name}`);
                                    }
                                }

                                // Link control to risk (if not already linked)
                                await prisma.controlRisk.create({
                                    data: {
                                        controlId: controlRecord.id,
                                        riskId: riskRecord.id,
                                    }
                                }).catch(() => {
                                    // Ignore duplicate mapping errors
                                });
                            }
                        }
                    }
                }

                processedRisks.push({
                    id: riskRecord?.id,
                    riskId: riskRecord?.riskId,
                    name: riskRecord?.name || matchedRisk.Risk_name,
                    matchedCode: matchedRisk.Matched_Risk_Code,
                    similarity: matchedRisk.Similarity_Score,
                    action: riskAction
                });
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
