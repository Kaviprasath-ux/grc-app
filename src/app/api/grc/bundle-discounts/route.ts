/**
 * Bundle discount CRUD — GRCAdministrator only.
 *
 *   GET   /api/grc/bundle-discounts    → list all rules
 *   POST  /api/grc/bundle-discounts    → create new rule
 *   PATCH /api/grc/bundle-discounts/[id] → update one rule (separate file)
 *   DELETE /api/grc/bundle-discounts/[id] → delete one rule (separate file)
 */

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth } from "@/lib/api-auth";
import { z } from "zod";

const CreateSchema = z.object({
  name: z.string().min(1).max(120),
  minModules: z.number().int().min(1).max(3),
  minTier: z.enum(["BASIC", "MEDIUM", "PRO"]).nullable().optional(),
  discountType: z.enum(["PERCENTAGE", "FIXED"]),
  discountValue: z.number().nonnegative(),
  appliesToCycle: z.enum(["MONTHLY", "YEARLY"]).nullable().optional(),
  isActive: z.boolean().optional(),
  validFrom: z.string().datetime().nullable().optional(),
  validUntil: z.string().datetime().nullable().optional(),
});

function serialize(r: {
  id: string; name: string; minModules: number; minTier: string | null;
  discountType: string; discountValue: unknown; appliesToCycle: string | null;
  isActive: boolean; validFrom: Date | null; validUntil: Date | null;
  createdAt: Date; updatedAt: Date;
}) {
  return {
    id: r.id,
    name: r.name,
    minModules: r.minModules,
    minTier: r.minTier,
    discountType: r.discountType,
    discountValue: Number(r.discountValue),
    appliesToCycle: r.appliesToCycle,
    isActive: r.isActive,
    validFrom: r.validFrom,
    validUntil: r.validUntil,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}

export const GET = withAuth(
  async () => {
    const rows = await prisma.bundleDiscount.findMany({
      orderBy: [{ isActive: "desc" }, { createdAt: "desc" }],
    });
    return NextResponse.json({ data: rows.map(serialize) });
  },
  { resource: "subscription.bundle-discounts", action: "view" }
);

export const POST = withAuth(
  async (req: NextRequest) => {
    let body: unknown;
    try { body = await req.json(); }
    catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

    const parsed = CreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    if (parsed.data.discountType === "PERCENTAGE" && parsed.data.discountValue > 100) {
      return NextResponse.json(
        { error: "PERCENTAGE discount cannot exceed 100" },
        { status: 400 }
      );
    }

    const created = await prisma.bundleDiscount.create({
      data: {
        name: parsed.data.name,
        minModules: parsed.data.minModules,
        minTier: parsed.data.minTier ?? null,
        discountType: parsed.data.discountType,
        discountValue: parsed.data.discountValue,
        appliesToCycle: parsed.data.appliesToCycle ?? null,
        isActive: parsed.data.isActive ?? true,
        validFrom: parsed.data.validFrom ? new Date(parsed.data.validFrom) : null,
        validUntil: parsed.data.validUntil ? new Date(parsed.data.validUntil) : null,
      },
    });
    return NextResponse.json({ data: serialize(created) }, { status: 201 });
  },
  { resource: "subscription.bundle-discounts", action: "create" }
);
