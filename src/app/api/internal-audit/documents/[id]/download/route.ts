import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { readFile } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import { getUploadBaseDir } from "@/lib/file-upload";

interface RouteContext {
  params: Promise<{ id: string }>;
}

// GET - Download document file
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;

    const document = await prisma.internalAuditDocument.findUnique({
      where: { id },
    });

    if (!document) {
      return NextResponse.json(
        { error: "Document not found" },
        { status: 404 }
      );
    }

    let fileBuffer: Buffer | null = null;

    // 1. Try fileData from DB via raw SQL (bypasses Prisma client cache on Vercel)
    try {
      const rows = await prisma.$queryRaw<Array<{ fileData: Buffer | null }>>`
        SELECT "fileData" FROM "InternalAuditDocument" WHERE "id" = ${id}
      `;
      if (rows[0]?.fileData) {
        fileBuffer = Buffer.from(rows[0].fileData);
      }
    } catch {
      // raw SQL failed, will try disk fallback
    }

    // 2. Fall back to disk read (local dev or old documents without fileData)
    if (!fileBuffer) {
      const baseDir = getUploadBaseDir();
      const relativePath = document.filePath.replace(/^\/uploads\//, '');
      const candidates = [
        path.join(baseDir, relativePath),
        path.join('/tmp', 'uploads', relativePath),
      ];

      for (const filePath of candidates) {
        if (existsSync(filePath)) {
          try {
            fileBuffer = await readFile(filePath);
            break;
          } catch {
            // try next candidate
          }
        }
      }
    }

    if (!fileBuffer) {
      return NextResponse.json(
        { error: "File not found on server" },
        { status: 404 }
      );
    }

    const contentType = getContentType(document.fileType || "");

    return new NextResponse(new Uint8Array(fileBuffer), {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${document.fileName}"`,
        "Content-Length": fileBuffer.length.toString(),
      },
    });
  } catch (error) {
    console.error("Error downloading document:", error);
    return NextResponse.json(
      { error: "Failed to download document" },
      { status: 500 }
    );
  }
}

function getContentType(fileType: string): string {
  const types: Record<string, string> = {
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
    zip: "application/zip",
  };

  return types[fileType.toLowerCase()] || "application/octet-stream";
}
