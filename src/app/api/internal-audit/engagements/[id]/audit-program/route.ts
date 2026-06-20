import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth, getTenantFilter, getCustomerAccountId } from "@/lib/api-auth";

interface RouteContext {
  params: Promise<{ id: string }>;
}

const DEFAULT_INSTRUCTIONS =
  "This audit program is designed to execute audit procedures aligned with the Audit Planning Memorandum (APM). Each procedure must be linked to risks, controls, and audit objectives. Evidence must be documented and conclusions supported.";

const blankRow = () => ({
  objective: "",
  processSubprocess: "",
  risk: "",
  control: "",
  controlType: "",
  testType: "",
  auditProcedure: "",
  samplingMethod: "",
  sampleSize: "",
  evidenceRequired: "",
  result: "",
  conclusion: "",
  exception: "",
  workingPaperRef: "",
});

// GET - fetch the audit program for an engagement. When none is saved yet,
// returns a blank shell pre-filled from the engagement + default instructions.
export const GET = withAuth(
  async (req: NextRequest, context, session) => {
    try {
      const { id } = await (context as RouteContext).params;
      const tenantFilter = getTenantFilter(session);

      const engagement = await prisma.auditEngagement.findFirst({
        where: { id, ...tenantFilter },
        select: {
          id: true,
          auditId: true,
          engagementTitle: true,
          department: { select: { name: true } },
        },
      });
      if (!engagement) {
        return NextResponse.json({ error: "Engagement not found" }, { status: 404 });
      }

      const existing = await prisma.auditProgram.findUnique({ where: { engagementId: id } });

      if (existing) {
        return NextResponse.json({
          ...existing,
          rows: existing.rows ? JSON.parse(existing.rows) : [],
        });
      }

      return NextResponse.json({
        id: null,
        engagementId: id,
        auditTitle: engagement.engagementTitle || "",
        department: engagement.department?.name || "",
        period: "",
        instructions: DEFAULT_INSTRUCTIONS,
        rows: [blankRow()],
        preparedBy: "",
        preparedDate: "",
        reviewedBy: "",
        reviewedDate: "",
        approvedBy: "",
        approvedDate: "",
      });
    } catch (error) {
      console.error("Error fetching audit program:", error);
      return NextResponse.json({ error: "Failed to fetch audit program" }, { status: 500 });
    }
  },
  { resource: "audit.fieldwork", action: "view" }
);

// PUT - create or update (upsert) the audit program for an engagement.
export const PUT = withAuth(
  async (req: NextRequest, context, session) => {
    try {
      const { id } = await (context as RouteContext).params;
      const tenantFilter = getTenantFilter(session);

      const engagement = await prisma.auditEngagement.findFirst({
        where: { id, ...tenantFilter },
        select: { id: true },
      });
      if (!engagement) {
        return NextResponse.json({ error: "Engagement not found" }, { status: 404 });
      }

      const customerAccountId = getCustomerAccountId(session);
      if (!customerAccountId) {
        return NextResponse.json({ error: "No customer account associated" }, { status: 400 });
      }

      const body = await req.json();
      const {
        auditTitle,
        department,
        period,
        instructions,
        rows,
        preparedBy,
        preparedDate,
        reviewedBy,
        reviewedDate,
        approvedBy,
        approvedDate,
      } = body;

      const data = {
        auditTitle: auditTitle ?? null,
        department: department ?? null,
        period: period ?? null,
        instructions: instructions ?? null,
        rows: Array.isArray(rows) ? JSON.stringify(rows) : null,
        preparedBy: preparedBy ?? null,
        preparedDate: preparedDate ?? null,
        reviewedBy: reviewedBy ?? null,
        reviewedDate: reviewedDate ?? null,
        approvedBy: approvedBy ?? null,
        approvedDate: approvedDate ?? null,
      };

      const saved = await prisma.auditProgram.upsert({
        where: { engagementId: id },
        create: {
          customerAccountId,
          engagementId: id,
          createdById: session.id || null,
          updatedById: session.id || null,
          ...data,
        },
        update: {
          updatedById: session.id || null,
          ...data,
        },
      });

      return NextResponse.json({
        ...saved,
        rows: saved.rows ? JSON.parse(saved.rows) : [],
      });
    } catch (error) {
      console.error("Error saving audit program:", error);
      return NextResponse.json({ error: "Failed to save audit program" }, { status: 500 });
    }
  },
  { resource: "audit.fieldwork", action: "edit" }
);
