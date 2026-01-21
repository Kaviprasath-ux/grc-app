import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth, validateTenantAccess } from "@/lib/api-auth";

interface RouteContext {
  params: Promise<{ id: string }>;
}

// PUT update asset lifecycle status
export const PUT = withAuth(
  async (req, context: RouteContext, session) => {
    try {
      const { id } = await context.params;
      const body = await req.json();
      const { name, description, order } = body;

      if (!name?.trim()) {
        return NextResponse.json(
          { error: "Status name is required" },
          { status: 400 }
        );
      }

      // Verify the status exists and belongs to the user's tenant
      const existingStatus = await prisma.assetLifecycleStatus.findUnique({
        where: { id },
      });

      if (!existingStatus) {
        return NextResponse.json(
          { error: "Lifecycle status not found" },
          { status: 404 }
        );
      }

      if (!validateTenantAccess(session, existingStatus.customerAccountId)) {
        return NextResponse.json(
          { error: "Access denied" },
          { status: 403 }
        );
      }

      const status = await prisma.assetLifecycleStatus.update({
        where: { id },
        data: {
          name: name.trim(),
          description: description?.trim() || null,
          order: order || 0,
        },
        include: {
          _count: {
            select: { assets: true },
          },
        },
      });

      return NextResponse.json(status);
    } catch (error: unknown) {
      console.error("Error updating asset lifecycle status:", error);
      if (error && typeof error === 'object' && 'code' in error && error.code === "P2002") {
        return NextResponse.json(
          { error: "Status with this name already exists" },
          { status: 400 }
        );
      }
      return NextResponse.json(
        { error: "Failed to update asset lifecycle status" },
        { status: 500 }
      );
    }
  },
  { resource: "asset.settings", action: "edit" }
);

// DELETE asset lifecycle status
export const DELETE = withAuth(
  async (_req, context: RouteContext, session) => {
    try {
      const { id } = await context.params;

      // Verify the status exists and belongs to the user's tenant
      const existingStatus = await prisma.assetLifecycleStatus.findUnique({
        where: { id },
      });

      if (!existingStatus) {
        return NextResponse.json(
          { error: "Lifecycle status not found" },
          { status: 404 }
        );
      }

      if (!validateTenantAccess(session, existingStatus.customerAccountId)) {
        return NextResponse.json(
          { error: "Access denied" },
          { status: 403 }
        );
      }

      await prisma.assetLifecycleStatus.delete({
        where: { id },
      });
      return NextResponse.json({ success: true });
    } catch (error) {
      console.error("Error deleting asset lifecycle status:", error);
      return NextResponse.json(
        { error: "Failed to delete asset lifecycle status" },
        { status: 500 }
      );
    }
  },
  { resource: "asset.settings", action: "delete" }
);
