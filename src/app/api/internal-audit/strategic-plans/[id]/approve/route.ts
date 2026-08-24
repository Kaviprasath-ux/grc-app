import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth, validateTenantAccess, forbidden } from "@/lib/api-auth";
import { validateUploadedFile } from "@/lib/upload-validation";
import path from "path";
import { saveUploadedFile } from "@/lib/file-upload";
import { maybeEncryptBytes } from "@/lib/encryption";

interface RouteContext {
  params: Promise<{ id: string }>;
}

// POST - upload the signed copy and mark the plan Approved (manual sign-off).
// Only roles with the 'approve' action on audit.strategic-plan (Head of Audit) can do this.
export const POST = withAuth(
  async (request: NextRequest, context, session) => {
    try {
      const { id } = await (context as RouteContext).params;

      const existing = await prisma.auditStrategicPlan.findUnique({ where: { id } });
      if (!existing) {
        return NextResponse.json({ error: "Strategic plan not found" }, { status: 404 });
      }
      if (!validateTenantAccess(session, existing.customerAccountId)) {
        return forbidden("Access denied");
      }

      const formData = await request.formData();
      const file = formData.get("file") as File | null;
      const approvedByName = (formData.get("approvedByName") as string) || null;

      if (!file) {
        return NextResponse.json({ error: "No signed copy file provided" }, { status: 400 });
      }
      const check = validateUploadedFile(file);
      if (!check.ok) {
        return NextResponse.json({ error: check.reason }, { status: 400 });
      }

      const { urlPath, buffer } = await saveUploadedFile(file, "strategic-plans");
      const originalName = file.name;

      const updated = await prisma.auditStrategicPlan.update({
        where: { id },
        data: {
          status: "Approved",
          approvedByName,
          approvedAt: new Date(),
          signedCopyPath: urlPath,
          signedCopyName: originalName,
        },
      });

      // Store binary via raw SQL (bypasses Prisma extension → encrypt manually)
      const encrypted = maybeEncryptBytes(Buffer.from(buffer));
      await prisma.$executeRaw`UPDATE "AuditStrategicPlan" SET "signedCopyData" = ${encrypted} WHERE "id" = ${id}`;

      const { signedCopyData, ...safe } = updated as any;
      return NextResponse.json({ ...safe, hasSignedCopy: true });
    } catch (error) {
      console.error("Error approving strategic plan:", error);
      return NextResponse.json({ error: "Failed to approve strategic plan" }, { status: 500 });
    }
  },
  { resource: "audit.strategic-plan", action: "approve" }
);

// DELETE - revoke approval: clear the signed copy and return the plan to Draft.
export const DELETE = withAuth(
  async (request: NextRequest, context, session) => {
    try {
      const { id } = await (context as RouteContext).params;

      const existing = await prisma.auditStrategicPlan.findUnique({ where: { id } });
      if (!existing) {
        return NextResponse.json({ error: "Strategic plan not found" }, { status: 404 });
      }
      if (!validateTenantAccess(session, existing.customerAccountId)) {
        return forbidden("Access denied");
      }

      await prisma.auditStrategicPlan.update({
        where: { id },
        data: {
          status: "Draft",
          approvedByName: null,
          approvedAt: null,
          signedCopyPath: null,
          signedCopyName: null,
        },
      });
      await prisma.$executeRaw`UPDATE "AuditStrategicPlan" SET "signedCopyData" = NULL WHERE "id" = ${id}`;

      return NextResponse.json({ message: "Approval revoked" });
    } catch (error) {
      console.error("Error revoking strategic plan approval:", error);
      return NextResponse.json({ error: "Failed to revoke approval" }, { status: 500 });
    }
  },
  { resource: "audit.strategic-plan", action: "approve" }
);
