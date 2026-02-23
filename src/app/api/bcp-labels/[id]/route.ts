import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth, getTenantFilter } from "@/lib/api-auth";
import { translateRecord, deleteRecordTranslations } from '@/lib/translation-service';

interface RouteContext {
  params: Promise<{ id: string }>;
}

// GET single BCP label - with tenant isolation
export const GET = withAuth(
  async (req, context: RouteContext, session) => {
    try {
      const { id } = await context.params;
      const tenantFilter = getTenantFilter(session);

      const label = await prisma.bCPLabel.findFirst({
        where: { id, ...tenantFilter },
      });

      if (!label) {
        return NextResponse.json(
          { error: "BCP label not found" },
          { status: 404 }
        );
      }

      return NextResponse.json(label);
    } catch (error) {
      console.error("Error fetching BCP label:", error);
      return NextResponse.json(
        { error: "Failed to fetch BCP label" },
        { status: 500 }
      );
    }
  },
  { resource: "organization.bia", action: "view" }
);

// PUT update BCP label - with tenant isolation
export const PUT = withAuth(
  async (req, context: RouteContext, session) => {
    try {
      const { id } = await context.params;
      const body = await req.json();
      const { name, type, hours, description, sortOrder, isActive } = body;
      const tenantFilter = getTenantFilter(session);

      // Verify the label belongs to the tenant
      const existing = await prisma.bCPLabel.findFirst({
        where: { id, ...tenantFilter },
      });

      if (!existing) {
        return NextResponse.json(
          { error: "BCP label not found" },
          { status: 404 }
        );
      }

      const label = await prisma.bCPLabel.update({
        where: { id },
        data: {
          ...(name !== undefined && { name }),
          ...(type !== undefined && { type }),
          ...(hours !== undefined && { hours }),
          ...(description !== undefined && { description }),
          ...(sortOrder !== undefined && { sortOrder }),
          ...(isActive !== undefined && { isActive }),
        },
      });

      if (existing.customerAccountId) void translateRecord(existing.customerAccountId, 'BCPLabel', label.id, { name: label.name, description: label.description });

      return NextResponse.json(label);
    } catch (error: unknown) {
      console.error("Error updating BCP label:", error);
      if (error && typeof error === "object" && "code" in error && error.code === "P2002") {
        return NextResponse.json(
          { error: "A label with this name already exists" },
          { status: 409 }
        );
      }
      return NextResponse.json(
        { error: "Failed to update BCP label" },
        { status: 500 }
      );
    }
  },
  { resource: "organization.bia", action: "edit" }
);

// DELETE BCP label - with tenant isolation
export const DELETE = withAuth(
  async (req, context: RouteContext, session) => {
    try {
      const { id } = await context.params;
      const tenantFilter = getTenantFilter(session);

      // Verify the label belongs to the tenant
      const existing = await prisma.bCPLabel.findFirst({
        where: { id, ...tenantFilter },
      });

      if (!existing) {
        return NextResponse.json(
          { error: "BCP label not found" },
          { status: 404 }
        );
      }

      await prisma.bCPLabel.delete({
        where: { id },
      });

      if (existing.customerAccountId) void deleteRecordTranslations(existing.customerAccountId, 'BCPLabel', id);

      return NextResponse.json({ message: "BCP label deleted successfully" });
    } catch (error) {
      console.error("Error deleting BCP label:", error);
      return NextResponse.json(
        { error: "Failed to delete BCP label" },
        { status: 500 }
      );
    }
  },
  { resource: "organization.bia", action: "delete" }
);
