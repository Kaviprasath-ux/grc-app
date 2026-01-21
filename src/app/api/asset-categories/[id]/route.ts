import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth, validateTenantAccess } from "@/lib/api-auth";

interface RouteContext {
  params: Promise<{ id: string }>;
}

// PUT update asset category
export const PUT = withAuth(
  async (req, context: RouteContext, session) => {
    try {
      const { id } = await context.params;
      const body = await req.json();
      const { name, description, status } = body;

      if (!name?.trim()) {
        return NextResponse.json(
          { error: "Category name is required" },
          { status: 400 }
        );
      }

      // Verify the category exists and belongs to the user's tenant
      const existingCategory = await prisma.assetCategory.findUnique({
        where: { id },
      });

      if (!existingCategory) {
        return NextResponse.json(
          { error: "Category not found" },
          { status: 404 }
        );
      }

      if (!validateTenantAccess(session, existingCategory.customerAccountId)) {
        return NextResponse.json(
          { error: "Access denied" },
          { status: 403 }
        );
      }

      const category = await prisma.assetCategory.update({
        where: { id },
        data: {
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

      return NextResponse.json(category);
    } catch (error: unknown) {
      console.error("Error updating asset category:", error);
      if (error && typeof error === 'object' && 'code' in error && error.code === "P2002") {
        return NextResponse.json(
          { error: "Category with this name already exists" },
          { status: 400 }
        );
      }
      return NextResponse.json(
        { error: "Failed to update asset category" },
        { status: 500 }
      );
    }
  },
  { resource: "asset.settings", action: "edit" }
);

// DELETE asset category
export const DELETE = withAuth(
  async (req, context: RouteContext, session) => {
    try {
      const { id } = await context.params;

      // Verify the category exists and belongs to the user's tenant
      const existingCategory = await prisma.assetCategory.findUnique({
        where: { id },
      });

      if (!existingCategory) {
        return NextResponse.json(
          { error: "Category not found" },
          { status: 404 }
        );
      }

      if (!validateTenantAccess(session, existingCategory.customerAccountId)) {
        return NextResponse.json(
          { error: "Access denied" },
          { status: 403 }
        );
      }

      await prisma.assetCategory.delete({
        where: { id },
      });
      return NextResponse.json({ success: true });
    } catch (error) {
      console.error("Error deleting asset category:", error);
      return NextResponse.json(
        { error: "Failed to delete asset category" },
        { status: 500 }
      );
    }
  },
  { resource: "asset.settings", action: "delete" }
);
