import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth, getTenantFilter, getCustomerAccountId } from "@/lib/api-auth";

// GET assessments with search, filters, pagination
export const GET = withAuth(
  async (req, context, session) => {
    try {
      const { searchParams } = new URL(req.url);
      const search = searchParams.get("search") || "";
      const status = searchParams.get("status");
      const assessmentType = searchParams.get("assessmentType");
      const limit = parseInt(searchParams.get("limit") || "50");
      const offset = parseInt(searchParams.get("offset") || "0");

      const tenantFilter = getTenantFilter(session);

      const where: Record<string, unknown> = { ...tenantFilter };

      if (search) {
        where.OR = [
          { assessmentCode: { contains: search, mode: "insensitive" } },
          { vendor: { name: { contains: search, mode: "insensitive" } } },
          { questionnaireTemplate: { contains: search, mode: "insensitive" } },
        ];
      }

      if (status) where.status = status;
      if (assessmentType) where.assessmentType = assessmentType;

      const [assessments, total] = await Promise.all([
        prisma.tPRMAssessment.findMany({
          where,
          include: {
            vendor: { select: { id: true, name: true, vendorCode: true, serviceCategory: true } },
            initiatedBy: { select: { id: true, fullName: true } },
            assessor: { select: { id: true, fullName: true } },
            approver: { select: { id: true, fullName: true } },
          },
          orderBy: { createdAt: "desc" },
          take: limit,
          skip: offset,
        }),
        prisma.tPRMAssessment.count({ where }),
      ]);

      return NextResponse.json({
        data: assessments,
        pagination: {
          total,
          limit,
          offset,
          hasMore: offset + assessments.length < total,
        },
      });
    } catch (error) {
      console.error("Error fetching TPRM assessments:", error);
      return NextResponse.json(
        { error: "Failed to fetch assessments" },
        { status: 500 }
      );
    }
  },
  { resource: "tprm.assessments", action: "view" }
);

// POST create assessment
export const POST = withAuth(
  async (req, context, session) => {
    try {
      const body = await req.json();
      const customerAccountId = getCustomerAccountId(session);

      // Generate assessment code
      const count = await prisma.tPRMAssessment.count({
        where: { customerAccountId },
      });
      const assessmentCode = `ASM${String(count + 1).padStart(3, "0")}`;

      const assessment = await prisma.tPRMAssessment.create({
        data: {
          customerAccountId,
          assessmentCode,
          vendorId: body.vendorId,
          assessmentType: body.assessmentType,
          status: body.status || "Draft",
          assessmentResult: body.assessmentResult,
          vendorSubmissionDate: body.vendorSubmissionDate ? new Date(body.vendorSubmissionDate) : null,
          assessorCompletionDate: body.assessorCompletionDate ? new Date(body.assessorCompletionDate) : null,
          approvalDate: body.approvalDate ? new Date(body.approvalDate) : null,
          completionDate: body.completionDate ? new Date(body.completionDate) : null,
          initiatedById: body.initiatedById || session.id,
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

      return NextResponse.json(assessment, { status: 201 });
    } catch (error) {
      console.error("Error creating TPRM assessment:", error);
      return NextResponse.json(
        { error: "Failed to create assessment" },
        { status: 500 }
      );
    }
  },
  { resource: "tprm.assessments", action: "create" }
);
