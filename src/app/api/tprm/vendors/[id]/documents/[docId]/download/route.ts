import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth, getTenantFilter } from "@/lib/api-auth";
import path from "path";
import fs from "fs";

interface RouteContext {
  params: Promise<{ id: string; docId: string }>;
}

// GET /api/tprm/vendors/[id]/documents/[docId]/download
export const GET = withAuth<RouteContext>(
  async (req: NextRequest, context, session) => {
    try {
      const { id, docId } = await context.params;
      const tenantFilter = getTenantFilter(session);

      const vendor = await prisma.tPRMVendor.findFirst({
        where: { id, ...tenantFilter },
        select: { id: true },
      });
      if (!vendor) {
        return NextResponse.json({ error: "Vendor not found" }, { status: 404 });
      }

      const doc = await prisma.tPRMVendorDocument.findFirst({
        where: { id: docId, vendorId: id },
      });
      if (!doc || !fs.existsSync(doc.filePath)) {
        return NextResponse.json({ error: "Document not found" }, { status: 404 });
      }

      const fileBuffer = fs.readFileSync(doc.filePath);
      const ext = path.extname(doc.fileName).toLowerCase();
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
      console.error("Error downloading vendor document:", error);
      return NextResponse.json({ error: "Failed to download" }, { status: 500 });
    }
  },
  { resource: ["tprm.assessments", "tprm.bo-inventory", "tprm.rm-inventory"], action: "view" }
);
