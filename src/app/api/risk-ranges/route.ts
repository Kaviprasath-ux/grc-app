import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth, getTenantFilter, getCustomerAccountId } from "@/lib/api-auth";
import { translateRecord } from '@/lib/translation-service';

// GET all risk ranges - with tenant filtering
// GRC Admins get global access to view all settings across tenants
export const GET = withAuth(
  async (req: NextRequest, context, session) => {
    try {
      const tenantFilter = getTenantFilter(session, { globalAccess: true });

      const ranges = await prisma.riskRange.findMany({
        where: tenantFilter,
        orderBy: { lowRange: "asc" },
      });
      return NextResponse.json(ranges);
    } catch (error) {
      console.error("Error fetching risk ranges:", error);
      return NextResponse.json(
        { error: "Failed to fetch risk ranges" },
        { status: 500 }
      );
    }
  },
  { resource: "risk.settings", action: "view" }
);

// POST create risk range - with tenant assignment
export const POST = withAuth(
  async (req: NextRequest, context, session) => {
    try {
      const customerAccountId = getCustomerAccountId(session);
      const body = await req.json();
      const { title, color, lowRange, highRange, timelineDays, description } = body;

      if (!title?.trim()) {
        return NextResponse.json(
          { error: "Title is required" },
          { status: 400 }
        );
      }

      // Check for duplicate within tenant
      const existing = await prisma.riskRange.findFirst({
        where: {
          customerAccountId,
          title: title.trim(),
        },
      });

      if (existing) {
        return NextResponse.json(
          { error: "Risk range with this title already exists" },
          { status: 409 }
        );
      }

      const range = await prisma.riskRange.create({
        data: {
          customerAccountId,
          title: title.trim(),
          color: color?.trim() || null,
          lowRange: parseInt(lowRange) || 0,
          highRange: parseInt(highRange) || 0,
          timelineDays: parseInt(timelineDays) || 0,
          description: description?.trim() || null,
        },
      });

      if (session.customerAccountId) void translateRecord(session.customerAccountId, 'RiskRange', range.id, { title: range.title, description: range.description });

      return NextResponse.json(range, { status: 201 });
    } catch (error: unknown) {
      console.error("Error creating risk range:", error);
      if ((error as { code?: string }).code === "P2002") {
        return NextResponse.json(
          { error: "Risk range with this title already exists" },
          { status: 409 }
        );
      }
      return NextResponse.json(
        { error: "Failed to create risk range" },
        { status: 500 }
      );
    }
  },
  { resource: "risk.settings", action: "create" }
);
