import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth, getTenantFilter, getAuditHeadId } from "@/lib/api-auth";
import { translateRecord } from "@/lib/translation-service";

// GET all scoring ranges
// Multi-tenant: Filter by customerAccountId and auditHeadId
export const GET = withAuth(
  async (req: NextRequest, context, session) => {
    try {
      const { searchParams } = new URL(req.url);
      const calculationType = searchParams.get("calculationType");
      const tenantFilter = getTenantFilter(session);
      const auditHeadId = getAuditHeadId(session);

      const where: Record<string, unknown> = {
        ...tenantFilter,
        ...(auditHeadId ? { auditHeadId } : {}),
      };
      if (calculationType) {
        where.calculationType = calculationType;
      }

      const ranges = await prisma.auditScoringRange.findMany({
        where,
        orderBy: { lowValue: "asc" },
      });

      return NextResponse.json(ranges);
    } catch (error) {
      console.error("Error fetching scoring ranges:", error);
      return NextResponse.json(
        { error: "Failed to fetch scoring ranges" },
        { status: 500 }
      );
    }
  },
  { resource: "audit.settings", action: "view" }
);

// POST create a new scoring range
// Multi-tenant: Associate with customerAccountId and auditHeadId
export const POST = withAuth(
  async (req: NextRequest, context, session) => {
    try {
      const body = await req.json();
      const { label, lowValue, highValue, calculationType } = body;
      const tenantFilter = getTenantFilter(session);
      const auditHeadId = getAuditHeadId(session);

      if (!label) {
        return NextResponse.json(
          { error: "Label is required" },
          { status: 400 }
        );
      }

      // Check for duplicate within same tenant and audit head
      const existing = await prisma.auditScoringRange.findFirst({
        where: {
          label,
          calculationType: calculationType || "High of all",
          ...tenantFilter,
          ...(auditHeadId ? { auditHeadId } : {}),
        },
      });

      if (existing) {
        return NextResponse.json(
          { error: "Scoring range with this label already exists for this calculation type" },
          { status: 400 }
        );
      }

      const range = await prisma.auditScoringRange.create({
        data: {
          label,
          lowValue: lowValue || 0,
          highValue: highValue || null,
          calculationType: calculationType || "High of all",
          customerAccountId: session.customerAccountId,
          auditHeadId: auditHeadId,
        },
      });

      if (session.customerAccountId) void translateRecord(session.customerAccountId, 'AuditScoringRange', range.id, { label: range.label });

      return NextResponse.json(range, { status: 201 });
    } catch (error) {
      console.error("Error creating scoring range:", error);
      return NextResponse.json(
        { error: "Failed to create scoring range" },
        { status: 500 }
      );
    }
  },
  { resource: "audit.settings", action: "create" }
);
