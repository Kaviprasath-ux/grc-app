import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { seedDefaultEmailTemplates } from "@/lib/email-service";

/**
 * POST /api/grc/email-templates/seed
 * Seed default email templates into the database (GRCAdministrator only)
 */
export async function POST(req: NextRequest) {
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

    await seedDefaultEmailTemplates();

    return NextResponse.json({
      success: true,
      message: "Default email templates have been seeded successfully",
    });
  } catch (error) {
    console.error("Error seeding email templates:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
