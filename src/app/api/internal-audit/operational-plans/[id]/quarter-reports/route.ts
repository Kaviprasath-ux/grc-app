import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth, validateTenantAccess, forbidden, getCustomerAccountId } from "@/lib/api-auth";
import { saveUploadedFile } from "@/lib/file-upload";
import { maybeEncryptBytes } from "@/lib/encryption";
import { validateUploadedFile } from "@/lib/upload-validation";

interface RouteContext {
  params: Promise<{ id: string }>;
}

const VALID_QUARTERS = ["Q1", "Q2", "Q3", "Q4"];

// POST - upload (or replace) the report document for a given quarter of an operational plan.
export const POST = withAuth(
  async (request: NextRequest, context, session) => {
    try {
      const { id } = await (context as RouteContext).params;

      const plan = await prisma.auditOperationalPlan.findUnique({ where: { id } });
      if (!plan) {
        return NextResponse.json({ error: "Operational plan not found" }, { status: 404 });
      }
      if (!validateTenantAccess(session, plan.customerAccountId)) {
        return forbidden("Access denied");
      }

      const formData = await request.formData();
      const file = formData.get("file") as File | null;
      const quarter = (formData.get("quarter") as string | null)?.trim() || "";
      const notes = (formData.get("notes") as string | null)?.trim() || null;

      if (!VALID_QUARTERS.includes(quarter)) {
        return NextResponse.json({ error: "A valid quarter (Q1-Q4) is required" }, { status: 400 });
      }
      if (!file) {
        return NextResponse.json({ error: "No report document provided" }, { status: 400 });
      }
      const check = validateUploadedFile(file);
      if (!check.ok) {
        return NextResponse.json({ error: check.reason }, { status: 400 });
      }

      const { urlPath, buffer } = await saveUploadedFile(file, "operational-plans/quarter-reports");
      const customerAccountId = getCustomerAccountId(session) || plan.customerAccountId;

      const report = await prisma.auditOperationalPlanQuarterReport.upsert({
        where: { operationalPlanId_quarter: { operationalPlanId: id, quarter } },
        create: {
          customerAccountId,
          operationalPlanId: id,
          quarter,
          status: "Submitted",
          reportDocPath: urlPath,
          reportDocName: file.name,
          notes,
          uploadedAt: new Date(),
          uploadedById: session.id || null,
        },
        update: {
          status: "Submitted",
          reportDocPath: urlPath,
          reportDocName: file.name,
          notes,
          uploadedAt: new Date(),
          uploadedById: session.id || null,
        },
      });

      // Store the binary via raw SQL with manual encryption (mirrors approval-doc handling).
      const encrypted = maybeEncryptBytes(Buffer.from(buffer));
      await prisma.$executeRaw`UPDATE "AuditOperationalPlanQuarterReport" SET "reportDocData" = ${encrypted} WHERE "id" = ${report.id}`;

      const { reportDocData, ...safe } = report as any;
      return NextResponse.json({ ...safe, hasReportDoc: true });
    } catch (error) {
      console.error("Error uploading quarter report:", error);
      return NextResponse.json({ error: "Failed to upload quarter report" }, { status: 500 });
    }
  },
  { resource: "audit.operational-plan", action: "edit" }
);
