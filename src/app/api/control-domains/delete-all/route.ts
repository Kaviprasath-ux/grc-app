import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";

// DELETE all control domains for the current customer account
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
        { error: "Forbidden - Only Customer Administrator can delete all domains" },
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

    const result = await prisma.controlDomain.deleteMany({
      where: { customerAccountId },
    });

    return NextResponse.json({
      message: `Successfully deleted ${result.count} domain(s)`,
      count: result.count,
    });
  } catch (error) {
    console.error("Error deleting all control domains:", error);
    return NextResponse.json(
      { error: "Failed to delete all control domains" },
      { status: 500 }
    );
  }
}
