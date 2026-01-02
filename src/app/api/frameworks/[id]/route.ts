import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// GET single framework with all related data
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const framework = await prisma.framework.findUnique({
      where: { id },
      include: {
        controls: {
          include: {
            domain: true,
            owner: true,
            assignee: true,
          },
        },
        evidences: true,
        requirements: {
          include: {
            category: true,
            controls: {
              include: {
                control: true,
              },
            },
          },
          orderBy: { sortOrder: "asc" },
        },
        requirementCategories: {
          orderBy: { sortOrder: "asc" },
        },
      },
    });

    if (!framework) {
      return NextResponse.json(
        { error: "Framework not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(framework);
  } catch (error) {
    console.error("Error fetching framework:", error);
    return NextResponse.json(
      { error: "Failed to fetch framework" },
      { status: 500 }
    );
  }
}

// PUT update framework
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const {
      name,
      description,
      version,
      type,
      status,
      logo,
      compliancePercentage,
      policyPercentage,
      evidencePercentage,
    } = body;

    const framework = await prisma.framework.update({
      where: { id },
      data: {
        name,
        description,
        version,
        type,
        status,
        logo,
        compliancePercentage,
        policyPercentage,
        evidencePercentage,
      },
    });

    return NextResponse.json(framework);
  } catch (error: unknown) {
    console.error("Error updating framework:", error);
    if ((error as { code?: string }).code === "P2025") {
      return NextResponse.json(
        { error: "Framework not found" },
        { status: 404 }
      );
    }
    return NextResponse.json(
      { error: "Failed to update framework" },
      { status: 500 }
    );
  }
}

// DELETE framework
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await prisma.framework.delete({
      where: { id },
    });

    return NextResponse.json({ message: "Framework deleted successfully" });
  } catch (error: unknown) {
    console.error("Error deleting framework:", error);
    if ((error as { code?: string }).code === "P2025") {
      return NextResponse.json(
        { error: "Framework not found" },
        { status: 404 }
      );
    }
    return NextResponse.json(
      { error: "Failed to delete framework" },
      { status: 500 }
    );
  }
}
