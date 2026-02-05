import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth, validateTenantAccess } from "@/lib/api-auth";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

interface RouteContext {
  params: Promise<{ id: string }>;
}

// GET /api/processes/[id]/attachments - Get attachments for a process
export const GET = withAuth(
  async (req: NextRequest, context: RouteContext, session) => {
    try {
      const { id } = await context.params;

      const processRecord = await prisma.process.findUnique({
        where: { id },
        select: { customerAccountId: true },
      });

      if (!processRecord) {
        return NextResponse.json(
          { error: "Process not found" },
          { status: 404 }
        );
      }

      if (!validateTenantAccess(session, processRecord.customerAccountId)) {
        return NextResponse.json({ error: "Access denied" }, { status: 403 });
      }

      const attachments = await prisma.processAttachment.findMany({
        where: { processId: id },
        orderBy: { uploadedAt: "desc" },
      });

      return NextResponse.json(
        attachments.map((att) => ({
          id: att.id,
          fileName: att.fileName,
          fileType: att.fileType,
          fileSize: att.fileSize,
          filePath: att.filePath,
          category: att.category,
          uploadedAt: att.uploadedAt.toISOString(),
        }))
      );
    } catch (error) {
      console.error("Error fetching process attachments:", error);
      return NextResponse.json(
        { error: "Failed to fetch attachments" },
        { status: 500 }
      );
    }
  },
  { resource: "organization.process", action: "view" }
);

// POST /api/processes/[id]/attachments - Upload attachment for a process
export const POST = withAuth(
  async (req: NextRequest, context: RouteContext, session) => {
    try {
      const { id } = await context.params;

      const processRecord = await prisma.process.findUnique({
        where: { id },
        select: { customerAccountId: true },
      });

      if (!processRecord) {
        return NextResponse.json(
          { error: "Process not found" },
          { status: 404 }
        );
      }

      if (!validateTenantAccess(session, processRecord.customerAccountId)) {
        return NextResponse.json({ error: "Access denied" }, { status: 403 });
      }

      const formData = await req.formData();
      const file = formData.get("file") as File;
      const category = (formData.get("category") as string) || "process_document";

      if (!file) {
        return NextResponse.json(
          { error: "No file provided" },
          { status: 400 }
        );
      }

      // Create upload directory
      const uploadDir = path.join(process.cwd(), "uploads", "processes", id);
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
      const attachment = await prisma.processAttachment.create({
        data: {
          processId: id,
          fileName: originalName,
          fileType,
          fileSize: file.size,
          filePath: `/uploads/processes/${id}/${fileName}`,
          category,
        },
      });

      return NextResponse.json(
        {
          id: attachment.id,
          fileName: attachment.fileName,
          fileType: attachment.fileType,
          fileSize: attachment.fileSize,
          filePath: attachment.filePath,
          category: attachment.category,
          uploadedAt: attachment.uploadedAt.toISOString(),
        },
        { status: 201 }
      );
    } catch (error) {
      console.error("Error uploading process attachment:", error);
      return NextResponse.json(
        { error: "Failed to upload attachment" },
        { status: 500 }
      );
    }
  },
  { resource: "organization.process", action: "edit" }
);
