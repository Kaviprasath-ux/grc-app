import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth, validateTenantAccess, forbidden } from "@/lib/api-auth";
import { translateRecord, deleteRecordTranslations } from '@/lib/translation-service';

interface RouteContext {
  params: Promise<{ id: string }>;
}

// GET a single risk category - with tenant validation
export const GET = withAuth(
  async (req: NextRequest, context: RouteContext, session) => {
    try {
      const { id } = await context.params;

      const category = await prisma.riskCategory.findUnique({
        where: { id },
        include: {
          risks: {
            select: {
              id: true,
              riskId: true,
              name: true,
              riskRating: true,
              status: true,
            },
          },
          _count: {
            select: { risks: true },
          },
        },
      });

      if (!category) {
        return NextResponse.json(
          { error: "Risk category not found" },
          { status: 404 }
        );
      }

      if (!validateTenantAccess(session, category.customerAccountId)) {
        return forbidden("Access denied to this risk category");
      }

      return NextResponse.json(category);
    } catch (error) {
      console.error("Error fetching risk category:", error);
      return NextResponse.json(
        { error: "Failed to fetch risk category" },
        { status: 500 }
      );
    }
  },
  { resource: "risk.settings", action: "view" }
);

// PUT update a risk category - with tenant validation
export const PUT = withAuth(
  async (req: NextRequest, context: RouteContext, session) => {
    try {
      const { id } = await context.params;
      const body = await req.json();
      const { name, description, color } = body;

      // Verify tenant access
      const existing = await prisma.riskCategory.findUnique({
        where: { id },
        select: { customerAccountId: true, name: true },
      });

      if (!existing) {
        return NextResponse.json(
          { error: "Risk category not found" },
          { status: 404 }
        );
      }

      if (!validateTenantAccess(session, existing.customerAccountId)) {
        return forbidden("Access denied to this risk category");
      }

      // Check for duplicate name if name is being changed
      if (name && name !== existing.name) {
        const duplicate = await prisma.riskCategory.findFirst({
          where: {
            name: name.trim(),
            customerAccountId: existing.customerAccountId,
            id: { not: id },
          },
        });
        if (duplicate) {
          return NextResponse.json(
            { error: "Category with this name already exists" },
            { status: 409 }
          );
        }
      }

      const category = await prisma.riskCategory.update({
        where: { id },
        data: {
          name: name?.trim(),
          description: description?.trim() || null,
          color: color?.trim() || null,
        },
      });

      if (session.customerAccountId) void translateRecord(session.customerAccountId, 'RiskCategory', category.id, { name: category.name, description: category.description });

      return NextResponse.json(category);
    } catch (error: unknown) {
      console.error("Error updating risk category:", error);
      if ((error as { code?: string }).code === "P2025") {
        return NextResponse.json(
          { error: "Risk category not found" },
          { status: 404 }
        );
      }
      return NextResponse.json(
        { error: "Failed to update risk category" },
        { status: 500 }
      );
    }
  },
  { resource: "risk.settings", action: "edit" }
);

// DELETE a risk category - with tenant validation
export const DELETE = withAuth(
  async (req: NextRequest, context: RouteContext, session) => {
    try {
      const { id } = await context.params;

      // Verify tenant access
      const existing = await prisma.riskCategory.findUnique({
        where: { id },
        include: { _count: { select: { risks: true } } },
      });

      if (!existing) {
        return NextResponse.json(
          { error: "Risk category not found" },
          { status: 404 }
        );
      }

      if (!validateTenantAccess(session, existing.customerAccountId)) {
        return forbidden("Access denied to this risk category");
      }

      if (existing._count.risks > 0) {
        return NextResponse.json(
          { error: "Cannot delete category with associated risks" },
          { status: 400 }
        );
      }

      await prisma.riskCategory.delete({ where: { id } });
      if (session.customerAccountId) void deleteRecordTranslations(session.customerAccountId, 'RiskCategory', id);

      return NextResponse.json({ message: "Risk category deleted successfully" });
    } catch (error: unknown) {
      console.error("Error deleting risk category:", error);
      if ((error as { code?: string }).code === "P2025") {
        return NextResponse.json(
          { error: "Risk category not found" },
          { status: 404 }
        );
      }
      return NextResponse.json(
        { error: "Failed to delete risk category" },
        { status: 500 }
      );
    }
  },
  { resource: "risk.settings", action: "delete" }
);
