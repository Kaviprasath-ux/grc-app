import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth, validateTenantAccess, forbidden, getCustomerAccountId } from "@/lib/api-auth";
import { writeFile, mkdir, unlink } from "fs/promises";
import path from "path";
import { notificationService, NOTIFICATION_EVENTS, NOTIFICATION_CHANNELS } from "@/lib/notification-service";

interface RouteContext {
  params: Promise<{ id: string }>;
}

// GET /api/qpost-compliance/evidences/[id]/attachments - Get attachments for a QPost evidence
export const GET = withAuth(
  async (req: NextRequest, context: RouteContext, session) => {
    try {
      const { id } = await context.params;

      // Verify evidence exists and user has access
      const evidence = await prisma.qPostEvidence.findUnique({
        where: { id },
        select: { customerAccountId: true },
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

      const attachments = await prisma.qPostEvidenceAttachment.findMany({
        where: { evidenceId: id },
        orderBy: { uploadedAt: "desc" },
      });

      return NextResponse.json(
        attachments.map((att) => ({
          id: att.id,
          fileName: att.fileName,
          fileType: att.fileType,
          fileSize: att.fileSize,
          filePath: att.filePath,
          uploadedAt: att.uploadedAt.toISOString(),
        }))
      );
    } catch (error) {
      console.error("Error fetching QPost evidence attachments:", error);
      return NextResponse.json(
        { error: "Failed to fetch attachments" },
        { status: 500 }
      );
    }
  },
  { resource: "qpost-compliance.evidence", action: "view" }
);

// POST /api/qpost-compliance/evidences/[id]/attachments - Upload attachment for a QPost evidence
export const POST = withAuth(
  async (req: NextRequest, context: RouteContext, session) => {
    try {
      const { id } = await context.params;

      // Verify evidence exists and user has access
      const evidence = await prisma.qPostEvidence.findUnique({
        where: { id },
        select: { customerAccountId: true, status: true },
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

      // Parse form data
      const formData = await req.formData();
      const file = formData.get("file") as File;
      const uploadedAtStr = formData.get("uploadedAt") as string | null;

      if (!file) {
        return NextResponse.json(
          { error: "No file provided" },
          { status: 400 }
        );
      }

      // Parse custom upload date if provided, otherwise use current time
      const uploadedAt = uploadedAtStr ? new Date(uploadedAtStr) : new Date();

      // Create upload directory
      const uploadDir = path.join(process.cwd(), "uploads", "evidence", id);
      await mkdir(uploadDir, { recursive: true });

      // Generate unique filename
      const timestamp = Date.now();
      const originalName = file.name;
      const ext = path.extname(originalName);
      const baseName = path.basename(originalName, ext);
      const fileName = `${baseName}_${timestamp}${ext}`;
      const filePath = path.join(uploadDir, fileName);

      // Write file to disk
      const buffer = Buffer.from(await file.arrayBuffer());
      await writeFile(filePath, buffer);

      // Get file type from extension
      const fileType = ext.replace(".", "").toLowerCase() || file.type;

      // Create attachment record
      const attachment = await prisma.qPostEvidenceAttachment.create({
        data: {
          evidenceId: id,
          fileName: originalName,
          fileType,
          fileSize: file.size,
          filePath: `/uploads/evidence/${id}/${fileName}`,
          uploadedAt,
        },
      });

      // Also create a QPost Artifact record and link it to this evidence
      const customerAccountId = getCustomerAccountId(session);
      const artifactCount = await prisma.qPostArtifact.count({
        where: { customerAccountId },
      });
      const artifactCode = `ART-${artifactCount + 1}`;

      const artifact = await prisma.qPostArtifact.create({
        data: {
          customerAccountId,
          artifactCode,
          name: originalName,
          fileName: originalName,
          fileType,
          fileSize: file.size,
          filePath: `/uploads/evidence/${id}/${fileName}`,
          uploadedById: session.id,
        },
      });

      // Link the artifact to this evidence
      await prisma.qPostEvidenceArtifact.create({
        data: {
          evidenceId: id,
          artifactId: artifact.id,
        },
      });

      // Auto-transition from "Not Uploaded" to "Draft" when first attachment is added
      if (evidence.status === "Not Uploaded") {
        await prisma.qPostEvidence.update({
          where: { id },
          data: { status: "Draft" },
        });
      }

      // Notify approver that attachment was uploaded
      try {
        const evidenceWithApprover = await prisma.qPostEvidence.findUnique({
          where: { id },
          select: { approverId: true, name: true, evidenceCode: true, customerAccountId: true },
        });
        if (evidenceWithApprover?.approverId) {
          void notificationService.send({
            customerAccountId: evidenceWithApprover.customerAccountId,
            actorId: session.id,
            recipientId: evidenceWithApprover.approverId,
            event: NOTIFICATION_EVENTS.GOVERNANCE_SUBMIT_FOR_APPROVAL,
            title: "Evidence Attachment Uploaded",
            message: `An attachment has been uploaded for evidence "${evidenceWithApprover.name}" and is ready for your review`,
            link: `/qpost-compliance/evidence/${id}`,
            relatedEntityType: "evidence",
            relatedEntityId: id,
            channels: [NOTIFICATION_CHANNELS.INBOX, NOTIFICATION_CHANNELS.EMAIL],
          });
        }
      } catch (notifError) {
        console.error("Error sending attachment notification:", notifError);
      }

      return NextResponse.json(
        {
          message: "File uploaded successfully",
          attachment: {
            id: attachment.id,
            fileName: attachment.fileName,
            fileType: attachment.fileType,
            fileSize: attachment.fileSize,
            filePath: attachment.filePath,
            uploadedAt: attachment.uploadedAt.toISOString(),
          },
          statusUpdated: evidence.status === "Not Uploaded",
        },
        { status: 201 }
      );
    } catch (error) {
      console.error("Error uploading QPost evidence attachment:", error);
      return NextResponse.json(
        { error: "Failed to upload attachment" },
        { status: 500 }
      );
    }
  },
  { resource: "qpost-compliance.evidence", action: "edit" }
);

// DELETE /api/qpost-compliance/evidences/[id]/attachments?attachmentId=xxx - Delete an attachment
export const DELETE = withAuth(
  async (req: NextRequest, context: RouteContext, session) => {
    try {
      const { id } = await context.params;
      const { searchParams } = new URL(req.url);
      const attachmentId = searchParams.get("attachmentId");

      if (!attachmentId) {
        return NextResponse.json(
          { error: "Attachment ID is required" },
          { status: 400 }
        );
      }

      // Verify evidence exists and user has access
      const evidence = await prisma.qPostEvidence.findUnique({
        where: { id },
        select: { customerAccountId: true },
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

      // Verify attachment belongs to this evidence
      const attachment = await prisma.qPostEvidenceAttachment.findUnique({
        where: { id: attachmentId },
      });

      if (!attachment || attachment.evidenceId !== id) {
        return NextResponse.json(
          { error: "Attachment not found" },
          { status: 404 }
        );
      }

      // Delete physical file from disk
      if (attachment.filePath) {
        try {
          // Handle both /uploads/... and uploads/... paths
          const relativePath = attachment.filePath.startsWith("/")
            ? attachment.filePath.slice(1)
            : attachment.filePath;
          const absolutePath = path.join(process.cwd(), relativePath);
          await unlink(absolutePath);
          console.log(`[QPost Evidence Attachment] Deleted file: ${absolutePath}`);
        } catch (fileError) {
          // Log but don't fail if file doesn't exist
          console.warn(
            `[QPost Evidence Attachment] Could not delete file: ${attachment.filePath}`,
            fileError
          );
        }
      }

      // Delete attachment record from database
      await prisma.qPostEvidenceAttachment.delete({
        where: { id: attachmentId },
      });

      return NextResponse.json({
        message: "Attachment deleted successfully",
        fileName: attachment.fileName,
      });
    } catch (error) {
      console.error("Error deleting QPost evidence attachment:", error);
      return NextResponse.json(
        { error: "Failed to delete attachment" },
        { status: 500 }
      );
    }
  },
  { resource: "qpost-compliance.evidence", action: "delete" }
);
