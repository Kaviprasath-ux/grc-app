import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET single control strength
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const strength = await prisma.controlStrength.findUnique({
      where: { id },
    });

    if (!strength) {
      return NextResponse.json(
        { error: "Control strength not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(strength);
  } catch (error) {
    console.error("Error fetching control strength:", error);
    return NextResponse.json(
      { error: "Failed to fetch control strength" },
      { status: 500 }
    );
  }
}

// PUT update control strength
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name, score, description } = body;

    const existing = await prisma.controlStrength.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Control strength not found" },
        { status: 404 }
      );
    }

    if (name && name !== existing.name) {
      const conflict = await prisma.controlStrength.findUnique({
        where: { name },
      });
      if (conflict) {
        return NextResponse.json(
          { error: "Control strength name already exists" },
          { status: 400 }
        );
      }
    }

    const strength = await prisma.controlStrength.update({
      where: { id },
      data: {
        name: name || existing.name,
        score: score !== undefined ? parseInt(score) : existing.score,
        description: description !== undefined ? description : existing.description,
      },
    });

    return NextResponse.json(strength);
  } catch (error) {
    console.error("Error updating control strength:", error);
    return NextResponse.json(
      { error: "Failed to update control strength" },
      { status: 500 }
    );
  }
}

// DELETE control strength
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const existing = await prisma.controlStrength.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Control strength not found" },
        { status: 404 }
      );
    }

    await prisma.controlStrength.delete({
      where: { id },
    });

    return NextResponse.json({ message: "Control strength deleted successfully" });
  } catch (error) {
    console.error("Error deleting control strength:", error);
    return NextResponse.json(
      { error: "Failed to delete control strength" },
      { status: 500 }
    );
  }
}
