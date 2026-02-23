import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth, validateTenantAccess } from "@/lib/api-auth";
import { translateRecord, deleteRecordTranslations } from '@/lib/translation-service';

interface RouteContext {
  params: Promise<{ id: string }>;
}

// PUT update a location
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

      const location = await prisma.organizationLocation.findUnique({
        where: { id },
      });

      if (!location) {
        return NextResponse.json(
          { error: "Location not found" },
          { status: 404 }
        );
      }

      if (!validateTenantAccess(session, location.customerAccountId)) {
        return NextResponse.json({ error: "Access denied" }, { status: 403 });
      }

      const updated = await prisma.organizationLocation.update({
        where: { id },
        data: { name },
      });

      if (location.customerAccountId) void translateRecord(location.customerAccountId, 'OrganizationLocation', updated.id, { name: updated.name });

      return NextResponse.json(updated);
    } catch (error) {
      console.error("Error updating location:", error);
      return NextResponse.json(
        { error: "Failed to update location" },
        { status: 500 }
      );
    }
  },
  { resource: "organization.settings", action: "edit" }
);

// DELETE a location
export const DELETE = withAuth(
  async (req: NextRequest, context: RouteContext, session) => {
    try {
      const { id } = await context.params;

      const location = await prisma.organizationLocation.findUnique({
        where: { id },
      });

      if (!location) {
        return NextResponse.json(
          { error: "Location not found" },
          { status: 404 }
        );
      }

      if (!validateTenantAccess(session, location.customerAccountId)) {
        return NextResponse.json({ error: "Access denied" }, { status: 403 });
      }

      await prisma.organizationLocation.delete({ where: { id } });

      if (location.customerAccountId) void deleteRecordTranslations(location.customerAccountId, 'OrganizationLocation', id);

      return NextResponse.json({ success: true });
    } catch (error) {
      console.error("Error deleting location:", error);
      return NextResponse.json(
        { error: "Failed to delete location" },
        { status: 500 }
      );
    }
  },
  { resource: "organization.settings", action: "delete" }
);
