import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth, validateTenantAccess, forbidden } from "@/lib/api-auth";
import { readFile } from "fs/promises";
import path from "path";

interface RouteContext {
  params: Promise<{ id: string }>;
}

// GET /api/artifacts/[id]/download - Download an artifact file
export const GET = withAuth(
  async (req, context: RouteContext, session) => {
    try {
      const { id } = await context.params;

      const artifact = await prisma.artifact.findUnique({
        where: { id },
        select: {
          customerAccountId: true,
          fileName: true,
          fileType: true,
          filePath: true,
        },
      });

      if (!artifact) {
        return NextResponse.json(
          { error: "Artifact not found" },
          { status: 404 }
        );
      }

      if (!validateTenantAccess(session, artifact.customerAccountId)) {
        return forbidden("Access denied to this artifact");
      }

      // Read file from disk
      const relativePath = artifact.filePath.startsWith("/")
        ? artifact.filePath.slice(1)
        : artifact.filePath;
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

      const contentType = contentTypeMap[artifact.fileType || ""] || "application/octet-stream";

      return new NextResponse(fileBuffer, {
        status: 200,
        headers: {
          "Content-Type": contentType,
          "Content-Disposition": `attachment; filename="${artifact.fileName}"`,
          "Content-Length": fileBuffer.length.toString(),
        },
      });
    } catch (error) {
      console.error("Error downloading artifact:", error);
      return NextResponse.json(
        { error: "Failed to download artifact" },
        { status: 500 }
      );
    }
  },
  { resource: "compliance.evidence", action: "view" }
);
