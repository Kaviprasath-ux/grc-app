import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";

// GET next available user ID (USR0001, USR0002, etc.) scoped to customer account
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const customerAccountId = session.user.customerAccountId || null;

    const existingUsers = await prisma.user.findMany({
      where: {
        userId: { startsWith: "USR" },
        ...(customerAccountId ? { customerAccountId } : {}),
      },
      select: { userId: true },
    });
    const maxId = existingUsers.reduce((max: number, u) => {
      const match = u.userId?.match(/^USR(\d+)$/);
      return match ? Math.max(max, parseInt(match[1])) : max;
    }, 0);
    const nextId = `USR${String(maxId + 1).padStart(4, "0")}`;

    return NextResponse.json({ nextId });
  } catch (error) {
    console.error("Error generating next user ID:", error);
    return NextResponse.json({ error: "Failed to generate user ID" }, { status: 500 });
  }
}
