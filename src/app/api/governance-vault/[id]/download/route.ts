import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth, validateTenantAccess, forbidden } from "@/lib/api-auth";
import { readFile } from "fs/promises";
import path from "path";

interface RouteContext {
  params: Promise<{ id: string }>;
}

// GET download vault document
export const GET = withAuth(
  async (req, context: RouteContext, session) => {
    try {
      const { id } = await context.params;

      const document = await prisma.governanceVaultDocument.findUnique({
        where: { id },
        select: {
          customerAccountId: true,
          fileName: true,
          fileType: true,
          filePath: true,
        },
      });

      if (!document) {
        return NextResponse.json(
          { error: "Document not found" },
          { status: 404 }
        );
      }

      if (!validateTenantAccess(session, document.customerAccountId)) {
        return forbidden("Access denied to this document");
      }

      // Read file from disk
      const fullPath = path.join(process.cwd(), document.filePath);
      const fileBuffer = await readFile(fullPath);

      // Determine content type
      const contentTypeMap: Record<string, string> = {
        pdf: "application/pdf",
        doc: "application/msword",
        docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        xls: "application/vnd.ms-excel",
        xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        ppt: "application/vnd.ms-powerpoint",
        pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        txt: "text/plain",
        csv: "text/csv",
        png: "image/png",
        jpg: "image/jpeg",
        jpeg: "image/jpeg",
        gif: "image/gif",
      };

      const contentType = contentTypeMap[document.fileType || ""] || "application/octet-stream";

      return new NextResponse(fileBuffer, {
        status: 200,
        headers: {
          "Content-Type": contentType,
          "Content-Disposition": `attachment; filename="${document.fileName}"`,
          "Content-Length": fileBuffer.length.toString(),
        },
      });
    } catch (error) {
      console.error("Error downloading vault document:", error);
      return NextResponse.json(
        { error: "Failed to download document" },
        { status: 500 }
      );
    }
  },
  { resource: "compliance.governance", action: "view" }
);
