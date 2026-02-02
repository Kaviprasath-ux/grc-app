import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { readFile } from "fs/promises";
import path from "path";

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

    // Read file from disk
    const filePath = path.join(process.cwd(), document.filePath);

    try {
      const fileBuffer = await readFile(filePath);

      // Determine content type
      const contentType = getContentType(document.fileType || "");

      return new NextResponse(fileBuffer, {
        headers: {
          "Content-Type": contentType,
          "Content-Disposition": `attachment; filename="${document.fileName}"`,
          "Content-Length": fileBuffer.length.toString(),
        },
      });
    } catch (err) {
      console.error("File not found on disk:", err);
      return NextResponse.json(
        { error: "File not found on server" },
        { status: 404 }
      );
    }
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
