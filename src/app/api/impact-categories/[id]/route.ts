import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth, validateTenantAccess, forbidden } from "@/lib/api-auth";
import { translateRecord, deleteRecordTranslations } from '@/lib/translation-service';

interface RouteContext {
  params: Promise<{ id: string }>;
}

// PUT update impact category - with tenant validation
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
      const existing = await prisma.impactCategory.findUnique({
        where: { id },
        select: { customerAccountId: true },
      });

      if (!existing) {
        return NextResponse.json({ error: "Impact category not found" }, { status: 404 });
      }

      if (!validateTenantAccess(session, existing.customerAccountId)) {
        return forbidden("Access denied to this impact category");
      }

      const category = await prisma.impactCategory.update({
        where: { id },
        data: { name: name.trim() },
      });

      if (session.customerAccountId) void translateRecord(session.customerAccountId, 'ImpactCategory', category.id, { name: category.name });

      return NextResponse.json(category);
    } catch (error: unknown) {
      console.error("Error updating impact category:", error);
      if ((error as { code?: string }).code === "P2025") {
        return NextResponse.json({ error: "Impact category not found" }, { status: 404 });
      }
      return NextResponse.json(
        { error: "Failed to update impact category" },
        { status: 500 }
      );
    }
  },
  { resource: "risk.settings", action: "edit" }
);

// DELETE impact category - with tenant validation
export const DELETE = withAuth(
  async (req: NextRequest, context: RouteContext, session) => {
    try {
      const { id } = await context.params;

      // Verify tenant access
      const existing = await prisma.impactCategory.findUnique({
        where: { id },
        select: { customerAccountId: true },
      });

      if (!existing) {
        return NextResponse.json({ error: "Impact category not found" }, { status: 404 });
      }

      if (!validateTenantAccess(session, existing.customerAccountId)) {
        return forbidden("Access denied to this impact category");
      }

      await prisma.impactCategory.delete({ where: { id } });
      if (session.customerAccountId) void deleteRecordTranslations(session.customerAccountId, 'ImpactCategory', id);
      return NextResponse.json({ message: "Impact category deleted successfully" });
    } catch (error: unknown) {
      console.error("Error deleting impact category:", error);
      if ((error as { code?: string }).code === "P2025") {
        return NextResponse.json({ error: "Impact category not found" }, { status: 404 });
      }
      return NextResponse.json(
        { error: "Failed to delete impact category" },
        { status: 500 }
      );
    }
  },
  { resource: "risk.settings", action: "delete" }
);
