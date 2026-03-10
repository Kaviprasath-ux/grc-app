import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuthOnly, getCustomerAccountId } from "@/lib/api-auth";

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

      return NextResponse.json({ success: true, status: newStatus });
    } catch (error) {
      console.error("Offboard Assessment PATCH error:", error);
      return NextResponse.json({ error: "Failed to update offboard assessment" }, { status: 500 });
    }
  }
);
