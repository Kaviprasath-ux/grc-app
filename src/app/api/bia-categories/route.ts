import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth, getTenantFilter, getCustomerAccountId } from "@/lib/api-auth";
import { translateRecord } from '@/lib/translation-service';

// GET all BIA categories - filtered by customer account
export const GET = withAuth(
  async (req, context, session) => {
    try {
      const tenantFilter = getTenantFilter(session);
      const categories = await prisma.bIACategory.findMany({
        where: tenantFilter,
        orderBy: { sortOrder: "asc" },
      });
      return NextResponse.json(categories);
    } catch (error) {
      console.error("Error fetching BIA categories:", error);
      return NextResponse.json(
        { error: "Failed to fetch BIA categories" },
        { status: 500 }
      );
    }
  },
  { resource: "organization.bia", action: "view" }
);

// POST create new BIA category - with customer account assignment
export const POST = withAuth(
  async (req, context, session) => {
    try {
      const body = await req.json();
      const { name, description, sortOrder } = body;

      if (!name) {
        return NextResponse.json(
          { error: "Name is required" },
          { status: 400 }
        );
      }

      const customerAccountId = getCustomerAccountId(session);
      const tenantFilter = getTenantFilter(session);

      // Get the max sortOrder if not provided
      let order = sortOrder;
      if (order === undefined) {
        const maxOrder = await prisma.bIACategory.findFirst({
          where: tenantFilter,
          orderBy: { sortOrder: "desc" },
          select: { sortOrder: true },
        });
        order = (maxOrder?.sortOrder ?? -1) + 1;
      }

      const category = await prisma.bIACategory.create({
        data: {
          customerAccountId,
          name,
          description,
          sortOrder: order,
          isActive: true,
        },
      });

      if (customerAccountId) void translateRecord(customerAccountId, 'BIACategory', category.id, { name: category.name, description: category.description });

      return NextResponse.json(category, { status: 201 });
    } catch (error: unknown) {
      console.error("Error creating BIA category:", error);
      if (error && typeof error === "object" && "code" in error && error.code === "P2002") {
        return NextResponse.json(
          { error: "A category with this name already exists" },
          { status: 409 }
        );
      }
      return NextResponse.json(
        { error: "Failed to create BIA category" },
        { status: 500 }
      );
    }
  },
  { resource: "organization.bia", action: "create" }
);
