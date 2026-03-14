import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth } from "@/lib/api-auth";
import path from "path";

interface RouteContext {
  params: Promise<{ id: string }>;
}

// GET — Superadmin downloads a vendor document (including archived)
export const GET = withAuth<RouteContext>(
  async (req: NextRequest, context, _session) => {
    try {
      const { id: vendorId } = await context.params;
      const { searchParams } = new URL(req.url);
      const docId = searchParams.get("docId");

      if (!docId) {
        return NextResponse.json({ error: "docId is required" }, { status: 400 });
      }

      const doc = await prisma.tPRMVendorDocument.findFirst({
        where: { id: docId, vendorId },
      });

      if (!doc || !doc.filePath) {
        return NextResponse.json({ error: "Document not found" }, { status: 404 });
      }

      const fs = await import("fs");
      if (!fs.existsSync(doc.filePath)) {
        return NextResponse.json({ error: "File not found on disk" }, { status: 404 });
      }

      const fileBuffer = fs.readFileSync(doc.filePath);
      const ext = path.extname(doc.fileName || "").toLowerCase();
      const mimeTypes: Record<string, string> = {
        ".pdf": "application/pdf",
        ".doc": "application/msword",
        ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        ".xls": "application/vnd.ms-excel",
        ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".txt": "text/plain",
      };
      const contentType = mimeTypes[ext] || "application/octet-stream";

      return new NextResponse(fileBuffer, {
        headers: {
          "Content-Type": contentType,
          "Content-Disposition": `attachment; filename="${doc.fileName}"`,
        },
      });
    } catch (error) {
      console.error("Error downloading document:", error);
      return NextResponse.json({ error: "Failed to download" }, { status: 500 });
    }
  },
  { resource: "tprm.account-overview", action: "view" }
);
