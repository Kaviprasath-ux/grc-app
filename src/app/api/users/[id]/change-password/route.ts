import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth, validateTenantAccess, forbidden } from "@/lib/api-auth";

interface RouteContext {
  params: Promise<{ id: string }>;
}

// POST change user password - with tenant validation
export const POST = withAuth(
  async (req: NextRequest, context: RouteContext, session) => {
    try {
      const { id } = await context.params;
      const body = await req.json();
      const { newPassword, confirmPassword } = body;

      // Validate passwords
      if (!newPassword || newPassword.length < 1) {
        return NextResponse.json(
          { error: "New password is required" },
          { status: 400 }
        );
      }

      if (newPassword !== confirmPassword) {
        return NextResponse.json(
          { error: "Passwords do not match" },
          { status: 400 }
        );
      }

      // Check if user exists and verify tenant access
      const existingUser = await prisma.user.findUnique({
        where: { id },
        select: { customerAccountId: true },
      });

      if (!existingUser) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
      }

      if (!validateTenantAccess(session, existingUser.customerAccountId)) {
        return forbidden("Access denied to this user");
      }

      // Update password (in production, hash this password!)
      await prisma.user.update({
        where: { id },
        data: {
          password: newPassword,
        },
      });

      return NextResponse.json({ message: "Password changed successfully" });
    } catch (error) {
      console.error("Error changing password:", error);
      return NextResponse.json(
        { error: "Failed to change password" },
        { status: 500 }
      );
    }
  },
  { resource: "organization.users", action: "edit" }
);
