import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// DELETE unlink control from policy
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; controlId: string }> }
) {
  try {
    const { id, controlId } = await params;

    // Find the link
    const policyControl = await prisma.policyControl.findFirst({
      where: {
        policyId: id,
        controlId,
      },
    });

    if (!policyControl) {
      return NextResponse.json(
        { error: "Control is not linked to this policy" },
        { status: 404 }
      );
    }

    // Delete the link
    await prisma.policyControl.delete({
      where: { id: policyControl.id },
    });

    return NextResponse.json({ message: "Control unlinked successfully" });
  } catch (error) {
    console.error("Error unlinking control from policy:", error);
    return NextResponse.json(
      { error: "Failed to unlink control" },
      { status: 500 }
    );
  }
}
