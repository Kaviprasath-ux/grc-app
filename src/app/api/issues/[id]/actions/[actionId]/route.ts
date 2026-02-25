import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuthOnly } from "@/lib/api-auth";
import { notificationService } from "@/lib/notification-service";

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
    const { actionType, description, completion, comment, status, fileName, fileType, filePath, fileSize, deleteFile } = body;

    // Build update data
    const updateData: Record<string, unknown> = {};

    if (actionType !== undefined) updateData.actionType = actionType;
    if (description !== undefined) updateData.description = description;
    if (completion !== undefined) updateData.completion = completion;
    if (comment !== undefined) updateData.comment = comment;
    if (status !== undefined) updateData.status = status;

    // Handle file updates
    if (deleteFile) {
      // Delete file by setting fields to null
      updateData.fileName = null;
      updateData.fileType = null;
      updateData.filePath = null;
      updateData.fileSize = null;
    } else if (fileName !== undefined) {
      // Add/update file
      updateData.fileName = fileName;
      updateData.fileType = fileType || null;
      updateData.filePath = filePath || null;
      updateData.fileSize = fileSize || null;
    }

    const action = await prisma.issueAction.update({
      where: { id: actionId },
      data: updateData,
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
export const PATCH = withAuthOnly(async (
  request: NextRequest,
  context: { params: Promise<{ id: string; actionId: string }> },
  session
) => {
  try {
    const { id: issueId, actionId } = await context.params;
    const body = await request.json();
    const { action: actionType, comment, createdBy } = body;

    // Fetch issue for notification context
    const issue = await prisma.issue.findUnique({
      where: { id: issueId },
      select: { id: true, title: true, customerAccountId: true },
    });

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

      // Notify action creator that their action was approved
      if (action.createdById && action.createdById !== session.id && issue?.customerAccountId) {
        await notificationService.notifyApprovalGranted({
          customerAccountId: issue.customerAccountId,
          actorId: session.id,
          requesterId: action.createdById,
          entityType: 'Issue Action',
          entityId: action.id,
          entityName: action.actionType || 'Action',
          link: `/organization/context`,
        });
      }

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

      // Fetch existing action to get createdById before update
      const existingAction = await prisma.issueAction.findUnique({
        where: { id: actionId },
        select: { createdById: true, actionType: true },
      });

      // Create comment and update status
      await prisma.issueActionComment.create({
        data: {
          actionId,
          comment,
          createdBy: createdBy || session.name || "Admin",
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

      // Notify action creator that their action was sent back
      if (existingAction?.createdById && existingAction.createdById !== session.id && issue?.customerAccountId) {
        await notificationService.notifySentBack({
          customerAccountId: issue.customerAccountId,
          actorId: session.id,
          assigneeId: existingAction.createdById,
          entityType: 'Issue Action',
          entityId: action.id,
          entityName: existingAction.actionType || 'Action',
          reason: comment,
          link: `/organization/context`,
        });
      }

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
});

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
