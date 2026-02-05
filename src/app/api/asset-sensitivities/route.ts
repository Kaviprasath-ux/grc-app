import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth, getTenantFilter } from "@/lib/api-auth";

// GET all asset sensitivities
export const GET = withAuth(
  async (_req, _context, session) => {
    try {
      const tenantFilter = getTenantFilter(session);

      const sensitivities = await prisma.assetSensitivity.findMany({
        where: tenantFilter as Record<string, unknown>,
        include: {
          _count: {
            select: { assets: true },
          },
        },
        orderBy: { name: "asc" },
      });
      return NextResponse.json(sensitivities);
    } catch (error) {
      console.error("Error fetching asset sensitivities:", error);
      return NextResponse.json(
        { error: "Failed to fetch asset sensitivities" },
        { status: 500 }
      );
    }
  },
  { resource: "asset.inventory", action: "view" }
);

// POST create new asset sensitivity
export const POST = withAuth(
  async (req, _context, session) => {
    try {
      const body = await req.json();
      const { name, description } = body;

      if (!name?.trim()) {
        return NextResponse.json(
          { error: "Sensitivity name is required" },
          { status: 400 }
        );
      }

      // Get customer account ID for the new record
      const customerAccountId = session.customerAccountId || null;

      // Check for duplicate within the same tenant
      const existing = await prisma.assetSensitivity.findFirst({
        where: {
          name: name.trim(),
          customerAccountId,
        } as Record<string, unknown>,
      });

      if (existing) {
        return NextResponse.json(
          { error: "Sensitivity with this name already exists" },
          { status: 400 }
        );
      }

      const sensitivity = await prisma.assetSensitivity.create({
        data: {
          name: name.trim(),
          description: description?.trim() || null,
          customerAccountId,
        },
        include: {
          _count: {
            select: { assets: true },
          },
        },
      });

      return NextResponse.json(sensitivity, { status: 201 });
    } catch (error: unknown) {
      console.error("Error creating asset sensitivity:", error);
      if (error && typeof error === 'object' && 'code' in error && error.code === "P2002") {
        return NextResponse.json(
          { error: "Sensitivity with this name already exists" },
          { status: 400 }
        );
      }
      return NextResponse.json(
        { error: "Failed to create asset sensitivity" },
        { status: 500 }
      );
    }
  },
  { resource: "asset.settings", action: "create" }
);
