import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { unlink } from "fs/promises";
import path from "path";

// GET single governance template
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const template = await prisma.governanceTemplate.findUnique({
      where: { id },
    });

    if (!template) {
      return NextResponse.json(
        { error: "Governance template not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(template);
  } catch (error) {
    console.error("Error fetching governance template:", error);
    return NextResponse.json(
      { error: "Failed to fetch governance template" },
      { status: 500 }
    );
  }
}

// PUT update governance template
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { governanceType } = body;

    const template = await prisma.governanceTemplate.update({
      where: { id },
      data: { governanceType },
    });

    return NextResponse.json(template);
  } catch (error: unknown) {
    console.error("Error updating governance template:", error);
    if ((error as { code?: string }).code === "P2025") {
      return NextResponse.json(
        { error: "Governance template not found" },
        { status: 404 }
      );
    }
    return NextResponse.json(
      { error: "Failed to update governance template" },
      { status: 500 }
    );
  }
}

// DELETE governance template
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Get template to find file path
    const template = await prisma.governanceTemplate.findUnique({
      where: { id },
    });

    if (!template) {
      return NextResponse.json(
        { error: "Governance template not found" },
        { status: 404 }
      );
    }

    // Delete the file from disk
    try {
      const filePath = path.join(process.cwd(), "public", template.filePath);
      await unlink(filePath);
    } catch {
      // File might already be deleted, continue anyway
      console.warn("Could not delete file:", template.filePath);
    }

    // Delete database record
    await prisma.governanceTemplate.delete({
      where: { id },
    });

    return NextResponse.json({ message: "Governance template deleted successfully" });
  } catch (error: unknown) {
    console.error("Error deleting governance template:", error);
    if ((error as { code?: string }).code === "P2025") {
      return NextResponse.json(
        { error: "Governance template not found" },
        { status: 404 }
      );
    }
    return NextResponse.json(
      { error: "Failed to delete governance template" },
      { status: 500 }
    );
  }
}
