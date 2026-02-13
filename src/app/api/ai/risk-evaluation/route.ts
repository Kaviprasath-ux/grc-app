import { NextRequest, NextResponse } from "next/server";
import { withAuthOnly, AuthenticatedRequest, getTenantFilter } from "@/lib/api-auth";
import aiApiClient from "@/lib/ai-api-client";
import { aiAuditService } from "@/services/ai-audit-service";
import { prisma } from "@/lib/prisma";
import { AI_ENDPOINTS } from "@/lib/ai-endpoints";
import {
  missingFieldResponse,
  notFoundResponse,
  errorResponse,
} from "@/lib/ai-route-helpers";
import { getAIUserFriendlyError, formatAIErrorForToast } from "@/lib/ai-config";

/**
 * POST /api/ai/risk-evaluation
 *
 * ARCHITECTURE RULE: This endpoint should NOT persist risks directly.
 * Use persist=false (recommended) and call /api/ai/risk-semantic-match/register after semantic matching.
 * See: Implementation plan for Process AI Risk Flow Alignment
 *
 * Generates AI-powered risks for a Process.
 *
 * RunPod Endpoint: POST /api/generate_process_asset_risk_v2
 *
 * Options:
 * - persist: false (RECOMMENDED) - Generate risks only, return raw AI response for semantic matching
 * - persist: true (DEPRECATED) - Generate and store risks immediately (bypasses semantic matching)
 *
 * Follows Synchronous v2 contract.
 */
async function handler(
    req: NextRequest,
    _context: unknown,
    session: AuthenticatedRequest["user"]
) {
    const startTime = Date.now();
    let requestPayload: Record<string, unknown> = {};

    try {
        const body = await req.json();
        const { processId, regenerate = false, persist = false } = body;

        if (!processId) {
            return missingFieldResponse("processId");
        }

        // Deprecation warning for persist=true
        if (persist === true) {
            console.warn(`[DEPRECATED] persist=true in risk-evaluation for process ${processId}. Use persist=false and call /register endpoint after semantic matching.`);
        }

        // 1. Fetch Process Details from DB (use tenant filter with globalAccess for GRCAdmin cross-tenant access)
        const tenantFilter = getTenantFilter(session, { globalAccess: true });
        console.log("[Risk Evaluation] Session roles:", session.roles);
        console.log("[Risk Evaluation] Session customerAccountId:", session.customerAccountId);
        console.log("[Risk Evaluation] Tenant filter:", tenantFilter);
        console.log("[Risk Evaluation] Looking for processId:", processId);
        console.log("[Risk Evaluation] Persist mode:", persist, persist ? "(DEPRECATED)" : "(Recommended)");

        const process = await prisma.process.findFirst({
            where: { id: processId, ...tenantFilter },
            include: {
                department: true,
                impactedByRisks: { take: 1 }
            }
        });

        console.log("[Risk Evaluation] Process found:", process ? process.id : "NOT FOUND");

        if (!process) {
            return notFoundResponse("Process");
        }

        // Use the process's customerAccountId for data isolation
        const customerAccountId = process.customerAccountId;

        // 2. Duplicate Prevention / Persistence Recovery (only when persisting)
        // Skip AI call if risks already exist and regenerate is false
        if (persist && !regenerate && process.impactedByRisks.length > 0) {
            const existingRisks = await prisma.risk.findMany({
                where: { impactedProcessId: processId, customerAccountId },
                include: {
                    threats: { include: { threat: true } },
                    controlRisks: { include: { control: true } }
                }
            });
            return NextResponse.json({ risks: existingRisks, status: "success", source: "DB" });
        }

        // 3. Prepare AI Payload (Process Details only - backend requires meaningful values)
        requestPayload = {
            Process_Details: {
                Process_name: process.name,
                Process_description: process.description || "No description provided",
                Department: process.department?.name || "General"
            }
        };
        console.log("AI Request Payload:", JSON.stringify(requestPayload));

        // Pre-flight Log
        const operation = await aiAuditService.logOperation({
            endpoint: AI_ENDPOINTS.GENERATE_RISK,
            method: "POST",
            requestBody: requestPayload,
            userId: session.id,
        });

        // 4. Call AI Service (Synchronous)
        const response = await aiApiClient.post(AI_ENDPOINTS.GENERATE_RISK, requestPayload);
        console.log("[Risk Evaluation] AI Response:", response);
        const result = response.data as {
            risks?: Array<{
                Risk_name: string;
                Risk_description: string;
                Inherent_risk_rating?: string;
                Threats?: Array<{
                    threat_name: string;
                    controls?: Array<{
                        ControlName: string;
                        control_functionalGrouping?: string;
                    }>;
                }>;
            }>;
        };
        const latencyMs = Date.now() - startTime;

        // Post-flight Log
        if (operation) {
            await prisma.aIOperation.update({
                where: { id: operation.id },
                data: {
                    responseBody: JSON.stringify(result),
                    statusCode: 200,
                    latencyMs,
                }
            });
        }

        // 5. If persist=false, return raw AI response for semantic matching
        if (!persist) {
            // Transform AI response to format expected by semantic matching
            const generatedRisks = (result.risks || []).map(aiRisk => ({
                name: aiRisk.Risk_name,
                description: aiRisk.Risk_description,
                risk_rating: aiRisk.Inherent_risk_rating || "Medium",
                risk_sources: "AI-Generated (v2)",
                category: process.department?.name || "General",
                threats: aiRisk.Threats?.map(t => t.threat_name) || [],
                controls: aiRisk.Threats?.flatMap(t =>
                    t.controls?.map(c => c.ControlName) || []
                ) || [],
            }));

            console.log("[Risk Evaluation] Returning raw risks for semantic matching:", generatedRisks.length);

            return NextResponse.json({
                risks: generatedRisks,
                rawRisks: result.risks, // Include original format too
                processId,
                customerAccountId,
                status: "success",
                source: "AI",
                persist: false,
            });
        }

        // 6. Hierarchical Persistence (Transactional)
        const createdRisks = await prisma.$transaction(async (tx) => {
            // If regenerating, cleanup old AI risks
            if (regenerate) {
                await tx.risk.deleteMany({
                    where: { impactedProcessId: processId, customerAccountId }
                });
            }

            const risksToPersist = [];
            const risks = result.risks || [];
            
            // Get the starting number for risk IDs within the transaction
            let riskCounter = 1;
            const lastRisk = await tx.risk.findFirst({
                where: { customerAccountId },
                orderBy: { createdAt: "desc" },
                select: { riskId: true },
            });
            
            if (lastRisk) {
                const match = lastRisk.riskId.match(/RID(\d+)/);
                if (match) {
                    riskCounter = parseInt(match[1], 10) + 1;
                }
            }

            for (const aiRisk of risks) {
                const riskId = `RID${String(riskCounter).padStart(3, "0")}`;
                riskCounter++;

                const createdRisk = await tx.risk.create({
                    data: {
                        customerAccountId,
                        riskId,
                        name: aiRisk.Risk_name,
                        description: aiRisk.Risk_description,
                        riskRating: aiRisk.Inherent_risk_rating || "Medium",
                        status: "Open",
                        impactedProcessId: processId,
                        riskSources: "AI-Generated (v2)",
                        // Handle threats and controls
                        threats: {
                            create: aiRisk.Threats?.map((t: any) => ({
                                threat: {
                                    connectOrCreate: {
                                        where: {
                                            customerAccountId_name: {
                                                customerAccountId,
                                                name: t.threat_name
                                            }
                                        },
                                        create: {
                                            customerAccountId,
                                            name: t.threat_name,
                                            description: "AI identified threat"
                                        }
                                    }
                                }
                            }))
                        },
                        controlRisks: {
                            create: aiRisk.Threats?.flatMap((t: any) =>
                                t.controls?.map((c: any) => ({
                                    control: {
                                        create: {
                                            customerAccountId,
                                            controlCode: `CTL-AI-${Math.random().toString(36).substring(2, 7).toUpperCase()}`,
                                            name: c.ControlName,
                                            functionalGrouping: c.control_functionalGrouping || "protect",
                                            status: "Non Compliant",
                                            description: "AI suggested control"
                                        }
                                    }
                                })) || []
                            )
                        }
                    },
                    include: {
                        threats: { include: { threat: true } },
                        controlRisks: { include: { control: true } }
                    }
                });
                risksToPersist.push(createdRisk);
            }
            return risksToPersist;
        });

        return NextResponse.json({ risks: createdRisks, status: "success", source: "AI" });

    } catch (error: unknown) {
        const latencyMs = Date.now() - startTime;
        const err = error as {
            message?: string;
            status?: number;
            userError?: { title: string; description: string; suggestion?: string; retryable: boolean };
            userMessage?: string;
        };
        console.error("[Risk Evaluation] Error:", err);

        await aiAuditService.logOperation({
            endpoint: AI_ENDPOINTS.GENERATE_RISK,
            method: "POST",
            requestBody: requestPayload,
            error: err.message || "Failed to generate risk evaluation",
            statusCode: err.status || 500,
            latencyMs,
            userId: session.id
        });

        // Include user-friendly error in response
        const statusCode = err.status || 500;
        const userError = err.userError || getAIUserFriendlyError(statusCode, err.message);
        const userMessage = err.userMessage || formatAIErrorForToast(userError);

        return NextResponse.json(
            {
                error: err.message || "Failed to generate risk evaluation",
                userError,
                userMessage,
            },
            { status: statusCode }
        );
    }
}

export const POST = withAuthOnly(handler);
