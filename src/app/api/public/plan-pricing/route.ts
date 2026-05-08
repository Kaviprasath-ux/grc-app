/**
 * GET /api/public/plan-pricing - UNAUTHENTICATED
 *
 * Public catalog read for the V2 signup wizard. Returns active rows from
 * ModulePlanPricing.
 */

import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET() {
  const rows = await prisma.modulePlanPricing.findMany({
    where: { isActive: true },
    orderBy: [{ planType: "asc" }, { moduleCode: "asc" }],
  });
  return NextResponse.json({
    data: rows.map((r) => ({
      moduleCode: r.moduleCode,
      planType: r.planType,
      monthlyPrice: r.monthlyPrice === null ? null : Number(r.monthlyPrice),
      yearlyPrice: Number(r.yearlyPrice),
      currency: r.currency,
      userLimit: r.userLimit,
      unlimitedUsers: r.unlimitedUsers,
      frameworkLimit: r.frameworkLimit,
      unlimitedFrameworks: r.unlimitedFrameworks,
      vendorLimit: r.vendorLimit,
      unlimitedVendors: r.unlimitedVendors,
      assessmentLimit: r.assessmentLimit,
      unlimitedAssessments: r.unlimitedAssessments,
      auditLimit: r.auditLimit,
      unlimitedAudits: r.unlimitedAudits,
    })),
  });
}
