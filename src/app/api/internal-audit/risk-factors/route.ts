import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth, getTenantFilter, getAuditHeadId, resolveAuditHeadIdForCreate } from "@/lib/api-auth";
import { translateRecord } from "@/lib/translation-service";

// GET all risk factors
// Multi-tenant: Filter by customerAccountId and auditHeadId
export const GET = withAuth(
  async (req, context, session) => {
    try {
      const tenantFilter = getTenantFilter(session);
      const auditHeadId = getAuditHeadId(session);

      const factors = await prisma.auditRiskFactor.findMany({
        where: {
          ...tenantFilter,
          ...(auditHeadId ? { auditHeadId } : {}),
        },
        orderBy: { label: "asc" },
      });

      return NextResponse.json(factors);
    } catch (error) {
      console.error("Error fetching risk factors:", error);
      return NextResponse.json(
        { error: "Failed to fetch risk factors" },
        { status: 500 }
      );
    }
  },
  { resource: "audit.settings", action: "view" }
);

// POST create a new risk factor
// Multi-tenant: Associate with customerAccountId and auditHeadId
export const POST = withAuth(
  async (req: NextRequest, context, session) => {
    try {
      const body = await req.json();
      const { label } = body;
      const tenantFilter = getTenantFilter(session);
      const auditHeadId = await resolveAuditHeadIdForCreate(session);

      if (!label) {
        return NextResponse.json(
          { error: "Label is required" },
          { status: 400 }
        );
      }

      // Check for duplicate within same tenant and audit head
      const existing = await prisma.auditRiskFactor.findFirst({
        where: {
          label,
          ...tenantFilter,
          ...(auditHeadId ? { auditHeadId } : {}),
        },
      });

      if (existing) {
        return NextResponse.json(
          { error: "Risk factor with this label already exists" },
          { status: 400 }
        );
      }

      const factor = await prisma.auditRiskFactor.create({
        data: {
          label,
          customerAccountId: session.customerAccountId,
          auditHeadId: auditHeadId,
        },
      });

      if (session.customerAccountId) void translateRecord(session.customerAccountId, 'AuditRiskFactor', factor.id, { label: factor.label });

      return NextResponse.json(factor, { status: 201 });
    } catch (error) {
      console.error("Error creating risk factor:", error);
      return NextResponse.json(
        { error: "Failed to create risk factor" },
        { status: 500 }
      );
    }
  },
  { resource: "audit.settings", action: "create" }
);
