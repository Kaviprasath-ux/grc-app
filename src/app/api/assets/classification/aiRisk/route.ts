import { NextRequest, NextResponse } from "next/server";
import { proxyToExternalApi } from "@/lib/api-proxy";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { AI_ENDPOINTS } from "@/lib/ai-endpoints";

export const maxDuration = 60;

/** Set to true to use semantic match API (async job + polling). Currently inactive - use Generate Risks V2. */
const USE_SEMANTIC_MATCH = false;

// POST: Trigger AI Risk Evaluation — uses Generate Risks V2 (sync) or Semantic Match (async, inactive)
export async function POST(req: NextRequest) {
    try {
        const session = await auth();
        if (!session || !session.user) {
            console.error("Auth failed: No session");
            return NextResponse.json({ error: "Unauthorized - No Local Session" }, { status: 401 });
        }

        console.log("[AI Risk] API called: POST /api/assets/classification/aiRisk");

        let body: { classificationId?: string };
        try {
            body = await req.json();
            console.log("[AI Risk] Payload (incoming):", JSON.stringify(body, null, 2));
        } catch (e) {
            console.error("[AI Risk] Failed to parse JSON body", e);
            return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
        }

        const { classificationId } = body;

        if (!classificationId || typeof classificationId !== "string") {
            console.error("[AI Risk] Invalid or missing classificationId:", classificationId);
            return NextResponse.json({ error: "Classification ID is required and must be a string" }, { status: 400 });
        }

        const classificationData = await prisma.assetCIAClassification.findUnique({
            where: { id: classificationId },
            include: {
                subCategory: { include: { category: true } },
                group: true,
            },
        });

        if (!classificationData) {
            return NextResponse.json({ error: "Asset classification not found" }, { status: 404 });
        }

        const assetGroupName = classificationData.group?.name ?? "";

        // --- Generate Risks V2: synchronous, payload only Assets_Details ---
        if (!USE_SEMANTIC_MATCH) {
            const payload = {
                Assets_Details: {
                    Asset_group_name: assetGroupName,
                },
            };

            console.log("[AI Risk] API called: POST /api/generate_process_asset_risk_v2");
            console.log("[AI Risk] Payload:", JSON.stringify(payload, null, 2));

            const response = await proxyToExternalApi({
                service: "PYTHON_BACKEND",
                path: AI_ENDPOINTS.GENERATE_RISK,
                method: "POST",
                body: payload,
                contentType: "application/json",
            });

        if (!response.ok) {
            const errorBody = await response.clone().text();
            console.error("[AI Risk] External API result (error):", response.status, errorBody);
            return response;
        }

            const data = await response.json();
            console.log("[AI Risk] Result:", JSON.stringify(data, null, 2));

            // Normalize for frontend: expect results.risks or top-level risks
            const risks = data.results?.risks ?? data.risks ?? (Array.isArray(data) ? data : []);
            return NextResponse.json({
                status: "completed",
                results: { risks },
                ...data,
            });
        }

        // --- Semantic Match (inactive): async job + polling; re-enable by setting USE_SEMANTIC_MATCH = true ---
        const [controls, risks, threats, vulnerabilities] = await Promise.all([
            prisma.control.findMany({ select: { name: true, description: true, controlCode: true } }),
            prisma.risk.findMany({ select: { name: true, description: true, riskId: true } }),
            prisma.riskThreat.findMany({ select: { name: true, description: true } }),
            prisma.riskVulnerability.findMany({ select: { name: true, description: true } }),
        ]);

        const existingLibraryObj = {
            Control_Library: controls.map((c, i) => ({
                Control_Name: c.name,
                Control_name: c.name,
                control_name: c.name,
                Control_Code: c.controlCode || `CTRL-${i + 1}`,
                Control_code: c.controlCode || `CTRL-${i + 1}`,
                control_code: c.controlCode || `CTRL-${i + 1}`,
                Control_Description: c.description || "",
                Control_description: c.description || "",
                control_description: c.description || "",
                description: c.description || "",
            })),
            Threats_library: threats.map((t, i) => ({
                Threats_name: t.name,
                Threats_Name: t.name,
                threats_name: t.name,
                Threats_code: `THR-${i + 1}`,
                Threats_Code: `THR-${i + 1}`,
                threats_code: `THR-${i + 1}`,
                Threats_Description: t.description || "",
                Threats_description: t.description || "",
                threats_description: t.description || "",
                description: t.description || "",
            })),
            Vulnerabilities_library: vulnerabilities.map((v, i) => ({
                Vulnerabilities_name: v.name,
                Vulnerabilities_Name: v.name,
                vulnerabilities_name: v.name,
                Vulnerabilities_code: `VUL-${i + 1}`,
                Vulnerabilities_Code: `VUL-${i + 1}`,
                vulnerabilities_code: `VUL-${i + 1}`,
                Vulnerabilities_Description: v.description || "",
                Vulnerabilities_description: v.description || "",
                vulnerabilities_description: v.description || "",
                description: v.description || "",
            })),
            Risk_Library: risks
                .filter((r) => r.description && r.description.trim() !== "")
                .map((r, i) => ({
                    Risk_name: r.name,
                    Risk_Name: r.name,
                    risk_name: r.name,
                    Risk_code: r.riskId || `RSK-${i + 1}`,
                    Risk_Code: r.riskId || `RSK-${i + 1}`,
                    risk_code: r.riskId || `RSK-${i + 1}`,
                    Risk_Description: r.description || "",
                    Risk_description: r.description || "",
                    risk_description: r.description || "",
                    description: r.description || "",
                })),
        };

        const assetDescription =
            `Asset Classification: ${classificationData.subCategory.name} - ${classificationData.group.name}. ` +
            `Confidentiality: ${classificationData.confidentiality} (${classificationData.confidentialityScore}), ` +
            `Integrity: ${classificationData.integrity} (${classificationData.integrityScore}), ` +
            `Availability: ${classificationData.availability} (${classificationData.availabilityScore}), ` +
            `Criticality: ${classificationData.assetCriticality} (${classificationData.assetCriticalityScore})`;

        const generatedRiskObj = {
            Asset_Details: {
                Asset_SubCategory: classificationData.subCategory.name,
                Asset_SubCategory_name: classificationData.subCategory.name,
                asset_subcategory_name: classificationData.subCategory.name,
                Asset_Category: classificationData.subCategory.category?.name || "General",
                Asset_category: classificationData.subCategory.category?.name || "General",
                asset_category: classificationData.subCategory.category?.name || "General",
                Asset_Group: classificationData.group.name,
                Asset_Group_name: classificationData.group.name,
                asset_group_name: classificationData.group.name,
                Asset_Group_Description: classificationData.group.description || "",
                Asset_group_description: classificationData.group.description || "",
                asset_group_description: classificationData.group.description || "",
                Confidentiality: classificationData.confidentiality,
                confidentiality: classificationData.confidentiality,
                Confidentiality_Score: classificationData.confidentialityScore,
                confidentiality_score: classificationData.confidentialityScore,
                Integrity: classificationData.integrity,
                integrity: classificationData.integrity,
                Integrity_Score: classificationData.integrityScore,
                integrity_score: classificationData.integrityScore,
                Availability: classificationData.availability,
                availability: classificationData.availability,
                Availability_Score: classificationData.availabilityScore,
                availability_score: classificationData.availabilityScore,
                Asset_Criticality: classificationData.assetCriticality,
                asset_criticality: classificationData.assetCriticality,
                Asset_Criticality_Score: classificationData.assetCriticalityScore,
                asset_criticality_score: classificationData.assetCriticalityScore,
                Asset_Sensitivity: "",
                asset_sensitivity: "",
                Asset_Description: assetDescription,
                asset_description: assetDescription,
            },
            risks: [],
        };

        const runpodPayload = {
            existing_library: JSON.stringify(existingLibraryObj),
            generated_risk: JSON.stringify(generatedRiskObj),
        };

        const response = await proxyToExternalApi({
            service: "PYTHON_BACKEND",
            path: AI_ENDPOINTS.SEMANTIC_MATCH,
            method: "POST",
            body: runpodPayload,
            contentType: "application/x-www-form-urlencoded",
        });

        return response;
    } catch (error) {
        console.error("Error starting AI Risk Evaluation:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

// GET: Poll Job Status and Result
export async function GET(req: NextRequest) {
    try {
        const session = await auth();
        if (!session || !session.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { searchParams } = new URL(req.url);
        const jobId = searchParams.get("jobId");

        if (!jobId) {
            return NextResponse.json({ error: "Job ID is required" }, { status: 400 });
        }

        console.log("[AI Risk] API called: GET /api/assets/classification/aiRisk (poll)", { jobId });

        // 1. Check Status
        // Target: /api/semanticMatch_process_asset_riskV2_status/{job_id}
        const statusResponse = await proxyToExternalApi({
            service: "PYTHON_BACKEND",
            path: `/api/semanticMatch_process_asset_riskV2_status/${jobId}`,
            method: "GET",
        });

        if (!statusResponse.ok) {
            const err = await statusResponse.text();
            console.error("Status Check Failed:", err);
            return NextResponse.json({ error: "Failed to check job status" }, { status: statusResponse.status });
        }

        const statusData = await statusResponse.json();
        console.log("[AI Risk] Status result:", JSON.stringify(statusData, null, 2));

        // If not completed, return status
        if (statusData.status !== "completed") {
            return NextResponse.json(statusData);
        }

        // 2. Fetch Result if Completed
        // Target: /api/semanticMatch_process_asset_riskV2_result/{job_id}
        const resultResponse = await proxyToExternalApi({
            service: "PYTHON_BACKEND",
            path: `/api/semanticMatch_process_asset_riskV2_result/${jobId}`,
            method: "GET",
        });

        if (!resultResponse.ok) {
            return NextResponse.json({ error: "Failed to fetch job result" }, { status: resultResponse.status });
        }

        const resultData = await resultResponse.json();
        console.log("[AI Risk] Result payload:", JSON.stringify(resultData, null, 2));

        // Return combined status + result
        return NextResponse.json({ ...resultData, status: "completed" });

    } catch (error) {
        console.error("Error polling risk job:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
