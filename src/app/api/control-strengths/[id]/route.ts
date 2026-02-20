import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth, validateTenantAccess, forbidden } from "@/lib/api-auth";
import { translateRecord, deleteRecordTranslations } from '@/lib/translation-service';

interface RouteContext {
  params: Promise<{ id: string }>;
}

// PUT update control strength - with tenant validation
export const PUT = withAuth(
  async (req: NextRequest, context: RouteContext, session) => {
    try {
      const { id } = await context.params;
      const body = await req.json();
      const { name, score } = body;

      if (!name?.trim()) {
        return NextResponse.json({ error: "Name is required" }, { status: 400 });
      }

      // Verify tenant access
      const existing = await prisma.controlStrength.findUnique({
        where: { id },
        select: { customerAccountId: true },
      });

      if (!existing) {
        return NextResponse.json({ error: "Control strength not found" }, { status: 404 });
      }

      if (!validateTenantAccess(session, existing.customerAccountId)) {
        return forbidden("Access denied to this control strength");
      }

      const strength = await prisma.controlStrength.update({
        where: { id },
        data: {
          name: name.trim(),
          score: parseInt(score) || 0,
        },
      });

      if (session.customerAccountId) void translateRecord(session.customerAccountId, 'ControlStrength', strength.id, { name: strength.name });

      return NextResponse.json(strength);
    } catch (error: unknown) {
      console.error("Error updating control strength:", error);
      if ((error as { code?: string }).code === "P2025") {
        return NextResponse.json({ error: "Control strength not found" }, { status: 404 });
      }
      return NextResponse.json(
        { error: "Failed to update control strength" },
        { status: 500 }
      );
    }
  },
  { resource: "risk.settings", action: "edit" }
);

// DELETE control strength - with tenant validation
export const DELETE = withAuth(
  async (req: NextRequest, context: RouteContext, session) => {
    try {
      const { id } = await context.params;

      // Verify tenant access
      const existing = await prisma.controlStrength.findUnique({
        where: { id },
        select: { customerAccountId: true },
      });

      if (!existing) {
        return NextResponse.json({ error: "Control strength not found" }, { status: 404 });
      }

      if (!validateTenantAccess(session, existing.customerAccountId)) {
        return forbidden("Access denied to this control strength");
      }

      await prisma.controlStrength.delete({ where: { id } });
      if (session.customerAccountId) void deleteRecordTranslations(session.customerAccountId, 'ControlStrength', id);
      return NextResponse.json({ message: "Control strength deleted successfully" });
    } catch (error: unknown) {
      console.error("Error deleting control strength:", error);
      if ((error as { code?: string }).code === "P2025") {
        return NextResponse.json({ error: "Control strength not found" }, { status: 404 });
      }
      return NextResponse.json(
        { error: "Failed to delete control strength" },
        { status: 500 }
      );
    }
  },
  { resource: "risk.settings", action: "delete" }
);
