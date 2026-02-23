import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth, validateTenantAccess, forbidden } from "@/lib/api-auth";
import { notificationService, NOTIFICATION_EVENTS, NOTIFICATION_CHANNELS } from "@/lib/notification-service";
import { translateRecord, deleteRecordTranslations } from '@/lib/translation-service';

interface RouteContext {
  params: Promise<{ id: string }>;
}

// PUT update issue - with tenant validation
export const PUT = withAuth(
  async (req: NextRequest, context: RouteContext, session) => {
    try {
      const { id } = await context.params;
      const body = await req.json();
      const {
        title,
        description,
        domain,
        category,
        issueType,
        status,
        dueDate,
        departmentId,
        ownerId,
        selectedRegulations,
        selectedProcesses,
        stakeholderNeeds,
      } = body;

      // Verify the issue belongs to the same customer account
      const existingIssue = await prisma.issue.findUnique({
        where: { id },
        select: { customerAccountId: true, ownerId: true },
      });

      if (!existingIssue) {
        return NextResponse.json({ error: "Issue not found" }, { status: 404 });
      }

      if (!validateTenantAccess(session, existingIssue.customerAccountId)) {
        return forbidden("Access denied to this issue");
      }

      // Use a transaction to update the issue and its associations
      const issue = await prisma.$transaction(async (tx) => {
        // Delete existing associations if new ones are provided
        if (selectedRegulations !== undefined) {
          await tx.issueRegulation.deleteMany({ where: { issueId: id } });
        }
        if (selectedProcesses !== undefined) {
          await tx.issueProcess.deleteMany({ where: { issueId: id } });
        }
        if (stakeholderNeeds !== undefined) {
          await tx.issueStakeholder.deleteMany({ where: { issueId: id } });
        }

        // Update the issue with new associations
        return tx.issue.update({
          where: { id },
          data: {
            title,
            description,
            domain,
            category,
            issueType,
            status,
            dueDate: dueDate ? new Date(dueDate) : null,
            // Use connect/disconnect syntax for relations
            department: departmentId
              ? { connect: { id: departmentId } }
              : { disconnect: true },
            owner: ownerId
              ? { connect: { id: ownerId } }
              : { disconnect: true },
            // Create new regulation associations
            regulations:
              selectedRegulations?.length
                ? {
                    create: selectedRegulations.map((regulationId: string) => ({
                      regulation: { connect: { id: regulationId } },
                    })),
                  }
                : undefined,
            // Create new process associations
            processes:
              selectedProcesses?.length
                ? {
                    create: selectedProcesses.map((processId: string) => ({
                      process: { connect: { id: processId } },
                    })),
                  }
                : undefined,
            // Create new stakeholder associations
            stakeholders:
              stakeholderNeeds?.length
                ? {
                    create: stakeholderNeeds.map(
                      (item: { stakeholderId: string; needExpectation: string }) => ({
                        stakeholder: { connect: { id: item.stakeholderId } },
                        needExpectation: item.needExpectation,
                      })
                    ),
                  }
                : undefined,
          },
          include: {
            department: true,
            owner: {
              select: { id: true, fullName: true },
            },
            regulations: {
              include: { regulation: true },
            },
            processes: {
              include: {
                process: {
                  select: { id: true, processCode: true, name: true },
                },
              },
            },
            stakeholders: {
              include: {
                stakeholder: {
                  select: { id: true, name: true, type: true },
                },
              },
            },
          },
        });
      });

      if (existingIssue.customerAccountId) void translateRecord(existingIssue.customerAccountId, 'Issue', issue.id, { title: issue.title, description: issue.description });

      // Send notifications for issue changes
      if (session.customerAccountId) {
        // Notify new owner if owner changed
        if (ownerId && ownerId !== existingIssue.ownerId && ownerId !== session.id) {
          await notificationService.send({
            customerAccountId: session.customerAccountId,
            actorId: session.id,
            recipientId: ownerId,
            event: NOTIFICATION_EVENTS.ISSUE_CREATED,
            title: 'Issue Assigned to You',
            message: `Issue "${issue.title}" has been assigned to you.`,
            relatedEntityType: 'issue',
            relatedEntityId: issue.id,
            link: `/organization/context/issues/${issue.id}`,
            metadata: {
              issueTitle: issue.title,
              category: issue.category,
              domain: issue.domain,
              assignedBy: session.name || 'User',
            },
            channels: [NOTIFICATION_CHANNELS.INBOX, NOTIFICATION_CHANNELS.EMAIL],
          });
        }

        // Notify owner when issue is resolved
        if (status === "Resolved" && existingIssue.ownerId && existingIssue.ownerId !== session.id) {
          await notificationService.send({
            customerAccountId: session.customerAccountId,
            actorId: session.id,
            recipientId: existingIssue.ownerId,
            event: NOTIFICATION_EVENTS.ISSUE_RESOLVED,
            title: 'Issue Resolved',
            message: `Issue "${issue.title}" has been marked as resolved.`,
            relatedEntityType: 'issue',
            relatedEntityId: issue.id,
            link: `/organization/context/issues/${issue.id}`,
            metadata: {
              issueTitle: issue.title,
              resolvedBy: session.name || 'User',
            },
            channels: [NOTIFICATION_CHANNELS.INBOX, NOTIFICATION_CHANNELS.EMAIL],
          });
        }

        // Notify owner when issue is rejected
        if (status === "Rejected" && existingIssue.ownerId && existingIssue.ownerId !== session.id) {
          await notificationService.send({
            customerAccountId: session.customerAccountId,
            actorId: session.id,
            recipientId: existingIssue.ownerId,
            event: NOTIFICATION_EVENTS.ISSUE_REJECTED,
            title: 'Issue Rejected',
            message: `Issue "${issue.title}" has been rejected.`,
            relatedEntityType: 'issue',
            relatedEntityId: issue.id,
            link: `/organization/context/issues/${issue.id}`,
            metadata: {
              issueTitle: issue.title,
              rejectedBy: session.name || 'Reviewer',
            },
            channels: [NOTIFICATION_CHANNELS.INBOX, NOTIFICATION_CHANNELS.EMAIL],
          });
        }

        // Notify reviewers when issue is submitted for closure (Pending Closure status)
        if (status === "Pending Closure" && existingIssue.ownerId !== session.id) {
          // Get reviewer users to notify (CustomerAdministrator and Reviewer roles)
          const reviewers = await prisma.user.findMany({
            where: {
              customerAccountId: session.customerAccountId,
              userRoles: {
                some: {
                  role: {
                    name: { in: ['CustomerAdministrator', 'Reviewer'] },
                  },
                },
              },
            },
            select: { id: true },
          });

          for (const reviewer of reviewers) {
            if (reviewer.id !== session.id) {
              await notificationService.send({
                customerAccountId: session.customerAccountId,
                actorId: session.id,
                recipientId: reviewer.id,
                event: NOTIFICATION_EVENTS.ISSUE_SUBMIT_FOR_CLOSURE,
                title: 'Issue Submitted for Closure',
                message: `Issue "${issue.title}" has been submitted for closure and requires your review.`,
                relatedEntityType: 'issue',
                relatedEntityId: issue.id,
                link: `/organization/context/issues/${issue.id}`,
                metadata: {
                  issueTitle: issue.title,
                  submittedBy: session.name || 'User',
                },
                channels: [NOTIFICATION_CHANNELS.INBOX, NOTIFICATION_CHANNELS.EMAIL],
              });
            }
          }
        }

        // Notify owner when issue is escalated
        if (status === "Escalated" && existingIssue.ownerId && existingIssue.ownerId !== session.id) {
          await notificationService.send({
            customerAccountId: session.customerAccountId,
            actorId: session.id,
            recipientId: existingIssue.ownerId,
            event: NOTIFICATION_EVENTS.ISSUE_ESCALATED,
            title: 'Issue Escalated',
            message: `Issue "${issue.title}" has been escalated and requires immediate attention.`,
            relatedEntityType: 'issue',
            relatedEntityId: issue.id,
            link: `/organization/context/issues/${issue.id}`,
            metadata: {
              issueTitle: issue.title,
              escalatedBy: session.name || 'Reviewer',
            },
            channels: [NOTIFICATION_CHANNELS.INBOX, NOTIFICATION_CHANNELS.EMAIL],
          });
        }
      }

      return NextResponse.json(issue);
    } catch (error: unknown) {
      console.error("Error updating issue:", error);
      if ((error as { code?: string }).code === "P2025") {
        return NextResponse.json({ error: "Issue not found" }, { status: 404 });
      }
      return NextResponse.json({ error: "Failed to update issue" }, { status: 500 });
    }
  },
  { resource: "organization.context", action: "edit" }
);

// DELETE issue - with tenant validation
export const DELETE = withAuth(
  async (req: NextRequest, context: RouteContext, session) => {
    try {
      const { id } = await context.params;

      // Verify the issue belongs to the same customer account
      const existingIssue = await prisma.issue.findUnique({
        where: { id },
        select: { customerAccountId: true },
      });

      if (!existingIssue) {
        return NextResponse.json({ error: "Issue not found" }, { status: 404 });
      }

      if (!validateTenantAccess(session, existingIssue.customerAccountId)) {
        return forbidden("Access denied to this issue");
      }

      await prisma.issue.delete({ where: { id } });

      if (existingIssue.customerAccountId) void deleteRecordTranslations(existingIssue.customerAccountId, 'Issue', id);

      return NextResponse.json({ message: "Issue deleted successfully" });
    } catch (error: unknown) {
      console.error("Error deleting issue:", error);
      if ((error as { code?: string }).code === "P2025") {
        return NextResponse.json({ error: "Issue not found" }, { status: 404 });
      }
      return NextResponse.json({ error: "Failed to delete issue" }, { status: 500 });
    }
  },
  { resource: "organization.context", action: "delete" }
);
