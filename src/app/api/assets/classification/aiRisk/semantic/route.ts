import { NextRequest, NextResponse } from "next/server";
import { proxyToExternalApi } from "@/lib/api-proxy";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";

export const maxDuration = 60;

/**
 * POST: Start semantic match job for "Add to Risk Register".
 * Builds existing_library (asset only, no Process_Details) from customer data
 * and generated_risk from the risks the user kept on UI.
 */
export async function POST(req: NextRequest) {
    try {
        const session = await auth();
        if (!session || !session.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        let body: { classificationId?: string; generatedRisks?: any[] };
        try {
            body = await req.json();
        } catch {
            return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
        }

        console.log("[Semantic] API called: POST /api/assets/classification/aiRisk/semantic");
        console.log("[Semantic] Payload (incoming):", JSON.stringify({ classificationId: body.classificationId, generatedRisksCount: Array.isArray(body.generatedRisks) ? body.generatedRisks.length : 0 }, null, 2));

        const { classificationId, generatedRisks } = body;

        if (!classificationId || typeof classificationId !== "string") {
            return NextResponse.json({ error: "classificationId is required" }, { status: 400 });
        }

        const risksToSend = Array.isArray(generatedRisks) ? generatedRisks : [];
        if (risksToSend.length === 0) {
            return NextResponse.json({ error: "At least one risk is required to add to the register" }, { status: 400 });
        }

        const classificationData = await prisma.assetCIAClassification.findUnique({
            where: { id: classificationId },
            include: { group: true },
        });

        if (!classificationData?.group) {
            return NextResponse.json({ error: "Asset classification not found" }, { status: 404 });
        }

        const assetGroupName = classificationData.group.name ?? "";

        const [controls, risks, threats, vulnerabilities] = await Promise.all([
            prisma.control.findMany({ select: { name: true, controlCode: true } }),
            prisma.risk.findMany({ select: { name: true, riskId: true } }),
            prisma.riskThreat.findMany({ select: { name: true, threatId: true } }),
            prisma.riskVulnerability.findMany({ select: { name: true, vulnId: true } }),
        ]);

        const existing_library = {
            Assets_Details: {
                Asset_group_name: assetGroupName,
            },
            Control_Library: controls.map((c, i) => ({
                Control_Name: c.name,
                Control_Code: c.controlCode || `CTRL-${i + 1}`,
            })),
            Threats_library: threats.map((t, i) => ({
                Threats_name: t.name,
                Threats_code: t.threatId || `THR-${i + 1}`,
            })),
            Vulnerabilities_library: vulnerabilities.map((v, i) => ({
                Vulnerabilities_name: v.name,
                Vulnerabilities_code: v.vulnId || `VUL-${i + 1}`,
            })),
            Risk_Library: risks.map((r, i) => ({
                Risk_name: r.name,
                Risk_code: r.riskId || `RSK-${i + 1}`,
            })),
        };

        const generated_risk = { risks: risksToSend };

        const payload = {
            existing_library: JSON.stringify(existing_library),
            generated_risk: JSON.stringify(generated_risk),
        };

        console.log("[Semantic] External API: POST /api/semanticMatch_process_asset_riskV2");
        console.log("[Semantic] Payload (existing_library):", JSON.stringify(existing_library, null, 2));
        console.log("[Semantic] Payload (generated_risk):", JSON.stringify(generated_risk, null, 2));

        const response = await proxyToExternalApi({
            service: "PYTHON_BACKEND",
            path: "/api/semanticMatch_process_asset_riskV2",
            method: "POST",
            body: payload,
            contentType: "application/x-www-form-urlencoded",
        });

        if (!response.ok) {
            const errText = await response.clone().text();
            console.error("[Semantic] Result (error):", response.status, errText);
            return response;
        }

        const data = await response.json();
        console.log("[Semantic] Result:", data);

        const jobId = data.job_id ?? data.jobId ?? data.id;
        if (!jobId) {
            console.error("[Semantic] No job_id in response:", data);
            return NextResponse.json({ error: "Semantic API did not return a job ID" }, { status: 502 });
        }

        return NextResponse.json({ job_id: jobId, jobId });
    } catch (error) {
        console.error("Error starting semantic match:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
