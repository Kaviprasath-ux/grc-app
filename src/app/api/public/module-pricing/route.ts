/**
 * GET /api/public/module-pricing — UNAUTHENTICATED.
 *
 * Returns the active tier pricing catalog so marketing pages and the public
 * signup wizard can display live prices without requiring login.
 *
 * Returns only safe fields: no audit metadata (updatedBy / updatedAt are stripped).
 * Inactive tiers are excluded.
 */

import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET() {
  try {
    const rows = await prisma.moduleTierPricing.findMany({
      where: { isActive: true },
      orderBy: [{ moduleCode: "asc" }, { tier: "asc" }],
    });

    return NextResponse.json({
      data: rows.map((r) => ({
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
      })),
    }, {
      headers: {
        // Cache aggressively at the edge so /signup loads fast. Admin price
        // edits propagate within 60s.
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
      },
    });
  } catch {
    return NextResponse.json({ error: "Failed to load pricing" }, { status: 500 });
  }
}
