import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { testEmailConnection } from "@/lib/email-service";

/**
 * POST /api/grc/email-settings/test
 * Test email configuration by sending a test email (GRCAdministrator only)
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
    const { testRecipient } = body;

    // Test the global email connection
    const result = await testEmailConnection(testRecipient);

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: testRecipient
          ? `Test email sent successfully to ${testRecipient}`
          : "SMTP connection verified successfully",
        messageId: result.messageId,
      });
    } else {
      return NextResponse.json(
        {
          success: false,
          error: result.error || "Failed to test email configuration",
        },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error("Error testing email configuration:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
