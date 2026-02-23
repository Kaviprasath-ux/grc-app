import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth, getTenantFilter } from "@/lib/api-auth";
import { translateRecord } from "@/lib/translation-service";

// GET all BIA categories
export const GET = withAuth(
  async (req, _context, session) => {
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

// POST create new BIA category
export const POST = withAuth(
  async (req, _context, session) => {
    try {
      const body = await req.json();
      const { name, description, sortOrder, isActive } = body;
      const customerAccountId = session.customerAccountId;

      if (!customerAccountId) {
        return NextResponse.json(
          { error: "Customer account not found" },
          { status: 400 }
        );
      }

      if (!name?.trim()) {
        return NextResponse.json(
          { error: "Category name is required" },
          { status: 400 }
        );
      }

      const category = await prisma.bIACategory.create({
        data: {
          name: name.trim(),
          description: description?.trim() || null,
          sortOrder: sortOrder ?? 0,
          isActive: isActive ?? true,
          customerAccountId,
        },
      });

      if (customerAccountId) {
        void translateRecord(customerAccountId, 'BIACategory', category.id, { name: category.name, description: category.description ?? undefined });
      }

      return NextResponse.json(category, { status: 201 });
    } catch (error: unknown) {
      console.error("Error creating BIA category:", error);
      if (error && typeof error === 'object' && 'code' in error && error.code === "P2002") {
        return NextResponse.json(
          { error: "Category with this name already exists" },
          { status: 400 }
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
