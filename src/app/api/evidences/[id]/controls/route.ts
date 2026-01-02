import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// GET all controls linked to evidence
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const evidenceControls = await prisma.evidenceControl.findMany({
      where: { evidenceId: id },
      include: {
        control: {
          include: {
            domain: true,
            framework: true,
          },
        },
      },
    });

    return NextResponse.json(evidenceControls);
  } catch (error) {
    console.error("Error fetching evidence controls:", error);
    return NextResponse.json(
      { error: "Failed to fetch evidence controls" },
      { status: 500 }
    );
  }
}

// POST link control to evidence
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { controlId, controlIds } = body;

    // Check if evidence exists
    const evidence = await prisma.evidence.findUnique({
      where: { id },
    });

    if (!evidence) {
      return NextResponse.json(
        { error: "Evidence not found" },
        { status: 404 }
      );
    }

    // Handle multiple control IDs
    const idsToLink = controlIds || (controlId ? [controlId] : []);

    if (idsToLink.length === 0) {
      return NextResponse.json(
        { error: "Control ID(s) required" },
        { status: 400 }
      );
    }

    const results = [];
    for (const ctrlId of idsToLink) {
      // Check if control exists
      const control = await prisma.control.findUnique({
        where: { id: ctrlId },
      });

      if (!control) continue;

      // Check if already linked
      const existingLink = await prisma.evidenceControl.findFirst({
        where: {
          evidenceId: id,
          controlId: ctrlId,
        },
      });

      if (existingLink) continue;

      // Create the link
      const evidenceControl = await prisma.evidenceControl.create({
        data: {
          evidenceId: id,
          controlId: ctrlId,
        },
        include: {
          control: {
            include: {
              domain: true,
            },
          },
        },
      });

      results.push(evidenceControl);
    }

    return NextResponse.json(results, { status: 201 });
  } catch (error) {
    console.error("Error linking control to evidence:", error);
    return NextResponse.json(
      { error: "Failed to link control" },
      { status: 500 }
    );
  }
}

// DELETE unlink all controls (or specific ones via body)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    let controlId: string | null = null;
    try {
      const body = await request.json();
      controlId = body.controlId;
    } catch {
      // No body provided, that's ok
    }

    if (controlId) {
      // Delete specific link
      const link = await prisma.evidenceControl.findFirst({
        where: {
          evidenceId: id,
          controlId,
        },
      });

      if (!link) {
        return NextResponse.json(
          { error: "Control is not linked to this evidence" },
          { status: 404 }
        );
      }

      await prisma.evidenceControl.delete({
        where: { id: link.id },
      });

      return NextResponse.json({ message: "Control unlinked successfully" });
    }

    // Delete all links for this evidence
    await prisma.evidenceControl.deleteMany({
      where: { evidenceId: id },
    });

    return NextResponse.json({ message: "All controls unlinked successfully" });
  } catch (error) {
    console.error("Error unlinking control from evidence:", error);
    return NextResponse.json(
      { error: "Failed to unlink control" },
      { status: 500 }
    );
  }
}
