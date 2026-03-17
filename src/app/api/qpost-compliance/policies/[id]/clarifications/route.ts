import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth, validateTenantAccess, forbidden } from "@/lib/api-auth";
import { notificationService, NOTIFICATION_EVENTS, NOTIFICATION_CHANNELS } from "@/lib/notification-service";

interface RouteContext {
  params: Promise<{ id: string }>;
}

// GET all clarifications for a policy
export const GET = withAuth(
  async (req: NextRequest, context: RouteContext, session) => {
    try {
      const { id } = await context.params;

      const policy = await prisma.qPostPolicy.findUnique({
        where: { id },
        select: { customerAccountId: true },
      });

      if (!policy) {
        return NextResponse.json({ error: "Policy not found" }, { status: 404 });
      }

      if (!validateTenantAccess(session, policy.customerAccountId)) {
        return forbidden("Access denied");
      }

      const clarifications = await prisma.qPostPolicyClarification.findMany({
        where: { policyId: id },
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
  { resource: "qpost-compliance.governance", action: "view" }
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

      const policy = await prisma.qPostPolicy.findUnique({
        where: { id },
        include: {
          assignee: { select: { id: true, fullName: true } },
          approver: { select: { id: true, fullName: true } },
        },
      });

      if (!policy) {
        return NextResponse.json({ error: "Policy not found" }, { status: 404 });
      }

      if (!validateTenantAccess(session, policy.customerAccountId)) {
        return forbidden("Access denied");
      }

      const clarification = await prisma.qPostPolicyClarification.create({
        data: {
          policyId: id,
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
        if (type === "request" && policy.assigneeId) {
          // Approver requesting clarification → notify assignee
          void notificationService.send({
            customerAccountId: policy.customerAccountId,
            actorId: session.id,
            recipientId: policy.assigneeId,
            event: NOTIFICATION_EVENTS.GOVERNANCE_SUBMIT_FOR_APPROVAL,
            title: "Clarification Requested",
            message: `Approver has requested clarification for "${policy.name}"`,
            link: `/qpost-compliance/governance/${id}`,
            relatedEntityType: "governance",
            relatedEntityId: id,
            channels: [NOTIFICATION_CHANNELS.INBOX, NOTIFICATION_CHANNELS.EMAIL],
          });
        } else if (type === "reply" && policy.approverId) {
          // Assignee replying → notify approver
          void notificationService.send({
            customerAccountId: policy.customerAccountId,
            actorId: session.id,
            recipientId: policy.approverId,
            event: NOTIFICATION_EVENTS.GOVERNANCE_SUBMIT_FOR_APPROVAL,
            title: "Clarification Reply",
            message: `Assignee has replied to your clarification for "${policy.name}"`,
            link: `/qpost-compliance/governance/${id}`,
            relatedEntityType: "governance",
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
  { resource: "qpost-compliance.governance", action: "edit" }
);
