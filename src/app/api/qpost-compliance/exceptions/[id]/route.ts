import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth, getTenantFilter, validateTenantAccess, forbidden } from "@/lib/api-auth";
import { notificationService, NOTIFICATION_CHANNELS, NOTIFICATION_EVENTS } from "@/lib/notification-service";

interface RouteContext {
  params: Promise<{ id: string }>;
}

// GET single QPost exception - filtered by customer account and department for DepartmentReviewer
export const GET = withAuth(
  async (req, context: RouteContext, session) => {
    try {
      const { id } = await context.params;
      const tenantFilter = getTenantFilter(session);

      // Build where clause
      const where: Record<string, unknown> = { id, ...tenantFilter };

      // DepartmentReviewer can only see exceptions from their own department
      const isDepartmentReviewer = session.roles.includes("DepartmentReviewer");
      const isDepartmentContributor = session.roles.includes("DepartmentContributor");
      const hasAdminRole = session.roles.some(role =>
        ["GRCAdministrator", "CustomerAdministrator", "Reviewer", "Contributor"].includes(role)
      );

      if ((isDepartmentReviewer || isDepartmentContributor) && !hasAdminRole) {
        if (session.departmentId) {
          where.departmentId = session.departmentId;
        } else {
          where.departmentId = "__NO_DEPARTMENT__";
        }
      }

      const exception = await prisma.qPostException.findFirst({
        where,
        include: {
          department: true,
          policy: true,
          risk: {
            include: {
              category: true,
            },
          },
          requester: {
            select: {
              id: true,
              userName: true,
              fullName: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
          approver: {
            select: {
              id: true,
              userName: true,
              fullName: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
          comments: {
            orderBy: { createdAt: "desc" },
          },
          policyExceptions: {
            include: {
              policy: true,
            },
          },
        },
      });

      if (!exception) {
        return NextResponse.json(
          { error: "Exception not found" },
          { status: 404 }
        );
      }

      return NextResponse.json(exception);
    } catch (error) {
      console.error("Error fetching QPost exception:", error);
      return NextResponse.json(
        { error: "Failed to fetch exception" },
        { status: 500 }
      );
    }
  },
  { resource: "qpost-compliance.exceptions", action: "view" }
);

// PUT update QPost exception - with tenant validation
export const PUT = withAuth(
  async (req, context: RouteContext, session) => {
    try {
      const { id } = await context.params;
      const body = await req.json();
      const {
        name,
        description,
        category,
        departmentId,
        policyId,
        riskId,
        frameworkId,
        requirementId,
        requesterId,
        approverId,
        approvedBy,
        approvedDate,
        status,
        endDate,
      } = body;

      // First, verify the exception belongs to the user's customer account
      const existing = await prisma.qPostException.findUnique({
        where: { id },
        select: {
          customerAccountId: true,
          departmentId: true,
          status: true,
          name: true,
          exceptionCode: true,
          requesterId: true,
        },
      });

      if (!existing) {
        return NextResponse.json(
          { error: "Exception not found" },
          { status: 404 }
        );
      }

      if (!validateTenantAccess(session, existing.customerAccountId)) {
        return forbidden("Access denied to this exception");
      }

      // DepartmentReviewer can only update exceptions from their own department
      const isDepartmentReviewer = session.roles.includes("DepartmentReviewer");
      const isDepartmentContributor = session.roles.includes("DepartmentContributor");
      const hasAdminRole = session.roles.some(role =>
        ["GRCAdministrator", "CustomerAdministrator", "Reviewer", "Contributor"].includes(role)
      );

      if ((isDepartmentReviewer || isDepartmentContributor) && !hasAdminRole) {
        if (existing.departmentId !== session.departmentId) {
          return forbidden("Access denied - you can only update exceptions from your department");
        }
      }

      // Build update data - only include fields that are explicitly provided
      const updateData: Record<string, unknown> = {};

      // Only update fields that are explicitly provided in the request body
      if (name !== undefined) updateData.name = name;
      if (description !== undefined) updateData.description = description;
      if (status !== undefined) updateData.status = status;
      if (departmentId !== undefined) updateData.departmentId = departmentId || null;
      if (requesterId !== undefined) updateData.requesterId = requesterId || null;
      if (approverId !== undefined) updateData.approverId = approverId || null;
      if (endDate !== undefined) updateData.endDate = endDate ? new Date(endDate) : null;
      if (approvedBy !== undefined) updateData.approvedBy = approvedBy;
      if (approvedDate !== undefined) updateData.approvedDate = approvedDate ? new Date(approvedDate) : null;

      // Only update category if provided
      if (category !== undefined) {
        updateData.category = category;
        // Clear old references and set new one based on category
        updateData.policyId = null;
        updateData.riskId = null;
        updateData.frameworkId = null;
        updateData.requirementId = null;

        if (category === "Policy" && policyId) {
          updateData.policyId = policyId;
        } else if (category === "Risk" && riskId) {
          updateData.riskId = riskId;
        } else if (category === "Compliance") {
          if (frameworkId) updateData.frameworkId = frameworkId;
          if (requirementId) updateData.requirementId = requirementId;
        }
      }

      const exception = await prisma.qPostException.update({
        where: { id },
        data: updateData,
        include: {
          department: true,
          policy: true,
          risk: true,
          framework: true,
          requirement: true,
          requester: {
            select: {
              id: true,
              userName: true,
              fullName: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
          approver: {
            select: {
              id: true,
              userName: true,
              fullName: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
          comments: {
            orderBy: { createdAt: "desc" },
          },
        },
      });

      // Send notifications based on status changes
      if (session.customerAccountId && existing.requesterId && existing.requesterId !== session.id) {
        // Notify requester when their exception is rejected/denied
        if (status === "Rejected" && existing.status !== "Rejected") {
          const latestComment = exception.comments?.[0];
          const rejectionReason = latestComment?.content?.startsWith("[Send Back]")
            ? latestComment.content.replace("[Send Back] ", "")
            : undefined;

          await notificationService.send({
            customerAccountId: session.customerAccountId,
            actorId: session.id,
            recipientId: existing.requesterId,
            event: NOTIFICATION_EVENTS.EXCEPTION_DENIED,
            title: 'Exception Denied',
            message: `Exception "${existing.exceptionCode}: ${existing.name}" has been denied.${rejectionReason ? ' Reason: ' + rejectionReason : ''}`,
            relatedEntityType: 'exception',
            relatedEntityId: id,
            link: `/qpost-compliance/exceptions/${id}`,
            metadata: {
              entityName: existing.name,
              exceptionCode: existing.exceptionCode,
              exceptionName: existing.name,
              deniedBy: session.name || 'Approver',
              reason: rejectionReason,
            },
            channels: [NOTIFICATION_CHANNELS.INBOX, NOTIFICATION_CHANNELS.EMAIL],
          });
        }

        // Notify requester when their exception is approved
        if (status === "Approved" && existing.status !== "Approved") {
          await notificationService.send({
            customerAccountId: session.customerAccountId,
            actorId: session.id,
            recipientId: existing.requesterId,
            event: NOTIFICATION_EVENTS.EXCEPTION_APPROVED,
            title: 'Exception Approved',
            message: `Exception "${existing.exceptionCode}: ${existing.name}" has been approved.`,
            relatedEntityType: 'exception',
            relatedEntityId: id,
            link: `/qpost-compliance/exceptions/${id}`,
            metadata: {
              entityName: existing.name,
              exceptionCode: existing.exceptionCode,
              exceptionName: existing.name,
              approvedBy: session.name || 'Approver',
            },
            channels: [NOTIFICATION_CHANNELS.INBOX, NOTIFICATION_CHANNELS.EMAIL],
          });
        }

        // Notify requester when exception is authorized
        if (status === "Authorised" && existing.status !== "Authorised") {
          await notificationService.send({
            customerAccountId: session.customerAccountId,
            actorId: session.id,
            recipientId: existing.requesterId,
            event: NOTIFICATION_EVENTS.EXCEPTION_AUTHORIZED,
            title: 'Exception Authorized',
            message: `Exception "${existing.exceptionCode}: ${existing.name}" has been authorized.`,
            relatedEntityType: 'exception',
            relatedEntityId: id,
            link: `/qpost-compliance/exceptions/${id}`,
            metadata: {
              entityName: existing.name,
              exceptionCode: existing.exceptionCode,
              exceptionName: existing.name,
              authorizedBy: session.name || 'Authorizer',
            },
            channels: [NOTIFICATION_CHANNELS.INBOX, NOTIFICATION_CHANNELS.EMAIL],
          });
        }

        // Notify requester when exception is sent back
        if (status === "Sent Back" && existing.status !== "Sent Back") {
          const latestComment = exception.comments?.[0];
          const reason = latestComment?.content;

          await notificationService.send({
            customerAccountId: session.customerAccountId,
            actorId: session.id,
            recipientId: existing.requesterId,
            event: NOTIFICATION_EVENTS.EXCEPTION_SENT_BACK,
            title: 'Exception Sent Back',
            message: `Exception "${existing.exceptionCode}: ${existing.name}" has been sent back for revision.${reason ? ' Reason: ' + reason : ''}`,
            relatedEntityType: 'exception',
            relatedEntityId: id,
            link: `/qpost-compliance/exceptions/${id}`,
            metadata: {
              entityName: existing.name,
              exceptionCode: existing.exceptionCode,
              exceptionName: existing.name,
              sentBackBy: session.name || 'Reviewer',
              reason: reason,
            },
            channels: [NOTIFICATION_CHANNELS.INBOX, NOTIFICATION_CHANNELS.EMAIL],
          });
        }

        // Notify requester when exception is closed
        if (status === "Closed" && existing.status !== "Closed") {
          await notificationService.send({
            customerAccountId: session.customerAccountId,
            actorId: session.id,
            recipientId: existing.requesterId,
            event: NOTIFICATION_EVENTS.EXCEPTION_CLOSED,
            title: 'Exception Closed',
            message: `Exception "${existing.exceptionCode}: ${existing.name}" has been closed.`,
            relatedEntityType: 'exception',
            relatedEntityId: id,
            link: `/qpost-compliance/exceptions/${id}`,
            metadata: {
              entityName: existing.name,
              exceptionCode: existing.exceptionCode,
              exceptionName: existing.name,
              closedBy: session.name || 'System',
            },
            channels: [NOTIFICATION_CHANNELS.INBOX, NOTIFICATION_CHANNELS.EMAIL],
          });
        }
      }

      return NextResponse.json(exception);
    } catch (error: unknown) {
      console.error("Error updating QPost exception:", error);
      if ((error as { code?: string }).code === "P2025") {
        return NextResponse.json(
          { error: "Exception not found" },
          { status: 404 }
        );
      }
      return NextResponse.json(
        { error: "Failed to update exception" },
        { status: 500 }
      );
    }
  },
  { resource: "qpost-compliance.exceptions", action: "edit" }
);

// DELETE QPost exception - with tenant validation
export const DELETE = withAuth(
  async (req, context: RouteContext, session) => {
    try {
      const { id } = await context.params;

      // First, verify the exception belongs to the user's customer account
      const existing = await prisma.qPostException.findUnique({
        where: { id },
        select: { customerAccountId: true, departmentId: true },
      });

      if (!existing) {
        return NextResponse.json(
          { error: "Exception not found" },
          { status: 404 }
        );
      }

      if (!validateTenantAccess(session, existing.customerAccountId)) {
        return forbidden("Access denied to this exception");
      }

      // DepartmentReviewer can only delete exceptions from their own department
      const isDepartmentReviewer = session.roles.includes("DepartmentReviewer");
      const isDepartmentContributor = session.roles.includes("DepartmentContributor");
      const hasAdminRole = session.roles.some(role =>
        ["GRCAdministrator", "CustomerAdministrator", "Reviewer", "Contributor"].includes(role)
      );

      if ((isDepartmentReviewer || isDepartmentContributor) && !hasAdminRole) {
        if (existing.departmentId !== session.departmentId) {
          return forbidden("Access denied - you can only delete exceptions from your department");
        }
      }

      await prisma.qPostException.delete({
        where: { id },
      });

      return NextResponse.json({ message: "Exception deleted successfully" });
    } catch (error: unknown) {
      console.error("Error deleting QPost exception:", error);
      if ((error as { code?: string }).code === "P2025") {
        return NextResponse.json(
          { error: "Exception not found" },
          { status: 404 }
        );
      }
      return NextResponse.json(
        { error: "Failed to delete exception" },
        { status: 500 }
      );
    }
  },
  { resource: "qpost-compliance.exceptions", action: "delete" }
);
