import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth, getTenantFilter, getCustomerAccountId } from "@/lib/api-auth";

// GET all risk sub categories - with tenant filtering
// GRC Admins get global access to view all settings across tenants
export const GET = withAuth(
  async (req: NextRequest, context, session) => {
    try {
      const tenantFilter = getTenantFilter(session, { globalAccess: true });

      const categories = await prisma.riskSubCategory.findMany({
        where: tenantFilter,
        orderBy: { type: "asc" },
      });
      return NextResponse.json(categories);
    } catch (error) {
      console.error("Error fetching risk sub categories:", error);
      return NextResponse.json(
        { error: "Failed to fetch risk sub categories" },
        { status: 500 }
      );
    }
  },
  { resource: "risk.settings", action: "view" }
);

// POST create risk sub category - with tenant assignment
export const POST = withAuth(
  async (req: NextRequest, context, session) => {
    try {
      const customerAccountId = getCustomerAccountId(session);
      const body = await req.json();
      const { type } = body;

      if (!type?.trim()) {
        return NextResponse.json(
          { error: "Type is required" },
          { status: 400 }
        );
      }

      // Check for duplicate within tenant
      const existing = await prisma.riskSubCategory.findFirst({
        where: {
          customerAccountId,
          type: type.trim(),
        },
      });

      if (existing) {
        return NextResponse.json(
          { error: "Sub category already exists" },
          { status: 409 }
        );
      }

      const category = await prisma.riskSubCategory.create({
        data: {
          customerAccountId,
          type: type.trim(),
        },
      });

      return NextResponse.json(category, { status: 201 });
    } catch (error: unknown) {
      console.error("Error creating risk sub category:", error);
      if ((error as { code?: string }).code === "P2002") {
        return NextResponse.json(
          { error: "Sub category already exists" },
          { status: 409 }
        );
      }
      return NextResponse.json(
        { error: "Failed to create risk sub category" },
        { status: 500 }
      );
    }
  },
  { resource: "risk.settings", action: "create" }
);
