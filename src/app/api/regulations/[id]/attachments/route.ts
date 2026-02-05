import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth, validateTenantAccess, forbidden } from "@/lib/api-auth";
import { writeFile, mkdir, unlink } from "fs/promises";
import path from "path";

interface RouteContext {
  params: Promise<{ id: string }>;
}

// POST /api/regulations/[id]/attachments - Upload attachment for a regulation
export const POST = withAuth(
  async (req: NextRequest, context: RouteContext, session) => {
    try {
      const { id } = await context.params;

      // Verify regulation exists and user has access
      const regulation = await prisma.regulation.findUnique({
        where: { id },
        select: { customerAccountId: true },
      });

      if (!regulation) {
        return NextResponse.json(
          { error: "Regulation not found" },
          { status: 404 }
        );
      }

      if (!validateTenantAccess(session, regulation.customerAccountId)) {
        return forbidden("Access denied to this regulation");
      }

      // Parse form data
      const formData = await req.formData();
      const file = formData.get("file") as File;
      const type = formData.get("type") as string; // "document" or "certificate"

      if (!file) {
        return NextResponse.json(
          { error: "No file provided" },
          { status: 400 }
        );
      }

      if (!type || !["document", "certificate"].includes(type)) {
        return NextResponse.json(
          { error: "Type must be 'document' or 'certificate'" },
          { status: 400 }
        );
      }

      // Create upload directory
      const uploadDir = path.join(process.cwd(), "uploads", "regulations", id);
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
      const attachment = await prisma.regulationAttachment.create({
        data: {
          regulationId: id,
          type,
          fileName: originalName,
          fileType,
          fileSize: file.size,
          filePath: `/uploads/regulations/${id}/${fileName}`,
        },
      });

      return NextResponse.json(
        {
          message: "File uploaded successfully",
          attachment: {
            id: attachment.id,
            type: attachment.type,
            fileName: attachment.fileName,
            fileType: attachment.fileType,
            fileSize: attachment.fileSize,
            filePath: attachment.filePath,
            uploadedAt: attachment.uploadedAt.toISOString(),
          },
        },
        { status: 201 }
      );
    } catch (error) {
      console.error("Error uploading regulation attachment:", error);
      return NextResponse.json(
        { error: "Failed to upload attachment" },
        { status: 500 }
      );
    }
  },
  { resource: "organization.profile", action: "edit" }
);

// DELETE /api/regulations/[id]/attachments?attachmentId=xxx - Delete an attachment
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

      // Verify regulation exists and user has access
      const regulation = await prisma.regulation.findUnique({
        where: { id },
        select: { customerAccountId: true },
      });

      if (!regulation) {
        return NextResponse.json(
          { error: "Regulation not found" },
          { status: 404 }
        );
      }

      if (!validateTenantAccess(session, regulation.customerAccountId)) {
        return forbidden("Access denied to this regulation");
      }

      // Verify attachment belongs to this regulation
      const attachment = await prisma.regulationAttachment.findUnique({
        where: { id: attachmentId },
      });

      if (!attachment || attachment.regulationId !== id) {
        return NextResponse.json(
          { error: "Attachment not found" },
          { status: 404 }
        );
      }

      // Delete physical file from disk
      if (attachment.filePath) {
        try {
          const relativePath = attachment.filePath.startsWith("/")
            ? attachment.filePath.slice(1)
            : attachment.filePath;
          const absolutePath = path.join(process.cwd(), relativePath);
          await unlink(absolutePath);
        } catch (fileError) {
          console.warn(
            `[Regulation Attachment] Could not delete file: ${attachment.filePath}`,
            fileError
          );
        }
      }

      // Delete attachment record from database
      await prisma.regulationAttachment.delete({
        where: { id: attachmentId },
      });

      return NextResponse.json({
        message: "Attachment deleted successfully",
        fileName: attachment.fileName,
      });
    } catch (error) {
      console.error("Error deleting regulation attachment:", error);
      return NextResponse.json(
        { error: "Failed to delete attachment" },
        { status: 500 }
      );
    }
  },
  { resource: "organization.profile", action: "edit" }
);
