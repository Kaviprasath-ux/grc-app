import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// DELETE unlink exception from policy
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; exceptionId: string }> }
) {
  try {
    const { id, exceptionId } = await params;

    // Find the link
    const policyException = await prisma.policyException.findFirst({
      where: {
        policyId: id,
        exceptionId,
      },
    });

    if (!policyException) {
      return NextResponse.json(
        { error: "Exception is not linked to this policy" },
        { status: 404 }
      );
    }

    // Delete the link
    await prisma.policyException.delete({
      where: { id: policyException.id },
    });

    return NextResponse.json({ message: "Exception unlinked successfully" });
  } catch (error) {
    console.error("Error unlinking exception from policy:", error);
    return NextResponse.json(
      { error: "Failed to unlink exception" },
      { status: 500 }
    );
  }
}
