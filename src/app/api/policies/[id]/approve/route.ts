import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth, validateTenantAccess, forbidden } from "@/lib/api-auth";
import { notificationService } from '@/lib/notification-service';

interface RouteContext {
  params: Promise<{ id: string }>;
}

// POST approve policy - requires approve permission
export const POST = withAuth(
  async (req, context: RouteContext, session) => {
    try {
      const { id } = await context.params;

      // First, verify the policy exists and get its details
      const existing = await prisma.policy.findUnique({
        where: { id },
        select: {
          customerAccountId: true,
          status: true,
          approverId: true,
        },
      });

      if (!existing) {
        return NextResponse.json(
          { error: "Policy not found" },
          { status: 404 }
        );
      }

      if (!validateTenantAccess(session, existing.customerAccountId)) {
        return forbidden("Access denied to this policy");
      }

      // Check if status is Draft (only Draft policies can be approved)
      if (existing.status !== "Draft") {
        return NextResponse.json(
          { error: "Only policies with Draft status can be approved" },
          { status: 400 }
        );
      }

      // Verify the user is the assigned approver or has approve permission
      const userId = session.id;
      if (existing.approverId && existing.approverId !== userId) {
        // Check if user has CustomerAdministrator role (they can approve any)
        const userRoles = session.roles || [];
        if (!userRoles.includes("CustomerAdministrator")) {
          return NextResponse.json(
            { error: "You are not authorized to approve this policy" },
            { status: 403 }
          );
        }
      }

      // Update status to Approved
      const policy = await prisma.policy.update({
        where: { id },
        data: {
          status: "Approved",
        },
        include: {
          department: true,
          assignee: true,
          approver: true,
          attachments: true,
        },
      });

      // Notify policy assignee that their policy was approved
      if (policy.assigneeId && policy.assigneeId !== session.id && session.customerAccountId) {
        await notificationService.notifyApprovalGranted({
          customerAccountId: session.customerAccountId,
          actorId: session.id,
          requesterId: policy.assigneeId,
          entityType: 'Policy',
          entityId: policy.id,
          entityName: policy.name,
          link: `/compliance/governance/${policy.id}`,
        });
      }

      return NextResponse.json(policy);
    } catch (error) {
      console.error("Error approving policy:", error);
      return NextResponse.json(
        { error: "Failed to approve policy" },
        { status: 500 }
      );
    }
  },
  { resource: "compliance.governance", action: "approve" }
);
