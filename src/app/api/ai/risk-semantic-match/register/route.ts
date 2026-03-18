import { NextRequest, NextResponse } from "next/server";
import { withAuthOnly, AuthenticatedRequest } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { aiAuditService } from "@/services/ai-audit-service";
import {
    badRequestResponse,
    errorResponse,
} from "@/lib/ai-route-helpers";
import type { MatchedRisk, MatchedThreat, MatchedControl } from "@/types/ai-types";

export const dynamic = 'force-dynamic';

/**
 * POST /api/ai/risk-semantic-match/register
 *
 * ARCHITECTURE RULE: This is the ONLY endpoint that writes risk data from semantic matching.
 * All other endpoints (result, status) are READ-ONLY.
 * See: Implementation plan for Process AI Risk Flow Alignment
 *
 * Register semantic match results to database.
 * - Creates new risks if no semantic match found
 * - Links to existing risks if a match is found
 * - Creates threats, vulnerabilities, and controls
 * - Ensures idempotency (no duplicate risks)
 *
 * Request: { processId?: string, semanticResult: { risks: MatchedRisk[] } }
 * Response: { success, stats, risks: [...] }
 */
async function handler(
    req: NextRequest,
    _context: unknown,
    session: AuthenticatedRequest['user']
) {
    const startTime = Date.now();
    let jobId = 'manual-register';

    try {
        const body = await req.json();
        const { processId, semanticResult, jobId: providedJobId } = body;

        if (providedJobId) {
            jobId = providedJobId;
        }

        const customerAccountId = session.customerAccountId;
        if (!customerAccountId) {
            return badRequestResponse("Customer account required");
        }

        // Extract risks from the semantic result - handle different possible formats
        let matchedRisks: MatchedRisk[] = [];
        if (semanticResult?.risks) {
            matchedRisks = semanticResult.risks;
        } else if (semanticResult?.results?.risks) {
            matchedRisks = semanticResult.results.risks;
        } else if (Array.isArray(semanticResult)) {
            matchedRisks = semanticResult as MatchedRisk[];
        }

        if (!Array.isArray(matchedRisks) || matchedRisks.length === 0) {
            return badRequestResponse("No risks in semantic result to register");
        }

        console.log(`[Risk Register] Starting registration of ${matchedRisks.length} risks for customer ${customerAccountId}`);

        // Enhanced stats tracking for risks, threats, vulnerabilities, and controls
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

        interface ProcessedRisk {
            id?: string;
            riskId?: string;
            name: string;
            matchedCode?: string;
            similarity?: number;
            action: string;
            threatsCount?: number;
            controlsCount?: number;
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
                        stats.risks.matched++;
                        console.log(`[Risk Register] Linking to existing risk: ${existingRisk.riskId}`);
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
                        stats.risks.skipped++;
                        console.log(`[Risk Register] Found duplicate by name: ${existingByName.riskId}`);
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

                    // Create new risk with optional process link
                    const riskData: any = {
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
                    };

                    // Link to process if provided
                    if (processId) {
                        riskData.impactedProcessId = processId;
                    }

                    riskRecord = await prisma.risk.create({
                        data: riskData,
                        select: { id: true, riskId: true, name: true }
                    });
                    riskAction = 'created';
                    stats.risks.created++;
                    console.log(`[Risk Register] Created new risk: ${riskRecord.riskId}`);

                    // Create activity log for new risk
                    await prisma.riskActivityLog.create({
                        data: {
                            riskId: riskRecord.id,
                            activity: "Created",
                            description: `Risk "${riskRecord.name}" was created from AI Semantic Match`,
                            actor: "System",
                        }
                    });
                }

                // Track threats and controls for this risk
                let riskThreatsCount = 0;
                let riskControlsCount = 0;

                // Process associated threats if present
                if (matchedRisk.Threats && matchedRisk.Threats.length > 0 && riskRecord) {
                    for (const threat of matchedRisk.Threats) {
                        stats.threats.detected++;
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
                                stats.threats.matched++;
                                console.log(`[Threat] ✓ Matched existing by code: ${threat.Matched_Threat_Code} -> ${existingThreat.name}`);
                            } else {
                                console.log(`[Threat] Code ${threat.Matched_Threat_Code} not found, will search by name or create new`);
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
                                stats.threats.matched++;
                                console.log(`[Threat] ✓ Matched existing by name: ${existingThreat.name}`);
                            } else {
                                threatRecord = await prisma.riskThreat.create({
                                    data: {
                                        customerAccountId,
                                        name: threat.threat_name,
                                        description: "AI-identified threat",
                                    },
                                    select: { id: true, name: true }
                                });
                                stats.threats.created++;
                                console.log(`[Threat] + Created NEW: ${threatRecord.name}`);
                            }
                        }

                        // Link threat to risk (if not already linked)
                        await prisma.riskThreatMapping.create({
                            data: {
                                riskId: riskRecord.id,
                                threatId: threatRecord.id,
                            }
                        }).then(() => {
                            stats.threats.linkedToRisks++;
                            riskThreatsCount++;
                        }).catch(() => {
                            // Already linked - ignore
                        });

                        // Process associated vulnerabilities if present
                        if (threat.Vulnerabilities && threat.Vulnerabilities.length > 0) {
                            for (const vuln of threat.Vulnerabilities) {
                                // Handle both string format and object format
                                const vulnName = typeof vuln === 'string' ? vuln : (vuln as any).vulnerability_name;
                                if (!vulnName) continue;

                                stats.vulnerabilities.detected++;
                                let vulnRecord: { id: string; name: string } | null = null;

                                // Try to find existing vulnerability by name
                                const existingVuln = await prisma.riskVulnerability.findFirst({
                                    where: {
                                        customerAccountId,
                                        name: vulnName,
                                    },
                                    select: { id: true, name: true }
                                });

                                if (existingVuln) {
                                    vulnRecord = existingVuln;
                                    stats.vulnerabilities.matched++;
                                    console.log(`[Vulnerability] ✓ Matched existing: ${existingVuln.name}`);
                                } else {
                                    vulnRecord = await prisma.riskVulnerability.create({
                                        data: {
                                            customerAccountId,
                                            name: vulnName,
                                            description: "AI-identified vulnerability",
                                        },
                                        select: { id: true, name: true }
                                    });
                                    stats.vulnerabilities.created++;
                                    console.log(`[Vulnerability] + Created NEW: ${vulnRecord.name}`);
                                }

                                stats.vulnerabilities.linkedToThreats++;
                            }
                        }

                        // Process associated controls
                        if (threat.controls) {
                            for (const control of threat.controls) {
                                stats.controls.detected++;
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
                                        stats.controls.matched++;
                                        console.log(`[Control] ✓ Matched existing by code: ${control.Matched_Control_Code}`);
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
                                        stats.controls.matched++;
                                        console.log(`[Control] ✓ Matched existing by name: ${existingControl.name}`);
                                    } else {
                                        // Generate UC-XXX-NNNN-YYYY format code
                                        const fg = control.control_functionalGrouping || "protect";
                                        const abbr = fg.substring(0, 3).toUpperCase();
                                        const yr = new Date().getFullYear();
                                        const existingUC = await prisma.control.findMany({
                                            where: { customerAccountId, controlCode: { startsWith: "UC-" } },
                                            select: { controlCode: true },
                                        });
                                        let maxS = 0;
                                        for (const c of existingUC) {
                                            const m = c.controlCode.match(/UC-[A-Z]{3}-(\d+)-\d{4}/);
                                            if (m) { const n = parseInt(m[1], 10); if (n > maxS) maxS = n; }
                                        }
                                        const controlCode = `UC-${abbr}-${String(maxS + 1).padStart(4, "0")}-${yr}`;
                                        controlRecord = await prisma.control.create({
                                            data: {
                                                customerAccountId,
                                                controlCode,
                                                name: control.ControlName,
                                                functionalGrouping: fg,
                                                status: "Non Compliant",
                                                description: "AI suggested control",
                                            },
                                            select: { id: true, name: true }
                                        });
                                        stats.controls.created++;
                                        console.log(`[Control] + Created NEW: ${controlCode} - ${controlRecord.name}`);
                                    }
                                }

                                // Link control to risk (if not already linked)
                                await prisma.controlRisk.create({
                                    data: {
                                        controlId: controlRecord.id,
                                        riskId: riskRecord.id,
                                    }
                                }).then(() => {
                                    stats.controls.linkedToRisks++;
                                    riskControlsCount++;
                                }).catch(() => {
                                    // Already linked - ignore
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
                    action: riskAction,
                    threatsCount: riskThreatsCount,
                    controlsCount: riskControlsCount,
                });
            } catch (err: unknown) {
                const processErr = err as { message?: string };
                console.error(`[Risk Register] Error processing risk:`, processErr.message);
                stats.risks.errors++;
            }
        }

        // Update job status if jobId was provided
        if (providedJobId) {
            await aiAuditService.updateJobStatus(jobId, 'COMPLETED', {
                stats,
                processedCount: processedRisks.length,
                registered: true,
            });
        }

        // Log the registration operation
        await aiAuditService.logOperation({
            jobId,
            endpoint: '/api/ai/risk-semantic-match/register',
            method: 'POST',
            requestBody: { processId, riskCount: matchedRisks.length },
            responseBody: { stats, processedCount: processedRisks.length },
            statusCode: 200,
            latencyMs: Date.now() - startTime,
            userId: session.id
        });

        // Comprehensive summary log
        const latencyMs = Date.now() - startTime;
        console.log(`
╔════════════════════════════════════════════════════════════════╗
║          RISK REGISTRATION - COMPLETE                           ║
╚════════════════════════════════════════════════════════════════╝
Job ID: ${jobId}
Process ID: ${processId || 'N/A'}
Processing Time: ${latencyMs}ms

📊 RISKS SUMMARY:
   Total Detected: ${stats.risks.total}
   ├─ Created (NEW): ${stats.risks.created}
   ├─ Matched (Existing): ${stats.risks.matched}
   ├─ Skipped (Duplicate): ${stats.risks.skipped}
   └─ Errors: ${stats.risks.errors}

⚠️  THREATS SUMMARY:
   Total Detected: ${stats.threats.detected}
   ├─ Created (NEW): ${stats.threats.created}
   ├─ Matched (Existing): ${stats.threats.matched}
   └─ Linked to Risks: ${stats.threats.linkedToRisks}

🔓 VULNERABILITIES SUMMARY:
   Total Detected: ${stats.vulnerabilities.detected}
   ├─ Created (NEW): ${stats.vulnerabilities.created}
   ├─ Matched (Existing): ${stats.vulnerabilities.matched}
   └─ Linked to Threats: ${stats.vulnerabilities.linkedToThreats}

🛡️  CONTROLS SUMMARY:
   Total Detected: ${stats.controls.detected}
   ├─ Created (NEW): ${stats.controls.created}
   ├─ Matched (Existing): ${stats.controls.matched}
   └─ Linked to Risks: ${stats.controls.linkedToRisks}

════════════════════════════════════════════════════════════════
`);

        return NextResponse.json({
            success: true,
            job_id: jobId,
            stats,
            risks: processedRisks,
            summary: {
                risksProcessed: stats.risks.total,
                newRisksCreated: stats.risks.created,
                threatsDetected: stats.threats.detected,
                newThreatsCreated: stats.threats.created,
                vulnerabilitiesDetected: stats.vulnerabilities.detected,
                newVulnerabilitiesCreated: stats.vulnerabilities.created,
                controlsDetected: stats.controls.detected,
                newControlsCreated: stats.controls.created,
            },
        });
    } catch (error: unknown) {
        const latency = Date.now() - startTime;
        const err = error as { message?: string; status?: number };
        console.error(`[Risk Register] Error:`, err);

        await aiAuditService.logOperation({
            jobId,
            endpoint: '/api/ai/risk-semantic-match/register',
            method: 'POST',
            error: err.message,
            statusCode: err.status || 500,
            latencyMs: latency,
            userId: session.id
        });

        return errorResponse("Something went wrong. Please try again.", err.status || 500);
    }
}

export const POST = withAuthOnly(handler);
