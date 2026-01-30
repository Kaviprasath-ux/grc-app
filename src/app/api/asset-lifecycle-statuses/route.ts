import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api-auth";

// GET all asset lifecycle statuses
// NOTE: AssetLifecycleStatus model doesn't have customerAccountId yet - tenant filtering disabled
export const GET = withAuth(
  async () => {
    try {
      const statuses = await prisma.assetLifecycleStatus.findMany({
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
// NOTE: AssetLifecycleStatus model doesn't have customerAccountId yet - tenant filtering disabled
export const POST = withAuth(
  async (req) => {
    try {
      const body = await req.json();
      const { name, description, order } = body;

      if (!name?.trim()) {
        return NextResponse.json(
          { error: "Status name is required" },
          { status: 400 }
        );
      }

      // Check for duplicate
      const existing = await prisma.assetLifecycleStatus.findFirst({
        where: { name: name.trim() },
      });

      if (existing) {
        return NextResponse.json(
          { error: "Status with this name already exists" },
          { status: 400 }
        );
      }

      const status = await prisma.assetLifecycleStatus.create({
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
