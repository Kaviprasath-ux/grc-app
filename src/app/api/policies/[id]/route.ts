import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth, getTenantFilter, validateTenantAccess, forbidden } from "@/lib/api-auth";
import { aiDeleteService } from "@/services/ai-delete-service";
import { unlink } from "fs/promises";
import path from "path";
import { notificationService, NOTIFICATION_EVENTS, NOTIFICATION_CHANNELS } from "@/lib/notification-service";

interface RouteContext {
  params: Promise<{ id: string }>;
}

// GET single policy with all related data - filtered by customer account
export const GET = withAuth(
  async (req, context: RouteContext, session) => {
    try {
      const { id } = await context.params;
      const tenantFilter = getTenantFilter(session);

      const policy = await prisma.policy.findFirst({
        where: { id, ...tenantFilter },
        include: {
          department: true,
          assignee: true,
          approver: true,
          attachments: true,
          policyControls: {
            include: {
              control: {
                include: {
                  domain: true,
                  framework: true,
                },
              },
            },
          },
          policyExceptions: {
            include: {
              exception: true,
            },
          },
          vaultDocumentLinks: {
            include: {
              document: true,
            },
          },
        },
      });

      if (!policy) {
        return NextResponse.json(
          { error: "Policy not found" },
          { status: 404 }
        );
      }

      return NextResponse.json(policy);
    } catch (error) {
      console.error("Error fetching policy:", error);
      return NextResponse.json(
        { error: "Failed to fetch policy" },
        { status: 500 }
      );
    }
  },
  { resource: "compliance.governance", action: "view" }
);

// PUT update policy - with tenant validation
export const PUT = withAuth(
  async (req, context: RouteContext, session) => {
    try {
      const { id } = await context.params;
      const body = await req.json();
      const {
        name,
        version,
        documentType,
        recurrence,
        departmentId,
        assigneeId,
        approverId,
        status,
        effectiveDate,
        reviewDate,
        content,
        aiReviewStatus,
        aiReviewScore,
        aiReviewJustification,
      } = body;

      // First, verify the policy belongs to the user's customer account and get current assignments
      const existing = await prisma.policy.findUnique({
        where: { id },
        select: { customerAccountId: true, assigneeId: true, approverId: true, name: true },
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

      const policy = await prisma.policy.update({
        where: { id },
        data: {
          name,
          version,
          documentType,
          recurrence,
          departmentId,
          assigneeId,
          approverId,
          status,
          effectiveDate: effectiveDate ? new Date(effectiveDate) : null,
          reviewDate: reviewDate ? new Date(reviewDate) : null,
          content,
          aiReviewStatus,
          aiReviewScore,
          aiReviewJustification,
        },
        include: {
          department: true,
          assignee: true,
          approver: true,
          attachments: true,
        },
      });

      // Send notifications for changed assignments
      if (existing.customerAccountId) {
        // Notify new assignee if changed and different from actor
        if (assigneeId && assigneeId !== existing.assigneeId && assigneeId !== session.id) {
          await notificationService.send({
            customerAccountId: existing.customerAccountId,
            actorId: session.id,
            recipientId: assigneeId,
            event: NOTIFICATION_EVENTS.POLICY_ASSIGNED,
            title: "Policy assigned to you",
            message: `Policy "${policy.name}" has been assigned to you`,
            relatedEntityType: "policy",
            relatedEntityId: policy.id,
            link: `/compliance/governance/${policy.id}`,
            channels: [NOTIFICATION_CHANNELS.INBOX, NOTIFICATION_CHANNELS.EMAIL],
          });
        }

        // Notify new approver if changed and different from actor (submit for approval)
        if (approverId && approverId !== existing.approverId && approverId !== session.id) {
          await notificationService.send({
            customerAccountId: existing.customerAccountId,
            actorId: session.id,
            recipientId: approverId,
            event: NOTIFICATION_EVENTS.GOVERNANCE_SUBMIT_FOR_APPROVAL,
            title: "Policy Submitted for Approval",
            message: `Policy "${policy.name}" has been submitted for your approval.`,
            relatedEntityType: "policy",
            relatedEntityId: policy.id,
            link: `/compliance/governance/${policy.id}`,
            metadata: {
              policyName: policy.name,
              submittedBy: session.name || 'User',
            },
            channels: [NOTIFICATION_CHANNELS.INBOX, NOTIFICATION_CHANNELS.EMAIL],
          });
        }
      }

      return NextResponse.json(policy);
    } catch (error: unknown) {
      console.error("Error updating policy:", error);
      if ((error as { code?: string }).code === "P2025") {
        return NextResponse.json(
          { error: "Policy not found" },
          { status: 404 }
        );
      }
      return NextResponse.json(
        { error: "Failed to update policy" },
        { status: 500 }
      );
    }
  },
  { resource: "compliance.governance", action: "edit" }
);

// PATCH update policy (partial update) - with tenant validation
export const PATCH = withAuth(
  async (req, context: RouteContext, session) => {
    try {
      const { id } = await context.params;
      const body = await req.json();
      const {
        name,
        version,
        documentType,
        recurrence,
        departmentId,
        assigneeId,
        approverId,
        status,
        effectiveDate,
        reviewDate,
        content,
        aiReviewStatus,
        aiReviewScore,
        aiReviewJustification,
      } = body;

      // First, verify the policy belongs to the user's customer account and get current assignments
      const existing = await prisma.policy.findUnique({
        where: { id },
        select: { customerAccountId: true, assigneeId: true, approverId: true, name: true },
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

      // Build update data object, only including provided fields
      const updateData: Record<string, unknown> = {};
      if (name !== undefined) updateData.name = name;
      if (version !== undefined) updateData.version = version;
      if (documentType !== undefined) updateData.documentType = documentType;
      if (recurrence !== undefined) updateData.recurrence = recurrence;
      if (departmentId !== undefined) updateData.departmentId = departmentId;
      if (assigneeId !== undefined) updateData.assigneeId = assigneeId;
      if (approverId !== undefined) updateData.approverId = approverId;
      if (status !== undefined) updateData.status = status;
      if (effectiveDate !== undefined) updateData.effectiveDate = effectiveDate ? new Date(effectiveDate) : null;
      if (reviewDate !== undefined) updateData.reviewDate = reviewDate ? new Date(reviewDate) : null;
      if (content !== undefined) updateData.content = content;
      if (aiReviewStatus !== undefined) updateData.aiReviewStatus = aiReviewStatus;
      if (aiReviewScore !== undefined) updateData.aiReviewScore = aiReviewScore;
      if (aiReviewJustification !== undefined) updateData.aiReviewJustification = aiReviewJustification;

      const policy = await prisma.policy.update({
        where: { id },
        data: updateData,
        include: {
          department: true,
          assignee: true,
          approver: true,
          attachments: true,
        },
      });

      // Send notifications for changed assignments
      if (existing.customerAccountId) {
        // Notify new assignee if changed and different from actor
        if (assigneeId !== undefined && assigneeId !== existing.assigneeId && assigneeId && assigneeId !== session.id) {
          await notificationService.send({
            customerAccountId: existing.customerAccountId,
            actorId: session.id,
            recipientId: assigneeId,
            event: NOTIFICATION_EVENTS.POLICY_ASSIGNED,
            title: "Policy assigned to you",
            message: `Policy "${policy.name}" has been assigned to you`,
            relatedEntityType: "policy",
            relatedEntityId: policy.id,
            link: `/compliance/governance/${policy.id}`,
            channels: [NOTIFICATION_CHANNELS.INBOX, NOTIFICATION_CHANNELS.EMAIL],
          });
        }

        // Notify new approver if changed and different from actor (submit for approval)
        if (approverId !== undefined && approverId !== existing.approverId && approverId && approverId !== session.id) {
          await notificationService.send({
            customerAccountId: existing.customerAccountId,
            actorId: session.id,
            recipientId: approverId,
            event: NOTIFICATION_EVENTS.GOVERNANCE_SUBMIT_FOR_APPROVAL,
            title: "Policy Submitted for Approval",
            message: `Policy "${policy.name}" has been submitted for your approval.`,
            relatedEntityType: "policy",
            relatedEntityId: policy.id,
            link: `/compliance/governance/${policy.id}`,
            metadata: {
              policyName: policy.name,
              submittedBy: session.name || 'User',
            },
            channels: [NOTIFICATION_CHANNELS.INBOX, NOTIFICATION_CHANNELS.EMAIL],
          });
        }
      }

      return NextResponse.json(policy);
    } catch (error: unknown) {
      console.error("Error updating policy:", error);
      if ((error as { code?: string }).code === "P2025") {
        return NextResponse.json(
          { error: "Policy not found" },
          { status: 404 }
        );
      }
      return NextResponse.json(
        { error: "Failed to update policy" },
        { status: 500 }
      );
    }
  },
  { resource: "compliance.governance", action: "edit" }
);

// DELETE policy - with tenant validation
export const DELETE = withAuth(
  async (req, context: RouteContext, session) => {
    try {
      const { id } = await context.params;

      // First, verify the policy belongs to the user's customer account
      const existing = await prisma.policy.findUnique({
        where: { id },
        select: { customerAccountId: true, code: true, attachments: true },
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

      console.log(`[Policy Delete] Deleting policy: ${existing.code} (${id})`);

      // Step 1: Clean up AI documents from RunPod
      try {
        const aiResults = await aiDeleteService.deleteAllForPolicy(
          id,
          session.id
        );
        console.log(
          `[Policy Delete] AI cleanup: ${aiResults.filter((r) => r.status === "deleted").length}/${aiResults.length} documents deleted`
        );
      } catch (aiError) {
        console.warn("[Policy Delete] AI cleanup failed (continuing):", aiError);
        // Continue with deletion even if AI cleanup fails
      }

      // Step 2: Delete physical attachment files
      for (const attachment of existing.attachments) {
        if (attachment.filePath) {
          try {
            const relativePath = attachment.filePath.startsWith("/")
              ? attachment.filePath.slice(1)
              : attachment.filePath;
            const absolutePath = path.join(process.cwd(), relativePath);
            await unlink(absolutePath);
            console.log(`[Policy Delete] Deleted file: ${attachment.fileName}`);
          } catch (fileError) {
            console.warn(
              `[Policy Delete] Could not delete file: ${attachment.filePath}`
            );
          }
        }
      }

      // Step 3: Delete policy (cascade handles DB records)
      await prisma.policy.delete({
        where: { id },
      });

      console.log(`[Policy Delete] Successfully deleted policy: ${existing.code}`);
      return NextResponse.json({ message: "Policy deleted successfully" });
    } catch (error: unknown) {
      console.error("Error deleting policy:", error);
      if ((error as { code?: string }).code === "P2025") {
        return NextResponse.json(
          { error: "Policy not found" },
          { status: 404 }
        );
      }
      return NextResponse.json(
        { error: "Failed to delete policy" },
        { status: 500 }
      );
    }
  },
  { resource: "compliance.governance", action: "delete" }
);
