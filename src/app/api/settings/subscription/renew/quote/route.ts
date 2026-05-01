/**
 * POST /api/settings/subscription/renew/quote
 *
 * Body: { cycle: "MONTHLY"|"YEARLY", lines: [{moduleCode, tier}] }
 *
 * Returns the live quote (line items, bundle discount, GST, total) for the
 * caller's customer account using the central computeQuote engine.
 * Read-only — does NOT create invoices or charge anything.
 */

import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api-auth";
import { computeQuote } from "@/lib/pricing";
import { z } from "zod";

const Schema = z.object({
  cycle: z.enum(["MONTHLY", "YEARLY"]),
  lines: z
    .array(
      z.object({
        moduleCode: z.enum(["GRC", "TPRM", "INTERNAL_AUDIT"]),
        tier: z.enum(["BASIC", "MEDIUM", "PRO"]),
      })
    )
    .min(1),
});

export const POST = withAuth(
  async (req: NextRequest, _ctx, session) => {
    if (!session.customerAccountId) {
      return NextResponse.json({ error: "No customer account on session" }, { status: 400 });
    }

    let body: unknown;
    try { body = await req.json(); }
    catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

    const parsed = Schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    try {
      const quote = await computeQuote({
        customerAccountId: session.customerAccountId,
        lines: parsed.data.lines,
        cycle: parsed.data.cycle,
      });
      return NextResponse.json({ data: quote });
    } catch (e) {
      return NextResponse.json({ error: (e as Error).message }, { status: 400 });
    }
  },
  { resource: "subscription.customer-portal", action: "view" }
);
