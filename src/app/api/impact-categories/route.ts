import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth, getTenantFilter, getCustomerAccountId } from "@/lib/api-auth";

// GET all impact categories - with tenant filtering
export const GET = withAuth(
  async (req: NextRequest, context, session) => {
    try {
      const tenantFilter = getTenantFilter(session);

      const categories = await prisma.impactCategory.findMany({
        where: tenantFilter,
        orderBy: { name: "asc" },
      });
      return NextResponse.json(categories);
    } catch (error) {
      console.error("Error fetching impact categories:", error);
      return NextResponse.json(
        { error: "Failed to fetch impact categories" },
        { status: 500 }
      );
    }
  },
  { resource: "risk.settings", action: "view" }
);

// POST create impact category - with tenant assignment
export const POST = withAuth(
  async (req: NextRequest, context, session) => {
    try {
      const customerAccountId = getCustomerAccountId(session);
      const body = await req.json();
      const { name } = body;

      if (!name?.trim()) {
        return NextResponse.json(
          { error: "Name is required" },
          { status: 400 }
        );
      }

      // Check for duplicate within tenant
      const existing = await prisma.impactCategory.findFirst({
        where: {
          customerAccountId,
          name: name.trim(),
        },
      });

      if (existing) {
        return NextResponse.json(
          { error: "Category already exists" },
          { status: 409 }
        );
      }

      const category = await prisma.impactCategory.create({
        data: {
          customerAccountId,
          name: name.trim(),
        },
      });

      return NextResponse.json(category, { status: 201 });
    } catch (error: unknown) {
      console.error("Error creating impact category:", error);
      if ((error as { code?: string }).code === "P2002") {
        return NextResponse.json(
          { error: "Category already exists" },
          { status: 409 }
        );
      }
      return NextResponse.json(
        { error: "Failed to create impact category" },
        { status: 500 }
      );
    }
  },
  { resource: "risk.settings", action: "create" }
);
