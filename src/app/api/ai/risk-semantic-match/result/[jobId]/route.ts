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
 * ARCHITECTURE RULE: This endpoint is READ-ONLY by default.
 * All database writes happen in the /register endpoint.
 * See: Implementation plan for Process AI Risk Flow Alignment
 *
 * Fetches the result of a semantic matching job from RunPod.
 * Returns matched risks with Is_Matched, Similarity_Score for user review.
 *
 * Query Parameters:
 * - persist=true (DEPRECATED): Auto-persist to DB (legacy behavior, will be removed)
 * - persist=false (DEFAULT): Return results only, require explicit /register call
 *
 * Response includes:
 * - risks: Array of matched risks with match info
 * - stats: Summary of what would be created/matched
 * - requiresRegistration: Flag indicating /register call is needed
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

        // Check persist query parameter
        const url = new URL(req.url);
        const persistParam = url.searchParams.get('persist');
        const shouldPersist = persistParam === 'true';

        // Deprecation warning for persist=true
        if (shouldPersist) {
            console.warn(`[DEPRECATED] persist=true in result endpoint for job ${jobId}. Use /register endpoint instead.`);
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

        console.log(`[Risk Semantic Match Result] Processing ${matchedRisks.length} risks (persist=${shouldPersist})`);

        // Calculate stats for preview (what would happen if registered)
        const stats = {
            risks: {
                total: matchedRisks.length,
                created: 0,
                matched: 0,
                skipped: 0,
                errors: 0,
            },
            threats: {
                detected: 0,
                created: 0,
                matched: 0,
                linkedToRisks: 0,
            },
            vulnerabilities: {
                detected: 0,
                created: 0,
                matched: 0,
                linkedToThreats: 0,
            },
            controls: {
                detected: 0,
                created: 0,
                matched: 0,
                linkedToRisks: 0,
            },
        };

        // Preview mode: Check what would happen without making changes
        for (const matchedRisk of matchedRisks) {
            // Check if risk would be matched or created
            if (matchedRisk.Is_Matched && matchedRisk.Matched_Risk_Code) {
                const existingRisk = await prisma.risk.findFirst({
                    where: {
                        customerAccountId,
                        riskId: matchedRisk.Matched_Risk_Code,
                    },
                    select: { id: true }
                });
                if (existingRisk) {
                    stats.risks.matched++;
                } else {
                    // Matched code not found, would create new
                    const existingByName = await prisma.risk.findFirst({
                        where: {
                            customerAccountId,
                            name: { equals: matchedRisk.Risk_name, mode: 'insensitive' }
                        },
                        select: { id: true }
                    });
                    if (existingByName) {
                        stats.risks.skipped++;
                    } else {
                        stats.risks.created++;
                    }
                }
            } else {
                // Not matched by semantic matching, check by name
                const existingByName = await prisma.risk.findFirst({
                    where: {
                        customerAccountId,
                        name: { equals: matchedRisk.Risk_name, mode: 'insensitive' }
                    },
                    select: { id: true }
                });
                if (existingByName) {
                    stats.risks.skipped++;
                } else {
                    stats.risks.created++;
                }
            }

            // Count threats, vulnerabilities, and controls
            if (matchedRisk.Threats) {
                for (const threat of matchedRisk.Threats) {
                    stats.threats.detected++;
                    if (threat.Is_Matched) {
                        stats.threats.matched++;
                    } else {
                        // Check by name
                        const existingThreat = await prisma.riskThreat.findFirst({
                            where: {
                                customerAccountId,
                                name: threat.threat_name,
                            },
                            select: { id: true }
                        });
                        if (existingThreat) {
                            stats.threats.matched++;
                        } else {
                            stats.threats.created++;
                        }
                    }
                    stats.threats.linkedToRisks++;

                    // Count vulnerabilities
                    if (threat.Vulnerabilities) {
                        for (const vuln of threat.Vulnerabilities) {
                            const vulnName = typeof vuln === 'string' ? vuln : (vuln as any).vulnerability_name;
                            if (!vulnName) continue;

                            stats.vulnerabilities.detected++;
                            const existingVuln = await prisma.riskVulnerability.findFirst({
                                where: {
                                    customerAccountId,
                                    name: vulnName,
                                },
                                select: { id: true }
                            });
                            if (existingVuln) {
                                stats.vulnerabilities.matched++;
                            } else {
                                stats.vulnerabilities.created++;
                            }
                            stats.vulnerabilities.linkedToThreats++;
                        }
                    }

                    // Count controls
                    if (threat.controls) {
                        for (const control of threat.controls) {
                            stats.controls.detected++;
                            if (control.Is_Matched) {
                                stats.controls.matched++;
                            } else {
                                const existingControl = await prisma.control.findFirst({
                                    where: {
                                        customerAccountId,
                                        name: control.ControlName,
                                    },
                                    select: { id: true }
                                });
                                if (existingControl) {
                                    stats.controls.matched++;
                                } else {
                                    stats.controls.created++;
                                }
                            }
                            stats.controls.linkedToRisks++;
                        }
                    }
                }
            }
        }

        // Log operation (read-only)
        await aiAuditService.logOperation({
            jobId,
            endpoint: AI_ENDPOINTS.SEMANTIC_MATCH_RESULT,
            method: 'GET',
            responseBody: { stats, riskCount: matchedRisks.length, persist: shouldPersist },
            statusCode: response.status,
            latencyMs: Date.now() - startTime,
            userId: session.id
        });

        // Summary log
        const latencyMs = Date.now() - startTime;
        console.log(`
╔════════════════════════════════════════════════════════════════╗
║          SEMANTIC MATCH RESULT - PREVIEW                        ║
╚════════════════════════════════════════════════════════════════╝
Job ID: ${jobId}
Processing Time: ${latencyMs}ms
Mode: ${shouldPersist ? 'PERSIST (DEPRECATED)' : 'READ-ONLY (Preview)'}

📊 RISKS PREVIEW:
   Total Detected: ${stats.risks.total}
   ├─ Would Create (NEW): ${stats.risks.created}
   ├─ Would Match (Existing): ${stats.risks.matched}
   └─ Would Skip (Duplicate): ${stats.risks.skipped}

⚠️  THREATS PREVIEW:
   Total Detected: ${stats.threats.detected}
   ├─ Would Create (NEW): ${stats.threats.created}
   └─ Would Match (Existing): ${stats.threats.matched}

🛡️  CONTROLS PREVIEW:
   Total Detected: ${stats.controls.detected}
   ├─ Would Create (NEW): ${stats.controls.created}
   └─ Would Match (Existing): ${stats.controls.matched}

${shouldPersist ? '⚠️  DEPRECATED: Use /register endpoint for persistence' : '✅ Call /register endpoint to persist these results'}
════════════════════════════════════════════════════════════════
`);

        // If legacy persist=true mode (DEPRECATED), delegate to register endpoint internally
        if (shouldPersist) {
            console.warn('[DEPRECATED] Auto-persisting from result endpoint. Migrate to /register endpoint.');

            // Make internal call to register endpoint
            const registerResponse = await fetch(new URL('/api/ai/risk-semantic-match/register', req.url).origin + '/api/ai/risk-semantic-match/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Cookie': req.headers.get('cookie') || '',
                },
                body: JSON.stringify({
                    semanticResult: { risks: matchedRisks },
                    jobId,
                }),
            });

            if (!registerResponse.ok) {
                const errorData = await registerResponse.json();
                return errorResponse("Failed to persist results", registerResponse.status, errorData);
            }

            const registerResult = await registerResponse.json();
            return NextResponse.json({
                ...registerResult,
                deprecated: 'persist=true is deprecated. Use /api/ai/risk-semantic-match/register endpoint instead.',
            });
        }

        // Default: Return preview results without persisting
        return NextResponse.json({
            success: true,
            job_id: jobId,
            stats,
            risks: matchedRisks,
            requiresRegistration: true,
            summary: {
                risksProcessed: stats.risks.total,
                newRisksToCreate: stats.risks.created,
                existingRisksToMatch: stats.risks.matched,
                duplicatesToSkip: stats.risks.skipped,
                threatsDetected: stats.threats.detected,
                newThreatsToCreate: stats.threats.created,
                vulnerabilitiesDetected: stats.vulnerabilities.detected,
                newVulnerabilitiesToCreate: stats.vulnerabilities.created,
                controlsDetected: stats.controls.detected,
                newControlsToCreate: stats.controls.created,
            },
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

        return errorResponse("Something went wrong. Please try again.", err.status || 500);
    }
}

export const GET = withAuthOnly(handler);
