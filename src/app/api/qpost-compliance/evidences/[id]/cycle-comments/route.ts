import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth, validateTenantAccess, forbidden } from "@/lib/api-auth";
import { notificationService } from "@/lib/notification-service";

interface RouteContext {
  params: Promise<{ id: string }>;
}

// GET cycle comments for a specific QPost evidence + cycle period
export const GET = withAuth(
  async (req, context: RouteContext, session) => {
    try {
      const { id } = await context.params;
      const { searchParams } = new URL(req.url);
      const cyclePeriod = searchParams.get("cyclePeriod");

      if (!cyclePeriod) {
        return NextResponse.json(
          { error: "cyclePeriod query parameter is required" },
          { status: 400 }
        );
      }

      // Check if evidence belongs to user's tenant
      const evidence = await prisma.qPostEvidence.findUnique({
        where: { id },
        select: { customerAccountId: true },
      });

      if (!evidence) {
        return NextResponse.json(
          { error: "Evidence not found" },
          { status: 404 }
        );
      }

      if (!validateTenantAccess(session, evidence.customerAccountId)) {
        return forbidden("Access denied to this evidence");
      }

      const comments = await prisma.qPostEvidenceCycleComment.findMany({
        where: {
          evidenceId: id,
          cyclePeriod,
        },
        orderBy: { createdAt: "asc" },
      });

      return NextResponse.json(comments);
    } catch (error) {
      console.error("Error fetching QPost cycle comments:", error);
      return NextResponse.json(
        { error: "Failed to fetch cycle comments" },
        { status: 500 }
      );
    }
  },
  { resource: "qpost-compliance.evidence", action: "view" }
);

// POST create a new cycle comment (sendback or resubmit)
export const POST = withAuth(
  async (req, context: RouteContext, session) => {
    try {
      const { id } = await context.params;
      const body = await req.json();
      const { cyclePeriod, action, comment } = body;

      if (!cyclePeriod || !action || !comment) {
        return NextResponse.json(
          { error: "cyclePeriod, action, and comment are required" },
          { status: 400 }
        );
      }

      if (!["sendback", "resubmit"].includes(action)) {
        return NextResponse.json(
          { error: "action must be 'sendback' or 'resubmit'" },
          { status: 400 }
        );
      }

      // Check if evidence belongs to user's tenant
      const evidence = await prisma.qPostEvidence.findUnique({
        where: { id },
        select: { id: true, name: true, assigneeId: true, customerAccountId: true },
      });

      if (!evidence) {
        return NextResponse.json(
          { error: "Evidence not found" },
          { status: 404 }
        );
      }

      if (!validateTenantAccess(session, evidence.customerAccountId)) {
        return forbidden("Access denied to this evidence");
      }

      const newComment = await prisma.qPostEvidenceCycleComment.create({
        data: {
          evidenceId: id,
          cyclePeriod,
          action,
          comment,
          userId: session.id || null,
          userName: session.name || null,
        },
      });

      // Notify evidence assignee about the comment
      if (evidence.assigneeId && evidence.assigneeId !== session.id && evidence.customerAccountId) {
        await notificationService.notifyCommentAdded({
          customerAccountId: evidence.customerAccountId,
          actorId: session.id,
          recipientId: evidence.assigneeId,
          entityType: "Evidence",
          entityId: evidence.id,
          entityName: evidence.name,
          commentPreview: comment.substring(0, 100),
          link: `/qpost-compliance/evidence/${evidence.id}`,
        });
      }

      // Special case: send-back action triggers additional notification
      if (action === "sendback" && evidence.assigneeId && evidence.assigneeId !== session.id && evidence.customerAccountId) {
        await notificationService.notifySentBack({
          customerAccountId: evidence.customerAccountId,
          actorId: session.id,
          assigneeId: evidence.assigneeId,
          entityType: "Evidence",
          entityId: evidence.id,
          entityName: evidence.name,
          reason: comment,
          link: `/qpost-compliance/evidence/${evidence.id}`,
        });
      }

      return NextResponse.json(newComment, { status: 201 });
    } catch (error) {
      console.error("Error creating QPost cycle comment:", error);
      return NextResponse.json(
        { error: "Failed to create cycle comment" },
        { status: 500 }
      );
    }
  },
  { resource: "qpost-compliance.evidence", action: "edit" }
);
