import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth, validateTenantAccess, forbidden } from "@/lib/api-auth";
import { notificationService, NOTIFICATION_EVENTS, NOTIFICATION_CHANNELS } from "@/lib/notification-service";

// GET all actions for an issue
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const actions = await prisma.issueAction.findMany({
      where: { issueId: id },
      include: {
        createdBy: {
          select: { id: true, fullName: true },
        },
        comments: {
          orderBy: { createdAt: "desc" },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(actions);
  } catch (error) {
    console.error("Error fetching issue actions:", error);
    return NextResponse.json(
      { error: "Failed to fetch issue actions" },
      { status: 500 }
    );
  }
}

interface RouteContext {
  params: Promise<{ id: string }>;
}

// POST create a new action for an issue
export const POST = withAuth(
  async (req: NextRequest, context: RouteContext, session) => {
    try {
      const { id } = await context.params;
      const body = await req.json();
      const { actionType, description, completion, comment, createdById, fileName, fileType, filePath, fileSize, title } = body;

      if (!actionType || !description || !createdById) {
        return NextResponse.json(
          { error: "Action type, description, and creator are required" },
          { status: 400 }
        );
      }

      // Verify the issue exists and get owner info for notification
      const issue = await prisma.issue.findUnique({
        where: { id },
        select: { id: true, title: true, ownerId: true, customerAccountId: true },
      });

      if (!issue) {
        return NextResponse.json({ error: "Issue not found" }, { status: 404 });
      }

      if (!validateTenantAccess(session, issue.customerAccountId)) {
        return forbidden("Access denied to this issue");
      }

      const action = await prisma.issueAction.create({
        data: {
          issueId: id,
          actionType,
          description,
          completion: completion || 0,
          comment: comment || null,
          createdById,
          status: "Pending",
          fileName: fileName || null,
          fileType: fileType || null,
          filePath: filePath || null,
          fileSize: fileSize || null,
        },
        include: {
          createdBy: {
            select: { id: true, fullName: true },
          },
          comments: true,
        },
      });

      // Notify issue owner about new planned action
      if (issue.ownerId && issue.ownerId !== session.id && session.customerAccountId) {
        await notificationService.send({
          customerAccountId: session.customerAccountId,
          actorId: session.id,
          recipientId: issue.ownerId,
          event: NOTIFICATION_EVENTS.PLANNED_ACTION_RAISE,
          title: 'New Planned Action',
          message: `New planned action "${title || actionType}" has been raised for issue "${issue.title}"`,
          relatedEntityType: 'issue',
          relatedEntityId: issue.id,
          link: `/organization/context`,
          metadata: {
            entityName: issue.title,
            issueTitle: issue.title,
            actionType: actionType,
            actionTitle: title,
            raisedBy: session.name || 'User',
          },
          channels: [NOTIFICATION_CHANNELS.INBOX, NOTIFICATION_CHANNELS.EMAIL],
        });
      }

      return NextResponse.json(action, { status: 201 });
    } catch (error) {
      console.error("Error creating issue action:", error);
      return NextResponse.json(
        { error: "Failed to create issue action" },
        { status: 500 }
      );
    }
  },
  { resource: "organization.context", action: "create" }
);
