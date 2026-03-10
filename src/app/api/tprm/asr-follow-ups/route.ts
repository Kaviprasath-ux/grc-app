import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth, getTenantFilter, getCustomerAccountId } from "@/lib/api-auth";
import { notificationService } from '@/lib/notification-service';

// GET follow-ups data for assessor (clarifications and remediations)
export const GET = withAuth(
  async (req, context, session) => {
    try {
      const { searchParams } = new URL(req.url);
      const type = searchParams.get("type") || "clarifications";
      const limit = parseInt(searchParams.get("limit") || "50");
      const offset = parseInt(searchParams.get("offset") || "0");

      const tenantFilter = getTenantFilter(session);

      if (type === "clarifications") {
        const clarifications = await prisma.tPRMClarification.findMany({
          where: { ...tenantFilter },
          include: {
            assessment: {
              include: {
                vendor: true,
              },
            },
          },
          take: limit,
          skip: offset,
          orderBy: { createdAt: "desc" },
        });

        const data = clarifications.map((c) => ({
          id: c.id,
          department: null,
          vendorId: c.assessment?.vendor?.vendorCode || null,
          vendorName: c.assessment?.vendor?.name || null,
          questionNo: c.questionNo || null,
          date: c.createdAt?.toISOString() || null,
          domain: c.domainName || null,
          status: c.status || "Open",
        }));

        return NextResponse.json({ data, total: data.length });
      }

      if (type === "remediations") {
        const remediations = await prisma.tPRMIssueRemediation.findMany({
          where: { ...tenantFilter },
          include: {
            assessment: {
              include: {
                vendor: true,
              },
            },
          },
          take: limit,
          skip: offset,
          orderBy: { createdAt: "desc" },
        });

        const data = remediations.map((r) => ({
          id: r.id,
          issueId: r.issueCode || r.assessment?.assessmentCode || r.id.substring(0, 8),
          vendorName: r.assessment?.vendor?.name || null,
          engagementId: r.assessment?.assessmentCode || null,
          domain: r.domainName || null,
          severity: r.severity || null,
          questionNo: r.questionNo || null,
          questionText: r.questionText || null,
          questionResponse: r.questionResponse || null,
          issue: r.issue || null,
          risk: r.risk || null,
          recommendation: r.recommendation || null,
          amComment: r.amComment || null,
          assessorComment: r.assessorComment || null,
          artifactUrl: r.artifactUrl || null,
          artifactName: r.artifactName || null,
          itArtifactUrl: r.itArtifactUrl || null,
          itArtifactName: r.itArtifactName || null,
          returnedAt: r.returnedAt?.toISOString() || null,
          responseDate: r.responseDate?.toISOString() || r.requestedDate?.toISOString() || null,
          dueDate: r.dueDate?.toISOString() || null,
          reassignStatus: r.status === "Assigned to BO" ? "Assigned to BO" : r.status === "Assigned to RM" ? "Assigned to RM" : (r.status === "Assigned to IT" || r.status === "IT Submitted") ? "Assigned to IT" : "Not Assigned",
          status: r.status === "Submitted" ? "Received" : r.status || "Pending",
        }));

        return NextResponse.json({ data, total: data.length });
      }

      return NextResponse.json({ data: [], total: 0 });
    } catch (error) {
      console.error("Error fetching follow-ups:", error);
      return NextResponse.json({ error: "Failed to fetch follow-ups" }, { status: 500 });
    }
  },
  { resource: "tprm.asr-follow-ups", action: "view" }
);

// PATCH /api/tprm/asr-follow-ups — Assessor actions on remediations
export const PATCH = withAuth(
  async (req: NextRequest, context, session) => {
    try {
      const customerAccountId = getCustomerAccountId(session);
      const body = await req.json();
      const { id, action, comment, assignedToUserId } = body;

      if (!id || !action) {
        return NextResponse.json({ error: "ID and action are required" }, { status: 400 });
      }

      const remediation = await prisma.tPRMIssueRemediation.findFirst({
        where: { id, customerAccountId },
      });

      if (!remediation) {
        return NextResponse.json({ error: "Remediation not found" }, { status: 404 });
      }

      let updateData: Record<string, unknown> = {};

      switch (action) {
        case "satisfied":
          updateData = { status: "Closed" };
          break;
        case "unsatisfied":
          // Send back to AM with comment — resets to Pending so AM sees it again
          updateData = {
            status: "Pending",
            amResponse: null,
            responseDate: null,
            returnedAt: new Date(),
            ...(comment ? { assessorComment: comment } : {}),
          };
          break;
        case "send-to-business":
          if (!assignedToUserId) {
            return NextResponse.json({ error: "Assigned RM user is required" }, { status: 400 });
          }
          updateData = {
            status: "Assigned to RM",
            reassignComment: comment || null,
            assignedToUserId,
            assignedAt: new Date(),
          };
          break;
        case "reassign-to-it":
          if (!assignedToUserId) {
            return NextResponse.json({ error: "Assigned RM user is required" }, { status: 400 });
          }
          updateData = {
            status: "Assigned to IT",
            reassignComment: comment || null,
            assignedToUserId,
            assignedAt: new Date(),
          };
          break;
        case "approve-it":
          // Assessor approves IT submission
          updateData = { status: "IT Approved" };
          break;
        case "return-to-it":
          // Assessor sends back to IT with comment
          updateData = {
            status: "Returned to IT",
            returnedAt: new Date(),
            ...(comment ? { assessorComment: comment } : {}),
          };
          break;
        default:
          return NextResponse.json({ error: "Invalid action" }, { status: 400 });
      }

      const updated = await prisma.tPRMIssueRemediation.update({
        where: { id },
        data: updateData,
      });

      // Save comment as a chat-style remediation comment for all actions
      if (comment?.trim()) {
        const roles = session.roles || [];
        let userRole = "Assessor";
        if (roles.some((r: string) => r.includes("Approver"))) userRole = "Approver";
        else if (roles.some((r: string) => r.includes("Admin"))) userRole = "Admin";

        await prisma.tPRMRemediationComment.create({
          data: {
            remediationId: id,
            userId: session.id,
            userRole,
            message: comment.trim(),
          },
        });
      }

      // Send notifications for remediation status changes
      const remediationWithAssessment = await prisma.tPRMIssueRemediation.findFirst({
        where: { id, customerAccountId },
        include: {
          assessment: {
            include: { vendor: { select: { name: true, accountManagerEmail: true } } },
          },
        },
      });
      const vendorName = remediationWithAssessment?.assessment?.vendor?.name || '';
      const issueCode = remediation.issueCode || id.substring(0, 8);
      const questionTitle = remediation.questionText || '';

      // Resolve AM user ID
      const amEmail = remediationWithAssessment?.assessment?.vendor?.accountManagerEmail?.split(';')[0]?.trim();
      const amUser = amEmail ? await prisma.user.findFirst({
        where: { customerAccountId, email: { equals: amEmail, mode: 'insensitive' }, isActive: true },
        select: { id: true },
      }) : null;

      // Resolve BO/admin user IDs for bulk notifications
      const boAdmins = await prisma.user.findMany({
        where: {
          customerAccountId, isActive: true,
          OR: [{ role: { in: ['GRCAdministrator', 'CustomerAdministrator'] } }, { tprmRole: 'Business Owner' }],
        },
        select: { id: true },
        take: 10,
      });
      const boAdminIds = boAdmins.map(u => u.id);
      const amAndBoIds = [...new Set([...(amUser ? [amUser.id] : []), ...boAdminIds])];

      switch (action) {
        case 'satisfied':
          if (amAndBoIds.length > 0) {
            void notificationService.notifyTPRMRemediationSatisfied({
              customerAccountId, actorId: session.id, recipientIds: amAndBoIds,
              remediationId: id, issueCode, vendorName, questionTitle,
            });
          }
          break;
        case 'unsatisfied':
          if (amAndBoIds.length > 0) {
            void notificationService.notifyTPRMRemediationUnsatisfied({
              customerAccountId, actorId: session.id, recipientIds: amAndBoIds,
              remediationId: id, issueCode, vendorName, questionTitle, reason: comment,
            });
          }
          break;
        case 'send-to-business':
          if (assignedToUserId) {
            void notificationService.notifyTPRMRemediationSentToBusiness({
              customerAccountId, actorId: session.id, recipientId: assignedToUserId,
              remediationId: id, issueCode, vendorName, questionTitle,
            });
          }
          break;
        case 'reassign-to-it':
          if (assignedToUserId) {
            void notificationService.notifyTPRMRemediationAssignedToIT({
              customerAccountId, actorId: session.id, recipientId: assignedToUserId,
              remediationId: id, issueCode, vendorName, questionTitle,
            });
          }
          break;
        case 'approve-it':
          if (remediation.assignedToUserId) {
            void notificationService.notifyTPRMRemediationITApproved({
              customerAccountId, actorId: session.id, recipientId: remediation.assignedToUserId,
              remediationId: id, issueCode, vendorName, questionTitle,
            });
          }
          break;
        case 'return-to-it':
          if (remediation.assignedToUserId) {
            void notificationService.notifyTPRMRemediationITReturned({
              customerAccountId, actorId: session.id, recipientId: remediation.assignedToUserId,
              remediationId: id, issueCode, vendorName, questionTitle, reason: comment,
            });
          }
          break;
      }

      return NextResponse.json(updated);
    } catch (error) {
      console.error("ASR Follow-ups PATCH error:", error);
      return NextResponse.json({ error: "Failed to update remediation" }, { status: 500 });
    }
  },
  { resource: "tprm.asr-follow-ups", action: "edit" }
);
