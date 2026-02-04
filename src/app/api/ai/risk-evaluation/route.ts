import { NextRequest, NextResponse } from "next/server";
import { withAuthOnly, AuthenticatedRequest, getCustomerAccountId } from "@/lib/api-auth";
import aiApiClient from "@/lib/ai-api-client";
import { aiAuditService } from "@/services/ai-audit-service";
import { prisma } from "@/lib/prisma";

// Helper function to generate risk ID (format: RID001, RID002, etc.)
async function generateRiskId(customerAccountId: string): Promise<string> {
    const lastRisk = await prisma.risk.findFirst({
        where: { customerAccountId },
        orderBy: { createdAt: "desc" },
        select: { riskId: true },
    });

    if (!lastRisk) return "RID001";

    const match = lastRisk.riskId.match(/RID(\d+)/);
    if (match) {
        const nextNum = parseInt(match[1], 10) + 1;
        return `RID${String(nextNum).padStart(3, "0")}`;
    }

    const count = await prisma.risk.count({ where: { customerAccountId } });
    return `RID${String(count + 1).padStart(3, "0")}`;
}

/**
 * POST /api/ai/risk-evaluation
 * 
 * Generates and PERSISTS AI-powered risks for a Process.
 * Follows Synchronous v2 contract.
 */
async function handler(
    req: NextRequest,
    _context: any,
    session: AuthenticatedRequest["user"]
) {
    const startTime = Date.now();
    const endpoint = "/api/generate_process_asset_risk_v2";
    const customerAccountId = getCustomerAccountId(session);
    let requestPayload: any = {};

    try {
        const body = await req.json();
        const { processId, regenerate = false } = body;

        if (!processId) {
            return NextResponse.json({ error: "processId is required" }, { status: 400 });
        }

        // 1. Fetch Process Details from DB
        const process = await prisma.process.findUnique({
            where: { id: processId, customerAccountId },
            include: {
                department: true,
                impactedByRisks: { take: 1 }
            }
        });

        if (!process) {
            return NextResponse.json({ error: "Process not found" }, { status: 404 });
        }

        // 2. Duplicate Prevention / Persistence Recovery
        // Skip AI call if risks already exist and regenerate is false
        if (!regenerate && process.impactedByRisks.length > 0) {
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
                Process_description: process.description || `Process: ${process.name}`,
                Department: process.department?.name || "General"
            }
        };
        console.log("AI Request Payload:", JSON.stringify(requestPayload));

        // Pre-flight Log
        const operation = await aiAuditService.logOperation({
            endpoint,
            method: "POST",
            requestBody: requestPayload,
            userId: session.id,
        });

        // 4. Call AI Service (Synchronous)
        const response = await aiApiClient.post(endpoint, requestPayload);
        console.log(response)
        const result = response.data;
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

        // 5. Hierarchical Persistence (Transactional)
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

    } catch (error: any) {
        const latencyMs = Date.now() - startTime;
        console.error("Error in risk evaluation API:", error);

        await aiAuditService.logOperation({
            endpoint,
            method: "POST",
            requestBody: requestPayload,
            error: error.message || "Failed to generate risk evaluation",
            statusCode: error.status || 500,
            latencyMs,
            userId: session.id
        });

        return NextResponse.json(
            { error: error.message || "Failed to generate risk evaluation" },
            { status: error.status || 500 }
        );
    }
}

export const POST = withAuthOnly(handler);
