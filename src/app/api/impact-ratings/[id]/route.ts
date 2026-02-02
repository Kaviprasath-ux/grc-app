import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth, validateTenantAccess, forbidden } from "@/lib/api-auth";

interface RouteContext {
  params: Promise<{ id: string }>;
}

// PUT update impact rating - with tenant validation
export const PUT = withAuth(
  async (req: NextRequest, context: RouteContext, session) => {
    try {
      const { id } = await context.params;
      const body = await req.json();
      const { name, score, description } = body;

      if (!name?.trim()) {
        return NextResponse.json({ error: "Name is required" }, { status: 400 });
      }

      // Verify tenant access
      const existing = await prisma.impactRating.findUnique({
        where: { id },
        select: { customerAccountId: true },
      });

      if (!existing) {
        return NextResponse.json({ error: "Impact rating not found" }, { status: 404 });
      }

      if (!validateTenantAccess(session, existing.customerAccountId)) {
        return forbidden("Access denied to this impact rating");
      }

      const rating = await prisma.impactRating.update({
        where: { id },
        data: {
          name: name.trim(),
          score: parseInt(score) || 0,
          description: description?.trim() || null,
        },
      });

      return NextResponse.json(rating);
    } catch (error: unknown) {
      console.error("Error updating impact rating:", error);
      if ((error as { code?: string }).code === "P2025") {
        return NextResponse.json({ error: "Impact rating not found" }, { status: 404 });
      }
      return NextResponse.json(
        { error: "Failed to update impact rating" },
        { status: 500 }
      );
    }
  },
  { resource: "risk.settings", action: "edit" }
);

// DELETE impact rating - with tenant validation
export const DELETE = withAuth(
  async (req: NextRequest, context: RouteContext, session) => {
    try {
      const { id } = await context.params;

      // Verify tenant access
      const existing = await prisma.impactRating.findUnique({
        where: { id },
        select: { customerAccountId: true },
      });

      if (!existing) {
        return NextResponse.json({ error: "Impact rating not found" }, { status: 404 });
      }

      if (!validateTenantAccess(session, existing.customerAccountId)) {
        return forbidden("Access denied to this impact rating");
      }

      await prisma.impactRating.delete({ where: { id } });
      return NextResponse.json({ message: "Impact rating deleted successfully" });
    } catch (error: unknown) {
      console.error("Error deleting impact rating:", error);
      if ((error as { code?: string }).code === "P2025") {
        return NextResponse.json({ error: "Impact rating not found" }, { status: 404 });
      }
      return NextResponse.json(
        { error: "Failed to delete impact rating" },
        { status: 500 }
      );
    }
  },
  { resource: "risk.settings", action: "delete" }
);
