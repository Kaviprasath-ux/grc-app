import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";

// GET all scheduled tasks (GRCAdministrator only)
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const roles = (session.user as { roles?: string[] }).roles || [];
    if (!roles.includes("GRCAdministrator")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const tasks = await prisma.scheduledTask.findMany({
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(tasks);
  } catch (error) {
    console.error("Error fetching scheduled tasks:", error);
    return NextResponse.json({ error: "Failed to fetch tasks" }, { status: 500 });
  }
}

// DELETE a scheduled task
export async function DELETE(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const roles = (session.user as { roles?: string[] }).roles || [];
    if (!roles.includes("GRCAdministrator")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await req.json();
    if (!id) {
      return NextResponse.json({ error: "Task ID required" }, { status: 400 });
    }

    await prisma.scheduledTask.delete({ where: { id } });
    return NextResponse.json({ message: "Task deleted" });
  } catch (error) {
    console.error("Error deleting scheduled task:", error);
    return NextResponse.json({ error: "Failed to delete task" }, { status: 500 });
  }
}
