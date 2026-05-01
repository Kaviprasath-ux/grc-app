import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth } from "@/lib/api-auth";
import { z } from "zod";

const PatchSchema = z.object({
  monthlyPrice: z.number().nonnegative().optional(),
  yearlyPrice: z.number().nonnegative().optional(),
  userLimit: z.number().int().nonnegative().optional(),
  vendorLimit: z.number().int().nonnegative().nullable().optional(),
  assessmentLimit: z.number().int().nonnegative().nullable().optional(),
  frameworkLimit: z.number().int().nonnegative().nullable().optional(),
  auditLimit: z.number().int().nonnegative().nullable().optional(),
  isActive: z.boolean().optional(),
});

interface RouteContext {
  params: Promise<{ id: string }>;
}

export const PATCH = withAuth(
  async (req: NextRequest, context: RouteContext, session) => {
    const { id } = await context.params;

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const parsed = PatchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const existing = await prisma.moduleTierPricing.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Pricing row not found" }, { status: 404 });
    }

    // Sanity check: yearly should not be more expensive than 12 × monthly.
    const monthly = parsed.data.monthlyPrice ?? Number(existing.monthlyPrice);
    const yearly = parsed.data.yearlyPrice ?? Number(existing.yearlyPrice);
    if (monthly > 0 && yearly > monthly * 12) {
      return NextResponse.json(
        { error: `Yearly price (${yearly}) must not exceed 12× monthly (${monthly * 12})` },
        { status: 400 }
      );
    }

    const updated = await prisma.moduleTierPricing.update({
      where: { id },
      data: { ...parsed.data, updatedBy: session.id },
    });

    return NextResponse.json({
      data: {
        id: updated.id,
        moduleCode: updated.moduleCode,
        tier: updated.tier,
        monthlyPrice: Number(updated.monthlyPrice),
        yearlyPrice: Number(updated.yearlyPrice),
        currency: updated.currency,
        userLimit: updated.userLimit,
        vendorLimit: updated.vendorLimit,
        assessmentLimit: updated.assessmentLimit,
        frameworkLimit: updated.frameworkLimit,
        auditLimit: updated.auditLimit,
        isActive: updated.isActive,
        updatedAt: updated.updatedAt,
        updatedBy: updated.updatedBy,
      },
    });
  },
  { resource: "subscription.pricing", action: "edit" }
);
