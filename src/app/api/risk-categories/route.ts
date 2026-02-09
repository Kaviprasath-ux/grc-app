import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth, getTenantFilter, getCustomerAccountId } from "@/lib/api-auth";

// GET all risk categories - with tenant filtering
// GRC Admins get global access to view all categories across tenants
export const GET = withAuth(
  async (req: NextRequest, context, session) => {
    try {
      const tenantFilter = getTenantFilter(session, { globalAccess: true });

      const categories = await prisma.riskCategory.findMany({
        where: tenantFilter,
        include: {
          _count: {
            select: { risks: true },
          },
        },
        orderBy: { name: "asc" },
      });

      return NextResponse.json(categories);
    } catch (error) {
      console.error("Error fetching risk categories:", error);
      return NextResponse.json(
        { error: "Failed to fetch risk categories" },
        { status: 500 }
      );
    }
  },
  { resource: "risk.settings", action: "view" }
);

// POST create risk category - with tenant assignment
export const POST = withAuth(
  async (req: NextRequest, context, session) => {
    try {
      const customerAccountId = getCustomerAccountId(session);
      const body = await req.json();
      const { name, description, color } = body;

      if (!name?.trim()) {
        return NextResponse.json(
          { error: "Category name is required" },
          { status: 400 }
        );
      }

      // Check for duplicate within tenant
      const existing = await prisma.riskCategory.findFirst({
        where: {
          customerAccountId,
          name: name.trim(),
        },
      });

      if (existing) {
        return NextResponse.json(
          { error: "Category with this name already exists" },
          { status: 409 }
        );
      }

      const category = await prisma.riskCategory.create({
        data: {
          customerAccountId,
          name: name.trim(),
          description: description?.trim() || null,
          color: color?.trim() || null,
        },
      });

      return NextResponse.json(category, { status: 201 });
    } catch (error: unknown) {
      console.error("Error creating risk category:", error);
      if ((error as { code?: string }).code === "P2002") {
        return NextResponse.json(
          { error: "Category with this name already exists" },
          { status: 409 }
        );
      }
      return NextResponse.json(
        { error: "Failed to create risk category" },
        { status: 500 }
      );
    }
  },
  { resource: "risk.settings", action: "create" }
);
