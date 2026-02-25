import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth, getTenantFilter, validateTenantAccess, forbidden, canAccessRecord } from "@/lib/api-auth";
import { hasPermission } from "@/lib/permissions";
import { notificationService } from '@/lib/notification-service';

interface RouteContext {
  params: Promise<{ id: string }>;
}

// GET a single risk response - filtered by customer account and department scope
export const GET = withAuth(
  async (req, context: RouteContext, session) => {
    try {
      const { id } = await context.params;
      const tenantFilter = getTenantFilter(session);

      const response = await prisma.riskResponse.findFirst({
        where: { id, ...tenantFilter },
        include: {
          risk: {
            select: {
              id: true,
              riskId: true,
              name: true,
              category: true,
              department: true,
              departmentId: true,
              riskRating: true,
              owner: {
                select: {
                  id: true,
                  fullName: true,
                },
              },
              ownerId: true,
            },
          },
        },
      });

      if (!response) {
        return NextResponse.json(
          { error: "Risk response not found" },
          { status: 404 }
        );
      }

      // Check department scope access
      if (!canAccessRecord(session, "risk.response", "view", {
        departmentId: response.risk?.departmentId,
        ownerId: response.risk?.ownerId,
      })) {
        return forbidden("Access denied - this record belongs to a different department");
      }

      return NextResponse.json(response);
    } catch (error) {
      console.error("Error fetching risk response:", error);
      return NextResponse.json(
        { error: "Failed to fetch risk response" },
        { status: 500 }
      );
    }
  },
  { resource: "risk.response", action: "view" }
);

// PUT update a risk response - with tenant validation and approval workflow
export const PUT = withAuth(
  async (req, context: RouteContext, session) => {
    try {
      const { id } = await context.params;
      const body = await req.json();
      const {
        responseType,
        actionTitle,
        actionDescription,
        assignee,
        dueDate,
        status,
        completionDate,
        notes,
      } = body;

      const existing = await prisma.riskResponse.findUnique({
        where: { id },
        include: {
          risk: {
            select: { departmentId: true, ownerId: true, id: true, riskId: true, name: true },
          },
        },
      });
      if (!existing) {
        return NextResponse.json(
          { error: "Risk response not found" },
          { status: 404 }
        );
      }

      if (!validateTenantAccess(session, existing.customerAccountId)) {
        return forbidden("Access denied to this risk response");
      }

      // Check department scope access for edit
      if (!canAccessRecord(session, "risk.response", "edit", {
        departmentId: existing.risk?.departmentId,
        ownerId: existing.risk?.ownerId,
      })) {
        return forbidden("Access denied - this record belongs to a different department");
      }

      // Per UAT: Approval transitions to In-Progress directly (no Completed intermediate state)
      // If status is being changed to In-Progress from Awaiting Approval (approval), require 'approve' permission
      const isApprovalAction = status === "In-Progress" && existing.status === "Awaiting Approval";
      // Also check for Send Back action (Awaiting Approval → Open)
      const isSendBackAction = status === "Open" && existing.status === "Awaiting Approval";

      if (isApprovalAction || isSendBackAction) {
        const canApprove = hasPermission(
          session.permissions,
          "risk.response",
          "approve",
          {
            userDepartmentId: session.departmentId || undefined,
            resourceDepartmentId: existing.risk?.departmentId || undefined,
          }
        );
        if (!canApprove) {
          return forbidden("You don't have permission to approve/send back risk responses");
        }
      }

      // Per UAT: Status flow is Awaiting Approval → In-Progress → Closed
      // Open → Awaiting Approval (submitting for approval)
      // Awaiting Approval → In-Progress (approved) or Open (sent back)
      // In-Progress → Closed (treatment complete)
      const validTransitions: Record<string, string[]> = {
        "Open": ["Awaiting Approval"],
        "Awaiting Approval": ["In-Progress", "Open"], // In-Progress = approved, Open = sent back
        "In-Progress": ["Closed"],
        "Closed": [], // Terminal state
      };

      if (status && status !== existing.status) {
        const allowedNextStates = validTransitions[existing.status] || [];
        if (!allowedNextStates.includes(status)) {
          return NextResponse.json(
            { error: `Invalid status transition from ${existing.status} to ${status}` },
            { status: 400 }
          );
        }
      }

      const response = await prisma.riskResponse.update({
        where: { id },
        data: {
          responseType,
          actionTitle,
          actionDescription,
          assignee,
          dueDate: dueDate ? new Date(dueDate) : undefined,
          status,
          completionDate: completionDate ? new Date(completionDate) : undefined,
          notes,
        },
        include: {
          risk: {
            select: {
              id: true,
              riskId: true,
              name: true,
            },
          },
        },
      });

      // Update risk status based on response status (per UAT flow)
      if (status === "In-Progress" && existing.status === "Awaiting Approval") {
        // Response approved - treatment execution started - update risk status
        await prisma.risk.update({
          where: { id: existing.risk?.id },
          data: { status: "In Treatment" },
        });

        // Notify risk owner that their risk response was approved
        if (existing.risk?.ownerId && existing.risk.ownerId !== session.id && session.customerAccountId) {
          await notificationService.notifyApprovalGranted({
            customerAccountId: session.customerAccountId,
            actorId: session.id,
            requesterId: existing.risk.ownerId,
            entityType: 'Risk Response',
            entityId: id,
            entityName: `${existing.risk.riskId}: ${response.actionTitle}`,
            link: `/risks/response/${existing.risk.id}`,
          });
        }
      } else if (status === "Open" && existing.status === "Awaiting Approval") {
        // Send back action - notify risk owner
        if (existing.risk?.ownerId && existing.risk.ownerId !== session.id && session.customerAccountId) {
          await notificationService.notifySentBack({
            customerAccountId: session.customerAccountId,
            actorId: session.id,
            assigneeId: existing.risk.ownerId,
            entityType: 'Risk Response',
            entityId: id,
            entityName: `${existing.risk.riskId}: ${response.actionTitle}`,
            reason: notes || undefined,
            link: `/risks/response/${existing.risk.id}`,
          });
        }
      } else if (status === "Closed" && existing.status === "In-Progress") {
        // Check if all responses for this risk are closed
        const openResponses = await prisma.riskResponse.count({
          where: {
            riskId: existing.riskId,
            status: { not: "Closed" },
          },
        });
        if (openResponses === 0) {
          // All responses closed - risk can be closed
          await prisma.risk.update({
            where: { id: existing.risk?.id },
            data: { status: "Closed" },
          });
        }
      }

      return NextResponse.json(response);
    } catch (error) {
      console.error("Error updating risk response:", error);
      return NextResponse.json(
        { error: "Failed to update risk response" },
        { status: 500 }
      );
    }
  },
  { resource: "risk.response", action: "edit" }
);

// DELETE a risk response - with tenant validation and department scope
export const DELETE = withAuth(
  async (req, context: RouteContext, session) => {
    try {
      const { id } = await context.params;

      const existing = await prisma.riskResponse.findUnique({
        where: { id },
        include: {
          risk: {
            select: { departmentId: true, ownerId: true },
          },
        },
      });
      if (!existing) {
        return NextResponse.json(
          { error: "Risk response not found" },
          { status: 404 }
        );
      }

      if (!validateTenantAccess(session, existing.customerAccountId)) {
        return forbidden("Access denied to this risk response");
      }

      // Check department scope access for delete
      if (!canAccessRecord(session, "risk.response", "delete", {
        departmentId: existing.risk?.departmentId,
        ownerId: existing.risk?.ownerId,
      })) {
        return forbidden("Access denied - this record belongs to a different department");
      }

      // Only allow deleting Open responses (not submitted/approved)
      if (existing.status !== "Open") {
        return NextResponse.json(
          { error: "Only open responses can be deleted" },
          { status: 400 }
        );
      }

      await prisma.riskResponse.delete({ where: { id } });

      return NextResponse.json({
        message: "Risk response deleted successfully",
      });
    } catch (error) {
      console.error("Error deleting risk response:", error);
      return NextResponse.json(
        { error: "Failed to delete risk response" },
        { status: 500 }
      );
    }
  },
  { resource: "risk.response", action: "delete" }
);
