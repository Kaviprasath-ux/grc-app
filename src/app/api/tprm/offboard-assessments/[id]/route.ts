import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuthOnly, getCustomerAccountId } from "@/lib/api-auth";
import { notificationService } from '@/lib/notification-service';
import { translateRecord } from '@/lib/translation-service';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/tprm/offboard-assessments/[id] — Get offboard assessment detail with responses
 */
export const GET = withAuthOnly(
  async (req: NextRequest, context: RouteContext, session) => {
    try {
      const customerAccountId = getCustomerAccountId(session);
      const { id } = await context.params;

      const assessment = await prisma.tPRMAssessment.findFirst({
        where: { id, customerAccountId, assessmentType: "Offboard Assessment" },
        include: {
          vendor: { select: { id: true, name: true, vendorCode: true } },
          initiatedBy: { select: { fullName: true } },
          offboardResponses: {
            orderBy: { questionNo: "asc" },
            include: {
              delegatedTo: { select: { id: true, fullName: true } },
            },
          },
        },
      });

      if (!assessment) {
        return NextResponse.json({ error: "Offboard assessment not found" }, { status: 404 });
      }

      return NextResponse.json({
        id: assessment.id,
        assessmentCode: assessment.assessmentCode,
        status: assessment.status,
        vendorId: assessment.vendor?.id,
        vendorName: assessment.vendor?.name || "Unknown",
        vendorCode: assessment.vendor?.vendorCode || "",
        initiatedBy: assessment.initiatedBy?.fullName || null,
        createdAt: assessment.createdAt.toISOString(),
        responses: assessment.offboardResponses.map((r) => ({
          id: r.id,
          questionId: r.questionId,
          questionNo: r.questionNo,
          questionTitle: r.questionTitle,
          questionText: r.questionText,
          response: r.response,
          comment: r.comment,
          artifactUrl: r.artifactUrl,
          artifactName: r.artifactName,
          isFlagged: r.isFlagged,
          isDelegated: r.isDelegated,
          delegatedToId: r.delegatedToId,
          delegatedTo: r.delegatedTo,
        })),
      });
    } catch (error) {
      console.error("Offboard Assessment GET error:", error);
      return NextResponse.json({ error: "Failed to fetch offboard assessment" }, { status: 500 });
    }
  }
);

/**
 * PATCH /api/tprm/offboard-assessments/[id] — Update assessment status (submit, approve, send-back)
 */
export const PATCH = withAuthOnly(
  async (req: NextRequest, context: RouteContext, session) => {
    try {
      const customerAccountId = getCustomerAccountId(session);
      const { id } = await context.params;
      const body = await req.json();
      const { action, comment } = body;

      const assessment = await prisma.tPRMAssessment.findFirst({
        where: { id, customerAccountId, assessmentType: "Offboard Assessment" },
        include: { vendor: { select: { id: true, name: true } } },
      });

      if (!assessment) {
        return NextResponse.json({ error: "Offboard assessment not found" }, { status: 404 });
      }

      let newStatus: string;

      switch (action) {
        case "submit":
          // AM submits → goes to Assessor
          if (!["Offboard_In_Progress", "Offboard_Awaiting_Response"].includes(assessment.status)) {
            return NextResponse.json({ error: "Assessment cannot be submitted in current status" }, { status: 400 });
          }
          newStatus = "Offboard_Approve_Assessor";
          break;

        case "assessor-approve":
          if (assessment.status !== "Offboard_Approve_Assessor") {
            return NextResponse.json({ error: "Assessment is not pending assessor approval" }, { status: 400 });
          }
          newStatus = "Offboard_Approve_RM";
          break;

        case "assessor-send-back":
          if (assessment.status !== "Offboard_Approve_Assessor") {
            return NextResponse.json({ error: "Assessment is not pending assessor approval" }, { status: 400 });
          }
          newStatus = "Offboard_Awaiting_Response";
          break;

        case "rm-approve":
          if (assessment.status !== "Offboard_Approve_RM") {
            return NextResponse.json({ error: "Assessment is not pending RM approval" }, { status: 400 });
          }
          newStatus = "Offboard_Approve_BO";
          break;

        case "rm-send-back":
          if (assessment.status !== "Offboard_Approve_RM") {
            return NextResponse.json({ error: "Assessment is not pending RM approval" }, { status: 400 });
          }
          // RM sends back to vendor (AM)
          newStatus = "Offboard_Awaiting_Response";
          break;

        case "bo-approve":
          // BO approves termination
          if (assessment.status !== "Offboard_Approve_BO") {
            return NextResponse.json({ error: "Assessment is not pending BO approval" }, { status: 400 });
          }
          newStatus = "Offboard_Completed";
          break;

        case "bo-send-to-rm":
          if (assessment.status !== "Offboard_Approve_BO") {
            return NextResponse.json({ error: "Assessment is not pending BO approval" }, { status: 400 });
          }
          newStatus = "Offboard_Approve_RM";
          break;

        default:
          return NextResponse.json({ error: "Invalid action" }, { status: 400 });
      }

      // Build update data: status + optional comment
      const updateData: { status: string; approverComment?: string } = { status: newStatus };
      if (comment?.trim()) {
        const roleLabel = action.startsWith("assessor") ? "Assessor" : action.startsWith("rm") ? "RM" : "BO";
        const timestamp = new Date().toISOString();
        const existingComment = assessment.approverComment || "";
        updateData.approverComment = existingComment
          ? `${existingComment}\n[${timestamp}] ${roleLabel}: ${comment.trim()}`
          : `[${timestamp}] ${roleLabel}: ${comment.trim()}`;
      }

      // Fire-and-forget translation (approverComment may have been updated)
      if (customerAccountId && updateData.approverComment) {
        void translateRecord(customerAccountId, 'TPRMAssessment', id, {
          questionnaireTemplate: assessment.questionnaireTemplate,
          approverComment: updateData.approverComment,
        });
      }

      // Use transaction to ensure all operations succeed or fail together
      await prisma.$transaction(async (tx) => {
        // Update assessment status + comment
        await tx.tPRMAssessment.update({
          where: { id },
          data: updateData,
        });

        // If BO approves termination → close all open remediations and offboard vendor
        if (action === "bo-approve" && assessment.vendor?.id) {
          const vendorAssessments = await tx.tPRMAssessment.findMany({
            where: { customerAccountId, vendorId: assessment.vendor!.id },
            select: { id: true },
          });
          const assessmentIds = vendorAssessments.map((a) => a.id);

          if (assessmentIds.length > 0) {
            await tx.tPRMIssueRemediation.updateMany({
              where: {
                customerAccountId,
                assessmentId: { in: assessmentIds },
                status: { notIn: ["Closed", "Terminated"] },
              },
              data: { status: "Terminated" },
            });
          }

          // Offboard the vendor
          await tx.tPRMVendor.update({
            where: { id: assessment.vendor!.id },
            data: { status: "Offboarded", offboardedDate: new Date() },
          });
        }
      });

      // === Send offboarding notifications ===
      // Helper: resolve role-based user IDs for notifications
      const resolveUsersByTPRMRole = async (tprmRole: string) => {
        const users = await prisma.user.findMany({
          where: { customerAccountId, isActive: true, tprmRole },
          select: { id: true },
          take: 10,
        });
        return users.map(u => u.id);
      };

      const assessorIds = await resolveUsersByTPRMRole('Assessor');
      const rmIds = await resolveUsersByTPRMRole('Relationship Manager');
      const boIds = await resolveUsersByTPRMRole('Business Owner');
      const adminIds = (await prisma.user.findMany({
        where: { customerAccountId, isActive: true, role: { in: ['GRCAdministrator', 'CustomerAdministrator'] } },
        select: { id: true },
        take: 10,
      })).map(u => u.id);

      // Also resolve AM from vendor
      const vendorForNotif = await prisma.tPRMVendor.findUnique({
        where: { id: assessment.vendor?.id || '' },
        select: { accountManagerEmail: true },
      });
      const amEmail = vendorForNotif?.accountManagerEmail?.split(';')[0]?.trim();
      const amUser = amEmail ? await prisma.user.findFirst({
        where: { customerAccountId, email: { equals: amEmail, mode: 'insensitive' }, isActive: true },
        select: { id: true },
      }) : null;
      const amIds = amUser ? [amUser.id] : [];

      const assessmentCode = assessment.assessmentCode || '';
      const vendorName = assessment.vendor?.name || 'Unknown';

      switch (action) {
        case 'submit':
          if (assessorIds.length > 0) {
            void notificationService.notifyTPRMOffboardSubmitted({
              customerAccountId, actorId: session.id, recipientIds: assessorIds,
              assessmentId: id, assessmentCode, vendorName,
            });
          }
          break;
        case 'assessor-approve':
          if (rmIds.length > 0) {
            void notificationService.notifyTPRMOffboardAssessorApproved({
              customerAccountId, actorId: session.id, recipientIds: rmIds,
              assessmentId: id, assessmentCode, vendorName,
            });
          }
          break;
        case 'assessor-send-back':
          if (amIds.length > 0) {
            void notificationService.notifyTPRMOffboardAssessorSentBack({
              customerAccountId, actorId: session.id, recipientIds: amIds,
              assessmentId: id, assessmentCode, vendorName, comment,
            });
          }
          break;
        case 'rm-approve':
          if (boIds.length > 0 || adminIds.length > 0) {
            void notificationService.notifyTPRMOffboardRMApproved({
              customerAccountId, actorId: session.id, recipientIds: [...new Set([...boIds, ...adminIds])],
              assessmentId: id, assessmentCode, vendorName,
            });
          }
          break;
        case 'rm-send-back':
          if (amIds.length > 0) {
            void notificationService.notifyTPRMOffboardRMSentBack({
              customerAccountId, actorId: session.id, recipientIds: amIds,
              assessmentId: id, assessmentCode, vendorName, comment,
            });
          }
          break;
        case 'bo-approve': {
          const allRecipients = [...new Set([...assessorIds, ...rmIds, ...amIds])];
          if (allRecipients.length > 0) {
            void notificationService.notifyTPRMOffboardBOApproved({
              customerAccountId, actorId: session.id, recipientIds: allRecipients,
              assessmentId: id, assessmentCode, vendorName,
            });
          }
          break;
        }
        case 'bo-send-to-rm':
          if (rmIds.length > 0) {
            void notificationService.notifyTPRMOffboardBOSentToRM({
              customerAccountId, actorId: session.id, recipientIds: rmIds,
              assessmentId: id, assessmentCode, vendorName, comment,
            });
          }
          break;
      }

      return NextResponse.json({ success: true, status: newStatus });
    } catch (error) {
      console.error("Offboard Assessment PATCH error:", error);
      return NextResponse.json({ error: "Failed to update offboard assessment" }, { status: 500 });
    }
  }
);
