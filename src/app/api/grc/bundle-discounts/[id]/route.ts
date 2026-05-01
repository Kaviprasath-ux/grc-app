import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth } from "@/lib/api-auth";
import { z } from "zod";

const PatchSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  minModules: z.number().int().min(1).max(3).optional(),
  minTier: z.enum(["BASIC", "MEDIUM", "PRO"]).nullable().optional(),
  discountType: z.enum(["PERCENTAGE", "FIXED"]).optional(),
  discountValue: z.number().nonnegative().optional(),
  appliesToCycle: z.enum(["MONTHLY", "YEARLY"]).nullable().optional(),
  isActive: z.boolean().optional(),
  validFrom: z.string().datetime().nullable().optional(),
  validUntil: z.string().datetime().nullable().optional(),
});

interface RouteContext { params: Promise<{ id: string }>; }

function serialize(r: {
  id: string; name: string; minModules: number; minTier: string | null;
  discountType: string; discountValue: unknown; appliesToCycle: string | null;
  isActive: boolean; validFrom: Date | null; validUntil: Date | null;
  createdAt: Date; updatedAt: Date;
}) {
  return {
    id: r.id, name: r.name, minModules: r.minModules, minTier: r.minTier,
    discountType: r.discountType, discountValue: Number(r.discountValue),
    appliesToCycle: r.appliesToCycle, isActive: r.isActive,
    validFrom: r.validFrom, validUntil: r.validUntil,
    createdAt: r.createdAt, updatedAt: r.updatedAt,
  };
}

export const PATCH = withAuth(
  async (req: NextRequest, context: RouteContext) => {
    const { id } = await context.params;
    let body: unknown;
    try { body = await req.json(); }
    catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

    const parsed = PatchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const existing = await prisma.bundleDiscount.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    if (parsed.data.discountType === "PERCENTAGE" && (parsed.data.discountValue ?? 0) > 100) {
      return NextResponse.json({ error: "PERCENTAGE discount cannot exceed 100" }, { status: 400 });
    }

    const data: Record<string, unknown> = { ...parsed.data };
    if (parsed.data.validFrom !== undefined) {
      data.validFrom = parsed.data.validFrom ? new Date(parsed.data.validFrom) : null;
    }
    if (parsed.data.validUntil !== undefined) {
      data.validUntil = parsed.data.validUntil ? new Date(parsed.data.validUntil) : null;
    }

    const updated = await prisma.bundleDiscount.update({ where: { id }, data });
    return NextResponse.json({ data: serialize(updated) });
  },
  { resource: "subscription.bundle-discounts", action: "edit" }
);

export const DELETE = withAuth(
  async (_req, context: RouteContext) => {
    const { id } = await context.params;
    const existing = await prisma.bundleDiscount.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
    await prisma.bundleDiscount.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  },
  { resource: "subscription.bundle-discounts", action: "delete" }
);
