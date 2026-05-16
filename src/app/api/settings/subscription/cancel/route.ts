/**
 * POST /api/settings/subscription/cancel
 * Body: { moduleCode?: ModuleCode }   // omit → cancel all modules
 *
 * Spotify-like instant cancellation:
 *   - User can cancel anytime (no admin approval needed)
 *   - Autopay stops immediately (Razorpay mandate cancelled)
 *   - Access continues until cycleEnd (paid period honored)
 *   - Admin is notified via email
 *   - Refused for COMPLIMENTARY subscriptions (admin-only)
 */

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth } from "@/lib/api-auth";
import { syncSubscriptionPlan } from "@/lib/subscription-plan-sync";
import { cancelMandate } from "@/lib/payment-provider-mandate";
import { sendTemplatedEmail } from "@/lib/email-service";
import { z } from "zod";

function appUrl(): string {
  return process.env.NEXTAUTH_URL || "https://app.verifai.com";
}

const Schema = z.object({
  moduleCode: z.enum(["GRC", "TPRM", "INTERNAL_AUDIT", "TECHNICAL_EVIDENCE"]).optional(),
});

export const POST = withAuth(
  async (req: NextRequest, _ctx, session) => {
    if (!session.customerAccountId) {
      return NextResponse.json({ error: "No customer account on session" }, { status: 400 });
    }

    let body: unknown = {};
    try { body = await req.json(); } catch {}

    const parsed = Schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Validation failed", details: parsed.error.flatten() }, { status: 400 });
    }

    const sub = await prisma.subscription.findUnique({
      where: { customerAccountId: session.customerAccountId },
      include: { modules: true, customerAccount: { select: { id: true, name: true } } },
    });
    if (!sub) return NextResponse.json({ error: "No subscription configured" }, { status: 404 });
    if (sub.subscriptionType === "COMPLIMENTARY") {
      return NextResponse.json({ error: "Complimentary subscriptions cannot be cancelled here — please contact your administrator" }, { status: 400 });
    }

    const targets = parsed.data.moduleCode
      ? sub.modules.filter((m) => m.moduleCode === parsed.data.moduleCode && !m.cancelledAt)
      : sub.modules.filter((m) => !m.cancelledAt);

    if (targets.length === 0) {
      return NextResponse.json({ error: "No active modules to cancel" }, { status: 400 });
    }

    const now = new Date();
    const cancelledModules: string[] = [];

    // Instant cancellation for all targets
    for (const m of targets) {
      await prisma.moduleSubscription.update({
        where: { id: m.id },
        data: { cancelledAt: now },
      });

      // Cancel Razorpay mandate immediately to stop autopay
      if (m.mandateId) {
        try {
          await cancelMandate(m.mandateId);
        } catch (e) {
          console.warn(`[cancel] mandate cancel failed for ms ${m.id}:`, (e as Error).message);
        }
      }

      await syncSubscriptionPlan(m.id);
      cancelledModules.push(m.moduleCode);
    }

    // Turn off autoRenew when cancelling all modules
    if (!parsed.data.moduleCode) {
      await prisma.subscription.update({ where: { id: sub.id }, data: { autoRenew: false } });
    }

    // Log the action
    const stamp = now.toISOString();
    const scope = parsed.data.moduleCode ?? "all modules";
    const note = `[${stamp}] ${session.email || session.id}: cancelled ${scope} (customer self-service)`;
    await prisma.subscription.update({
      where: { id: sub.id },
      data: { notes: sub.notes ? `${sub.notes}\n${note}` : note },
    });

    // Notify admin(s) - fire and forget
    void (async () => {
      try {
        const admins = await prisma.user.findMany({
          where: {
            customerAccountId: session.customerAccountId!,
            isActive: true,
            userRoles: { some: { role: { name: "CustomerAdministrator" } } },
          },
          select: { id: true, fullName: true, email: true },
        });

        // Find the latest cycleEnd among cancelled modules
        const latestCycleEnd = targets
          .map((m) => m.cycleEnd)
          .sort((a, b) => b.getTime() - a.getTime())[0];

        for (const admin of admins) {
          try {
            await sendTemplatedEmail(
              "SUBSCRIPTION_CANCELLED",
              admin.email,
              {
                customerName: sub.customerAccount.name,
                cancelledBy: session.email || "User",
                moduleList: cancelledModules.join(", "),
                accessUntil: latestCycleEnd.toISOString().slice(0, 10),
                portalLink: `${appUrl()}/settings/subscription`,
                recipientName: admin.fullName,
              },
              admin.fullName
            );
          } catch (e) {
            console.warn(`[cancel] admin notification failed for ${admin.email}:`, (e as Error).message);
          }
        }
      } catch (e) {
        console.warn("[cancel] admin notification lookup failed:", (e as Error).message);
      }
    })();

    return NextResponse.json({
      ok: true,
      cancelled: targets.length,
      modules: cancelledModules,
      accessUntil: targets[0]?.cycleEnd.toISOString().slice(0, 10),
    });
  },
  { resource: "subscription.customer-portal", action: "edit" }
);
