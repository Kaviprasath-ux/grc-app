import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth, validateTenantAccess, forbidden } from "@/lib/api-auth";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

interface RouteContext {
  params: Promise<{ id: string }>;
}

// GET /api/evidences/[id]/attachments - Get attachments for an evidence
export const GET = withAuth(
  async (req: NextRequest, context: RouteContext, session) => {
    try {
      const { id } = await context.params;

      // Verify evidence exists and user has access
      const evidence = await prisma.evidence.findUnique({
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

      const attachments = await prisma.evidenceAttachment.findMany({
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
      console.error("Error fetching evidence attachments:", error);
      return NextResponse.json(
        { error: "Failed to fetch attachments" },
        { status: 500 }
      );
    }
  },
  { resource: "compliance.evidence", action: "view" }
);

// POST /api/evidences/[id]/attachments - Upload attachment for an evidence
export const POST = withAuth(
  async (req: NextRequest, context: RouteContext, session) => {
    try {
      const { id } = await context.params;

      // Verify evidence exists and user has access
      const evidence = await prisma.evidence.findUnique({
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

      if (!file) {
        return NextResponse.json(
          { error: "No file provided" },
          { status: 400 }
        );
      }

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
      const attachment = await prisma.evidenceAttachment.create({
        data: {
          evidenceId: id,
          fileName: originalName,
          fileType,
          fileSize: file.size,
          filePath: `/uploads/evidence/${id}/${fileName}`,
        },
      });

      // Auto-transition from "Not Uploaded" to "Draft" when first attachment is added
      if (evidence.status === "Not Uploaded") {
        await prisma.evidence.update({
          where: { id },
          data: { status: "Draft" },
        });
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
      console.error("Error uploading evidence attachment:", error);
      return NextResponse.json(
        { error: "Failed to upload attachment" },
        { status: 500 }
      );
    }
  },
  { resource: "compliance.evidence", action: "edit" }
);

// DELETE /api/evidences/[id]/attachments?attachmentId=xxx - Delete an attachment
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
      const evidence = await prisma.evidence.findUnique({
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
      const attachment = await prisma.evidenceAttachment.findUnique({
        where: { id: attachmentId },
      });

      if (!attachment || attachment.evidenceId !== id) {
        return NextResponse.json(
          { error: "Attachment not found" },
          { status: 404 }
        );
      }

      // Delete attachment record
      await prisma.evidenceAttachment.delete({
        where: { id: attachmentId },
      });

      return NextResponse.json({ message: "Attachment deleted successfully" });
    } catch (error) {
      console.error("Error deleting evidence attachment:", error);
      return NextResponse.json(
        { error: "Failed to delete attachment" },
        { status: 500 }
      );
    }
  },
  { resource: "compliance.evidence", action: "delete" }
);
