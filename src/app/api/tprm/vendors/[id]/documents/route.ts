import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth, getTenantFilter, getCustomerAccountId } from "@/lib/api-auth";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

interface RouteContext {
  params: Promise<{ id: string }>;
}

// GET /api/tprm/vendors/[id]/documents — List vendor documents
export const GET = withAuth<RouteContext>(
  async (req, context, session) => {
    try {
      const { id } = await context.params;
      const tenantFilter = getTenantFilter(session, { globalAccess: session.roles.includes('GRCAdministrator') });

      const vendor = await prisma.tPRMVendor.findFirst({
        where: { id, ...tenantFilter },
        select: { id: true },
      });
      if (!vendor) {
        return NextResponse.json({ error: "Vendor not found" }, { status: 404 });
      }

      const docs = await prisma.tPRMVendorDocument.findMany({
        where: { vendorId: id, customerAccountId: getCustomerAccountId(session), isDeleted: false },
        orderBy: { createdAt: "desc" },
      });

      return NextResponse.json({
        data: docs.map((d) => ({
          id: d.id,
          name: d.fileName,
          path: d.filePath,
          type: d.docType,
          createdAt: d.createdAt.toISOString(),
        })),
      });
    } catch (error) {
      console.error("Error fetching vendor documents:", error);
      return NextResponse.json({ error: "Failed to fetch documents" }, { status: 500 });
    }
  },
  { resource: ["tprm.vendor-management", "tprm.assessments", "tprm.bo-inventory", "tprm.rm-inventory"], action: "view" }
);

// POST /api/tprm/vendors/[id]/documents — Upload a document
export const POST = withAuth<RouteContext>(
  async (req: NextRequest, context, session) => {
    try {
      const { id } = await context.params;
      const tenantFilter = getTenantFilter(session, { globalAccess: session.roles.includes('GRCAdministrator') });
      const customerAccountId = getCustomerAccountId(session);

      const vendor = await prisma.tPRMVendor.findFirst({
        where: { id, ...tenantFilter },
        select: { id: true },
      });
      if (!vendor) {
        return NextResponse.json({ error: "Vendor not found" }, { status: 404 });
      }

      const formData = await req.formData();
      const file = formData.get("file") as File;
      const docType = (formData.get("docType") as string) || "document";

      if (!file) {
        return NextResponse.json({ error: "No file provided" }, { status: 400 });
      }

      const uploadDir = path.join(process.cwd(), "uploads", "tprm-vendor-docs");
      await mkdir(uploadDir, { recursive: true });

      const timestamp = Date.now();
      const ext = path.extname(file.name);
      const baseName = path.basename(file.name, ext);
      const fileName = `${baseName}_${timestamp}${ext}`;
      const filePath = path.join(uploadDir, fileName);

      const buffer = Buffer.from(await file.arrayBuffer());
      await writeFile(filePath, buffer);

      // If docType is "contract", also update the vendor's contract fields
      if (docType === "contract") {
        await prisma.tPRMVendor.update({
          where: { id },
          data: { contractDocumentName: file.name, contractDocumentPath: filePath },
        });
      }

      const doc = await prisma.tPRMVendorDocument.create({
        data: {
          customerAccountId,
          vendorId: id,
          docType,
          fileName: file.name,
          filePath,
        },
      });

      return NextResponse.json({
        id: doc.id,
        name: doc.fileName,
        path: doc.filePath,
        type: doc.docType,
        createdAt: doc.createdAt.toISOString(),
      }, { status: 201 });
    } catch (error) {
      console.error("Error uploading vendor document:", error);
      return NextResponse.json({ error: "Failed to upload document" }, { status: 500 });
    }
  },
  { resource: ["tprm.vendor-management", "tprm.assessments", "tprm.bo-inventory", "tprm.rm-inventory"], action: "edit" }
);
