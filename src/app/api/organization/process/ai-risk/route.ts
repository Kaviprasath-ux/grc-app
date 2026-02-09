import { NextRequest, NextResponse } from "next/server";
import { proxyToExternalApi } from "@/lib/api-proxy";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { AI_ENDPOINTS } from "@/lib/ai-endpoints";

export const maxDuration = 60;

// POST: Trigger AI Risk Evaluation (Semantic Match)
export async function POST(req: NextRequest) {
    try {
        const session = await auth();
        if (!session || !session.user) {
            console.error("Auth failed: No session");
            return NextResponse.json({ error: "Unauthorized - No Local Session" }, { status: 401 });
        }

        let body;
        try {
            body = await req.json();
            console.log("DEBUG: Incoming POST body:", JSON.stringify(body, null, 2));
        } catch (e) {
            console.error("DEBUG: Failed to parse JSON body", e);
            return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
        }

        const { processId } = body;

        if (!processId || typeof processId !== 'string') {
            console.error("DEBUG: Invalid or missing processId:", processId);
            return NextResponse.json({ error: "Process ID is required and must be a string" }, { status: 400 });
        }

        // 1. Fetch Process Details from DB
        const processData = await prisma.process.findUnique({
            where: { id: processId },
            include: {
                department: true,
            },
        });

        console.log(`DEBUG: Fetched process ${processId}:`, processData ? "Found" : "Not Found");

        if (!processData) {
            return NextResponse.json({ error: "Process not found" }, { status: 404 });
        }

        // 2. Fetch Library Data for Semantic Matching
        const [controls, risks, threats, vulnerabilities] = await Promise.all([
            prisma.control.findMany({ select: { name: true, description: true, controlCode: true } }),
            prisma.risk.findMany({ select: { name: true, description: true, riskId: true } }),
            prisma.riskThreat.findMany({ select: { name: true, description: true } }),
            prisma.riskVulnerability.findMany({ select: { name: true, description: true } }),
        ]);

        // 3. Construct Payload ("Super Shotgun" / Verified Protocol)
        // Create the object structures first
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
                description: c.description || ""
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
                description: t.description || ""
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
                description: v.description || ""
            })),
            Risk_Library: risks
                .filter(r => r.description && r.description.trim() !== '')
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
                    description: r.description || ""
                }))
        };

        const generatedRiskObj = {
            Process_Details: {
                Process_Name: processData.name,
                Process_name: processData.name,
                process_name: processData.name,
                Process_Description: processData.description || "No description provided",
                Process_description: processData.description || "No description provided",
                process_description: processData.description || "No description provided",
                Department: processData.department?.name || "General",
                department: processData.department?.name || "General"
            },
            risks: []
        };

        // Construct the payload for Runpod - Explicitly Stringified strings for urlencoded form
        const runpodPayload = {
            existing_library: JSON.stringify(existingLibraryObj),
            generated_risk: JSON.stringify(generatedRiskObj)
        };

        console.log("DEBUG: Sending payload to Runpod:", JSON.stringify(runpodPayload, null, 2));

        // 4. Proxy to Runpod (Start Job)
        // Target: AI_ENDPOINTS.SEMANTIC_MATCH
        const response = await proxyToExternalApi({
            service: "PYTHON_BACKEND",
            path: AI_ENDPOINTS.SEMANTIC_MATCH,
            method: "POST",
            body: runpodPayload,
            contentType: "application/x-www-form-urlencoded",
        });

        if (!response.ok) {
            const errorBody = await response.clone().text();
            console.error(`DEBUG: Runpod/Proxy failed with status ${response.status}:`, errorBody);
        } else {
            console.log(`DEBUG: Runpod Success: ${response.status}`);
        }

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
        console.log("DEBUG: Result Payload:", JSON.stringify(resultData, null, 2));

        // Return combined status + result
        return NextResponse.json({ ...resultData, status: "completed" });

    } catch (error) {
        console.error("Error polling risk job:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
