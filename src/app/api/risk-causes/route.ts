import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth, getTenantFilter, getCustomerAccountId } from "@/lib/api-auth";
import { translateRecord } from '@/lib/translation-service';

// GET all risk causes - with tenant filtering
export const GET = withAuth(
  async (req: NextRequest, context, session) => {
    try {
      const tenantFilter = getTenantFilter(session);

      const causes = await prisma.riskCause.findMany({
        where: tenantFilter,
        include: {
          _count: {
            select: { risks: true },
          },
        },
        orderBy: { name: "asc" },
      });

      return NextResponse.json(causes);
    } catch (error) {
      console.error("Error fetching risk causes:", error);
      return NextResponse.json(
        { error: "Failed to fetch risk causes" },
        { status: 500 }
      );
    }
  },
  { resource: "risk.settings", action: "view" }
);

// POST create a new risk cause - with tenant assignment
export const POST = withAuth(
  async (req: NextRequest, context, session) => {
    try {
      const customerAccountId = getCustomerAccountId(session);
      const body = await req.json();
      const { name, description } = body;

      if (!name?.trim()) {
        return NextResponse.json(
          { error: "Cause name is required" },
          { status: 400 }
        );
      }

      // Check for duplicate within tenant
      const existing = await prisma.riskCause.findFirst({
        where: {
          customerAccountId,
          name: name.trim(),
        },
      });

      if (existing) {
        return NextResponse.json(
          { error: "Cause with this name already exists" },
          { status: 409 }
        );
      }

      const cause = await prisma.riskCause.create({
        data: {
          customerAccountId,
          name: name.trim(),
          description: description?.trim() || null,
        },
      });

      if (session.customerAccountId) void translateRecord(session.customerAccountId, 'RiskCause', cause.id, { name: cause.name });

      return NextResponse.json(cause, { status: 201 });
    } catch (error: unknown) {
      console.error("Error creating risk cause:", error);
      if ((error as { code?: string }).code === "P2002") {
        return NextResponse.json(
          { error: "Cause with this name already exists" },
          { status: 409 }
        );
      }
      return NextResponse.json(
        { error: "Failed to create risk cause" },
        { status: 500 }
      );
    }
  },
  { resource: "risk.settings", action: "create" }
);
