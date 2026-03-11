import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { withAuth, getTenantFilter, getCustomerAccountId } from "@/lib/api-auth";
import { notificationService } from "@/lib/notification-service";
import { translateRecord } from "@/lib/translation-service";

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

      const where: Record<string, unknown> = {
        ...tenantFilter,
        assessmentType: { not: "Offboard Assessment" },
      };

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
            vendor: { select: { id: true, name: true, vendorCode: true, serviceCategory: true, vrr: true } },
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

      // Auto-create or find Account Manager user from vendor's account manager details
      let accountManagerUserId: string | null = null;
      if (body.vendorId) {
        const vendor = await prisma.tPRMVendor.findUnique({
          where: { id: body.vendorId },
          select: { accountManagerName: true, accountManagerEmail: true },
        });

        if (vendor?.accountManagerName && vendor?.accountManagerEmail) {
          const amName = vendor.accountManagerName.split("; ")[0];
          const amEmail = vendor.accountManagerEmail.split("; ")[0];

          if (amName && amEmail) {
            // Check if Account Manager user already exists with this email
            let accountManager = await prisma.user.findFirst({
              where: {
                customerAccountId,
                email: { equals: amEmail, mode: "insensitive" },
                tprmRole: "Account Manager",
              },
            });

            if (!accountManager) {
              // Create Account Manager user
              const userCount = await prisma.user.count({ where: { customerAccountId } });
              const userId = `TPRM_${customerAccountId.substring(0, 6)}_${String(userCount + 1).padStart(3, "0")}`;
              let userName = amEmail.split("@")[0];

              // Ensure unique userName within tenant
              const existingWithUserName = await prisma.user.findFirst({
                where: { customerAccountId, userName },
              });
              if (existingWithUserName) {
                userName = `${userName}_am_${Date.now()}`;
              }

              const hashedPassword = await bcrypt.hash("1", 10);
              const nameParts = amName.trim().split(/\s+/);

              accountManager = await prisma.user.create({
                data: {
                  userId,
                  customerAccountId,
                  fullName: amName,
                  firstName: nameParts[0] || amName,
                  lastName: nameParts.slice(1).join(" ") || "-",
                  email: amEmail,
                  userName,
                  password: hashedPassword,
                  tprmRole: "Account Manager",
                  tprmFunctionCategory: "TPRM Team",
                  isActive: true,
                },
              });
            }

            accountManagerUserId = accountManager.id;
          }
        }
      }

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

      // Trigger translation for assessment
      void translateRecord(customerAccountId, 'TPRMAssessment', assessment.id, {
        questionnaireTemplate: assessment.questionnaireTemplate,
        approverComment: assessment.approverComment,
      });

      // Notify the account manager that an assessment has been initiated
      if (accountManagerUserId) {
        void notificationService.notifyTPRMAssessmentInitiated({
          customerAccountId,
          actorId: session.id,
          recipientId: accountManagerUserId,
          assessmentId: assessment.id,
          assessmentCode: assessment.assessmentCode,
          vendorName: assessment.vendor?.name || '',
        });
      }

      // Notify the assessor if one was assigned at creation time
      if (body.assessorId) {
        void notificationService.notifyTPRMAssessmentAssigned({
          customerAccountId,
          actorId: session.id,
          assessorId: body.assessorId,
          assessmentId: assessment.id,
          assessmentCode: assessment.assessmentCode,
          vendorName: assessment.vendor?.name || '',
        });
      }

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
