import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth, getTenantFilter } from "@/lib/api-auth";

// GET all asset sub-categories
export const GET = withAuth(
  async (_req, _context, session) => {
    try {
      const tenantFilter = getTenantFilter(session);

      const subCategories = await prisma.assetSubCategory.findMany({
        where: tenantFilter as Record<string, unknown>,
        include: {
          category: true,
          _count: {
            select: { assets: true },
          },
        },
        orderBy: [{ category: { name: "asc" } }, { name: "asc" }],
      });
      return NextResponse.json(subCategories);
    } catch (error) {
      console.error("Error fetching asset sub-categories:", error);
      return NextResponse.json(
        { error: "Failed to fetch asset sub-categories" },
        { status: 500 }
      );
    }
  },
  { resource: "asset.inventory", action: "view" }
);

// POST create new asset sub-category
export const POST = withAuth(
  async (req, _context, session) => {
    try {
      const body = await req.json();
      const { name, description, categoryId, status } = body;

      if (!name?.trim()) {
        return NextResponse.json(
          { error: "Sub-category name is required" },
          { status: 400 }
        );
      }

      if (!categoryId) {
        return NextResponse.json(
          { error: "Category is required" },
          { status: 400 }
        );
      }

      // Get customer account ID for the new record
      const customerAccountId = session.customerAccountId || null;

      const subCategory = await prisma.assetSubCategory.create({
        data: {
          name: name.trim(),
          description: description?.trim() || null,
          categoryId,
          status: status || "Active",
          customerAccountId,
        },
        include: {
          category: true,
          _count: {
            select: { assets: true },
          },
        },
      });

      return NextResponse.json(subCategory, { status: 201 });
    } catch (error: unknown) {
      console.error("Error creating asset sub-category:", error);
      if (error && typeof error === 'object' && 'code' in error && error.code === "P2002") {
        return NextResponse.json(
          { error: "Sub-category with this name already exists in this category" },
          { status: 400 }
        );
      }
      return NextResponse.json(
        { error: "Failed to create asset sub-category" },
        { status: 500 }
      );
    }
  },
  { resource: "asset.settings", action: "create" }
);
