/**
 * GET /api/grc/cancellation-requests
 *
 * Lists all subscription cancellation requests across all customers.
 * Super-admin only (GRCAdministrator).
 *
 * Returns ModuleSubscription rows where cancellationRequestedAt is set
 * and cancelledAt is null (pending requests only).
 */

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth } from "@/lib/api-auth";

export const GET = withAuth(
  async (_req: NextRequest) => {
    const requests = await prisma.moduleSubscription.findMany({
      where: {
        cancellationRequestedAt: { not: null },
        cancelledAt: null, // Only pending requests
      },
      include: {
        subscription: {
          include: {
            customerAccount: {
              select: {
                id: true,
                name: true,
                code: true,
                users: {
                  where: {
                    role: "CustomerAdministrator",
                  },
                  select: {
                    email: true,
                  },
                  take: 1,
                },
              },
            },
          },
        },
      },
      orderBy: { cancellationRequestedAt: "desc" },
    });

    const formatted = requests.map((r) => ({
      id: r.id,
      moduleCode: r.moduleCode,
      tier: r.tier,
      billingCycle: r.billingCycle,
      unitPrice: Number(r.unitPrice),
      cycleStart: r.cycleStart.toISOString(),
      cycleEnd: r.cycleEnd.toISOString(),
      cancellationRequestedAt: r.cancellationRequestedAt?.toISOString() || null,
      contractEndDate: r.contractEndDate?.toISOString() || null,
      planType: r.planType,
      customer: {
        id: r.subscription.customerAccount.id,
        name: r.subscription.customerAccount.name,
        email: r.subscription.customerAccount.users[0]?.email || null,
        customerCode: r.subscription.customerAccount.code,
      },
      subscriptionId: r.subscriptionId,
    }));

    return NextResponse.json({ data: formatted });
  },
  { resource: "grc.customer-accounts", action: "view" }
);
