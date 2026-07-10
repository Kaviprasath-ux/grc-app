import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth, validateTenantAccess, forbidden } from "@/lib/api-auth";
import { saveUploadedFile } from "@/lib/file-upload";
import { maybeEncryptBytes } from "@/lib/encryption";
import { generateEngagementsFromOperationalPlan } from "@/lib/audit-engagement-from-plan";

interface RouteContext {
  params: Promise<{ id: string }>;
}

// POST - upload the approval document and mark the operational plan Approved.
export const POST = withAuth(
  async (request: NextRequest, context, session) => {
    try {
      const { id } = await (context as RouteContext).params;

      const existing = await prisma.auditOperationalPlan.findUnique({ where: { id } });
      if (!existing) {
        return NextResponse.json({ error: "Operational plan not found" }, { status: 404 });
      }
      if (!validateTenantAccess(session, existing.customerAccountId)) {
        return forbidden("Access denied");
      }

      const formData = await request.formData();
      const file = formData.get("file") as File | null;
      if (!file) {
        return NextResponse.json({ error: "No approval document provided" }, { status: 400 });
      }

      const { urlPath, buffer } = await saveUploadedFile(file, "operational-plans");

      const updated = await prisma.auditOperationalPlan.update({
        where: { id },
        data: {
          status: "Approved",
          approvedAt: new Date(),
          approvalDocPath: urlPath,
          approvalDocName: file.name,
        },
      });

      const encrypted = maybeEncryptBytes(Buffer.from(buffer));
      await prisma.$executeRaw`UPDATE "AuditOperationalPlan" SET "approvalDocData" = ${encrypted} WHERE "id" = ${id}`;

      // Auto-generate audit engagements from the now-approved plan's items.
      // Idempotent: items already converted are skipped.
      let engagementsCreated = 0;
      try {
        const result = await generateEngagementsFromOperationalPlan(id, {
          id: session.id,
          name: session.name,
        });
        engagementsCreated = result.created;
      } catch (genError) {
        // Don't fail the approval if engagement generation hits a snag.
        console.error("Error auto-generating engagements from operational plan:", genError);
      }

      const { approvalDocData, ...safe } = updated as any;
      return NextResponse.json({ ...safe, hasApprovalDoc: true, engagementsCreated });
    } catch (error) {
      console.error("Error uploading operational plan approval:", error);
      return NextResponse.json({ error: "Failed to upload approval document" }, { status: 500 });
    }
  },
  { resource: "audit.operational-plan", action: "edit" }
);

// DELETE - remove approval document and return plan to Draft.
export const DELETE = withAuth(
  async (request: NextRequest, context, session) => {
    try {
      const { id } = await (context as RouteContext).params;

      const existing = await prisma.auditOperationalPlan.findUnique({ where: { id } });
      if (!existing) {
        return NextResponse.json({ error: "Operational plan not found" }, { status: 404 });
      }
      if (!validateTenantAccess(session, existing.customerAccountId)) {
        return forbidden("Access denied");
      }

      await prisma.auditOperationalPlan.update({
        where: { id },
        data: {
          status: "Draft",
          approvedAt: null,
          approvalDocPath: null,
          approvalDocName: null,
        },
      });
      await prisma.$executeRaw`UPDATE "AuditOperationalPlan" SET "approvalDocData" = NULL WHERE "id" = ${id}`;

      return NextResponse.json({ message: "Approval document removed" });
    } catch (error) {
      console.error("Error removing operational plan approval:", error);
      return NextResponse.json({ error: "Failed to remove approval document" }, { status: 500 });
    }
  },
  { resource: "audit.operational-plan", action: "edit" }
);
