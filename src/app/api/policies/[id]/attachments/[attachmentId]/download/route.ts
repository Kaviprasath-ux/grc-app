import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { join } from "path";
import prisma from "@/lib/prisma";
import { withAuth, validateTenantAccess, forbidden } from "@/lib/api-auth";

interface RouteContext {
  params: Promise<{ id: string; attachmentId: string }>;
}

// GET /api/policies/[id]/attachments/[attachmentId]/download - Download a policy attachment
export const GET = withAuth(
  async (req, context: RouteContext, session) => {
    try {
      const { id, attachmentId } = await context.params;

      // Verify policy exists and user has access
      const policy = await prisma.policy.findUnique({
        where: { id },
        select: { customerAccountId: true },
      });

      if (!policy) {
        return NextResponse.json(
          { error: "Policy not found" },
          { status: 404 }
        );
      }

      if (!validateTenantAccess(session, policy.customerAccountId)) {
        return forbidden("Access denied to this policy");
      }

      const attachment = await prisma.policyAttachment.findUnique({
        where: { id: attachmentId },
        select: {
          id: true,
          policyId: true,
          fileName: true,
          fileType: true,
          filePath: true,
        },
      });

      if (!attachment || attachment.policyId !== id) {
        return NextResponse.json(
          { error: "Attachment not found" },
          { status: 404 }
        );
      }

      // Read file from disk
      const relativePath = attachment.filePath.startsWith("/")
        ? attachment.filePath.slice(1)
        : attachment.filePath;
      const diskPath = join(process.cwd(), relativePath);
      let fileBuffer: Buffer;
      try {
        fileBuffer = await readFile(diskPath);
      } catch {
        return NextResponse.json(
          { error: "File not found on disk" },
          { status: 404 }
        );
      }

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

      return new NextResponse(new Uint8Array(fileBuffer), {
        status: 200,
        headers: {
          "Content-Type": contentType,
          "Content-Disposition": `attachment; filename="${attachment.fileName}"`,
          "Content-Length": fileBuffer.length.toString(),
        },
      });
    } catch (error) {
      console.error("Error downloading policy attachment:", error);
      return NextResponse.json(
        { error: "Failed to download attachment" },
        { status: 500 }
      );
    }
  },
  { resource: "compliance.governance", action: "view" }
);
