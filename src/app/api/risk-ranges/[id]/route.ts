import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth, validateTenantAccess, forbidden } from "@/lib/api-auth";
import { translateRecord, deleteRecordTranslations } from '@/lib/translation-service';

interface RouteContext {
  params: Promise<{ id: string }>;
}

// PUT update risk range - with tenant validation
export const PUT = withAuth(
  async (req: NextRequest, context: RouteContext, session) => {
    try {
      const { id } = await context.params;
      const body = await req.json();
      const { title, color, lowRange, highRange, timelineDays, description } = body;

      if (!title?.trim()) {
        return NextResponse.json({ error: "Title is required" }, { status: 400 });
      }

      // Verify tenant access
      const existing = await prisma.riskRange.findUnique({
        where: { id },
        select: { customerAccountId: true },
      });

      if (!existing) {
        return NextResponse.json({ error: "Risk range not found" }, { status: 404 });
      }

      if (!validateTenantAccess(session, existing.customerAccountId)) {
        return forbidden("Access denied to this risk range");
      }

      const range = await prisma.riskRange.update({
        where: { id },
        data: {
          title: title.trim(),
          color: color?.trim() || null,
          lowRange: parseInt(lowRange) || 0,
          highRange: parseInt(highRange) || 0,
          timelineDays: parseInt(timelineDays) || 0,
          description: description?.trim() || null,
        },
      });

      if (session.customerAccountId) void translateRecord(session.customerAccountId, 'RiskRange', range.id, { title: range.title, description: range.description });

      return NextResponse.json(range);
    } catch (error: unknown) {
      console.error("Error updating risk range:", error);
      if ((error as { code?: string }).code === "P2025") {
        return NextResponse.json({ error: "Risk range not found" }, { status: 404 });
      }
      return NextResponse.json(
        { error: "Failed to update risk range" },
        { status: 500 }
      );
    }
  },
  { resource: "risk.settings", action: "edit" }
);

// DELETE risk range - with tenant validation
export const DELETE = withAuth(
  async (req: NextRequest, context: RouteContext, session) => {
    try {
      const { id } = await context.params;

      // Verify tenant access
      const existing = await prisma.riskRange.findUnique({
        where: { id },
        select: { customerAccountId: true },
      });

      if (!existing) {
        return NextResponse.json({ error: "Risk range not found" }, { status: 404 });
      }

      if (!validateTenantAccess(session, existing.customerAccountId)) {
        return forbidden("Access denied to this risk range");
      }

      await prisma.riskRange.delete({ where: { id } });
      if (session.customerAccountId) void deleteRecordTranslations(session.customerAccountId, 'RiskRange', id);
      return NextResponse.json({ message: "Risk range deleted successfully" });
    } catch (error: unknown) {
      console.error("Error deleting risk range:", error);
      if ((error as { code?: string }).code === "P2025") {
        return NextResponse.json({ error: "Risk range not found" }, { status: 404 });
      }
      return NextResponse.json(
        { error: "Failed to delete risk range" },
        { status: 500 }
      );
    }
  },
  { resource: "risk.settings", action: "delete" }
);
