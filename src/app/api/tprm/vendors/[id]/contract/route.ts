import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth, getTenantFilter, getCustomerAccountId } from "@/lib/api-auth";
import { writeFile, mkdir, unlink } from "fs/promises";
import path from "path";
import { validateUploadedFile } from "@/lib/upload-validation";

interface RouteContext {
  params: Promise<{ id: string }>;
}

// POST /api/tprm/vendors/[id]/contract — Upload contract document
export const POST = withAuth<RouteContext>(
  async (req: NextRequest, context, session) => {
    try {
      const { id } = await context.params;
      const tenantFilter = getTenantFilter(session, { globalAccess: session.roles.includes('GRCAdministrator') });

      const vendor = await prisma.tPRMVendor.findFirst({
        where: { id, ...tenantFilter },
      });
      if (!vendor) {
        return NextResponse.json({ error: "Vendor not found" }, { status: 404 });
      }

      const formData = await req.formData();
      const file = formData.get("file") as File;
      if (!file) {
        return NextResponse.json({ error: "No file provided" }, { status: 400 });
      }

      const check = validateUploadedFile(file);
      if (!check.ok) {
        return NextResponse.json({ error: check.reason }, { status: 400 });
      }

      // Attaching a contract activates an Inactive vendor regardless of which
      // UI path triggered the upload (inventory page, contracts page, etc.).
      // Centralizing the transition here prevents callers from forgetting it.
      const shouldActivate = vendor.status === "Inactive";

      // Create upload directory
      const uploadDir = path.join(process.cwd(), "uploads", "tprm-contracts");
      await mkdir(uploadDir, { recursive: true });

      // Generate unique filename
      const timestamp = Date.now();
      const originalName = file.name;
      const ext = path.extname(originalName);
      const baseName = path.basename(originalName, ext);
      const fileName = `${baseName}_${timestamp}${ext}`;
      const filePath = path.join(uploadDir, fileName);

      // Write file to disk
      const buffer = Buffer.from(await file.arrayBuffer());
      await writeFile(filePath, buffer);

      // Delete old contract file if exists
      if (vendor.contractDocumentPath) {
        try {
          await unlink(vendor.contractDocumentPath);
        } catch {
          // Old file may not exist, ignore
        }
      }

      const customerAccountId = getCustomerAccountId(session);

      // Update vendor with contract document info (and activate if Inactive)
      const updated = await prisma.tPRMVendor.update({
        where: { id },
        data: {
          contractDocumentName: originalName,
          contractDocumentPath: filePath,
          ...(shouldActivate ? { status: "Active" } : {}),
        },
      });

      // Also create a TPRMVendorDocument record so it appears in the documents list
      await prisma.tPRMVendorDocument.create({
        data: {
          customerAccountId,
          vendorId: id,
          docType: "contract",
          fileName: originalName,
          filePath,
        },
      });

      return NextResponse.json({
        contractDocumentName: updated.contractDocumentName,
        contractDocumentPath: updated.contractDocumentPath,
      });
    } catch (error) {
      console.error("Error uploading contract document:", error);
      return NextResponse.json({ error: "Failed to upload contract" }, { status: 500 });
    }
  },
  { resource: ["tprm.vendor-management", "tprm.assessments", "tprm.bo-inventory", "tprm.rm-inventory"], action: "edit" }
);

// DELETE /api/tprm/vendors/[id]/contract — Delete contract document
export const DELETE = withAuth<RouteContext>(
  async (req: NextRequest, context, session) => {
    try {
      const { id } = await context.params;
      const tenantFilter = getTenantFilter(session, { globalAccess: session.roles.includes('GRCAdministrator') });

      const vendor = await prisma.tPRMVendor.findFirst({
        where: { id, ...tenantFilter },
        select: { id: true, contractDocumentPath: true },
      });

      if (!vendor) {
        return NextResponse.json({ error: "Vendor not found" }, { status: 404 });
      }

      // Delete file from disk
      if (vendor.contractDocumentPath) {
        try {
          await unlink(vendor.contractDocumentPath);
        } catch {
          // File may not exist, ignore
        }
      }

      // Clear contract fields on vendor
      await prisma.tPRMVendor.update({
        where: { id },
        data: {
          contractDocumentName: null,
          contractDocumentPath: null,
        },
      });

      return NextResponse.json({ success: true });
    } catch (error) {
      console.error("Error deleting contract document:", error);
      return NextResponse.json({ error: "Failed to delete contract" }, { status: 500 });
    }
  },
  { resource: ["tprm.vendor-management", "tprm.assessments", "tprm.bo-inventory", "tprm.rm-inventory"], action: "delete" }
);

// GET /api/tprm/vendors/[id]/contract — Download contract document
export const GET = withAuth<RouteContext>(
  async (req: NextRequest, context, session) => {
    try {
      const { id } = await context.params;
      const tenantFilter = getTenantFilter(session, { globalAccess: session.roles.includes('GRCAdministrator') });

      const vendor = await prisma.tPRMVendor.findFirst({
        where: { id, ...tenantFilter },
        select: { contractDocumentName: true, contractDocumentPath: true },
      });

      if (!vendor || !vendor.contractDocumentPath) {
        return NextResponse.json({ error: "No contract document found" }, { status: 404 });
      }

      const fs = await import("fs");
      if (!fs.existsSync(vendor.contractDocumentPath)) {
        return NextResponse.json({ error: "File not found on disk" }, { status: 404 });
      }

      const fileBuffer = fs.readFileSync(vendor.contractDocumentPath);
      const ext = path.extname(vendor.contractDocumentName || "").toLowerCase();
      const mimeTypes: Record<string, string> = {
        ".pdf": "application/pdf",
        ".doc": "application/msword",
        ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        ".xls": "application/vnd.ms-excel",
        ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
      };
      const contentType = mimeTypes[ext] || "application/octet-stream";

      return new NextResponse(fileBuffer, {
        headers: {
          "Content-Type": contentType,
          "Content-Disposition": `attachment; filename="${vendor.contractDocumentName}"`,
        },
      });
    } catch (error) {
      console.error("Error downloading contract document:", error);
      return NextResponse.json({ error: "Failed to download contract" }, { status: 500 });
    }
  },
  { resource: ["tprm.vendor-management", "tprm.assessments", "tprm.bo-inventory", "tprm.rm-inventory"], action: "view" }
);
