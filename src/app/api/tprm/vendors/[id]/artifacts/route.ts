import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth, getTenantFilter } from "@/lib/api-auth";

interface RouteContext {
  params: Promise<{ id: string }>;
}

// GET — List all assessment artifacts (uploaded documents) for a vendor
export const GET = withAuth<RouteContext>(
  async (_req, context, session) => {
    try {
      const { id: vendorId } = await context.params;
      const tenantFilter = getTenantFilter(session);

      // Verify vendor exists and belongs to this tenant
      const vendor = await prisma.tPRMVendor.findFirst({
        where: { id: vendorId, ...tenantFilter },
        select: { id: true },
      });
      if (!vendor) {
        return NextResponse.json({ error: "Vendor not found" }, { status: 404 });
      }

      // Get all assessments for this vendor
      const assessments = await prisma.tPRMAssessment.findMany({
        where: { vendorId, ...tenantFilter },
        select: { id: true, assessmentCode: true },
      });

      const assessmentIds = assessments.map((a) => a.id);
      const assessmentMap = new Map(assessments.map((a) => [a.id, a.assessmentCode]));

      // Get all responses with artifacts
      const responses = await prisma.tPRMAssessmentResponse.findMany({
        where: {
          assessmentId: { in: assessmentIds },
          artifactUrl: { not: null },
          artifactName: { not: null },
        },
        select: {
          id: true,
          assessmentId: true,
          artifactUrl: true,
          artifactName: true,
          respondedAt: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
      });

      // Also get offboard response artifacts
      const offboardResponses = await prisma.tPRMOffboardResponse.findMany({
        where: {
          assessmentId: { in: assessmentIds },
          artifactUrl: { not: null },
          artifactName: { not: null },
        },
        select: {
          id: true,
          assessmentId: true,
          artifactUrl: true,
          artifactName: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
      });

      const docs = [
        ...responses.map((r) => ({
          id: r.id,
          name: `${r.artifactName} (${assessmentMap.get(r.assessmentId) || "Assessment"})`,
          path: r.artifactUrl!,
          type: "artifact",
          createdAt: (r.respondedAt || r.createdAt).toISOString(),
        })),
        ...offboardResponses.map((r) => ({
          id: r.id,
          name: `${r.artifactName} (${assessmentMap.get(r.assessmentId) || "Offboard"})`,
          path: r.artifactUrl!,
          type: "artifact",
          createdAt: r.createdAt.toISOString(),
        })),
      ];

      return NextResponse.json({ data: docs });
    } catch (error) {
      console.error("Error fetching vendor artifacts:", error);
      return NextResponse.json({ error: "Failed to fetch artifacts" }, { status: 500 });
    }
  },
  { resource: ["tprm.vendor-management", "tprm.assessments", "tprm.bo-inventory", "tprm.rm-inventory"], action: "view" }
);
