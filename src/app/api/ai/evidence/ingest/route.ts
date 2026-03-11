import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth, validateTenantAccess, forbidden } from "@/lib/api-auth";
import aiApiClient from "@/lib/ai-api-client";
import { AI_ENDPOINTS } from "@/lib/ai-endpoints";
import {
  missingFieldResponse,
  notFoundResponse,
  badRequestResponse,
  errorResponse,
  updateEvidenceAIStatus,
} from "@/lib/ai-route-helpers";
import fs from "fs";
import path from "path";

interface RequestBody {
  evidenceId: string;
  attachmentId?: string;
}

/**
 * POST /api/ai/evidence/ingest
 * Triggers AI ingest for an evidence's attachments
 * Sends files to RunPod /api/grc_ingest
 */
export const POST = withAuth(
  async (req: NextRequest, _context, session) => {
    try {
      const body: RequestBody = await req.json();
      const { evidenceId, attachmentId } = body;

      if (!evidenceId) {
        return missingFieldResponse("evidenceId");
      }

      // Verify evidence exists and user has access
      const evidence = await prisma.evidence.findUnique({
        where: { id: evidenceId },
        select: {
          id: true,
          evidenceCode: true,
          frameworkId: true,
          customerAccountId: true,
          attachments: attachmentId
            ? { where: { id: attachmentId } }
            : { take: 10, orderBy: { uploadedAt: "desc" } },
          linkedArtifacts: {
            include: {
              artifact: true,
            },
          },
        },
      });

      if (!evidence) {
        return notFoundResponse("Evidence");
      }

      if (!validateTenantAccess(session, evidence.customerAccountId)) {
        return forbidden("Access denied to this evidence");
      }

      const hasAttachments = evidence.attachments && evidence.attachments.length > 0;
      const hasLinkedArtifacts = evidence.linkedArtifacts && evidence.linkedArtifacts.length > 0;

      if (!hasAttachments && !hasLinkedArtifacts) {
        return badRequestResponse("No attachments or linked artifacts found for this evidence");
      }

      // Prepare multipart form data for RunPod
      const formData = new FormData();
      formData.append("base_id",  evidence.customerAccountId);
      formData.append("file_code", evidence.evidenceCode);
      formData.append("document_id", evidence.id);
      formData.append("doc_type", "evidence"); // Consistent doc_type for all evidence documents

      // Attach files and track file names for delete
      const ingestedFileNames: string[] = [];
      const processedFilePaths = new Set<string>();
      const missingFiles: string[] = [];

      console.log(`[Evidence Ingest] Attachments: ${evidence.attachments.length}, Linked artifacts: ${evidence.linkedArtifacts.length}`);
      console.log(`[Evidence Ingest] CWD: ${process.cwd()}`);

      // Include direct attachments
      for (const attachment of evidence.attachments) {
        if (!attachment.filePath) {
          console.log(`[AI] Attachment ${attachment.fileName || attachment.id} has no filePath`);
          continue;
        }

        // Handle leading slash in filePath
        const relativePath = attachment.filePath.startsWith("/")
          ? attachment.filePath.slice(1)
          : attachment.filePath;
        const filePath = path.join(process.cwd(), relativePath);

        if (!fs.existsSync(filePath)) {
          console.log(`[AI] Attachment file not found on disk: ${filePath}`);
          missingFiles.push(`${attachment.fileName} (${filePath})`);
          continue;
        }

        const fileBuffer = fs.readFileSync(filePath);
        const blob = new Blob([fileBuffer], { type: attachment.fileType || "application/octet-stream" });
        const file = new File([blob], attachment.fileName, { type: attachment.fileType || "application/octet-stream" });

        formData.append("files", file);
        ingestedFileNames.push(attachment.fileName);
        processedFilePaths.add(attachment.filePath);
      }

      // Include linked artifacts (skip if same file was already added via attachments)
      for (const la of evidence.linkedArtifacts) {
        const artifact = la.artifact;
        if (!artifact || !artifact.filePath) {
          console.log(`[AI] Linked artifact has no filePath`);
          continue;
        }
        if (processedFilePaths.has(artifact.filePath)) continue;

        // Handle leading slash in filePath
        const relativePath = artifact.filePath.startsWith("/")
          ? artifact.filePath.slice(1)
          : artifact.filePath;
        const filePath = path.join(process.cwd(), relativePath);

        if (!fs.existsSync(filePath)) {
          console.log(`[AI] Linked artifact file not found on disk: ${filePath}`);
          missingFiles.push(`${artifact.fileName} (${filePath})`);
          continue;
        }

        const fileBuffer = fs.readFileSync(filePath);
        const blob = new Blob([fileBuffer], { type: artifact.fileType || "application/octet-stream" });
        const file = new File([blob], artifact.fileName, { type: artifact.fileType || "application/octet-stream" });

        formData.append("files", file);
        ingestedFileNames.push(artifact.fileName);
        processedFilePaths.add(artifact.filePath);
      }

      // Ensure at least one file was successfully loaded
      if (ingestedFileNames.length === 0) {
        console.error(`[Evidence Ingest] All files missing from disk:`, missingFiles);
        return badRequestResponse(
          `No files could be loaded. ${missingFiles.length} file(s) not found on disk: ${missingFiles.map(f => f.split(' (')[0]).join(', ')}`
        );
      }

      console.log("[Evidence Ingest] Submitting to AI service, files:", ingestedFileNames);

      // Call RunPod ingest endpoint via standardized aiApiClient
      const response = await aiApiClient.post(AI_ENDPOINTS.INGEST, formData);
      console.log("[Evidence Ingest] RunPod Response:", response);

      // Response: { "job_id": "...", "status": "queued", "document_id"?: "..." }
      const runpodData = response.data as { job_id?: string; status?: string; document_id?: string };
      const jobId = runpodData.job_id;
      const status = runpodData.status?.toLowerCase() || "queued";
      const returnedDocumentId = runpodData.document_id || null;

      if (!jobId) {
        return errorResponse("No job_id returned from AI service", 502);
      }

      // Create ingest job record with document ID and file name tracking
      const ingestJob = await prisma.evidenceAIIngestJob.create({
        data: {
          evidenceId: evidence.id,
          attachmentId: attachmentId || null,
          runpodJobId: jobId,
          sentDocumentId: evidence.id,        // Track what we sent as document_id
          returnedDocumentId: returnedDocumentId,  // Track what RunPod returned
          ingestedFileName: ingestedFileNames[0] || null, // Track actual file name for delete
          status: status,
        },
      });

      // Update evidence AI status using helper
      await updateEvidenceAIStatus(evidence.id, { ingestStatus: status });

      return NextResponse.json({
        job_id: jobId,
        status: status,
      });
    } catch (error: unknown) {
      const err = error as { message?: string; rawResponse?: string; requestId?: string; status?: number; data?: unknown };
      console.error("[Evidence Ingest] Error:", err);
      return errorResponse("Unable to process evidence. Please try again.", err.status || 500);
    }
  },
  { resource: "compliance.evidence", action: "edit" }
);
