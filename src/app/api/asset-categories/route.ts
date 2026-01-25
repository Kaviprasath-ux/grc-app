import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth, getTenantFilter } from "@/lib/api-auth";

// Note: If TypeScript errors occur for customerAccountId, run: npx prisma generate

// GET all asset categories
export const GET = withAuth(
  async (_req, _context, session) => {
    try {
      const tenantFilter = getTenantFilter(session);

      const categories = await prisma.assetCategory.findMany({
        where: tenantFilter as Record<string, unknown>,
        include: {
          subCategories: true,
          _count: {
            select: { assets: true, subCategories: true },
          },
        },
        orderBy: { name: "asc" },
      });
      return NextResponse.json(categories);
    } catch (error) {
      console.error("Error fetching asset categories:", error);
      return NextResponse.json(
        { error: "Failed to fetch asset categories" },
        { status: 500 }
      );
    }
  },
  { resource: "asset.settings", action: "view" }
);

// POST create new asset category
export const POST = withAuth(
  async (req, _context, session) => {
    try {
      const body = await req.json();
      const { name, description, status } = body;

      if (!name?.trim()) {
        return NextResponse.json(
          { error: "Category name is required" },
          { status: 400 }
        );
      }

      // Get customer account ID for the new record
      // GRCAdministrators can create shared/master data without customerAccountId
      // Regular users must have a customerAccountId assigned
      let customerAccountId: string | null;
      if (session.roles.includes('GRCAdministrator')) {
        customerAccountId = session.customerAccountId || null;
      } else {
        if (!session.customerAccountId) {
          return NextResponse.json(
            { error: "User does not have a customer account assigned" },
            { status: 400 }
          );
        }
        customerAccountId = session.customerAccountId;
      }

      // Check for duplicate within the same tenant
      const existing = await prisma.assetCategory.findFirst({
        where: {
          name: name.trim(),
          customerAccountId,
        } as Record<string, unknown>,
      });

      if (existing) {
        return NextResponse.json(
          { error: "Category with this name already exists" },
          { status: 400 }
        );
      }

      const category = await prisma.assetCategory.create({
        data: {
          customerAccountId,
          name: name.trim(),
          description: description?.trim() || null,
          status: status || "Active",
        },
        include: {
          subCategories: true,
          _count: {
            select: { assets: true, subCategories: true },
          },
        },
      });

      return NextResponse.json(category, { status: 201 });
    } catch (error: unknown) {
      console.error("Error creating asset category:", error);
      if (error && typeof error === 'object' && 'code' in error && error.code === "P2002") {
        return NextResponse.json(
          { error: "Category with this name already exists" },
          { status: 400 }
        );
      }
      return NextResponse.json(
        { error: "Failed to create asset category" },
        { status: 500 }
      );
    }
  },
  { resource: "asset.settings", action: "create" }
);
