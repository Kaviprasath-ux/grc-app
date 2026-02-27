import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth, getTenantFilter } from "@/lib/api-auth";

interface RouteContext {
  params: Promise<{ id: string }>;
}

// GET single assessment detail
export const GET = withAuth<RouteContext>(
  async (req, context, session) => {
    try {
      const { id } = await context.params;
      const tenantFilter = getTenantFilter(session);

      const assessment = await prisma.tPRMAssessment.findFirst({
        where: { id, ...tenantFilter },
        include: {
          vendor: { select: { id: true, name: true, vendorCode: true, serviceCategory: true } },
          initiatedBy: { select: { id: true, fullName: true } },
          assessor: { select: { id: true, fullName: true } },
          approver: { select: { id: true, fullName: true } },
          logs: {
            orderBy: { logDate: "desc" },
            take: 50,
          },
        },
      });

      if (!assessment) {
        return NextResponse.json({ error: "Assessment not found" }, { status: 404 });
      }

      return NextResponse.json(assessment);
    } catch (error) {
      console.error("Error fetching TPRM assessment:", error);
      return NextResponse.json(
        { error: "Failed to fetch assessment" },
        { status: 500 }
      );
    }
  },
  { resource: "tprm.assessments", action: "view" }
);

// PATCH update assessment
export const PATCH = withAuth<RouteContext>(
  async (req, context, session) => {
    try {
      const { id } = await context.params;
      const tenantFilter = getTenantFilter(session);
      const body = await req.json();

      const existing = await prisma.tPRMAssessment.findFirst({
        where: { id, ...tenantFilter },
      });

      if (!existing) {
        return NextResponse.json({ error: "Assessment not found" }, { status: 404 });
      }

      const assessment = await prisma.tPRMAssessment.update({
        where: { id },
        data: {
          status: body.status,
          assessmentResult: body.assessmentResult,
          vendorSubmissionDate: body.vendorSubmissionDate ? new Date(body.vendorSubmissionDate) : undefined,
          assessorCompletionDate: body.assessorCompletionDate ? new Date(body.assessorCompletionDate) : undefined,
          approvalDate: body.approvalDate ? new Date(body.approvalDate) : undefined,
          completionDate: body.completionDate ? new Date(body.completionDate) : undefined,
          assessorId: body.assessorId,
          approverId: body.approverId,
          questionnaireTemplate: body.questionnaireTemplate,
          approverComment: body.approverComment,
        },
        include: {
          vendor: { select: { id: true, name: true, vendorCode: true } },
          initiatedBy: { select: { id: true, fullName: true } },
          assessor: { select: { id: true, fullName: true } },
          approver: { select: { id: true, fullName: true } },
        },
      });

      return NextResponse.json(assessment);
    } catch (error) {
      console.error("Error updating TPRM assessment:", error);
      return NextResponse.json(
        { error: "Failed to update assessment" },
        { status: 500 }
      );
    }
  },
  { resource: "tprm.assessments", action: "edit" }
);
