import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth, validateTenantAccess, forbidden } from "@/lib/api-auth";
import { notificationService, NOTIFICATION_EVENTS, NOTIFICATION_CHANNELS } from "@/lib/notification-service";

interface RouteContext {
  params: Promise<{ id: string }>;
}

// GET all clarifications for an evidence
export const GET = withAuth(
  async (req: NextRequest, context: RouteContext, session) => {
    try {
      const { id } = await context.params;

      const evidence = await prisma.qPostEvidence.findUnique({
        where: { id },
        select: { customerAccountId: true },
      });

      if (!evidence) {
        return NextResponse.json({ error: "Evidence not found" }, { status: 404 });
      }

      if (!validateTenantAccess(session, evidence.customerAccountId)) {
        return forbidden("Access denied");
      }

      const clarifications = await prisma.qPostEvidenceClarification.findMany({
        where: { evidenceId: id },
        include: {
          user: {
            select: { id: true, userName: true, fullName: true },
          },
        },
        orderBy: { createdAt: "asc" },
      });

      return NextResponse.json(clarifications);
    } catch (error) {
      console.error("Error fetching clarifications:", error);
      return NextResponse.json({ error: "Failed to fetch clarifications" }, { status: 500 });
    }
  },
  { resource: "qpost-compliance.evidence", action: "view" }
);

// POST create a new clarification (request or reply)
export const POST = withAuth(
  async (req: NextRequest, context: RouteContext, session) => {
    try {
      const { id } = await context.params;
      const body = await req.json();
      const { type, message } = body;

      if (!type || !message?.trim()) {
        return NextResponse.json({ error: "Type and message are required" }, { status: 400 });
      }

      if (!["request", "reply"].includes(type)) {
        return NextResponse.json({ error: "Type must be 'request' or 'reply'" }, { status: 400 });
      }

      const evidence = await prisma.qPostEvidence.findUnique({
        where: { id },
        include: {
          assignee: { select: { id: true, fullName: true } },
          approver: { select: { id: true, fullName: true } },
        },
      });

      if (!evidence) {
        return NextResponse.json({ error: "Evidence not found" }, { status: 404 });
      }

      if (!validateTenantAccess(session, evidence.customerAccountId)) {
        return forbidden("Access denied");
      }

      const clarification = await prisma.qPostEvidenceClarification.create({
        data: {
          evidenceId: id,
          userId: session.id,
          type,
          message: message.trim(),
        },
        include: {
          user: {
            select: { id: true, userName: true, fullName: true },
          },
        },
      });

      // Send notifications
      try {
        if (type === "request" && evidence.assigneeId) {
          // Approver requesting clarification → notify assignee
          void notificationService.send({
            customerAccountId: evidence.customerAccountId,
            actorId: session.id,
            recipientId: evidence.assigneeId,
            event: NOTIFICATION_EVENTS.GOVERNANCE_SUBMIT_FOR_APPROVAL,
            title: "Clarification Requested",
            message: `Approver has requested clarification for evidence "${evidence.name}"`,
            link: `/qpost-compliance/evidence/${id}`,
            relatedEntityType: "evidence",
            relatedEntityId: id,
            channels: [NOTIFICATION_CHANNELS.INBOX, NOTIFICATION_CHANNELS.EMAIL],
          });
        } else if (type === "reply" && evidence.approverId) {
          // Assignee replying → notify approver
          void notificationService.send({
            customerAccountId: evidence.customerAccountId,
            actorId: session.id,
            recipientId: evidence.approverId,
            event: NOTIFICATION_EVENTS.GOVERNANCE_SUBMIT_FOR_APPROVAL,
            title: "Clarification Reply",
            message: `Assignee has replied to your clarification for evidence "${evidence.name}"`,
            link: `/qpost-compliance/evidence/${id}`,
            relatedEntityType: "evidence",
            relatedEntityId: id,
            channels: [NOTIFICATION_CHANNELS.INBOX, NOTIFICATION_CHANNELS.EMAIL],
          });
        }
      } catch (notifError) {
        console.error("Error sending clarification notification:", notifError);
      }

      return NextResponse.json(clarification, { status: 201 });
    } catch (error) {
      console.error("Error creating clarification:", error);
      return NextResponse.json({ error: "Failed to create clarification" }, { status: 500 });
    }
  },
  { resource: "qpost-compliance.evidence", action: "edit" }
);
