import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";

// DELETE all policies/governance documents for the current customer account
// Restricted to CustomerAdministrator role only
// Supports optional documentType query parameter to filter by type
export async function DELETE(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userRoles = (session.user.roles as string[]) || [];
    if (!userRoles.includes("CustomerAdministrator")) {
      return NextResponse.json(
        { error: "Forbidden - Only Customer Administrator can delete all governance documents" },
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

    const { searchParams } = new URL(request.url);
    const documentType = searchParams.get("documentType");

    const where: Record<string, unknown> = { customerAccountId };
    if (documentType) {
      where.documentType = documentType;
    }

    // Delete related records first to avoid foreign key constraints
    // Delete requirement-policy links for affected policies
    const policyIds = (await prisma.qPostPolicy.findMany({
      where,
      select: { id: true },
    })).map(p => p.id);

    if (policyIds.length > 0) {
      await prisma.qPostRequirementPolicy.deleteMany({
        where: { policyId: { in: policyIds } },
      });
    }

    // Delete all policies matching the filter
    const result = await prisma.qPostPolicy.deleteMany({
      where,
    });

    return NextResponse.json({
      message: `Successfully deleted ${result.count} document(s)`,
      count: result.count,
    });
  } catch (error) {
    console.error("Error deleting all governance documents:", error);
    return NextResponse.json(
      { error: "Failed to delete all governance documents" },
      { status: 500 }
    );
  }
}
