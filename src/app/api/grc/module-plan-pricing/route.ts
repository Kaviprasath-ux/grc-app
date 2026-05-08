/**
 * Super-admin V2 plan pricing CRUD.
 *
 *   GET  /api/grc/module-plan-pricing            -> list all rows (3 modules x 2 plan types)
 *   PATCH /api/grc/module-plan-pricing/[id]      -> update one row (separate file)
 *
 * Edits flow into every quote produced by computeQuoteV2().
 */

import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth } from "@/lib/api-auth";

export const GET = withAuth(
  async () => {
    const rows = await prisma.modulePlanPricing.findMany({
      orderBy: [{ planType: "asc" }, { moduleCode: "asc" }],
    });
    return NextResponse.json({
      data: rows.map((r) => ({
        id: r.id,
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
        isActive: r.isActive,
        updatedAt: r.updatedAt,
        updatedBy: r.updatedBy,
      })),
    });
  },
  { resource: "subscription.pricing", action: "view" }
);
