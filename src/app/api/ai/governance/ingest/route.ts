import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { join } from "path";
import { auth } from "@/lib/auth";
import aiApiClient from "@/lib/ai-api-client";
import { aiAuditService } from "@/services/ai-audit-service";
import { prisma } from "@/lib/prisma";
import { AI_ENDPOINTS } from "@/lib/ai-endpoints";
import {
  unauthorizedResponse,
  badRequestResponse,
  notFoundResponse,
  errorResponse,
} from "@/lib/ai-route-helpers";
import { validateUploadedFile } from "@/lib/upload-validation";

/**
 * POST /api/ai/governance/ingest
 *
 * Ingests a policy document into RunPod /api/grc_ingest.
 * Aligned with 100% OpenAPI contract.
 *
 * Accepts either:
 * - FormData with 'policyId' and 'file'
 * - FormData with just 'policyId' (will read file from disk based on attachment)
 */
export async function POST(req: NextRequest) {
    const startTime = Date.now();
    let userId: string | undefined;

    try {
        const session = await auth();
        if (!session?.user) {
            return unauthorizedResponse();
        }
        userId = session.user.id;

        const formData = await req.formData();
        const policyId = formData.get("policyId") as string;
        let file = formData.get("file") as File | null;

        if (!policyId) {
            return badRequestResponse("policyId is required");
        }

        if (file) {
            const check = validateUploadedFile(file);
            if (!check.ok) {
                return badRequestResponse(check.reason || "Invalid file");
            }
        }

        // Fetch policy details with attachments and vault document links
        const policy = await prisma.policy.findUnique({
            where: { id: policyId },
            include: {
                attachments: {
                    orderBy: { createdAt: 'desc' },
                    take: 1,
                },
                vaultDocumentLinks: {
                    include: { document: true },
                    orderBy: { linkedAt: 'desc' },
                    take: 1,
                },
            },
        });

        if (!policy) {
            return notFoundResponse("Policy");
        }

        // If no file provided, read from disk using the latest attachment or vault document
        if (!file) {
            const latestAttachment = policy.attachments[0];
            const latestVaultLink = policy.vaultDocumentLinks[0];

            // Determine which document to use (attachment takes priority, then vault)
            const docSource = latestAttachment
                ? { fileName: latestAttachment.fileName, fileType: latestAttachment.fileType, filePath: latestAttachment.filePath }
                : latestVaultLink?.document
                    ? { fileName: latestVaultLink.document.fileName, fileType: latestVaultLink.document.fileType, filePath: latestVaultLink.document.filePath }
                    : null;

            if (!docSource) {
                return badRequestResponse("No document attached to this policy");
            }

            if (!docSource.filePath) {
                return errorResponse(`File path not found for: ${docSource.fileName}`, 404);
            }

            console.log(`[Governance Ingest] Reading file from disk: ${docSource.fileName}`);

            const relativePath = docSource.filePath.startsWith("/")
                ? docSource.filePath.slice(1)
                : docSource.filePath;
            const absolutePath = join(process.cwd(), relativePath);
            let fileBuffer: Buffer;
            try {
                fileBuffer = await readFile(absolutePath);
            } catch {
                return errorResponse(`File not found on disk: ${docSource.fileName}`, 404);
            }

            const mimeType = docSource.fileType === 'docx'
                ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
                : docSource.fileType === 'pdf'
                    ? 'application/pdf'
                    : 'application/octet-stream';

            file = new File([new Uint8Array(fileBuffer)], docSource.fileName, { type: mimeType });
            console.log(`[Governance Ingest] File loaded from disk: ${docSource.fileName} (${fileBuffer.length} bytes)`);
        }

        // Canonical OpenAPI Payload construction
        // Use documentType from policy record (Policy, Standard, Procedure)
        const docType = policy.documentType || "Policy";

        const runpodFormData = new FormData();
        runpodFormData.append("base_id", policy.customerAccountId); // Use customerAccountId for tenant isolation
        runpodFormData.append("doc_type", docType); // Use actual document type from policy record
        runpodFormData.append("file_code", policy.code || `POL-${policyId.substring(0, 8)}`);
        runpodFormData.append("document_id", policyId);
        runpodFormData.append("files", file); // OpenAPI expects 'files' array

        // Step 1: Log AIOperation (Request) using standard Atomic Audit pattern
        const operation = await aiAuditService.logOperation({
            endpoint: AI_ENDPOINTS.INGEST,
            method: "POST",
            requestBody: {
                base_id: policy.customerAccountId,
                doc_type: docType,
                file_code: policy.code,
                fileName: file.name
            },
            userId,
        });

        console.log(`[Governance Ingest] Ingesting ${docType} ${policy.code} (RunPod Contract Sync)`);

        // Step 2: Call RunPod via aiApiClient
        const response = await aiApiClient.post(AI_ENDPOINTS.INGEST, runpodFormData);

        // Backend may return job_id for async tracking or document_id for sync
        const responseData = response.data as { job_id?: string; document_id?: string };
        const jobId = responseData.job_id;
        const documentId = responseData.document_id;
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
                type: AI_ENDPOINTS.INGEST,
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

        // Step 6: Update Policy AI Ingest Status
        await prisma.policy.update({
            where: { id: policyId },
            data: {
                aiIngestStatus: jobId ? 'QUEUED' : 'INGESTED',
                aiIngestJobId: jobId || null,
                aiIngestedAt: jobId ? null : new Date(),
            },
        });

        return NextResponse.json({
            job_id: jobId,
            document_id: documentId || policyId,
            status: jobId ? "queued" : "completed"
        });

    } catch (error: unknown) {
        const latencyMs = Date.now() - startTime;
        const err = error as { message?: string; status?: number };
        console.error("[Governance Ingest] Error:", err);

        // Standardized Audit Error Logging
        await aiAuditService.logOperation({
            endpoint: AI_ENDPOINTS.INGEST,
            method: "POST",
            error: err.message || "Unknown error during ingestion",
            statusCode: err.status || 500,
            latencyMs,
            userId,
        });

        return errorResponse("Unable to process document. Please try again.", err.status || 500);
    }
}
