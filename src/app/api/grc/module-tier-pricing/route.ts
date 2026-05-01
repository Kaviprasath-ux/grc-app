/**
 * Super-admin tier pricing CRUD.
 *
 *   GET  /api/grc/module-tier-pricing            → list all 9 rows
 *   PATCH /api/grc/module-tier-pricing/[id]      → update one row (separate file)
 *
 * Edits here flow into every quote produced by computeQuote() — be deliberate.
 */

import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth } from "@/lib/api-auth";

export const GET = withAuth(
  async () => {
    const rows = await prisma.moduleTierPricing.findMany({
      orderBy: [{ moduleCode: "asc" }, { tier: "asc" }],
    });
    return NextResponse.json({
      data: rows.map((r) => ({
        id: r.id,
        moduleCode: r.moduleCode,
        tier: r.tier,
        monthlyPrice: Number(r.monthlyPrice),
        yearlyPrice: Number(r.yearlyPrice),
        currency: r.currency,
        userLimit: r.userLimit,
        vendorLimit: r.vendorLimit,
        assessmentLimit: r.assessmentLimit,
        frameworkLimit: r.frameworkLimit,
        auditLimit: r.auditLimit,
        isActive: r.isActive,
        updatedAt: r.updatedAt,
        updatedBy: r.updatedBy,
      })),
    });
  },
  { resource: "subscription.pricing", action: "view" }
);
