import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth, validateTenantAccess } from "@/lib/api-auth";
import { translateRecord, deleteRecordTranslations } from '@/lib/translation-service';

interface RouteContext {
  params: Promise<{ id: string }>;
}

// PUT update a nature of implementation
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

      const implementation = await prisma.natureOfImplementation.findUnique({
        where: { id },
      });

      if (!implementation) {
        return NextResponse.json(
          { error: "Nature of implementation not found" },
          { status: 404 }
        );
      }

      if (!validateTenantAccess(session, implementation.customerAccountId)) {
        return NextResponse.json({ error: "Access denied" }, { status: 403 });
      }

      const updated = await prisma.natureOfImplementation.update({
        where: { id },
        data: { name },
      });

      if (implementation.customerAccountId) void translateRecord(implementation.customerAccountId, 'NatureOfImplementation', updated.id, { name: updated.name });

      return NextResponse.json(updated);
    } catch (error) {
      console.error("Error updating nature of implementation:", error);
      return NextResponse.json(
        { error: "Failed to update nature of implementation" },
        { status: 500 }
      );
    }
  },
  { resource: "organization.settings", action: "edit" }
);

// DELETE a nature of implementation
export const DELETE = withAuth(
  async (req: NextRequest, context: RouteContext, session) => {
    try {
      const { id } = await context.params;

      const implementation = await prisma.natureOfImplementation.findUnique({
        where: { id },
      });

      if (!implementation) {
        return NextResponse.json(
          { error: "Nature of implementation not found" },
          { status: 404 }
        );
      }

      if (!validateTenantAccess(session, implementation.customerAccountId)) {
        return NextResponse.json({ error: "Access denied" }, { status: 403 });
      }

      await prisma.natureOfImplementation.delete({ where: { id } });

      if (implementation.customerAccountId) void deleteRecordTranslations(implementation.customerAccountId, 'NatureOfImplementation', id);

      return NextResponse.json({ success: true });
    } catch (error) {
      console.error("Error deleting nature of implementation:", error);
      return NextResponse.json(
        { error: "Failed to delete nature of implementation" },
        { status: 500 }
      );
    }
  },
  { resource: "organization.settings", action: "delete" }
);
