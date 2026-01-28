import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { unlink } from "fs/promises";
import path from "path";
import { withAuth, validateTenantAccess, forbidden } from "@/lib/api-auth";

interface RouteContext {
  params: Promise<{ id: string; attachmentId: string }>;
}

// GET - Get single attachment details
export const GET = withAuth(
  async (req: NextRequest, context: RouteContext, session) => {
    try {
      const { id, attachmentId } = await context.params;

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

      const attachment = await prisma.processAttachment.findUnique({
        where: { id: attachmentId, processId: id },
      });

      if (!attachment) {
        return NextResponse.json({ error: "Attachment not found" }, { status: 404 });
      }

      return NextResponse.json(attachment);
    } catch (error) {
      console.error("Error fetching attachment:", error);
      return NextResponse.json(
        { error: "Failed to fetch attachment" },
        { status: 500 }
      );
    }
  },
  { resource: "organization.process", action: "view" }
);

// DELETE - Delete attachment
export const DELETE = withAuth(
  async (req: NextRequest, context: RouteContext, session) => {
    try {
      const { id, attachmentId } = await context.params;

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

      // Get attachment to find file path
      const attachment = await prisma.processAttachment.findUnique({
        where: { id: attachmentId, processId: id },
      });

      if (!attachment) {
        return NextResponse.json({ error: "Attachment not found" }, { status: 404 });
      }

      // Delete file from disk
      try {
        const filePath = path.join(process.cwd(), "public", attachment.filePath);
        await unlink(filePath);
      } catch (fileError) {
        console.warn("Could not delete file from disk:", fileError);
        // Continue with database deletion even if file deletion fails
      }

      // Delete attachment record
      await prisma.processAttachment.delete({
        where: { id: attachmentId },
      });

      return NextResponse.json({ success: true, message: "Attachment deleted successfully" });
    } catch (error) {
      console.error("Error deleting attachment:", error);
      return NextResponse.json(
        { error: "Failed to delete attachment" },
        { status: 500 }
      );
    }
  },
  { resource: "organization.process", action: "delete" }
);
