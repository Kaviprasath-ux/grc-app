import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// POST link control to risk
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: riskId } = await params;
    const body = await request.json();
    const { controlId } = body;

    if (!controlId) {
      return NextResponse.json(
        { error: "Control ID is required" },
        { status: 400 }
      );
    }

    const link = await prisma.controlRisk.create({
      data: {
        controlId,
        riskId,
      },
      include: {
        control: true,
        risk: true,
      },
    });

    return NextResponse.json(link, { status: 201 });
  } catch (error: unknown) {
    console.error("Error linking control to risk:", error);
    if ((error as { code?: string }).code === "P2002") {
      return NextResponse.json(
        { error: "Control is already linked to this risk" },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: "Failed to link control to risk" },
      { status: 500 }
    );
  }
}

// DELETE unlink control from risk
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: riskId } = await params;
    const { searchParams } = new URL(request.url);
    const controlId = searchParams.get("controlId");

    if (!controlId) {
      return NextResponse.json(
        { error: "Control ID is required" },
        { status: 400 }
      );
    }

    await prisma.controlRisk.delete({
      where: {
        controlId_riskId: {
          controlId,
          riskId,
        },
      },
    });

    return NextResponse.json({ message: "Control unlinked from risk successfully" });
  } catch (error: unknown) {
    console.error("Error unlinking control from risk:", error);
    if ((error as { code?: string }).code === "P2025") {
      return NextResponse.json(
        { error: "Link not found" },
        { status: 404 }
      );
    }
    return NextResponse.json(
      { error: "Failed to unlink control from risk" },
      { status: 500 }
    );
  }
}
