import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

interface RouteContext {
  params: Promise<{ customerId: string }>;
}

/**
 * GET /api/grc/customers/[customerId]/evidences
 * Returns evidences belonging to the selected customer's account.
 * GRCAdministrator only.
 */
export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userRoles = session.user.roles || [];
    if (!userRoles.includes("GRCAdministrator")) {
      return NextResponse.json(
        { error: "Forbidden - GRCAdministrator role required" },
        { status: 403 }
      );
    }

    const { customerId } = await context.params;

    const customerUser = await prisma.user.findUnique({
      where: { id: customerId },
      select: { customerAccountId: true },
    });

    if (!customerUser?.customerAccountId) {
      return NextResponse.json(
        { error: "Customer not found or has no account" },
        { status: 404 }
      );
    }

    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search");

    const where: Record<string, unknown> = {
      customerAccountId: customerUser.customerAccountId,
    };

    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { evidenceCode: { contains: search, mode: "insensitive" } },
      ];
    }

    const evidences = await prisma.evidence.findMany({
      where,
      include: {
        framework: { select: { id: true, name: true } },
        department: { select: { id: true, name: true } },
        assignee: { select: { id: true, fullName: true } },
      },
      orderBy: { evidenceCode: "asc" },
    });

    return NextResponse.json(evidences);
  } catch (error) {
    console.error("Error fetching customer evidences:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
