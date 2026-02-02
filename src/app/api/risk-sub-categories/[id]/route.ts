import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth, validateTenantAccess, forbidden } from "@/lib/api-auth";

interface RouteContext {
  params: Promise<{ id: string }>;
}

// PUT update risk sub category - with tenant validation
export const PUT = withAuth(
  async (req: NextRequest, context: RouteContext, session) => {
    try {
      const { id } = await context.params;
      const body = await req.json();
      const { type } = body;

      if (!type?.trim()) {
        return NextResponse.json({ error: "Type is required" }, { status: 400 });
      }

      // Verify tenant access
      const existing = await prisma.riskSubCategory.findUnique({
        where: { id },
        select: { customerAccountId: true },
      });

      if (!existing) {
        return NextResponse.json({ error: "Risk sub category not found" }, { status: 404 });
      }

      if (!validateTenantAccess(session, existing.customerAccountId)) {
        return forbidden("Access denied to this risk sub category");
      }

      const category = await prisma.riskSubCategory.update({
        where: { id },
        data: { type: type.trim() },
      });

      return NextResponse.json(category);
    } catch (error: unknown) {
      console.error("Error updating risk sub category:", error);
      if ((error as { code?: string }).code === "P2025") {
        return NextResponse.json({ error: "Risk sub category not found" }, { status: 404 });
      }
      return NextResponse.json(
        { error: "Failed to update risk sub category" },
        { status: 500 }
      );
    }
  },
  { resource: "risk.settings", action: "edit" }
);

// DELETE risk sub category - with tenant validation
export const DELETE = withAuth(
  async (req: NextRequest, context: RouteContext, session) => {
    try {
      const { id } = await context.params;

      // Verify tenant access
      const existing = await prisma.riskSubCategory.findUnique({
        where: { id },
        select: { customerAccountId: true },
      });

      if (!existing) {
        return NextResponse.json({ error: "Risk sub category not found" }, { status: 404 });
      }

      if (!validateTenantAccess(session, existing.customerAccountId)) {
        return forbidden("Access denied to this risk sub category");
      }

      await prisma.riskSubCategory.delete({ where: { id } });
      return NextResponse.json({ message: "Risk sub category deleted successfully" });
    } catch (error: unknown) {
      console.error("Error deleting risk sub category:", error);
      if ((error as { code?: string }).code === "P2025") {
        return NextResponse.json({ error: "Risk sub category not found" }, { status: 404 });
      }
      return NextResponse.json(
        { error: "Failed to delete risk sub category" },
        { status: 500 }
      );
    }
  },
  { resource: "risk.settings", action: "delete" }
);
