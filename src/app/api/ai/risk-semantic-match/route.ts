import { NextRequest, NextResponse } from "next/server";
import { withAuthOnly, AuthenticatedRequest } from "@/lib/api-auth";
import aiApiClient from "@/lib/ai-api-client";
import { aiAuditService } from "@/services/ai-audit-service";
import { prisma } from "@/lib/prisma";
import { AI_ENDPOINTS } from "@/lib/ai-endpoints";
import {
  badRequestResponse,
  errorResponse,
} from "@/lib/ai-route-helpers";
import type { ExistingLibrary, GeneratedRiskData, GeneratedRisk, GeneratedThreat, GeneratedControl } from "@/types/ai-types";

export const dynamic = 'force-dynamic';

/**
 * POST /api/ai/risk-semantic-match
 *
 * Submit a semantic matching job to compare AI-generated risks with existing risks.
 * Uses RunPod API: POST /api/semanticMatch_process_asset_riskV2
 *
 * Request body:
 * - processId: string (optional) - Process to generate risks for
 * - generatedRisks: array - AI-generated risks to match (from risk-evaluation with persist=false)
 *
 * Response: { job_id, status: "queued" }
 */
async function handler(
    req: NextRequest,
    _context: unknown,
    session: AuthenticatedRequest['user']
) {
    const startTime = Date.now();

    try {
        const body = await req.json();
        const { processId, generatedRisks } = body;

        if (!generatedRisks || !Array.isArray(generatedRisks) || generatedRisks.length === 0) {
            return badRequestResponse("generatedRisks array is required");
        }

        const customerAccountId = session.customerAccountId;

        // Build existing_library with all entity types from the database
        // The API expects: { Control_Library, Threats_library, Vulnerabilities_library, Risk_Library }
        const [dbControls, dbThreats, dbVulnerabilities, dbRisks] = await Promise.all([
            prisma.control.findMany({
                where: customerAccountId ? { customerAccountId } : {},
                select: { name: true, controlCode: true },
                take: 1000,
            }),
            prisma.riskThreat.findMany({
                where: customerAccountId ? { customerAccountId } : {},
                select: { name: true, threatId: true },
                take: 1000,
            }),
            prisma.riskVulnerability.findMany({
                where: customerAccountId ? { customerAccountId } : {},
                select: { name: true, vulnId: true },
                take: 1000,
            }),
            prisma.risk.findMany({
                where: customerAccountId ? { customerAccountId } : {},
                select: { name: true, riskId: true },
                take: 1000,
            }),
        ]);

        // Format existing library according to API expectations
        const existingLibrary: ExistingLibrary = {
            Control_Library: dbControls.map(c => ({
                Control_Name: c.name,
                Control_Code: c.controlCode,
            })),
            Threats_library: dbThreats.map(t => ({
                Threats_name: t.name,
                Threats_code: t.threatId || "",
            })),
            Vulnerabilities_library: dbVulnerabilities.map(v => ({
                Vulnerabilities_name: v.name,
                Vulnerabilities_code: v.vulnId || "",
            })),
            Risk_Library: dbRisks.map(r => ({
                Risk_name: r.name,
                Risk_code: r.riskId,
            })),
        };

        // Format generated risks according to API expectations
        // The API expects: { risks: [{ Risk_name, Risk_description, Risk_category, Inherent_risk_rating, Threats: [...] }] }
        interface RawGeneratedRisk {
            Risk_name?: string;
            Risk_description?: string;
            Risk_category?: string;
            Inherent_risk_rating?: string;
            Threats?: Array<{ threat_name: string; controls?: Array<{ ControlName: string; control_functionalGrouping?: string }>; Vulnerabilities?: string[] }>;
            name?: string;
            description?: string;
            category?: string;
            risk_rating?: string;
            threats?: string[];
            controls?: string[];
        }

        // Build properly typed generated risks
        const formattedRisks: GeneratedRisk[] = generatedRisks.map((r: RawGeneratedRisk) => {
            // Build threats - either use existing Threats or construct from flat arrays
            let threats: GeneratedThreat[] = [];

            if (r.Threats && r.Threats.length > 0) {
                threats = r.Threats.map(t => ({
                    threat_name: t.threat_name,
                    controls: (t.controls || []).map(c => ({
                        ControlName: c.ControlName,
                        control_functionalGrouping: c.control_functionalGrouping || "protect",
                    })),
                    Vulnerabilities: t.Vulnerabilities || [],
                }));
            } else if (r.threats && r.threats.length > 0) {
                // Convert flat threat names to threat objects
                const controls: GeneratedControl[] = (r.controls || []).map(c => ({
                    ControlName: c,
                    control_functionalGrouping: "protect",
                }));
                threats = r.threats.map(t => ({
                    threat_name: t,
                    controls,
                    Vulnerabilities: [],
                }));
            }

            return {
                Risk_name: r.Risk_name || r.name || "Unnamed Risk",
                Risk_description: r.Risk_description || r.description || "",
                Risk_category: r.Risk_category || r.category || "General",
                Inherent_risk_rating: r.Inherent_risk_rating || r.risk_rating || "Medium",
                Threats: threats,
            };
        });

        const formattedGeneratedRisks: GeneratedRiskData = {
            risks: formattedRisks,
        };

        console.log("[Risk Semantic Match] Existing library counts:", {
            controls: existingLibrary.Control_Library.length,
            threats: existingLibrary.Threats_library.length,
            vulnerabilities: existingLibrary.Vulnerabilities_library.length,
            risks: existingLibrary.Risk_Library.length,
        });
        console.log("[Risk Semantic Match] Generated risks count:", formattedGeneratedRisks.risks.length);

        // Prepare form data for RunPod API
        const formData = new URLSearchParams();
        formData.append("existing_library", JSON.stringify(existingLibrary));
        formData.append("generated_risk", JSON.stringify(formattedGeneratedRisks));

        // Submit job to RunPod
        const response = await aiApiClient.post(AI_ENDPOINTS.SEMANTIC_MATCH, formData.toString(), {
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
        });

        const result = response.data as { job_id?: string; status?: string };
        const jobId = result.job_id;
        const latency = Date.now() - startTime;

        console.log(`[Risk Semantic Match] Job submitted: ${jobId} (${latency}ms)`);

        // Create job record in DB
        if (jobId) {
            await aiAuditService.createJob({
                providerJobId: jobId,
                type: 'RISK_SEMANTIC_MATCH',
                userId: session.id,
                metadata: {
                    processId,
                    generatedRisksCount: formattedGeneratedRisks.risks.length,
                    existingLibraryCounts: {
                        controls: existingLibrary.Control_Library.length,
                        threats: existingLibrary.Threats_library.length,
                        vulnerabilities: existingLibrary.Vulnerabilities_library.length,
                        risks: existingLibrary.Risk_Library.length,
                    },
                }
            });
        }

        // Log operation
        await aiAuditService.logOperation({
            jobId,
            endpoint: AI_ENDPOINTS.SEMANTIC_MATCH,
            method: 'POST',
            requestBody: { processId, generatedRisksCount: formattedGeneratedRisks.risks.length },
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
    } catch (error: unknown) {
        const latency = Date.now() - startTime;
        const err = error as { message?: string; status?: number };
        console.error(`[Risk Semantic Match] Error:`, err);

        await aiAuditService.logOperation({
            endpoint: AI_ENDPOINTS.SEMANTIC_MATCH,
            method: 'POST',
            error: err.message,
            statusCode: err.status || 500,
            latencyMs: latency,
            userId: session.id
        });

        return errorResponse("Failed to submit semantic matching job", err.status || 500, {
            details: err.message,
        });
    }
}

export const POST = withAuthOnly(handler);
