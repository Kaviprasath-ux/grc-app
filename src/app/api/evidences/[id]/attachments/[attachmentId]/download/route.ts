import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth, validateTenantAccess, forbidden } from "@/lib/api-auth";
import { readFile } from "fs/promises";
import path from "path";

interface RouteContext {
  params: Promise<{ id: string; attachmentId: string }>;
}

// GET /api/evidences/[id]/attachments/[attachmentId]/download - Download an evidence attachment
export const GET = withAuth(
  async (req, context: RouteContext, session) => {
    try {
      const { id, attachmentId } = await context.params;

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

      const attachment = await prisma.evidenceAttachment.findUnique({
        where: { id: attachmentId },
      });

      if (!attachment || attachment.evidenceId !== id) {
        return NextResponse.json(
          { error: "Attachment not found" },
          { status: 404 }
        );
      }

      // Read file from disk
      const relativePath = attachment.filePath.startsWith("/")
        ? attachment.filePath.slice(1)
        : attachment.filePath;
      const fullPath = path.join(process.cwd(), relativePath);
      const fileBuffer = await readFile(fullPath);

      // Determine content type
      const contentTypeMap: Record<string, string> = {
        pdf: "application/pdf",
        doc: "application/msword",
        docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        xls: "application/vnd.ms-excel",
        xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        txt: "text/plain",
        csv: "text/csv",
        png: "image/png",
        jpg: "image/jpeg",
        jpeg: "image/jpeg",
        gif: "image/gif",
      };

      const contentType = contentTypeMap[attachment.fileType || ""] || "application/octet-stream";

      return new NextResponse(fileBuffer, {
        status: 200,
        headers: {
          "Content-Type": contentType,
          "Content-Disposition": `attachment; filename="${attachment.fileName}"`,
          "Content-Length": fileBuffer.length.toString(),
        },
      });
    } catch (error) {
      console.error("Error downloading evidence attachment:", error);
      return NextResponse.json(
        { error: "Failed to download attachment" },
        { status: 500 }
      );
    }
  },
  { resource: "compliance.evidence", action: "view" }
);
