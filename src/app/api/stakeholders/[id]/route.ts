import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth, validateTenantAccess, forbidden } from "@/lib/api-auth";
import { translateRecord, deleteRecordTranslations } from '@/lib/translation-service';

interface RouteContext {
  params: Promise<{ id: string }>;
}

// PUT update stakeholder - with tenant validation
export const PUT = withAuth(
  async (req, context: RouteContext, session) => {
    try {
      const { id } = await context.params;
      const body = await req.json();
      const { name, email, type, status, departmentId } = body;

      // First, verify the stakeholder belongs to the user's customer account
      const existing = await prisma.stakeholder.findUnique({
        where: { id },
        select: { customerAccountId: true },
      });

      if (!existing) {
        return NextResponse.json({ error: "Stakeholder not found" }, { status: 404 });
      }

      if (!validateTenantAccess(session, existing.customerAccountId)) {
        return forbidden("Access denied to this stakeholder");
      }

      const stakeholder = await prisma.stakeholder.update({
        where: { id },
        data: { name, email, type, status, departmentId },
        include: { department: true },
      });

      if (existing.customerAccountId) void translateRecord(existing.customerAccountId, 'Stakeholder', stakeholder.id, { name: stakeholder.name });

      return NextResponse.json(stakeholder);
    } catch (error: unknown) {
      console.error("Error updating stakeholder:", error);
      if ((error as { code?: string }).code === "P2025") {
        return NextResponse.json({ error: "Stakeholder not found" }, { status: 404 });
      }
      return NextResponse.json({ error: "Failed to update stakeholder" }, { status: 500 });
    }
  },
  { resource: "organization.context", action: "edit" }
);

// DELETE stakeholder - with tenant validation
export const DELETE = withAuth(
  async (req, context: RouteContext, session) => {
    try {
      const { id } = await context.params;

      // First, verify the stakeholder belongs to the user's customer account
      const existing = await prisma.stakeholder.findUnique({
        where: { id },
        select: { customerAccountId: true },
      });

      if (!existing) {
        return NextResponse.json({ error: "Stakeholder not found" }, { status: 404 });
      }

      if (!validateTenantAccess(session, existing.customerAccountId)) {
        return forbidden("Access denied to this stakeholder");
      }

      await prisma.stakeholder.delete({ where: { id } });

      if (existing.customerAccountId) void deleteRecordTranslations(existing.customerAccountId, 'Stakeholder', id);

      return NextResponse.json({ message: "Stakeholder deleted successfully" });
    } catch (error: unknown) {
      console.error("Error deleting stakeholder:", error);
      if ((error as { code?: string }).code === "P2025") {
        return NextResponse.json({ error: "Stakeholder not found" }, { status: 404 });
      }
      return NextResponse.json({ error: "Failed to delete stakeholder" }, { status: 500 });
    }
  },
  { resource: "organization.context", action: "delete" }
);
