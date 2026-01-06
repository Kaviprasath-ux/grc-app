import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// PUT update issue
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { title, description, domain, category, issueType, status, dueDate, departmentId } = body;

    const issue = await prisma.issue.update({
      where: { id },
      data: {
        title,
        description,
        domain,
        category,
        issueType,
        status,
        dueDate: dueDate ? new Date(dueDate) : null,
        departmentId,
      },
      include: { department: true },
    });

    return NextResponse.json(issue);
  } catch (error: unknown) {
    console.error("Error updating issue:", error);
    if ((error as { code?: string }).code === "P2025") {
      return NextResponse.json({ error: "Issue not found" }, { status: 404 });
    }
    return NextResponse.json({ error: "Failed to update issue" }, { status: 500 });
  }
}

// DELETE issue
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await prisma.issue.delete({ where: { id } });
    return NextResponse.json({ message: "Issue deleted successfully" });
  } catch (error: unknown) {
    console.error("Error deleting issue:", error);
    if ((error as { code?: string }).code === "P2025") {
      return NextResponse.json({ error: "Issue not found" }, { status: 404 });
    }
    return NextResponse.json({ error: "Failed to delete issue" }, { status: 500 });
  }
}
