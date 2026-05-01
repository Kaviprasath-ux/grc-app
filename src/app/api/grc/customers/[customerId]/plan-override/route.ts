/**
 * Per-customer pricing override CRUD.
 *
 *   GET    /api/grc/customers/[id]/plan-override          → list all module overrides for this customer
 *   PUT    /api/grc/customers/[id]/plan-override          → upsert one module's override
 *   DELETE /api/grc/customers/[id]/plan-override?moduleCode=GRC → remove one override
 *
 * Override semantics: when an active override exists for (customer, module),
 * computeQuote() uses its monthlyPrice/yearlyPrice/limits in place of the
 * standard catalog values. See src/lib/pricing.ts.
 */

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth } from "@/lib/api-auth";
import { z } from "zod";

const ModuleCodeSchema = z.enum(["GRC", "TPRM", "INTERNAL_AUDIT"]);

const UpsertSchema = z.object({
  moduleCode: ModuleCodeSchema,
  tier: z.enum(["BASIC", "MEDIUM", "PRO"]).nullable().optional(),
  monthlyPrice: z.number().nonnegative().nullable().optional(),
  yearlyPrice: z.number().nonnegative().nullable().optional(),
  userLimit: z.number().int().nonnegative().nullable().optional(),
  vendorLimit: z.number().int().nonnegative().nullable().optional(),
  assessmentLimit: z.number().int().nonnegative().nullable().optional(),
  frameworkLimit: z.number().int().nonnegative().nullable().optional(),
  auditLimit: z.number().int().nonnegative().nullable().optional(),
  reason: z.string().max(500).nullable().optional(),
  validFrom: z.string().datetime().nullable().optional(),
  validUntil: z.string().datetime().nullable().optional(),
  isActive: z.boolean().optional(),
});

interface RouteContext { params: Promise<{ customerId: string }>; }

function serialize(o: {
  id: string; customerAccountId: string; moduleCode: string;
  tier: string | null;
  monthlyPrice: unknown; yearlyPrice: unknown;
  userLimit: number | null; vendorLimit: number | null;
  assessmentLimit: number | null; frameworkLimit: number | null;
  auditLimit: number | null;
  reason: string | null; validFrom: Date; validUntil: Date | null;
  isActive: boolean; createdBy: string;
  createdAt: Date; updatedAt: Date;
}) {
  return {
    id: o.id,
    customerAccountId: o.customerAccountId,
    moduleCode: o.moduleCode,
    tier: o.tier,
    monthlyPrice: o.monthlyPrice === null ? null : Number(o.monthlyPrice),
    yearlyPrice: o.yearlyPrice === null ? null : Number(o.yearlyPrice),
    userLimit: o.userLimit,
    vendorLimit: o.vendorLimit,
    assessmentLimit: o.assessmentLimit,
    frameworkLimit: o.frameworkLimit,
    auditLimit: o.auditLimit,
    reason: o.reason,
    validFrom: o.validFrom,
    validUntil: o.validUntil,
    isActive: o.isActive,
    createdBy: o.createdBy,
    createdAt: o.createdAt,
    updatedAt: o.updatedAt,
  };
}

export const GET = withAuth(
  async (_req, context: RouteContext) => {
    const { customerId: customerAccountId } = await context.params;
    const customer = await prisma.customerAccount.findUnique({
      where: { id: customerAccountId },
      select: { id: true, code: true, name: true },
    });
    if (!customer) return NextResponse.json({ error: "Customer not found" }, { status: 404 });

    const overrides = await prisma.customerPlanOverride.findMany({
      where: { customerAccountId },
      orderBy: { moduleCode: "asc" },
    });

    return NextResponse.json({
      customer,
      data: overrides.map(serialize),
    });
  },
  { resource: "subscription.customer-override", action: "view" }
);

export const PUT = withAuth(
  async (req: NextRequest, context: RouteContext, session) => {
    const { customerId: customerAccountId } = await context.params;

    const customer = await prisma.customerAccount.findUnique({ where: { id: customerAccountId } });
    if (!customer) return NextResponse.json({ error: "Customer not found" }, { status: 404 });

    let body: unknown;
    try { body = await req.json(); }
    catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

    const parsed = UpsertSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const data = parsed.data;
    const upserted = await prisma.customerPlanOverride.upsert({
      where: { customerAccountId_moduleCode: { customerAccountId, moduleCode: data.moduleCode } },
      update: {
        tier: data.tier ?? null,
        monthlyPrice: data.monthlyPrice ?? null,
        yearlyPrice: data.yearlyPrice ?? null,
        userLimit: data.userLimit ?? null,
        vendorLimit: data.vendorLimit ?? null,
        assessmentLimit: data.assessmentLimit ?? null,
        frameworkLimit: data.frameworkLimit ?? null,
        auditLimit: data.auditLimit ?? null,
        reason: data.reason ?? null,
        validFrom: data.validFrom ? new Date(data.validFrom) : new Date(),
        validUntil: data.validUntil ? new Date(data.validUntil) : null,
        isActive: data.isActive ?? true,
      },
      create: {
        customerAccountId,
        moduleCode: data.moduleCode,
        tier: data.tier ?? null,
        monthlyPrice: data.monthlyPrice ?? null,
        yearlyPrice: data.yearlyPrice ?? null,
        userLimit: data.userLimit ?? null,
        vendorLimit: data.vendorLimit ?? null,
        assessmentLimit: data.assessmentLimit ?? null,
        frameworkLimit: data.frameworkLimit ?? null,
        auditLimit: data.auditLimit ?? null,
        reason: data.reason ?? null,
        validFrom: data.validFrom ? new Date(data.validFrom) : new Date(),
        validUntil: data.validUntil ? new Date(data.validUntil) : null,
        isActive: data.isActive ?? true,
        createdBy: session.id,
      },
    });

    return NextResponse.json({ data: serialize(upserted) });
  },
  { resource: "subscription.customer-override", action: "edit" }
);

export const DELETE = withAuth(
  async (req: NextRequest, context: RouteContext) => {
    const { customerId: customerAccountId } = await context.params;
    const moduleCode = new URL(req.url).searchParams.get("moduleCode");
    const parsed = ModuleCodeSchema.safeParse(moduleCode);
    if (!parsed.success) {
      return NextResponse.json({ error: "moduleCode query param required (GRC|TPRM|INTERNAL_AUDIT)" }, { status: 400 });
    }

    try {
      await prisma.customerPlanOverride.delete({
        where: { customerAccountId_moduleCode: { customerAccountId, moduleCode: parsed.data } },
      });
      return NextResponse.json({ ok: true });
    } catch {
      return NextResponse.json({ error: "Override not found" }, { status: 404 });
    }
  },
  { resource: "subscription.customer-override", action: "delete" }
);
