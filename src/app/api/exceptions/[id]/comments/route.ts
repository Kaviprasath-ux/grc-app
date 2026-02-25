import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth, validateTenantAccess, forbidden } from "@/lib/api-auth";
import { notificationService, NOTIFICATION_CHANNELS } from "@/lib/notification-service";

interface RouteContext {
  params: Promise<{ id: string }>;
}

// GET all comments for an exception
export const GET = withAuth(
  async (req, context: RouteContext, session) => {
    try {
      const { id } = await context.params;

      // Check if exception belongs to user's tenant
      const exception = await prisma.exception.findUnique({
        where: { id },
        select: { customerAccountId: true },
      });

      if (!exception) {
        return NextResponse.json(
          { error: "Exception not found" },
          { status: 404 }
        );
      }

      if (!validateTenantAccess(session, exception.customerAccountId)) {
        return forbidden("Access denied to this exception");
      }

      const comments = await prisma.exceptionComment.findMany({
        where: { exceptionId: id },
        orderBy: { createdAt: "desc" },
      });

      return NextResponse.json(comments);
    } catch (error) {
      console.error("Error fetching exception comments:", error);
      return NextResponse.json(
        { error: "Failed to fetch exception comments" },
        { status: 500 }
      );
    }
  },
  { resource: "compliance.exceptions", action: "view" }
);

// POST create new comment
export const POST = withAuth(
  async (req, context: RouteContext, session) => {
    try {
      const { id } = await context.params;
      const body = await req.json();
      const { content } = body;

      if (!content) {
        return NextResponse.json(
          { error: "Comment content is required" },
          { status: 400 }
        );
      }

      // Fetch exception to get requester and approver for notifications
      const exception = await prisma.exception.findUnique({
        where: { id },
        select: { id: true, name: true, requesterId: true, approverId: true, customerAccountId: true },
      });

      if (!exception) {
        return NextResponse.json(
          { error: "Exception not found" },
          { status: 404 }
        );
      }

      if (!validateTenantAccess(session, exception.customerAccountId)) {
        return forbidden("Access denied to this exception");
      }

      const comment = await prisma.exceptionComment.create({
        data: {
          exceptionId: id,
          content,
          userId: session.id,
          userName: session.name,
        },
      });

      // Determine if commenter is the approver or requester
      const isApproverCommenting = session.id === exception.approverId;
      const isRequesterCommenting = session.id === exception.requesterId;

      // When APPROVER comments → notify REQUESTER with "Sent back" title
      if (isApproverCommenting && exception.requesterId && exception.requesterId !== session.id && exception.customerAccountId) {
        await notificationService.send({
          customerAccountId: exception.customerAccountId,
          actorId: session.id,
          recipientId: exception.requesterId,
          event: 'COMMENT_ADDED',
          title: 'Sent back',
          message: `New comment on Exception "${exception.name}": ${content.substring(0, 100)}`,
          relatedEntityType: 'Exception',
          relatedEntityId: exception.id,
          link: `/compliance/exceptions/${exception.id}`,
          metadata: { entityName: exception.name, commentPreview: content.substring(0, 100) },
          channels: [NOTIFICATION_CHANNELS.INBOX, NOTIFICATION_CHANNELS.EMAIL],
        });
      }

      // When REQUESTER comments → notify APPROVER with "New comment" title
      if (isRequesterCommenting && exception.approverId && exception.approverId !== session.id && exception.customerAccountId) {
        await notificationService.notifyCommentAdded({
          customerAccountId: exception.customerAccountId,
          actorId: session.id,
          recipientId: exception.approverId,
          entityType: "Exception",
          entityId: exception.id,
          entityName: exception.name,
          commentPreview: content.substring(0, 100),
          link: `/compliance/exceptions/${exception.id}`,
          channels: [NOTIFICATION_CHANNELS.INBOX, NOTIFICATION_CHANNELS.EMAIL],
        });
      }

      // If someone else comments (not approver or requester), notify both
      if (!isApproverCommenting && !isRequesterCommenting && exception.customerAccountId) {
        // Notify requester
        if (exception.requesterId && exception.requesterId !== session.id) {
          await notificationService.notifyCommentAdded({
            customerAccountId: exception.customerAccountId,
            actorId: session.id,
            recipientId: exception.requesterId,
            entityType: "Exception",
            entityId: exception.id,
            entityName: exception.name,
            commentPreview: content.substring(0, 100),
            link: `/compliance/exceptions/${exception.id}`,
            channels: [NOTIFICATION_CHANNELS.INBOX, NOTIFICATION_CHANNELS.EMAIL],
          });
        }
        // Notify approver
        if (exception.approverId && exception.approverId !== session.id && exception.approverId !== exception.requesterId) {
          await notificationService.notifyCommentAdded({
            customerAccountId: exception.customerAccountId,
            actorId: session.id,
            recipientId: exception.approverId,
            entityType: "Exception",
            entityId: exception.id,
            entityName: exception.name,
            commentPreview: content.substring(0, 100),
            link: `/compliance/exceptions/${exception.id}`,
            channels: [NOTIFICATION_CHANNELS.INBOX, NOTIFICATION_CHANNELS.EMAIL],
          });
        }
      }

      return NextResponse.json(comment, { status: 201 });
    } catch (error) {
      console.error("Error creating exception comment:", error);
      return NextResponse.json(
        { error: "Failed to create exception comment" },
        { status: 500 }
      );
    }
  },
  { resource: "compliance.exceptions", action: "edit" }
);
