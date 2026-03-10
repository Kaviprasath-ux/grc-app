import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

interface RouteContext {
  params: Promise<{ customerId: string }>;
}

/**
 * GET /api/grc/customers/[customerId]/controls
 * Returns controls belonging to the selected customer's account.
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

    // Try to find by User ID first
    let customerAccountId: string | null = null;

    const customerUser = await prisma.user.findUnique({
      where: { id: customerId },
      select: { customerAccountId: true },
    });

    if (customerUser?.customerAccountId) {
      customerAccountId = customerUser.customerAccountId;
    } else {
      // Fallback: check if customerId is directly a CustomerAccount ID
      const customerAccount = await prisma.customerAccount.findUnique({
        where: { id: customerId },
        select: { id: true },
      });
      if (customerAccount) {
        customerAccountId = customerAccount.id;
      }
    }

    if (!customerAccountId) {
      return NextResponse.json(
        { error: "Customer not found or has no account" },
        { status: 404 }
      );
    }

    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search");
    const frameworkId = searchParams.get("frameworkId");
    const domainFilter = searchParams.get("domain");
    const functionalGrouping = searchParams.get("functionalGrouping");

    const where: Record<string, unknown> = {
      customerAccountId,
    };

    if (search) {
      where.OR = [
        { name: { contains: search } },
        { controlCode: { contains: search } },
      ];
    }

    if (frameworkId) {
      where.frameworkId = frameworkId;
    }

    if (domainFilter) {
      where.domainId = domainFilter;
    }

    if (functionalGrouping) {
      where.functionalGrouping = functionalGrouping;
    }

    const controls = await prisma.control.findMany({
      where,
      include: {
        domain: true,
        department: true,
        framework: { select: { id: true, name: true } },
      },
      orderBy: { controlCode: "asc" },
    });

    return NextResponse.json(controls);
  } catch (error) {
    console.error("Error fetching customer controls:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json(
      { error: "Unable to complete the request. Please try again." },
      { status: 500 }
    );
  }
}
