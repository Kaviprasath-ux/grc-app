import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth, getTenantFilter, getCustomerAccountId, getAuditHeadFilter, getAuditHeadId } from "@/lib/api-auth";

// GET all periodicities - filtered by audit head
export const GET = withAuth(
  async (req: NextRequest, context, session) => {
    try {
      const tenantFilter = getTenantFilter(session);
      const auditHeadFilter = getAuditHeadFilter(session);

      const periodicities = await prisma.auditPeriodicity.findMany({
        where: { ...tenantFilter, ...auditHeadFilter },
        orderBy: { months: "asc" },
      });

      return NextResponse.json(periodicities);
    } catch (error) {
      console.error("Error fetching periodicities:", error);
      return NextResponse.json(
        { error: "Failed to fetch periodicities" },
        { status: 500 }
      );
    }
  },
  { resource: "audit.settings", action: "edit" }
);

// POST create a new periodicity - assigned to current audit head
export const POST = withAuth(
  async (req: NextRequest, context, session) => {
    try {
      const customerAccountId = getCustomerAccountId(session);
      const auditHeadId = getAuditHeadId(session);
      const body = await req.json();
      const { interval, months } = body;

      if (!interval) {
        return NextResponse.json(
          { error: "Interval is required" },
          { status: 400 }
        );
      }

      // Check for duplicate within the same audit head's settings
      const existing = await prisma.auditPeriodicity.findFirst({
        where: { interval, auditHeadId },
      });

      if (existing) {
        return NextResponse.json(
          { error: "Periodicity with this interval already exists" },
          { status: 400 }
        );
      }

      const periodicity = await prisma.auditPeriodicity.create({
        data: {
          interval,
          months: months || 1,
          customerAccountId,
          auditHeadId,
        },
      });

      return NextResponse.json(periodicity, { status: 201 });
    } catch (error) {
      console.error("Error creating periodicity:", error);
      return NextResponse.json(
        { error: "Failed to create periodicity" },
        { status: 500 }
      );
    }
  },
  { resource: "audit.settings", action: "create" }
);
