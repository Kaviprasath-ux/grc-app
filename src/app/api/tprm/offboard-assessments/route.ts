import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuthOnly, getCustomerAccountId } from "@/lib/api-auth";

/**
 * POST /api/tprm/offboard-assessments — Create an offboard assessment for a vendor
 * Called when BO clicks "Terminate Vendor" and confirms
 */
export const POST = withAuthOnly(
  async (req: NextRequest, context: unknown, session) => {
    try {
      const customerAccountId = getCustomerAccountId(session);
      const body = await req.json();
      const { vendorId } = body;

      if (!vendorId) {
        return NextResponse.json({ error: "vendorId is required" }, { status: 400 });
      }

      // Verify vendor belongs to this customer
      const vendor = await prisma.tPRMVendor.findFirst({
        where: { id: vendorId, customerAccountId },
        select: { id: true, name: true, vendorCode: true, accountManagerEmail: true },
      });

      if (!vendor) {
        return NextResponse.json({ error: "Vendor not found" }, { status: 404 });
      }

      // Check if there's already an active offboard assessment for this vendor
      const existing = await prisma.tPRMAssessment.findFirst({
        where: {
          customerAccountId,
          vendorId,
          assessmentType: "Offboard Assessment",
          status: {
            in: [
              "Offboard_In_Progress",
              "Offboard_Awaiting_Response",
              "Offboard_Approve_Assessor",
              "Offboard_Approve_RM",
              "Offboard_Approve_BO",
            ],
          },
        },
      });

      if (existing) {
        // Check if the existing assessment has responses; if not, populate them
        const existingResponses = await prisma.tPRMOffboardResponse.count({
          where: { assessmentId: existing.id },
        });
        if (existingResponses === 0) {
          // Populate responses for the existing assessment
          const questions = await prisma.tPRMOffboardingQuestion.findMany({
            where: { customerAccountId, isActive: true },
            orderBy: { sequenceNo: "asc" },
          });
          if (questions.length > 0) {
            await prisma.tPRMOffboardResponse.createMany({
              data: questions.map((q) => ({
                customerAccountId,
                assessmentId: existing.id,
                questionId: q.id,
                questionNo: q.sequenceNo,
                questionTitle: q.title,
                questionText: q.question || null,
              })),
            });
          }
          return NextResponse.json({
            id: existing.id,
            assessmentCode: existing.assessmentCode,
            vendorName: vendor.name,
            status: existing.status,
          }, { status: 200 });
        }
        return NextResponse.json(
          { error: "An offboard assessment is already in progress for this vendor" },
          { status: 409 }
        );
      }

      // Get offboarding questions for this customer
      const questions = await prisma.tPRMOffboardingQuestion.findMany({
        where: { customerAccountId, isActive: true },
        orderBy: { sequenceNo: "asc" },
      });

      if (questions.length === 0) {
        return NextResponse.json(
          { error: "No offboarding questions configured. Please set up offboarding questions in Configurations." },
          { status: 400 }
        );
      }

      // Generate assessment code
      const count = await prisma.tPRMAssessment.count({
        where: { customerAccountId },
      });
      const assessmentCode = `OB-${vendor.vendorCode}-${String(count + 1).padStart(4, "0")}`;

      // Create the offboard assessment
      const assessment = await prisma.tPRMAssessment.create({
        data: {
          customerAccountId,
          vendorId,
          assessmentCode,
          assessmentType: "Offboard Assessment",
          status: "Offboard_In_Progress",
          initiatedById: session.id,
        },
      });

      // Create offboard responses (one per question)
      const responseData = questions.map((q) => ({
        customerAccountId,
        assessmentId: assessment.id,
        questionId: q.id,
        questionNo: q.sequenceNo,
        questionTitle: q.title,
        questionText: q.question || null,
      }));

      await prisma.tPRMOffboardResponse.createMany({ data: responseData });

      // Update vendor status to Offboarding
      await prisma.tPRMVendor.update({
        where: { id: vendorId },
        data: { status: "Offboarding" },
      });

      return NextResponse.json({
        id: assessment.id,
        assessmentCode: assessment.assessmentCode,
        vendorName: vendor.name,
        status: assessment.status,
      }, { status: 201 });
    } catch (error) {
      console.error("Offboard Assessment POST error:", error);
      return NextResponse.json({ error: "Failed to create offboard assessment" }, { status: 500 });
    }
  }
);

/**
 * GET /api/tprm/offboard-assessments — List offboard assessments
 * Query params: role=am|assessor|rm|bo, status filter
 */
export const GET = withAuthOnly(
  async (req: NextRequest, context, session) => {
    try {
      const customerAccountId = getCustomerAccountId(session);
      const { searchParams } = new URL(req.url);
      const role = searchParams.get("role") || "am";

      // Build status filter based on role
      let statusFilter: string | { in: string[] };
      switch (role) {
        case "am":
          statusFilter = { in: ["Offboard_In_Progress", "Offboard_Awaiting_Response"] };
          break;
        case "assessor":
          statusFilter = "Offboard_Approve_Assessor";
          break;
        case "rm":
          statusFilter = "Offboard_Approve_RM";
          break;
        case "bo":
          statusFilter = "Offboard_Approve_BO";
          break;
        default:
          statusFilter = { in: ["Offboard_In_Progress", "Offboard_Awaiting_Response", "Offboard_Approve_Assessor", "Offboard_Approve_RM", "Offboard_Approve_BO", "Offboard_Completed"] };
      }

      // For AM, filter by their vendor assignments
      let vendorFilter = {};
      if (role === "am") {
        const userEmail = session.email?.toLowerCase() || "";
        if (userEmail) {
          const vendors = await prisma.tPRMVendor.findMany({
            where: {
              customerAccountId,
              accountManagerEmail: { contains: userEmail, mode: "insensitive" },
            },
            select: { id: true },
          });
          vendorFilter = { vendorId: { in: vendors.map((v) => v.id) } };
        }
      }

      const assessments = await prisma.tPRMAssessment.findMany({
        where: {
          customerAccountId,
          assessmentType: "Offboard Assessment",
          status: statusFilter,
          ...vendorFilter,
        },
        include: {
          vendor: { select: { id: true, name: true, vendorCode: true } },
          initiatedBy: { select: { fullName: true } },
        },
        orderBy: { createdAt: "desc" },
      });

      const data = assessments.map((a) => ({
        id: a.id,
        assessmentCode: a.assessmentCode,
        vendorId: a.vendor?.id,
        vendorName: a.vendor?.name || "Unknown",
        vendorCode: a.vendor?.vendorCode || "",
        status: a.status,
        initiatedBy: a.initiatedBy?.fullName || null,
        createdAt: a.createdAt.toISOString(),
      }));

      return NextResponse.json({ data });
    } catch (error) {
      console.error("Offboard Assessments GET error:", error);
      return NextResponse.json({ error: "Failed to fetch offboard assessments" }, { status: 500 });
    }
  }
);
