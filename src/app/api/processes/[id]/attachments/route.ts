import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { withAuth, validateTenantAccess, forbidden } from "@/lib/api-auth";

interface RouteContext {
  params: Promise<{ id: string }>;
}

// GET - List attachments for a process
export const GET = withAuth(
  async (req: NextRequest, context: RouteContext, session) => {
    try {
      const { id } = await context.params;

      // Verify process exists and belongs to user's tenant
      const process = await prisma.process.findUnique({
        where: { id },
        select: { customerAccountId: true },
      });

      if (!process) {
        return NextResponse.json({ error: "Process not found" }, { status: 404 });
      }

      if (!validateTenantAccess(session, process.customerAccountId)) {
        return forbidden("Access denied to this process");
      }

      const attachments = await prisma.processAttachment.findMany({
        where: { processId: id },
        orderBy: { uploadedAt: "desc" },
      });

      return NextResponse.json(attachments);
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

// POST - Upload attachment for a process
export const POST = withAuth(
  async (req: NextRequest, context: RouteContext, session) => {
    try {
      const { id } = await context.params;

      // Verify process exists and belongs to user's tenant
      const existingProcess = await prisma.process.findUnique({
        where: { id },
        select: { customerAccountId: true },
      });

      if (!existingProcess) {
        return NextResponse.json({ error: "Process not found" }, { status: 404 });
      }

      if (!validateTenantAccess(session, existingProcess.customerAccountId)) {
        return forbidden("Access denied to this process");
      }

      const formData = await req.formData();
      const file = formData.get("file") as File;

      if (!file) {
        return NextResponse.json(
          { error: "No file provided" },
          { status: 400 }
        );
      }

      // Get file details
      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);

      // Create uploads directory if it doesn't exist
      const uploadsDir = path.join(process.cwd(), "public", "uploads", "processes");
      await mkdir(uploadsDir, { recursive: true });

      // Generate unique filename
      const timestamp = Date.now();
      const originalName = file.name;
      const extension = path.extname(originalName);
      const baseName = path.basename(originalName, extension);
      const uniqueFileName = `${baseName}-${timestamp}${extension}`;

      // Save file
      const filePath = path.join(uploadsDir, uniqueFileName);
      await writeFile(filePath, buffer);

      // Create attachment record
      const fileType = extension.replace(".", "").toLowerCase();
      const attachment = await prisma.processAttachment.create({
        data: {
          fileName: originalName,
          fileType,
          fileSize: file.size,
          filePath: `/uploads/processes/${uniqueFileName}`,
          processId: id,
        },
      });

      return NextResponse.json(attachment);
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
