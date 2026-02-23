import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth, validateTenantAccess } from "@/lib/api-auth";
import { translateRecord, deleteRecordTranslations } from '@/lib/translation-service';

interface RouteContext {
  params: Promise<{ id: string }>;
}

// PUT update a process frequency
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

      // Find the frequency and validate tenant access
      const frequency = await prisma.processFrequency.findUnique({
        where: { id },
      });

      if (!frequency) {
        return NextResponse.json(
          { error: "Process frequency not found" },
          { status: 404 }
        );
      }

      if (!validateTenantAccess(session, frequency.customerAccountId)) {
        return NextResponse.json({ error: "Access denied" }, { status: 403 });
      }

      const updated = await prisma.processFrequency.update({
        where: { id },
        data: { name },
      });

      if (frequency.customerAccountId) void translateRecord(frequency.customerAccountId, 'ProcessFrequency', updated.id, { name: updated.name });

      return NextResponse.json(updated);
    } catch (error) {
      console.error("Error updating process frequency:", error);
      return NextResponse.json(
        { error: "Failed to update process frequency" },
        { status: 500 }
      );
    }
  },
  { resource: "organization.settings", action: "edit" }
);

// DELETE a process frequency
export const DELETE = withAuth(
  async (req: NextRequest, context: RouteContext, session) => {
    try {
      const { id } = await context.params;

      // Find the frequency and validate tenant access
      const frequency = await prisma.processFrequency.findUnique({
        where: { id },
      });

      if (!frequency) {
        return NextResponse.json(
          { error: "Process frequency not found" },
          { status: 404 }
        );
      }

      if (!validateTenantAccess(session, frequency.customerAccountId)) {
        return NextResponse.json({ error: "Access denied" }, { status: 403 });
      }

      await prisma.processFrequency.delete({ where: { id } });

      if (frequency.customerAccountId) void deleteRecordTranslations(frequency.customerAccountId, 'ProcessFrequency', id);

      return NextResponse.json({ success: true });
    } catch (error) {
      console.error("Error deleting process frequency:", error);
      return NextResponse.json(
        { error: "Failed to delete process frequency" },
        { status: 500 }
      );
    }
  },
  { resource: "organization.settings", action: "delete" }
);
