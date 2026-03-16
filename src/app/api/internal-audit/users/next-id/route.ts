import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth, getCustomerAccountId } from "@/lib/api-auth";

// GET next available user ID (BA0001, BA0002, etc.) scoped to customer account
export const GET = withAuth(
  async (req: NextRequest, context, session) => {
    try {
      const customerAccountId = getCustomerAccountId(session);

      const existingBAUsers = await prisma.user.findMany({
        where: {
          userId: { startsWith: "BA" },
          ...(customerAccountId ? { customerAccountId } : {}),
        },
        select: { userId: true },
      });
      const maxId = existingBAUsers.reduce((max: number, u) => {
        const match = u.userId?.match(/^BA(\d+)$/);
        return match ? Math.max(max, parseInt(match[1])) : max;
      }, 0);
      const nextId = `BA${String(maxId + 1).padStart(4, "0")}`;

      return NextResponse.json({ nextId });
    } catch (error) {
      console.error("Error generating next user ID:", error);
      return NextResponse.json({ error: "Failed to generate user ID" }, { status: 500 });
    }
  },
  { resource: "audit.settings", action: "view" }
);
