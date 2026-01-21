import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth, getTenantFilter } from "@/lib/api-auth";

// GET all asset lifecycle statuses
export const GET = withAuth(
  async (_req, _context, session) => {
    try {
      const tenantFilter = getTenantFilter(session);

      const statuses = await prisma.assetLifecycleStatus.findMany({
        where: tenantFilter as Record<string, unknown>,
        include: {
          _count: {
            select: { assets: true },
          },
        },
        orderBy: { order: "asc" },
      });
      return NextResponse.json(statuses);
    } catch (error) {
      console.error("Error fetching asset lifecycle statuses:", error);
      return NextResponse.json(
        { error: "Failed to fetch asset lifecycle statuses" },
        { status: 500 }
      );
    }
  },
  { resource: "asset.settings", action: "view" }
);

// POST create new asset lifecycle status
export const POST = withAuth(
  async (req, _context, session) => {
    try {
      const body = await req.json();
      const { name, description, order } = body;

      if (!name?.trim()) {
        return NextResponse.json(
          { error: "Status name is required" },
          { status: 400 }
        );
      }

      // Get customer account ID for the new record
      // GRCAdministrators can create shared/master data without customerAccountId
      // Regular users must have a customerAccountId assigned
      let customerAccountId: string | null;
      if (session.roles.includes('GRCAdministrator')) {
        customerAccountId = session.customerAccountId || null;
      } else {
        if (!session.customerAccountId) {
          return NextResponse.json(
            { error: "User does not have a customer account assigned" },
            { status: 400 }
          );
        }
        customerAccountId = session.customerAccountId;
      }

      // Check for duplicate within the same tenant
      const existing = await prisma.assetLifecycleStatus.findFirst({
        where: {
          name: name.trim(),
          customerAccountId,
        } as Record<string, unknown>,
      });

      if (existing) {
        return NextResponse.json(
          { error: "Status with this name already exists" },
          { status: 400 }
        );
      }

      const status = await prisma.assetLifecycleStatus.create({
        data: {
          customerAccountId,
          name: name.trim(),
          description: description?.trim() || null,
          order: order || 0,
        } as Record<string, unknown>,
        include: {
          _count: {
            select: { assets: true },
          },
        },
      });

      return NextResponse.json(status, { status: 201 });
    } catch (error: unknown) {
      console.error("Error creating asset lifecycle status:", error);
      if (error && typeof error === 'object' && 'code' in error && error.code === "P2002") {
        return NextResponse.json(
          { error: "Status with this name already exists" },
          { status: 400 }
        );
      }
      return NextResponse.json(
        { error: "Failed to create asset lifecycle status" },
        { status: 500 }
      );
    }
  },
  { resource: "asset.settings", action: "create" }
);
