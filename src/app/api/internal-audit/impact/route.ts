import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth, getTenantFilter, getAuditHeadId } from "@/lib/api-auth";
import { translateRecord } from "@/lib/translation-service";

// GET all impacts
// Multi-tenant: Filter by customerAccountId and auditHeadId
export const GET = withAuth(
  async (req, context, session) => {
    try {
      const tenantFilter = getTenantFilter(session);
      const auditHeadId = getAuditHeadId(session);

      const impacts = await prisma.auditImpact.findMany({
        where: {
          ...tenantFilter,
          ...(auditHeadId ? { auditHeadId } : {}),
        },
        orderBy: { value: "asc" },
      });

      return NextResponse.json(impacts);
    } catch (error) {
      console.error("Error fetching impacts:", error);
      return NextResponse.json(
        { error: "Failed to fetch impacts" },
        { status: 500 }
      );
    }
  },
  { resource: "audit.settings", action: "view" }
);

// POST create a new impact
// Multi-tenant: Associate with customerAccountId and auditHeadId
export const POST = withAuth(
  async (req: NextRequest, context, session) => {
    try {
      const body = await req.json();
      const { label, value } = body;
      const tenantFilter = getTenantFilter(session);
      const auditHeadId = getAuditHeadId(session);

      if (!label) {
        return NextResponse.json(
          { error: "Label is required" },
          { status: 400 }
        );
      }

      // Check for duplicate within same tenant and audit head
      const existing = await prisma.auditImpact.findFirst({
        where: {
          label,
          ...tenantFilter,
          ...(auditHeadId ? { auditHeadId } : {}),
        },
      });

      if (existing) {
        return NextResponse.json(
          { error: "Impact with this label already exists" },
          { status: 400 }
        );
      }

      const impact = await prisma.auditImpact.create({
        data: {
          label,
          value: value || 0,
          customerAccountId: session.customerAccountId,
          auditHeadId: auditHeadId,
        },
      });

      if (session.customerAccountId) void translateRecord(session.customerAccountId, 'AuditImpact', impact.id, { label: impact.label });

      return NextResponse.json(impact, { status: 201 });
    } catch (error) {
      console.error("Error creating impact:", error);
      return NextResponse.json(
        { error: "Failed to create impact" },
        { status: 500 }
      );
    }
  },
  { resource: "audit.settings", action: "create" }
);
