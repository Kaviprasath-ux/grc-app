import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth, getTenantFilter } from "@/lib/api-auth";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
interface RouteContext {
  params: Promise<Record<string, never>>;
}

// GET /api/qpost-compliance/evidences/status-counts - Get QPost evidence counts by status
export const GET = withAuth(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async (req: NextRequest, context: RouteContext, session) => {
    try {
      const tenantFilter = getTenantFilter(session);
      const { searchParams } = new URL(req.url);
      const frameworkId = searchParams.get("frameworkId");

      // Build where clause
      const whereClause: Record<string, unknown> = { ...tenantFilter };

      // If filtering by framework, we need to find evidences linked to that framework
      if (frameworkId) {
        whereClause.requirements = {
          some: {
            requirement: {
              frameworkId: frameworkId,
            },
          },
        };
      }

      // Get counts for each status
      const [notUploaded, draft, validated, published, needAttention, total] = await Promise.all([
        prisma.qPostEvidence.count({
          where: { ...whereClause, status: "Not Uploaded" },
        }),
        prisma.qPostEvidence.count({
          where: { ...whereClause, status: "Draft" },
        }),
        prisma.qPostEvidence.count({
          where: { ...whereClause, status: "Validated" },
        }),
        prisma.qPostEvidence.count({
          where: { ...whereClause, status: "Published" },
        }),
        prisma.qPostEvidence.count({
          where: { ...whereClause, status: "Need Attention" },
        }),
        prisma.qPostEvidence.count({
          where: whereClause,
        }),
      ]);

      return NextResponse.json({
        notUploaded,
        draft,
        validated,
        published,
        needAttention,
        total,
      });
    } catch (error) {
      console.error("Error fetching QPost evidence status counts:", error);
      return NextResponse.json(
        { error: "Failed to fetch status counts" },
        { status: 500 }
      );
    }
  },
  { resource: "qpost-compliance.evidence", action: "view" }
);
