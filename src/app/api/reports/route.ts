import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// GET compliance reports data
export async function GET() {
  try {
    // Get all statistics in parallel
    const [
      policyStats,
      evidenceStats,
      controlStats,
      exceptionStats,
      kpiStats,
      riskStats,
    ] = await Promise.all([
      // Policy stats by status
      prisma.policy.groupBy({
        by: ["status"],
        _count: { id: true },
      }),
      // Evidence stats by status
      prisma.evidence.groupBy({
        by: ["status"],
        _count: { id: true },
      }),
      // Control stats by status
      prisma.control.groupBy({
        by: ["status"],
        _count: { id: true },
      }),
      // Exception stats by status
      prisma.exception.groupBy({
        by: ["status"],
        _count: { id: true },
      }),
      // KPI stats by status
      prisma.kPI.groupBy({
        by: ["status"],
        _count: { id: true },
      }),
      // Risk stats by riskRating
      prisma.risk.groupBy({
        by: ["riskRating"],
        _count: { id: true },
      }),
    ]);

    // Build controls summary
    const controls = {
      total: 0,
      implemented: 0,
      inProgress: 0,
      notImplemented: 0,
    };
    controlStats.forEach((stat) => {
      controls.total += stat._count.id;
      if (stat.status === "Implemented" || stat.status === "Compliant") {
        controls.implemented += stat._count.id;
      } else if (stat.status === "In Progress" || stat.status === "Partially Implemented") {
        controls.inProgress += stat._count.id;
      } else if (stat.status === "Not Implemented" || stat.status === "Non Compliant") {
        controls.notImplemented += stat._count.id;
      }
    });

    // Build policies summary
    const policies = {
      total: 0,
      published: 0,
      draft: 0,
      underReview: 0,
    };
    policyStats.forEach((stat) => {
      policies.total += stat._count.id;
      if (stat.status === "Published" || stat.status === "Active") {
        policies.published += stat._count.id;
      } else if (stat.status === "Draft") {
        policies.draft += stat._count.id;
      } else if (stat.status === "Under Review" || stat.status === "Review") {
        policies.underReview += stat._count.id;
      }
    });

    // Build evidences summary
    const evidences = {
      total: 0,
      collected: 0,
      pending: 0,
      overdue: 0,
    };
    evidenceStats.forEach((stat) => {
      evidences.total += stat._count.id;
      if (stat.status === "Collected" || stat.status === "Approved") {
        evidences.collected += stat._count.id;
      } else if (stat.status === "Pending" || stat.status === "Requested") {
        evidences.pending += stat._count.id;
      } else if (stat.status === "Overdue") {
        evidences.overdue += stat._count.id;
      }
    });

    // Build risks summary
    const risks = {
      total: 0,
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
    };
    riskStats.forEach((stat) => {
      risks.total += stat._count.id;
      const rating = stat.riskRating?.toLowerCase();
      if (rating === "critical") risks.critical += stat._count.id;
      else if (rating === "high") risks.high += stat._count.id;
      else if (rating === "medium") risks.medium += stat._count.id;
      else if (rating === "low") risks.low += stat._count.id;
    });

    // Build exceptions summary
    const exceptions = {
      total: 0,
      approved: 0,
      pending: 0,
      rejected: 0,
    };
    exceptionStats.forEach((stat) => {
      exceptions.total += stat._count.id;
      if (stat.status === "Approved" || stat.status === "Authorised") {
        exceptions.approved += stat._count.id;
      } else if (stat.status === "Pending") {
        exceptions.pending += stat._count.id;
      } else if (stat.status === "Rejected" || stat.status === "Closed") {
        exceptions.rejected += stat._count.id;
      }
    });

    // Build KPIs summary
    const kpis = {
      total: 0,
      onTrack: 0,
      atRisk: 0,
      offTrack: 0,
    };
    kpiStats.forEach((stat) => {
      kpis.total += stat._count.id;
      if (stat.status === "Achieved" || stat.status === "On Track") {
        kpis.onTrack += stat._count.id;
      } else if (stat.status === "Overdue" || stat.status === "At Risk") {
        kpis.atRisk += stat._count.id;
      } else if (stat.status === "Missed" || stat.status === "Off Track") {
        kpis.offTrack += stat._count.id;
      }
    });

    return NextResponse.json({
      controls,
      policies,
      evidences,
      risks,
      exceptions,
      kpis,
    });
  } catch (error) {
    console.error("Error fetching reports:", error);
    return NextResponse.json(
      { error: "Failed to fetch reports" },
      { status: 500 }
    );
  }
}
