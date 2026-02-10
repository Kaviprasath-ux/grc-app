import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth, getTenantFilter } from "@/lib/api-auth";

interface RouteContext {
  params: Promise<{ id: string }>;
}

// GET single BIA scoring range - with tenant isolation
export const GET = withAuth(
  async (req, context: RouteContext, session) => {
    try {
      const { id } = await context.params;
      const tenantFilter = getTenantFilter(session);

      const range = await prisma.bIAScoringRange.findFirst({
        where: { id, ...tenantFilter },
      });

      if (!range) {
        return NextResponse.json(
          { error: "BIA scoring range not found" },
          { status: 404 }
        );
      }

      return NextResponse.json(range);
    } catch (error) {
      console.error("Error fetching BIA scoring range:", error);
      return NextResponse.json(
        { error: "Failed to fetch BIA scoring range" },
        { status: 500 }
      );
    }
  },
  { resource: "organization.bia", action: "view" }
);

// PUT update BIA scoring range - with tenant isolation
export const PUT = withAuth(
  async (req, context: RouteContext, session) => {
    try {
      const { id } = await context.params;
      const body = await req.json();
      const { label, lowValue, highValue, color, calculationType, sortOrder } = body;
      const tenantFilter = getTenantFilter(session);

      // Verify the range belongs to the tenant
      const existing = await prisma.bIAScoringRange.findFirst({
        where: { id, ...tenantFilter },
      });

      if (!existing) {
        return NextResponse.json(
          { error: "BIA scoring range not found" },
          { status: 404 }
        );
      }

      const range = await prisma.bIAScoringRange.update({
        where: { id },
        data: {
          ...(label !== undefined && { label }),
          ...(lowValue !== undefined && { lowValue }),
          ...(highValue !== undefined && { highValue }),
          ...(color !== undefined && { color }),
          ...(calculationType !== undefined && { calculationType }),
          ...(sortOrder !== undefined && { sortOrder }),
        },
      });

      return NextResponse.json(range);
    } catch (error: unknown) {
      console.error("Error updating BIA scoring range:", error);
      if (error && typeof error === "object" && "code" in error && error.code === "P2002") {
        return NextResponse.json(
          { error: "A range with this label and calculation type already exists" },
          { status: 409 }
        );
      }
      return NextResponse.json(
        { error: "Failed to update BIA scoring range" },
        { status: 500 }
      );
    }
  },
  { resource: "organization.bia", action: "edit" }
);

// DELETE BIA scoring range - with tenant isolation
export const DELETE = withAuth(
  async (req, context: RouteContext, session) => {
    try {
      const { id } = await context.params;
      const tenantFilter = getTenantFilter(session);

      // Verify the range belongs to the tenant
      const existing = await prisma.bIAScoringRange.findFirst({
        where: { id, ...tenantFilter },
      });

      if (!existing) {
        return NextResponse.json(
          { error: "BIA scoring range not found" },
          { status: 404 }
        );
      }

      await prisma.bIAScoringRange.delete({
        where: { id },
      });

      return NextResponse.json({ message: "BIA scoring range deleted successfully" });
    } catch (error) {
      console.error("Error deleting BIA scoring range:", error);
      return NextResponse.json(
        { error: "Failed to delete BIA scoring range" },
        { status: 500 }
      );
    }
  },
  { resource: "organization.bia", action: "delete" }
);
