import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { withAuth, getTenantFilter, getCustomerAccountId } from "@/lib/api-auth";
import { notificationService } from "@/lib/notification-service";
import { translateRecord } from "@/lib/translation-service";
import { checkAssessmentLimit, checkFactoryAssessmentLimit } from "@/lib/tprm-subscription";

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

      const tenantFilter = getTenantFilter(session, { globalAccess: session.roles.includes('GRCAdministrator') });

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

      // Check subscription plan assessment limit (factory vs customer)
      const assessmentCheck = body.assessmentType === "Assessment Factory"
        ? await checkFactoryAssessmentLimit(customerAccountId)
        : await checkAssessmentLimit(customerAccountId);
      if (!assessmentCheck.allowed) {
        return NextResponse.json({ error: assessmentCheck.message }, { status: 403 });
      }

      // Generate assessment code
      const count = await prisma.tPRMAssessment.count({
        where: { customerAccountId },
      });
      const assessmentCode = `ASM${String(count + 1).padStart(3, "0")}`;

      // Auto-create or find Account Manager user from vendor's account manager details.
      // This is best-effort: a failure here must NOT block assessment creation.
      let accountManagerUserId: string | null = null;
      // Cache the vendor's VRR so we can derive the assessment's due date below
      // without re-fetching. Filled inside the AM auto-provision branch when
      // we already query the vendor; left null otherwise (e.g. body.vendorId
      // missing — assessment creation would fail anyway).
      let vendorVrr: string | null = null;
      if (body.vendorId) {
        try {
          const vendor = await prisma.tPRMVendor.findUnique({
            where: { id: body.vendorId },
            select: { accountManagerName: true, accountManagerEmail: true, password: true, vrr: true },
          });
          vendorVrr = vendor?.vrr ?? null;

          if (vendor?.accountManagerName && vendor?.accountManagerEmail) {
            const amName = vendor.accountManagerName.split("; ")[0];
            const amEmail = vendor.accountManagerEmail.split("; ")[0];

            if (amName && amEmail) {
              // Look up by email alone so we reuse any existing user in this tenant,
              // not just ones already tagged as Account Manager. This avoids a unique
              // constraint violation on (customerAccountId, email) during create.
              let accountManager = await prisma.user.findFirst({
                where: {
                  customerAccountId,
                  email: { equals: amEmail, mode: "insensitive" },
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

                // Use the password the BO/RM entered for this vendor's account
                // manager during onboarding (TPRMVendor.password). Fall back to "1"
                // only if no password was provided.
                const hashedPassword = await bcrypt.hash(vendor.password || "1", 10);
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
        } catch (amError) {
          // Log but do not fail the assessment creation on AM auto-provisioning errors.
          console.error("TPRM assessment: Account Manager auto-provision failed", amError);
        }
      }

      // Derive the assessment's due date from the customer's Control Center
      // settings: assessment.createdAt + TPRMConfiguration.dueDate{VRR-Band}
      // days. If the body provides a dueDate explicitly, honour it; otherwise
      // compute from config. Falls back to schema defaults (30 days) when no
      // TPRMConfiguration row exists yet, so brand-new tenants still get a
      // sensible due date instead of null.
      // Honour explicit dueDate from the caller, but reject empty
       // strings / unparseable values that would otherwise become
       // Invalid Date in the DB column.
      let computedDueDate: Date | null = null;
      if (body.dueDate) {
        const parsed = new Date(body.dueDate);
        if (!isNaN(parsed.getTime())) {
          computedDueDate = parsed;
        }
      }
      if (!computedDueDate) {
        try {
          const cfg = await prisma.tPRMConfiguration.findUnique({
            where: { customerAccountId },
            select: {
              dueDateCritical: true,
              dueDateHigh: true,
              dueDateModerate: true,
              dueDateLow: true,
              dueDateNominal: true,
            },
          });
          const days = (() => {
            const band = (vendorVrr || "").toLowerCase();
            if (band === "critical") return cfg?.dueDateCritical ?? 30;
            if (band === "high") return cfg?.dueDateHigh ?? 30;
            if (band === "moderate" || band === "medium") return cfg?.dueDateModerate ?? 30;
            if (band === "low") return cfg?.dueDateLow ?? 30;
            if (band === "nominal") return cfg?.dueDateNominal ?? 30;
            // Unknown / unrated vendor: fall back to the most permissive band
            // (Nominal) so the assessment still gets a date rather than null.
            return cfg?.dueDateNominal ?? 30;
          })();
          computedDueDate = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
        } catch (cfgErr) {
          console.error("TPRM assessment: failed to compute due date from config:", cfgErr);
          computedDueDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
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
          dueDate: computedDueDate,
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
      const message = error instanceof Error ? error.message : "Failed to create assessment";
      return NextResponse.json(
        { error: `Failed to create assessment: ${message}` },
        { status: 500 }
      );
    }
  },
  { resource: "tprm.assessments", action: "create" }
);
