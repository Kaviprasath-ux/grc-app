import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth, getTenantFilter } from "@/lib/api-auth";
import { unlink } from "fs/promises";

interface RouteContext {
  params: Promise<{ id: string; docId: string }>;
}

// DELETE /api/tprm/vendors/[id]/documents/[docId]
export const DELETE = withAuth<RouteContext>(
  async (req: NextRequest, context, session) => {
    try {
      const { id, docId } = await context.params;
      const tenantFilter = getTenantFilter(session, { globalAccess: session.roles.includes('GRCAdministrator') });

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
      if (!doc) {
        return NextResponse.json({ error: "Document not found" }, { status: 404 });
      }

      // Delete file from disk
      try { await unlink(doc.filePath); } catch { /* ignore */ }

      await prisma.tPRMVendorDocument.delete({ where: { id: docId } });

      return NextResponse.json({ message: "Document deleted" });
    } catch (error) {
      console.error("Error deleting vendor document:", error);
      return NextResponse.json({ error: "Failed to delete document" }, { status: 500 });
    }
  },
  { resource: ["tprm.vendor-management", "tprm.assessments", "tprm.bo-inventory", "tprm.rm-inventory"], action: "delete" }
);
