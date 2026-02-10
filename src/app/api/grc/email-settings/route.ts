import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/grc/email-settings
 * Get the global email settings (GRCAdministrator only)
 */
export async function GET() {
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

    // Get the global email settings (should be only one record)
    const emailSettings = await prisma.emailSettings.findFirst({
      orderBy: {
        createdAt: "asc",
      },
    });

    if (!emailSettings) {
      return NextResponse.json(null);
    }

    // Mask password in response
    return NextResponse.json({
      ...emailSettings,
      smtpPassword: "********", // Never expose the actual password
    });
  } catch (error) {
    console.error("Error fetching email settings:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/grc/email-settings
 * Create or update the global email settings (GRCAdministrator only)
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

    const body = await req.json();
    const {
      smtpHost,
      smtpPort,
      smtpUser,
      smtpPassword,
      fromAddress,
      fromName,
      replyToAddress,
      useTLS,
      useSSL,
      isActive,
    } = body;

    // Validate required fields
    if (!smtpHost || !smtpUser || !fromAddress) {
      return NextResponse.json(
        { error: "SMTP host, user, and from address are required" },
        { status: 400 }
      );
    }

    // Check if settings already exist
    const existingSettings = await prisma.emailSettings.findFirst();

    let emailSettings;

    if (existingSettings) {
      // Update existing settings
      // Only update password if a new one is provided (not masked)
      const updateData: Record<string, unknown> = {
        smtpHost,
        smtpPort: smtpPort || 587,
        smtpUser,
        fromAddress,
        fromName: fromName || null,
        replyToAddress: replyToAddress || null,
        useTLS: useTLS ?? true,
        useSSL: useSSL ?? false,
        isActive: isActive ?? true,
        isVerified: false, // Reset verification when settings change
      };

      // Only update password if new one provided
      if (smtpPassword && smtpPassword !== "********") {
        updateData.smtpPassword = smtpPassword;
      }

      emailSettings = await prisma.emailSettings.update({
        where: { id: existingSettings.id },
        data: updateData,
      });
    } else {
      // Create new settings
      if (!smtpPassword) {
        return NextResponse.json(
          { error: "SMTP password is required for new configuration" },
          { status: 400 }
        );
      }

      emailSettings = await prisma.emailSettings.create({
        data: {
          smtpHost,
          smtpPort: smtpPort || 587,
          smtpUser,
          smtpPassword,
          fromAddress,
          fromName: fromName || null,
          replyToAddress: replyToAddress || null,
          useTLS: useTLS ?? true,
          useSSL: useSSL ?? false,
          isActive: isActive ?? true,
        },
      });
    }

    // Mask password in response
    return NextResponse.json({
      ...emailSettings,
      smtpPassword: "********",
    });
  } catch (error) {
    console.error("Error saving email settings:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/grc/email-settings
 * Delete the global email settings (GRCAdministrator only)
 */
export async function DELETE() {
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

    // Find and delete the email settings
    const existingSettings = await prisma.emailSettings.findFirst();

    if (existingSettings) {
      await prisma.emailSettings.delete({
        where: { id: existingSettings.id },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting email settings:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
