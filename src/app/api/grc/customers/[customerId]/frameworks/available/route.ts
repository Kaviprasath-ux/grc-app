import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

interface RouteContext {
  params: Promise<{ customerId: string }>;
}

/**
 * GET /api/grc/customers/[customerId]/frameworks/available
 * Returns master frameworks from GRC Admin accounts that the customer
 * has not already subscribed to or been suggested.
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

    // GRC Administrator has global access - return master frameworks that can be assigned
    // Exclude: customer's own frameworks, archived frameworks, and subscription copies
    const masterFrameworks = await prisma.framework.findMany({
      where: {
        // Exclude the customer's own frameworks
        customerAccountId: { not: customerUser.customerAccountId },
        // Exclude archived frameworks
        status: { not: "Archived" },
        // Only include master templates or frameworks without a source (original frameworks)
        // Exclude subscription copies (they have sourceFrameworkId set)
        sourceFrameworkId: null,
      },
      orderBy: { name: "asc" },
    });

    // Get customer's existing framework names/codes to exclude
    const customerFrameworks = await prisma.framework.findMany({
      where: { customerAccountId: customerUser.customerAccountId },
      select: { name: true, code: true },
    });

    const subscribedNames = new Set(
      customerFrameworks.map((f) => f.name.toLowerCase())
    );
    const subscribedCodes = new Set(
      customerFrameworks
        .filter((f) => f.code)
        .map((f) => f.code!.toLowerCase())
    );

    // Filter out frameworks the customer already has
    const availableFrameworks = masterFrameworks.filter((f) => {
      const nameMatch = subscribedNames.has(f.name.toLowerCase());
      const codeMatch = f.code && subscribedCodes.has(f.code.toLowerCase());
      return !nameMatch && !codeMatch;
    });

    return NextResponse.json(availableFrameworks);
  } catch (error) {
    console.error("Error fetching available frameworks:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
