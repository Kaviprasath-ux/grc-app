/**
 * GET /api/public/bundle-discounts — UNAUTHENTICATED.
 *
 * Returns ACTIVE bundle discount rules whose validity window includes "now"
 * so the public signup wizard can preview discounts a customer would qualify
 * for. Stale or future-only rules are excluded.
 */

import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET() {
  try {
    const now = new Date();
    const rows = await prisma.bundleDiscount.findMany({
      where: {
        isActive: true,
        AND: [
          { OR: [{ validFrom: null }, { validFrom: { lte: now } }] },
          { OR: [{ validUntil: null }, { validUntil: { gte: now } }] },
        ],
      },
      orderBy: [{ minModules: "desc" }, { discountValue: "desc" }],
    });

    return NextResponse.json({
      data: rows.map((r) => ({
        name: r.name,
        minModules: r.minModules,
        minTier: r.minTier,
        discountType: r.discountType,
        discountValue: Number(r.discountValue),
        appliesToCycle: r.appliesToCycle,
      })),
    }, {
      headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" },
    });
  } catch {
    return NextResponse.json({ error: "Failed to load discounts" }, { status: 500 });
  }
}
