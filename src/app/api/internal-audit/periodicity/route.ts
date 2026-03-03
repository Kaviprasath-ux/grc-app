import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth } from "@/lib/api-auth";
import { translateRecord } from '@/lib/translation-service';

// GET all periodicities
// Note: AuditPeriodicity model doesn't have customerAccountId field yet - tenant filtering disabled
export const GET = withAuth(
  async () => {
    try {
      const periodicities = await prisma.auditPeriodicity.findMany({
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
  { resource: "audit.settings", action: "view" }
);

// POST create a new periodicity
// Note: AuditPeriodicity model doesn't have customerAccountId field yet - tenant assignment disabled
export const POST = withAuth(
  async (req: NextRequest, context, session) => {
    try {
      const body = await req.json();
      const { interval, months } = body;

      if (!interval) {
        return NextResponse.json(
          { error: "Interval is required" },
          { status: 400 }
        );
      }

      // Check for duplicate
      const existing = await prisma.auditPeriodicity.findFirst({
        where: { interval },
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
        },
      });

      if (session.customerAccountId) void translateRecord(session.customerAccountId, 'AuditPeriodicity', periodicity.id, { interval: periodicity.interval });

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
