import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth, getTenantFilter } from "@/lib/api-auth";

// GET all asset groups
export const GET = withAuth(
  async (_req, _context, session) => {
    try {
      const tenantFilter = getTenantFilter(session);

      const groups = await prisma.assetGroup.findMany({
        where: tenantFilter as Record<string, unknown>,
        include: {
          subCategory: true,
          _count: {
            select: { assets: true, assetCIAClassifications: true },
          },
        },
        orderBy: { name: "asc" },
      });
      return NextResponse.json(groups);
    } catch (error) {
      console.error("Error fetching asset groups:", error);
      return NextResponse.json(
        { error: "Failed to fetch asset groups" },
        { status: 500 }
      );
    }
  },
  { resource: "asset.inventory", action: "view" }
);

// POST create new asset group
export const POST = withAuth(
  async (req, _context, session) => {
    try {
      const body = await req.json();
      const { name, description, status, subCategoryId } = body;

      if (!name?.trim()) {
        return NextResponse.json(
          { error: "Group name is required" },
          { status: 400 }
        );
      }

      // Get customer account ID for the new record
      const customerAccountId = session.customerAccountId || null;

      // Check for duplicate within the same tenant
      const existing = await prisma.assetGroup.findFirst({
        where: {
          name: name.trim(),
          customerAccountId,
        },
      });

      if (existing) {
        return NextResponse.json(
          { error: "Group with this name already exists" },
          { status: 400 }
        );
      }

      const group = await prisma.assetGroup.create({
        data: {
          name: name.trim(),
          description: description?.trim() || null,
          status: status || "Active",
          subCategoryId: subCategoryId || null,
          customerAccountId,
        },
        include: {
          subCategory: true,
          _count: {
            select: { assets: true, assetCIAClassifications: true },
          },
        },
      });

      return NextResponse.json(group, { status: 201 });
    } catch (error: unknown) {
      console.error("Error creating asset group:", error);
      if (error && typeof error === 'object' && 'code' in error && error.code === "P2002") {
        return NextResponse.json(
          { error: "Group with this name already exists" },
          { status: 400 }
        );
      }
      return NextResponse.json(
        { error: "Failed to create asset group" },
        { status: 500 }
      );
    }
  },
  { resource: "asset.settings", action: "create" }
);
