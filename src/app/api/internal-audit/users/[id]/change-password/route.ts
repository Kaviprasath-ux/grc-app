import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth, getTenantFilter } from "@/lib/api-auth";

// POST change password for audit user
export const POST = withAuth(
  async (req: NextRequest, { params }: { params: Promise<{ id: string }> }, session) => {
    try {
      const { id } = await params;
      const tenantFilter = getTenantFilter(session);
      const body = await req.json();
      const { password } = body;

      if (!password) {
        return NextResponse.json(
          { error: "Password is required" },
          { status: 400 }
        );
      }

      // Verify user exists and belongs to tenant
      const existingUser = await prisma.user.findFirst({
        where: { id, ...tenantFilter },
      });

      if (!existingUser) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
      }

      // Update password (in production, hash this password!)
      await prisma.user.update({
        where: { id },
        data: { password },
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
  { resource: "audit.settings", action: "edit" }
);
