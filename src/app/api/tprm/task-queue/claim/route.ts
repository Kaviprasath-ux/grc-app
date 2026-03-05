import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth, getTenantFilter } from "@/lib/api-auth";

// POST /api/tprm/task-queue/claim — Assessor claims an unassigned assessment
export const POST = withAuth(
  async (req: NextRequest, context, session) => {
    try {
      const body = await req.json();
      const { assessmentId } = body;

      if (!assessmentId) {
        return NextResponse.json({ error: "assessmentId is required" }, { status: 400 });
      }

      const tenantFilter = getTenantFilter(session);

      // Verify assessment exists, is Submitted, and has no assessor
      const assessment = await prisma.tPRMAssessment.findFirst({
        where: {
          id: assessmentId,
          ...tenantFilter,
          status: "Submitted",
          assessorId: null,
        },
      });

      if (!assessment) {
        return NextResponse.json(
          { error: "Assessment not found, already assigned, or not in Submitted status" },
          { status: 404 }
        );
      }

      // Assign current user as assessor and move to Under Review
      const updated = await prisma.tPRMAssessment.update({
        where: { id: assessmentId },
        data: {
          assessorId: session.id,
          status: "Under Review",
        },
        include: {
          vendor: { select: { id: true, name: true, vendorCode: true } },
          assessor: { select: { id: true, fullName: true } },
        },
      });

      // Log the claim
      await prisma.tPRMAssessmentLog.create({
        data: {
          customerAccountId: assessment.customerAccountId,
          assessmentId,
          logDate: new Date(),
          logMessage: `Assessment claimed by assessor ${session.name || session.email}`,
        },
      });

      return NextResponse.json(updated);
    } catch (error) {
      console.error("Error claiming assessment:", error);
      return NextResponse.json(
        { error: "Failed to claim assessment" },
        { status: 500 }
      );
    }
  },
  { resource: "tprm.task-queue", action: "edit" }
);
