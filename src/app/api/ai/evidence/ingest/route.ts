import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth, validateTenantAccess, forbidden } from "@/lib/api-auth";
import { AI_CONFIG, getAIMultipartHeaders } from "@/lib/ai-config";
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
        return NextResponse.json(
          { error: "evidenceId is required" },
          { status: 400 }
        );
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
        },
      
      });

      if (!evidence) {
        return NextResponse.json(
          { error: "Evidence not found" },
          { status: 404 }
        );
      }

      if (!validateTenantAccess(session, evidence.customerAccountId)) {
        return forbidden("Access denied to this evidence");
      }

      if (!evidence.attachments || evidence.attachments.length === 0) {
        return NextResponse.json(
          { error: "No attachments found for this evidence" },
          { status: 400 }
        );
      }

      // Prepare multipart form data for RunPod
      const formData = new FormData();
      formData.append("base_id", evidence.frameworkId || evidence.customerAccountId);
      formData.append("file_code", evidence.evidenceCode);
      formData.append("document_id", evidence.id);

      // Attach files and determine doc_type from first file extension
      let docType = "pdf"; // default
      for (const attachment of evidence.attachments) {
        const filePath = path.join(process.cwd(), attachment.filePath);

        // Check if file exists
        if (!fs.existsSync(filePath)) {
          console.log(`[AI] File not found: ${filePath}`);
          continue;
        }

        // Get file extension for doc_type
        const ext = attachment.fileName.split('.').pop()?.toLowerCase() || "pdf";
        docType = ext;

        const fileBuffer = fs.readFileSync(filePath);
        const blob = new Blob([fileBuffer], { type: attachment.fileType || "application/octet-stream" });
        const file = new File([blob], attachment.fileName, { type: attachment.fileType || "application/octet-stream" });

        formData.append("files", file);
      }
      formData.append("doc_type", docType);

      // Call RunPod ingest endpoint
      const runpodUrl = `${AI_CONFIG.baseUrl}${AI_CONFIG.endpoints.ingest}`;
      console.log(`[AI] POST ${AI_CONFIG.endpoints.ingest} → calling ${runpodUrl}`);

      const runpodResponse = await fetch(runpodUrl, {
        method: "POST",
        headers: getAIMultipartHeaders(),
        body: formData,
      });

      const responseStatus = runpodResponse.status;
      console.log(`[AI] POST ${AI_CONFIG.endpoints.ingest} → ${responseStatus}`);

      if (!runpodResponse.ok) {
        const errorText = await runpodResponse.text();
        console.log(`[AI] POST ${AI_CONFIG.endpoints.ingest} → ${responseStatus} (error: ${errorText})`);
        return NextResponse.json(
          { error: "AI ingest failed", details: errorText },
          { status: 502 }
        );
      }

      // Response: { "job_id": "...", "status": "queued" }
      const runpodData = await runpodResponse.json();
      const jobId = runpodData.job_id;
      const status = runpodData.status?.toLowerCase() || "queued";

      console.log(`[AI] POST ${AI_CONFIG.endpoints.ingest} → 200`, JSON.stringify(runpodData));

      if (!jobId) {
        return NextResponse.json(
          { error: "No job_id returned from AI service" },
          { status: 502 }
        );
      }

      // Create ingest job record
      const ingestJob = await prisma.evidenceAIIngestJob.create({
        data: {
          evidenceId: evidence.id,
          attachmentId: attachmentId || null,
          runpodJobId: jobId,
          status: status,
        },
      });

      // Update evidence AI status
      await prisma.evidence.update({
        where: { id: evidence.id },
        data: {
          aiIngestStatus: status,
        },
      });

      return NextResponse.json({
        job_id: jobId,
        status: status,
      });
    } catch (error) {
      console.error("Error triggering AI ingest:", error);
      return NextResponse.json(
        { error: "Failed to trigger AI ingest", details: String(error) },
        { status: 500 }
      );
    }
  },
  { resource: "compliance.evidence", action: "edit" }
);
