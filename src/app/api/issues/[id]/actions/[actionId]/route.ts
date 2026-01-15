import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// GET a specific action
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; actionId: string }> }
) {
  try {
    const { actionId } = await params;

    const action = await prisma.issueAction.findUnique({
      where: { id: actionId },
      include: {
        createdBy: {
          select: { id: true, fullName: true },
        },
        comments: {
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!action) {
      return NextResponse.json({ error: "Action not found" }, { status: 404 });
    }

    return NextResponse.json(action);
  } catch (error) {
    console.error("Error fetching action:", error);
    return NextResponse.json(
      { error: "Failed to fetch action" },
      { status: 500 }
    );
  }
}

// PUT update an action (for editing by DeptReviewer)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; actionId: string }> }
) {
  try {
    const { actionId } = await params;
    const body = await request.json();
    const { actionType, description, completion, comment, status } = body;

    const action = await prisma.issueAction.update({
      where: { id: actionId },
      data: {
        actionType: actionType || undefined,
        description: description || undefined,
        completion: completion !== undefined ? completion : undefined,
        comment: comment !== undefined ? comment : undefined,
        status: status || "Pending", // Reset to Pending when edited and resubmitted
      },
      include: {
        createdBy: {
          select: { id: true, fullName: true },
        },
        comments: {
          orderBy: { createdAt: "desc" },
        },
      },
    });

    return NextResponse.json(action);
  } catch (error: unknown) {
    console.error("Error updating action:", error);
    if ((error as { code?: string }).code === "P2025") {
      return NextResponse.json({ error: "Action not found" }, { status: 404 });
    }
    return NextResponse.json(
      { error: "Failed to update action" },
      { status: 500 }
    );
  }
}

// PATCH for status changes (resolve, resend)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; actionId: string }> }
) {
  try {
    const { actionId } = await params;
    const body = await request.json();
    const { action: actionType, comment, createdBy } = body;

    if (actionType === "resolve") {
      // Mark as resolved
      const action = await prisma.issueAction.update({
        where: { id: actionId },
        data: { status: "Resolved" },
        include: {
          createdBy: {
            select: { id: true, fullName: true },
          },
          comments: true,
        },
      });
      return NextResponse.json(action);
    }

    if (actionType === "resend") {
      // Send back with comment
      if (!comment) {
        return NextResponse.json(
          { error: "Comment is required for resend" },
          { status: 400 }
        );
      }

      // Create comment and update status
      await prisma.issueActionComment.create({
        data: {
          actionId,
          comment,
          createdBy: createdBy || "Admin",
        },
      });

      const action = await prisma.issueAction.update({
        where: { id: actionId },
        data: { status: "Sent Back" },
        include: {
          createdBy: {
            select: { id: true, fullName: true },
          },
          comments: {
            orderBy: { createdAt: "desc" },
          },
        },
      });

      return NextResponse.json(action);
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error: unknown) {
    console.error("Error updating action status:", error);
    if ((error as { code?: string }).code === "P2025") {
      return NextResponse.json({ error: "Action not found" }, { status: 404 });
    }
    return NextResponse.json(
      { error: "Failed to update action status" },
      { status: 500 }
    );
  }
}

// DELETE an action
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; actionId: string }> }
) {
  try {
    const { actionId } = await params;

    await prisma.issueAction.delete({
      where: { id: actionId },
    });

    return NextResponse.json({ message: "Action deleted successfully" });
  } catch (error: unknown) {
    console.error("Error deleting action:", error);
    if ((error as { code?: string }).code === "P2025") {
      return NextResponse.json({ error: "Action not found" }, { status: 404 });
    }
    return NextResponse.json(
      { error: "Failed to delete action" },
      { status: 500 }
    );
  }
}
