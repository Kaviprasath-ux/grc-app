import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

interface RouteContext {
  params: Promise<{ customerId: string }>;
}

/**
 * GET /api/grc/customers/[customerId]/frameworks
 * Returns only frameworks belonging to the selected customer's account.
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

    // Look up the customer user to get their customerAccountId
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
    const status = searchParams.get("status");
    const type = searchParams.get("type");

    const where: Record<string, unknown> = {
      customerAccountId: customerUser.customerAccountId,
    };
    if (status) where.status = status;
    if (type) where.type = type;

    const frameworks = await prisma.framework.findMany({
      where,
      include: {
        _count: {
          select: { controls: true, evidences: true, requirements: true },
        },
      },
      orderBy: { name: "asc" },
    });

    return NextResponse.json(frameworks);
  } catch (error) {
    console.error("Error fetching customer frameworks:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
