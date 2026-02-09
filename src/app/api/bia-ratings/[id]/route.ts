import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth, getTenantFilter } from "@/lib/api-auth";

// GET single BIA rating - with tenant isolation
export const GET = withAuth(
  async (req, context, session) => {
    try {
      const { id } = await context.params;
      const tenantFilter = getTenantFilter(session);

      const rating = await prisma.bIARating.findFirst({
        where: { id, ...tenantFilter },
      });

      if (!rating) {
        return NextResponse.json(
          { error: "BIA rating not found" },
          { status: 404 }
        );
      }

      return NextResponse.json(rating);
    } catch (error) {
      console.error("Error fetching BIA rating:", error);
      return NextResponse.json(
        { error: "Failed to fetch BIA rating" },
        { status: 500 }
      );
    }
  },
  { resource: "organization.bia", action: "view" }
);

// PUT update BIA rating - with tenant isolation
export const PUT = withAuth(
  async (req, context, session) => {
    try {
      const { id } = await context.params;
      const body = await req.json();
      const { label, score, description, color, sortOrder, isActive } = body;
      const tenantFilter = getTenantFilter(session);

      // Verify the rating belongs to the tenant
      const existing = await prisma.bIARating.findFirst({
        where: { id, ...tenantFilter },
      });

      if (!existing) {
        return NextResponse.json(
          { error: "BIA rating not found" },
          { status: 404 }
        );
      }

      const rating = await prisma.bIARating.update({
        where: { id },
        data: {
          ...(label !== undefined && { label }),
          ...(score !== undefined && { score }),
          ...(description !== undefined && { description }),
          ...(color !== undefined && { color }),
          ...(sortOrder !== undefined && { sortOrder }),
          ...(isActive !== undefined && { isActive }),
        },
      });

      return NextResponse.json(rating);
    } catch (error: unknown) {
      console.error("Error updating BIA rating:", error);
      if (error && typeof error === "object" && "code" in error && error.code === "P2002") {
        return NextResponse.json(
          { error: "A rating with this label already exists" },
          { status: 409 }
        );
      }
      return NextResponse.json(
        { error: "Failed to update BIA rating" },
        { status: 500 }
      );
    }
  },
  { resource: "organization.bia", action: "edit" }
);

// DELETE BIA rating - with tenant isolation
export const DELETE = withAuth(
  async (req, context, session) => {
    try {
      const { id } = await context.params;
      const tenantFilter = getTenantFilter(session);

      // Verify the rating belongs to the tenant
      const existing = await prisma.bIARating.findFirst({
        where: { id, ...tenantFilter },
      });

      if (!existing) {
        return NextResponse.json(
          { error: "BIA rating not found" },
          { status: 404 }
        );
      }

      await prisma.bIARating.delete({
        where: { id },
      });

      return NextResponse.json({ message: "BIA rating deleted successfully" });
    } catch (error) {
      console.error("Error deleting BIA rating:", error);
      return NextResponse.json(
        { error: "Failed to delete BIA rating" },
        { status: 500 }
      );
    }
  },
  { resource: "organization.bia", action: "delete" }
);
