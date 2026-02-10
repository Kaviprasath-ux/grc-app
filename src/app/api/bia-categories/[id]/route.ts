import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth, getTenantFilter } from "@/lib/api-auth";

interface RouteContext {
  params: Promise<{ id: string }>;
}

// GET single BIA category - with tenant isolation
export const GET = withAuth(
  async (req, context: RouteContext, session) => {
    try {
      const { id } = await context.params;
      const tenantFilter = getTenantFilter(session);

      const category = await prisma.bIACategory.findFirst({
        where: { id, ...tenantFilter },
      });

      if (!category) {
        return NextResponse.json(
          { error: "BIA category not found" },
          { status: 404 }
        );
      }

      return NextResponse.json(category);
    } catch (error) {
      console.error("Error fetching BIA category:", error);
      return NextResponse.json(
        { error: "Failed to fetch BIA category" },
        { status: 500 }
      );
    }
  },
  { resource: "organization.bia", action: "view" }
);

// PUT update BIA category - with tenant isolation
export const PUT = withAuth(
  async (req, context: RouteContext, session) => {
    try {
      const { id } = await context.params;
      const body = await req.json();
      const { name, description, sortOrder, isActive } = body;
      const tenantFilter = getTenantFilter(session);

      // Verify the category belongs to the tenant
      const existing = await prisma.bIACategory.findFirst({
        where: { id, ...tenantFilter },
      });

      if (!existing) {
        return NextResponse.json(
          { error: "BIA category not found" },
          { status: 404 }
        );
      }

      const category = await prisma.bIACategory.update({
        where: { id },
        data: {
          ...(name !== undefined && { name }),
          ...(description !== undefined && { description }),
          ...(sortOrder !== undefined && { sortOrder }),
          ...(isActive !== undefined && { isActive }),
        },
      });

      return NextResponse.json(category);
    } catch (error: unknown) {
      console.error("Error updating BIA category:", error);
      if (error && typeof error === "object" && "code" in error && error.code === "P2002") {
        return NextResponse.json(
          { error: "A category with this name already exists" },
          { status: 409 }
        );
      }
      return NextResponse.json(
        { error: "Failed to update BIA category" },
        { status: 500 }
      );
    }
  },
  { resource: "organization.bia", action: "edit" }
);

// DELETE BIA category - with tenant isolation
export const DELETE = withAuth(
  async (req, context: RouteContext, session) => {
    try {
      const { id } = await context.params;
      const tenantFilter = getTenantFilter(session);

      // Verify the category belongs to the tenant
      const existing = await prisma.bIACategory.findFirst({
        where: { id, ...tenantFilter },
      });

      if (!existing) {
        return NextResponse.json(
          { error: "BIA category not found" },
          { status: 404 }
        );
      }

      await prisma.bIACategory.delete({
        where: { id },
      });

      return NextResponse.json({ message: "BIA category deleted successfully" });
    } catch (error) {
      console.error("Error deleting BIA category:", error);
      return NextResponse.json(
        { error: "Failed to delete BIA category" },
        { status: 500 }
      );
    }
  },
  { resource: "organization.bia", action: "delete" }
);
