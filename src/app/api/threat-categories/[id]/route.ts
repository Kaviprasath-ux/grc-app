import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth, validateTenantAccess, forbidden } from "@/lib/api-auth";

interface RouteContext {
  params: Promise<{ id: string }>;
}

// GET single threat category - with tenant validation
export const GET = withAuth(
  async (req: NextRequest, context: RouteContext, session) => {
    try {
      const { id } = await context.params;
      const category = await prisma.threatCategory.findUnique({
        where: { id },
        include: {
          _count: { select: { threats: true } },
        },
      });

      if (!category) {
        return NextResponse.json({ error: "Category not found" }, { status: 404 });
      }

      if (!validateTenantAccess(session, category.customerAccountId)) {
        return forbidden("Access denied to this threat category");
      }

      return NextResponse.json(category);
    } catch (error) {
      console.error("Error fetching threat category:", error);
      return NextResponse.json(
        { error: "Failed to fetch threat category" },
        { status: 500 }
      );
    }
  },
  { resource: "risk.settings", action: "view" }
);

// PUT update threat category - with tenant validation
export const PUT = withAuth(
  async (req: NextRequest, context: RouteContext, session) => {
    try {
      const { id } = await context.params;
      const body = await req.json();
      const { name } = body;

      if (!name?.trim()) {
        return NextResponse.json({ error: "Name is required" }, { status: 400 });
      }

      // Verify tenant access
      const existing = await prisma.threatCategory.findUnique({
        where: { id },
        select: { customerAccountId: true },
      });

      if (!existing) {
        return NextResponse.json({ error: "Category not found" }, { status: 404 });
      }

      if (!validateTenantAccess(session, existing.customerAccountId)) {
        return forbidden("Access denied to this threat category");
      }

      const category = await prisma.threatCategory.update({
        where: { id },
        data: { name: name.trim() },
      });

      return NextResponse.json(category);
    } catch (error: unknown) {
      console.error("Error updating threat category:", error);
      if ((error as { code?: string }).code === "P2025") {
        return NextResponse.json({ error: "Category not found" }, { status: 404 });
      }
      return NextResponse.json(
        { error: "Failed to update threat category" },
        { status: 500 }
      );
    }
  },
  { resource: "risk.settings", action: "edit" }
);

// DELETE threat category - with tenant validation
export const DELETE = withAuth(
  async (req: NextRequest, context: RouteContext, session) => {
    try {
      const { id } = await context.params;

      // Verify tenant access
      const existing = await prisma.threatCategory.findUnique({
        where: { id },
        select: { customerAccountId: true },
      });

      if (!existing) {
        return NextResponse.json({ error: "Category not found" }, { status: 404 });
      }

      if (!validateTenantAccess(session, existing.customerAccountId)) {
        return forbidden("Access denied to this threat category");
      }

      await prisma.threatCategory.delete({ where: { id } });
      return NextResponse.json({ message: "Category deleted successfully" });
    } catch (error: unknown) {
      console.error("Error deleting threat category:", error);
      if ((error as { code?: string }).code === "P2025") {
        return NextResponse.json({ error: "Category not found" }, { status: 404 });
      }
      return NextResponse.json(
        { error: "Failed to delete threat category" },
        { status: 500 }
      );
    }
  },
  { resource: "risk.settings", action: "delete" }
);
