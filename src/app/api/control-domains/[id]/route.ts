import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// GET single control domain
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const domain = await prisma.controlDomain.findUnique({
      where: { id },
      include: {
        controls: true,
      },
    });

    if (!domain) {
      return NextResponse.json(
        { error: "Control domain not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(domain);
  } catch (error) {
    console.error("Error fetching control domain:", error);
    return NextResponse.json(
      { error: "Failed to fetch control domain" },
      { status: 500 }
    );
  }
}

// PUT update control domain
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name } = body;

    // Validate name is provided
    if (!name || !name.trim()) {
      return NextResponse.json(
        { error: "Domain name is required" },
        { status: 400 }
      );
    }

    // Only update name - code is auto-generated and cannot be changed
    const domain = await prisma.controlDomain.update({
      where: { id },
      data: { name: name.trim() },
    });

    return NextResponse.json(domain);
  } catch (error: unknown) {
    console.error("Error updating control domain:", error);
    if ((error as { code?: string }).code === "P2025") {
      return NextResponse.json(
        { error: "Control domain not found" },
        { status: 404 }
      );
    }
    if ((error as { code?: string }).code === "P2002") {
      return NextResponse.json(
        { error: "A domain with this name already exists" },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: "Failed to update control domain" },
      { status: 500 }
    );
  }
}

// DELETE control domain
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await prisma.controlDomain.delete({
      where: { id },
    });

    return NextResponse.json({ message: "Control domain deleted successfully" });
  } catch (error: unknown) {
    console.error("Error deleting control domain:", error);
    if ((error as { code?: string }).code === "P2025") {
      return NextResponse.json(
        { error: "Control domain not found" },
        { status: 404 }
      );
    }
    return NextResponse.json(
      { error: "Failed to delete control domain" },
      { status: 500 }
    );
  }
}
