import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { readFile } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import { getUploadBaseDir } from "@/lib/file-upload";
import { maybeDecryptBytes } from "@/lib/encryption";

interface RouteContext {
  params: Promise<{ id: string; reportId: string }>;
}

// GET - Download the quarter report document.
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id, reportId } = await context.params;

    const report = await prisma.auditOperationalPlanQuarterReport.findUnique({
      where: { id: reportId },
    });
    if (!report || report.operationalPlanId !== id || !report.reportDocName) {
      return NextResponse.json({ error: "Report document not found" }, { status: 404 });
    }

    let fileBuffer: Buffer | null = null;

    try {
      const rows = await prisma.$queryRaw<Array<{ reportDocData: Buffer | null }>>`
        SELECT "reportDocData" FROM "AuditOperationalPlanQuarterReport" WHERE "id" = ${reportId}
      `;
      if (rows[0]?.reportDocData) {
        fileBuffer = maybeDecryptBytes(Buffer.from(rows[0].reportDocData));
      }
    } catch {
      // raw SQL failed, try disk fallback
    }

    if (!fileBuffer && report.reportDocPath) {
      const baseDir = getUploadBaseDir();
      const relativePath = report.reportDocPath.replace(/^\/uploads\//, "");
      const candidates = [
        path.join(baseDir, relativePath),
        path.join("/tmp", "uploads", relativePath),
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
      return NextResponse.json({ error: "File not found on server" }, { status: 404 });
    }

    const ext = path.extname(report.reportDocName).replace(".", "").toLowerCase();
    const contentType = getContentType(ext);

    return new NextResponse(new Uint8Array(fileBuffer), {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${report.reportDocName}"`,
        "Content-Length": fileBuffer.length.toString(),
      },
    });
  } catch (error) {
    console.error("Error downloading quarter report document:", error);
    return NextResponse.json({ error: "Failed to download report document" }, { status: 500 });
  }
}

function getContentType(fileType: string): string {
  const types: Record<string, string> = {
    pdf: "application/pdf",
    doc: "application/msword",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    xls: "application/vnd.ms-excel",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    zip: "application/zip",
  };
  return types[fileType] || "application/octet-stream";
}
