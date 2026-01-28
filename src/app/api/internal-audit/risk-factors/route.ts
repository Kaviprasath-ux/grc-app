import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth, getTenantFilter, getCustomerAccountId, getAuditHeadFilter, getAuditHeadId } from "@/lib/api-auth";

// GET all risk factors - filtered by audit head
export const GET = withAuth(
  async (req: NextRequest, context, session) => {
    try {
      const tenantFilter = getTenantFilter(session);
      const auditHeadFilter = getAuditHeadFilter(session);

      const factors = await prisma.auditRiskFactor.findMany({
        where: { ...tenantFilter, ...auditHeadFilter },
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
  { resource: "audit.settings", action: "edit" }
);

// POST create a new risk factor - assigned to current audit head
export const POST = withAuth(
  async (req: NextRequest, context, session) => {
    try {
      const customerAccountId = getCustomerAccountId(session);
      const auditHeadId = getAuditHeadId(session);
      const body = await req.json();
      const { label } = body;

      if (!label) {
        return NextResponse.json(
          { error: "Label is required" },
          { status: 400 }
        );
      }

      // Check for duplicate within the same audit head's settings
      const existing = await prisma.auditRiskFactor.findFirst({
        where: { label, auditHeadId },
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
          customerAccountId,
          auditHeadId,
        },
      });

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
