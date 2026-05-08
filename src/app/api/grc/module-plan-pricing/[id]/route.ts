import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth } from "@/lib/api-auth";
import { z } from "zod";

const PatchSchema = z.object({
  monthlyPrice: z.number().nonnegative().nullable().optional(),
  yearlyPrice: z.number().nonnegative().optional(),
  userLimit: z.number().int().nonnegative().optional(),
  unlimitedUsers: z.boolean().optional(),
  frameworkLimit: z.number().int().nonnegative().nullable().optional(),
  unlimitedFrameworks: z.boolean().optional(),
  vendorLimit: z.number().int().nonnegative().nullable().optional(),
  unlimitedVendors: z.boolean().optional(),
  assessmentLimit: z.number().int().nonnegative().nullable().optional(),
  unlimitedAssessments: z.boolean().optional(),
  auditLimit: z.number().int().nonnegative().nullable().optional(),
  unlimitedAudits: z.boolean().optional(),
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

    const existing = await prisma.modulePlanPricing.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Plan pricing row not found" }, { status: 404 });
    }

    // BASE plans: monthlyPrice must be null (BASE charges yearly only).
    // GENERAL plans: monthlyPrice required and positive when sane.
    const nextMonthly =
      parsed.data.monthlyPrice !== undefined
        ? parsed.data.monthlyPrice
        : existing.monthlyPrice === null
        ? null
        : Number(existing.monthlyPrice);
    const nextYearly =
      parsed.data.yearlyPrice !== undefined ? parsed.data.yearlyPrice : Number(existing.yearlyPrice);

    if (existing.planType === "BASE" && nextMonthly !== null && nextMonthly !== 0) {
      return NextResponse.json(
        { error: "BASE plans charge yearly only - monthlyPrice must be null or 0" },
        { status: 400 }
      );
    }

    // Sanity: yearly should not exceed 12x monthly (only meaningful when monthly is set).
    if (nextMonthly !== null && nextMonthly > 0 && nextYearly > nextMonthly * 12) {
      return NextResponse.json(
        { error: `Yearly price (${nextYearly}) must not exceed 12x monthly (${nextMonthly * 12})` },
        { status: 400 }
      );
    }

    const updated = await prisma.modulePlanPricing.update({
      where: { id },
      data: { ...parsed.data, updatedBy: session.id },
    });

    return NextResponse.json({
      data: {
        id: updated.id,
        moduleCode: updated.moduleCode,
        planType: updated.planType,
        monthlyPrice: updated.monthlyPrice === null ? null : Number(updated.monthlyPrice),
        yearlyPrice: Number(updated.yearlyPrice),
        currency: updated.currency,
        userLimit: updated.userLimit,
        unlimitedUsers: updated.unlimitedUsers,
        frameworkLimit: updated.frameworkLimit,
        unlimitedFrameworks: updated.unlimitedFrameworks,
        vendorLimit: updated.vendorLimit,
        unlimitedVendors: updated.unlimitedVendors,
        assessmentLimit: updated.assessmentLimit,
        unlimitedAssessments: updated.unlimitedAssessments,
        auditLimit: updated.auditLimit,
        unlimitedAudits: updated.unlimitedAudits,
        isActive: updated.isActive,
        updatedAt: updated.updatedAt,
        updatedBy: updated.updatedBy,
      },
    });
  },
  { resource: "subscription.pricing", action: "edit" }
);
