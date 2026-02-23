import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth, validateTenantAccess } from "@/lib/api-auth";
import { translateRecord, deleteRecordTranslations } from '@/lib/translation-service';

interface RouteContext {
  params: Promise<{ id: string }>;
}

// PUT update a designation
export const PUT = withAuth(
  async (req: NextRequest, context: RouteContext, session) => {
    try {
      const { id } = await context.params;
      const body = await req.json();
      const { name } = body;

      if (!name) {
        return NextResponse.json(
          { error: "Name is required" },
          { status: 400 }
        );
      }

      const designation = await prisma.designation.findUnique({
        where: { id },
      });

      if (!designation) {
        return NextResponse.json(
          { error: "Designation not found" },
          { status: 404 }
        );
      }

      if (!validateTenantAccess(session, designation.customerAccountId)) {
        return NextResponse.json({ error: "Access denied" }, { status: 403 });
      }

      const updated = await prisma.designation.update({
        where: { id },
        data: { name },
      });

      if (designation.customerAccountId) void translateRecord(designation.customerAccountId, 'Designation', updated.id, { name: updated.name });

      return NextResponse.json(updated);
    } catch (error) {
      console.error("Error updating designation:", error);
      return NextResponse.json(
        { error: "Failed to update designation" },
        { status: 500 }
      );
    }
  },
  { resource: "organization.settings", action: "edit" }
);

// DELETE a designation
export const DELETE = withAuth(
  async (req: NextRequest, context: RouteContext, session) => {
    try {
      const { id } = await context.params;

      const designation = await prisma.designation.findUnique({
        where: { id },
      });

      if (!designation) {
        return NextResponse.json(
          { error: "Designation not found" },
          { status: 404 }
        );
      }

      if (!validateTenantAccess(session, designation.customerAccountId)) {
        return NextResponse.json({ error: "Access denied" }, { status: 403 });
      }

      await prisma.designation.delete({ where: { id } });

      if (designation.customerAccountId) void deleteRecordTranslations(designation.customerAccountId, 'Designation', id);

      return NextResponse.json({ success: true });
    } catch (error) {
      console.error("Error deleting designation:", error);
      return NextResponse.json(
        { error: "Failed to delete designation" },
        { status: 500 }
      );
    }
  },
  { resource: "organization.settings", action: "delete" }
);
