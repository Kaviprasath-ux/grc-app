import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

interface RouteContext {
  params: Promise<{ customerId: string }>;
}

/**
 * GET /api/grc/customers/[customerId]/domains
 * Returns control domains with control counts for the selected customer's account.
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

    const domains = await prisma.controlDomain.findMany({
      include: {
        _count: {
          select: {
            controls: {
              where: { customerAccountId: customerUser.customerAccountId },
            },
          },
        },
      },
      orderBy: { name: "asc" },
    });

    return NextResponse.json(domains);
  } catch (error) {
    console.error("Error fetching customer domains:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
