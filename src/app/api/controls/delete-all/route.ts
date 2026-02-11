import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";

// DELETE all controls for the current customer account
// Restricted to CustomerAdministrator role only
export async function DELETE(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userRoles = (session.user.roles as string[]) || [];
    if (!userRoles.includes("CustomerAdministrator")) {
      return NextResponse.json(
        { error: "Forbidden - Only Customer Administrator can delete all controls" },
        { status: 403 }
      );
    }

    const customerAccountId = session.user.customerAccountId as string | undefined;
    if (!customerAccountId) {
      return NextResponse.json(
        { error: "No customer account associated with this user" },
        { status: 400 }
      );
    }

    // Delete related junction records first, then controls
    // Junction tables use onDelete: Cascade but we explicitly clean up for safety
    await prisma.requirementControl.deleteMany({
      where: { control: { customerAccountId } },
    });

    await prisma.policyControl.deleteMany({
      where: { control: { customerAccountId } },
    });

    await prisma.evidenceControl.deleteMany({
      where: { control: { customerAccountId } },
    });

    await prisma.controlRisk.deleteMany({
      where: { control: { customerAccountId } },
    });

    await prisma.riskControlMatrixControl.deleteMany({
      where: { control: { customerAccountId } },
    });

    // Delete all controls
    const result = await prisma.control.deleteMany({
      where: { customerAccountId },
    });

    return NextResponse.json({
      message: `Successfully deleted ${result.count} control(s)`,
      count: result.count,
    });
  } catch (error) {
    console.error("Error deleting all controls:", error);
    return NextResponse.json(
      { error: "Failed to delete all controls" },
      { status: 500 }
    );
  }
}
