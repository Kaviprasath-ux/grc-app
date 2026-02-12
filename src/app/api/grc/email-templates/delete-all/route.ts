import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * DELETE /api/grc/email-templates/delete-all
 * Delete all email templates (GRCAdministrator only)
 */
export async function DELETE(req: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user has GRCAdministrator role
    const userRoles = session.user.roles || [];
    if (!userRoles.includes("GRCAdministrator")) {
      return NextResponse.json(
        { error: "Forbidden - GRCAdministrator role required" },
        { status: 403 }
      );
    }

    // Delete all email templates
    const result = await prisma.emailTemplate.deleteMany({});

    return NextResponse.json({
      success: true,
      message: `Successfully deleted ${result.count} email templates`,
      count: result.count,
    });
  } catch (error) {
    console.error("Error deleting email templates:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
