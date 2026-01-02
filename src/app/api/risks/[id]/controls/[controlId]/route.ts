import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// DELETE - Unlink a control from a risk
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; controlId: string }> }
) {
  try {
    const { id: riskId, controlId } = await params;

    // Find and delete the control-risk relationship
    const deleted = await prisma.controlRisk.deleteMany({
      where: {
        riskId,
        controlId,
      },
    });

    if (deleted.count === 0) {
      return NextResponse.json(
        { error: "Control-risk relationship not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ message: "Control unlinked successfully" });
  } catch (error) {
    console.error("Error unlinking control from risk:", error);
    return NextResponse.json(
      { error: "Failed to unlink control" },
      { status: 500 }
    );
  }
}
