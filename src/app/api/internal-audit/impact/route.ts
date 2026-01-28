import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth, getTenantFilter, getCustomerAccountId, getAuditHeadFilter, getAuditHeadId } from "@/lib/api-auth";

// GET all impacts - filtered by audit head
export const GET = withAuth(
  async (req: NextRequest, context, session) => {
    try {
      const tenantFilter = getTenantFilter(session);
      const auditHeadFilter = getAuditHeadFilter(session);

      const impacts = await prisma.auditImpact.findMany({
        where: { ...tenantFilter, ...auditHeadFilter },
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
  { resource: "audit.settings", action: "edit" }
);

// POST create a new impact - assigned to current audit head
export const POST = withAuth(
  async (req: NextRequest, context, session) => {
    try {
      const customerAccountId = getCustomerAccountId(session);
      const auditHeadId = getAuditHeadId(session);
      const body = await req.json();
      const { label, value } = body;

      if (!label) {
        return NextResponse.json(
          { error: "Label is required" },
          { status: 400 }
        );
      }

      // Check for duplicate within the same audit head's settings
      const existing = await prisma.auditImpact.findFirst({
        where: { label, auditHeadId },
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
          customerAccountId,
          auditHeadId,
        },
      });

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
