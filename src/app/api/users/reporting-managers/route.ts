import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";

// GET potential reporting managers based on user's function
// CustomerAdmin and Reviewer are always available
// AuditHead is only available for users with Audit function
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    const { searchParams } = new URL(request.url);
    const userFunction = searchParams.get("function");

    // Build role filter based on function
    const roles = ["CustomerAdministrator", "Reviewer"];

    // Add AuditHead only for Audit function users
    if (userFunction === "Audit") {
      roles.push("AuditHead");
    }

    // Build where clause
    const where: any = {
      userRoles: {
        some: {
          role: {
            name: { in: roles },
          },
        },
      },
      isActive: true,
    };

    // Multi-tenant: Filter by customerAccountId if user is not GRCAdministrator
    const userRoles = session?.user?.roles || [];
    if (!userRoles.includes("GRCAdministrator") && session?.user?.customerAccountId) {
      where.customerAccountId = session.user.customerAccountId;
    }

    const managers = await prisma.user.findMany({
      where,
      select: {
        id: true,
        fullName: true,
        designation: true,
        function: true,
        userRoles: {
          include: {
            role: true,
          },
        },
      },
      orderBy: { fullName: "asc" },
    });

    // Format response with role info
    const formattedManagers = managers.map((manager) => ({
      id: manager.id,
      fullName: manager.fullName,
      designation: manager.designation,
      function: manager.function,
      role: manager.userRoles[0]?.role?.name || "Unknown",
    }));

    return NextResponse.json(formattedManagers);
  } catch (error) {
    console.error("Error fetching reporting managers:", error);
    return NextResponse.json(
      { error: "Failed to fetch reporting managers" },
      { status: 500 }
    );
  }
}
