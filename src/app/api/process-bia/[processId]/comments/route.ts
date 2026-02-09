import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth, validateTenantAccess, forbidden } from "@/lib/api-auth";
import { notificationService } from "@/lib/notification-service";

interface RouteContext {
  params: Promise<{ processId: string }>;
}

// GET comments for a process BIA
export const GET = withAuth(
  async (req, context: RouteContext, session) => {
    try {
      const { processId } = await context.params;

      // Check if process belongs to user's tenant
      const process = await prisma.process.findUnique({
        where: { id: processId },
        select: { customerAccountId: true },
      });

      if (!process) {
        return NextResponse.json(
          { error: "Process not found" },
          { status: 404 }
        );
      }

      if (!validateTenantAccess(session, process.customerAccountId)) {
        return forbidden("Access denied to this process");
      }

      const processBIA = await prisma.processBIA.findUnique({
        where: { processId },
        include: {
          biaComments: {
            orderBy: { createdAt: "desc" },
          },
        },
      });

      if (!processBIA) {
        return NextResponse.json([]);
      }

      return NextResponse.json(processBIA.biaComments);
    } catch (error) {
      console.error("Error fetching BIA comments:", error);
      return NextResponse.json(
        { error: "Failed to fetch BIA comments" },
        { status: 500 }
      );
    }
  },
  { resource: "organization.bia", action: "view" }
);

// POST add a new comment to process BIA
export const POST = withAuth(
  async (req, context: RouteContext, session) => {
    try {
      const { processId } = await context.params;
      const body = await req.json();
      const { comment, action, newStatus } = body;

      if (!comment || !action) {
        return NextResponse.json(
          { error: "Missing required fields: comment, action" },
          { status: 400 }
        );
      }

      // Fetch process to get owner for notifications
      const process = await prisma.process.findUnique({
        where: { id: processId },
        select: { id: true, name: true, ownerId: true, customerAccountId: true },
      });

      if (!process) {
        return NextResponse.json(
          { error: "Process not found" },
          { status: 404 }
        );
      }

      if (!validateTenantAccess(session, process.customerAccountId)) {
        return forbidden("Access denied to this process");
      }

      // Get or create the ProcessBIA record
      let processBIA = await prisma.processBIA.findUnique({
        where: { processId },
      });

      if (!processBIA) {
        // Create a new ProcessBIA record if one doesn't exist
        processBIA = await prisma.processBIA.create({
          data: {
            processId,
            status: "Open",
          },
        });
      }

      // Create the comment
      const newComment = await prisma.processBIAComment.create({
        data: {
          processBIAId: processBIA.id,
          comment,
          createdBy: session.id,
          createdByName: session.name || "Unknown",
          action,
        },
      });

      // Update the ProcessBIA status if a new status was provided
      if (newStatus) {
        await prisma.processBIA.update({
          where: { id: processBIA.id },
          data: {
            status: newStatus,
            ...(newStatus === "Approved" && { approvedAt: new Date() }),
          },
        });
      }

      // Notify the process owner about the comment
      if (process.ownerId && process.ownerId !== session.id && process.customerAccountId) {
        await notificationService.notifyCommentAdded({
          customerAccountId: process.customerAccountId,
          actorId: session.id,
          recipientId: process.ownerId,
          entityType: "Process BIA",
          entityId: process.id,
          entityName: process.name,
          commentPreview: comment.substring(0, 100),
          link: `/organization/bia/${process.id}`,
        });
      }

      // Special case: send-back action triggers additional notification
      if (action === "sendback" && process.ownerId && process.ownerId !== session.id && process.customerAccountId) {
        await notificationService.notifySentBack({
          customerAccountId: process.customerAccountId,
          actorId: session.id,
          assigneeId: process.ownerId,
          entityType: "Process BIA",
          entityId: process.id,
          entityName: process.name,
          reason: comment,
          link: `/organization/bia/${process.id}`,
        });
      }

      return NextResponse.json(newComment, { status: 201 });
    } catch (error) {
      console.error("Error adding BIA comment:", error);
      return NextResponse.json(
        { error: "Failed to add BIA comment" },
        { status: 500 }
      );
    }
  },
  { resource: "organization.bia", action: "edit" }
);
