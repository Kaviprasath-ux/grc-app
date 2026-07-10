import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { readFile } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import { getUploadBaseDir } from "@/lib/file-upload";
import { maybeDecryptBytes } from "@/lib/encryption";

interface RouteContext {
  params: Promise<{ id: string }>;
}

// GET - Download the approved signed copy of a strategic plan
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;

    const plan = await prisma.auditStrategicPlan.findUnique({ where: { id } });
    if (!plan || !plan.signedCopyName) {
      return NextResponse.json({ error: "Signed copy not found" }, { status: 404 });
    }

    let fileBuffer: Buffer | null = null;

    // 1. Try signedCopyData from DB via raw SQL (decrypt manually — bypasses Prisma extension)
    try {
      const rows = await prisma.$queryRaw<Array<{ signedCopyData: Buffer | null }>>`
        SELECT "signedCopyData" FROM "AuditStrategicPlan" WHERE "id" = ${id}
      `;
      if (rows[0]?.signedCopyData) {
        fileBuffer = maybeDecryptBytes(Buffer.from(rows[0].signedCopyData));
      }
    } catch {
      // raw SQL failed, will try disk fallback
    }

    // 2. Fall back to disk (local dev)
    if (!fileBuffer && plan.signedCopyPath) {
      const baseDir = getUploadBaseDir();
      const relativePath = plan.signedCopyPath.replace(/^\/uploads\//, "");
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

    const ext = path.extname(plan.signedCopyName).replace(".", "").toLowerCase();
    const contentType = getContentType(ext);

    return new NextResponse(new Uint8Array(fileBuffer), {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${plan.signedCopyName}"`,
        "Content-Length": fileBuffer.length.toString(),
      },
    });
  } catch (error) {
    console.error("Error downloading signed copy:", error);
    return NextResponse.json({ error: "Failed to download signed copy" }, { status: 500 });
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
