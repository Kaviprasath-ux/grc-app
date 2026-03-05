import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth, getTenantFilter } from "@/lib/api-auth";

const ASSESSMENT_STATUSES = ["Initiated", "In Progress", "Completed"] as const;

/**
 * Mirrors the Mendix microflow pattern for Assessment Status chart:
 *
 * Dataview microflow (image 24):
 *   → Retrieve list of Assessment → check if non-empty → set IsEnable
 *
 * Per-series microflow (image 25) — DS_AssessmentInitiated_RM / InProgress / Completed:
 *   → Retrieve TPRMAccount (tenant scope)
 *   → Retrieve all Assessments
 *   → Filter by expression (tenant) → NewAssessmentList
 *   → Filter by expression (status) → ProgressResponse
 *   → Count ProgressResponse → ProgressCount
 *   → Create Barchart { Count, Status } → return as list
 */
export const GET = withAuth(
  async (req, _context, session) => {
    try {
      const tenantFilter = getTenantFilter(session);

      // Dataview microflow (image 24):
      // Retrieve list of Assessment → check if non-empty → IsEnable
      const totalAssessments = await prisma.tPRMAssessment.count({
        where: tenantFilter,
      });
      const isEnabled = totalAssessments > 0;

      // Per-series microflows (image 25):
      // For each status → tenant filter → status filter → count → { status, count }
      // Mirrors: Filter by expression (tenant) → Filter by expression (status) → Count
      const data = await Promise.all(
        ASSESSMENT_STATUSES.map(async (status) => {
          const count = await prisma.tPRMAssessment.count({
            where: { ...tenantFilter, status },
          });
          return { status, count };
        })
      );

      return NextResponse.json({ isEnabled, data });
    } catch (error) {
      console.error("Error fetching assessment status counts:", error);
      return NextResponse.json(
        { error: "Failed to fetch assessment status counts" },
        { status: 500 }
      );
    }
  },
  { resource: ["tprm.assessments", "tprm.bo-inventory", "tprm.rm-inventory"], action: "view" }
);
