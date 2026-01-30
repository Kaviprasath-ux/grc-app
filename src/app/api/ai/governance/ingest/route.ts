import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import aiApiClient from "@/lib/ai-api-client";
import { aiAuditService } from "@/services/ai-audit-service";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/ai/governance/ingest
 * 
 * Ingests a policy document into RunPod /api/grc_ingest.
 * Aligned with 100% OpenAPI contract.
 */
export async function POST(req: NextRequest) {
    const startTime = Date.now();
    let userId: string | undefined;

    try {
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        userId = session.user.id;

        const formData = await req.formData();
        const policyId = formData.get("policyId") as string;
        const file = formData.get("file") as File;

        if (!policyId || !file) {
            return NextResponse.json({ error: "policyId and file are required" }, { status: 400 });
        }

        // Fetch policy details for file_code
        const policy = await prisma.policy.findUnique({
            where: { id: policyId }
        });

        if (!policy) {
            return NextResponse.json({ error: "Policy not found" }, { status: 404 });
        }

        // Canonical OpenAPI Payload construction
        const runpodFormData = new FormData();
        runpodFormData.append("base_id", policyId);
        runpodFormData.append("doc_type", "policy");
        runpodFormData.append("file_code", policy.code || `POL-${policyId.substring(0, 8)}`);
        runpodFormData.append("document_id", policyId);
        runpodFormData.append("files", file); // OpenAPI expects 'files' array

        // Step 1: Log AIOperation (Request) using standard Atomic Audit pattern
        const operation = await aiAuditService.logOperation({
            endpoint: "/api/grc_ingest",
            method: "POST",
            requestBody: {
                base_id: policyId,
                doc_type: "policy",
                file_code: policy.code,
                fileName: file.name
            },
            userId,
        });

        console.log(`[Governance Ingest] Ingesting policy ${policy.code} (RunPod Contract Sync)`);

        // Step 2: Call RunPod via aiApiClient
        const response = await aiApiClient.post("/api/grc_ingest", runpodFormData, {
            headers: {
                "Content-Type": "multipart/form-data",
            },
        });

        // Backend may return job_id for async tracking or document_id for sync
        const jobId = response.data.job_id;
        const documentId = response.data.document_id;
        const latencyMs = Date.now() - startTime;

        // Step 3: Log AIOperation (Success Response Update)
        if (operation) {
            await prisma.aIOperation.update({
                where: { id: operation.id },
                data: {
                    responseBody: JSON.stringify(response.data),
                    statusCode: 200,
                    latencyMs,
                }
            });
        }

        // Step 4: Create AIJob for async tracking (if job_id returned)
        if (jobId) {
            await aiAuditService.createJob({
                providerJobId: jobId,
                type: "/api/grc_ingest",
                userId,
                metadata: { policyId, documentId },
            });
        }

        // Step 5: Persist to PolicyAIReview (Domain Persistence)
        await prisma.policyAIReview.create({
            data: {
                policyId,
                documentId: documentId || jobId || policyId, // Use returned doc ID, job ID, or fallback
                status: jobId ? "processing" : "ingested",
                aiOperationId: operation?.id,
            }
        });

        return NextResponse.json({
            job_id: jobId,
            document_id: documentId || policyId,
            status: jobId ? "queued" : "completed"
        });

    } catch (error: any) {
        const latencyMs = Date.now() - startTime;
        console.error("[Governance Ingest] Error:", error);

        // Standardized Audit Error Logging
        await aiAuditService.logOperation({
            endpoint: "/api/grc_ingest",
            method: "POST",
            error: error.message || "Unknown error during ingestion",
            statusCode: error.status || 500,
            latencyMs,
            userId,
        });

        return NextResponse.json(
            { error: error.message || "Failed to ingest policy" },
            { status: error.status || 500 }
        );
    }
}
