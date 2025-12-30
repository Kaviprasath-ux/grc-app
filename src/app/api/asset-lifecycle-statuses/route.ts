import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET all asset lifecycle statuses
export async function GET() {
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
}

// POST create new asset lifecycle status
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, description, order } = body;

    if (!name?.trim()) {
      return NextResponse.json(
        { error: "Status name is required" },
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
}
