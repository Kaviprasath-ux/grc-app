import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth, validateTenantAccess } from "@/lib/api-auth";
import { unlink } from "fs/promises";
import path from "path";

interface RouteContext {
  params: Promise<{ id: string; attachmentId: string }>;
}

// DELETE /api/processes/[id]/attachments/[attachmentId]
export const DELETE = withAuth(
  async (req: NextRequest, context: RouteContext, session) => {
    try {
      const { id, attachmentId } = await context.params;

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

      const attachment = await prisma.processAttachment.findUnique({
        where: { id: attachmentId },
      });

      if (!attachment || attachment.processId !== id) {
        return NextResponse.json(
          { error: "Attachment not found" },
          { status: 404 }
        );
      }

      // Delete physical file
      if (attachment.filePath) {
        try {
          const relativePath = attachment.filePath.startsWith("/")
            ? attachment.filePath.slice(1)
            : attachment.filePath;
          const absolutePath = path.join(process.cwd(), relativePath);
          await unlink(absolutePath);
        } catch (fileError) {
          console.warn(
            `Could not delete file: ${attachment.filePath}`,
            fileError
          );
        }
      }

      await prisma.processAttachment.delete({
        where: { id: attachmentId },
      });

      return NextResponse.json({ success: true });
    } catch (error) {
      console.error("Error deleting process attachment:", error);
      return NextResponse.json(
        { error: "Failed to delete attachment" },
        { status: 500 }
      );
    }
  },
  { resource: "organization.process", action: "delete" }
);
