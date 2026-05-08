/**
 * Customer-side subscription overview.
 *
 *   GET /api/settings/subscription  → returns the *current customer's* subscription,
 *                                     including module status, current usage vs. limits,
 *                                     billing history, and rolled-up status.
 *
 * Auto-scoped to session.customerAccountId — no super-admin parameter.
 */

import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth } from "@/lib/api-auth";
import { computeSubscriptionStatus, computeModuleStatus } from "@/lib/subscription-status";

const COUNTED_TPRM_ROLES = [
  "Approver", "Assessor", "Auditor", "BusinessOwner", "InternalITTeam", "RelationshipManager",
];
const COUNTED_GRC_ROLES = [
  "CustomerAdministrator", "Reviewer", "Contributor", "DepartmentReviewer", "DepartmentContributor",
];
const COUNTED_IA_ROLES = [
  "CustomerAdministrator", "AuditHead", "AuditUser", "Auditor", "Auditee",
];

export const GET = withAuth(
  async (_req, _ctx, session) => {
    if (!session.customerAccountId) {
      return NextResponse.json({ error: "No customer account on session" }, { status: 400 });
    }
    const customerAccountId = session.customerAccountId;

    const sub = await prisma.subscription.findUnique({
      where: { customerAccountId },
      include: {
        modules: { orderBy: { moduleCode: "asc" } },
        invoices: { orderBy: { issueDate: "desc" }, take: 25 },
      },
    });

    if (!sub) {
      return NextResponse.json({
        data: null,
        message: "No subscription configured for this customer.",
      });
    }

    const now = new Date();

    // Per-module usage counts (live)
    const [grcUsers, iaUsers, tprmUsers, frameworks, vendors, tprmAssessments, audits] = await Promise.all([
      prisma.user.count({
        where: { customerAccountId, userRoles: { some: { role: { name: { in: COUNTED_GRC_ROLES } } } } },
      }),
      prisma.user.count({
        where: { customerAccountId, userRoles: { some: { role: { name: { in: COUNTED_IA_ROLES } } } } },
      }),
      prisma.user.count({
        where: { customerAccountId, tprmRole: { in: COUNTED_TPRM_ROLES } },
      }),
      prisma.framework.count({ where: { customerAccountId } }),
      prisma.tPRMVendor.count({ where: { customerAccountId } }),
      prisma.tPRMAssessment.count({
        where: {
          customerAccountId,
          NOT: { status: { startsWith: "Offboard" } },
          assessmentType: { not: "Assessment Factory" },
        },
      }),
      prisma.auditEngagement.count({
        where: { customerAccountId },
      }),
    ]);

    const status = computeSubscriptionStatus({
      subscriptionType: sub.subscriptionType,
      trialEndsAt: sub.trialEndsAt,
      modules: sub.modules.map((m) => ({ cycleEnd: m.cycleEnd, cancelledAt: m.cancelledAt })),
      now,
    });

    // Earliest non-cancelled cycleEnd → "next renewal"
    const futureEnds = sub.modules
      .filter((m) => !m.cancelledAt && m.cycleEnd > now)
      .map((m) => m.cycleEnd);
    const nextRenewal = futureEnds.length > 0
      ? new Date(Math.min(...futureEnds.map((d) => d.getTime())))
      : null;

    // Total amount per cycle (sum of unitPrice for active modules grouped by cycle)
    let totalMonthly = 0;
    let totalYearly = 0;
    for (const m of sub.modules) {
      if (m.cancelledAt || m.cycleEnd <= now) continue;
      const price = Number(m.unitPrice);
      if (m.billingCycle === "MONTHLY") totalMonthly += price;
      else totalYearly += price;
    }

    return NextResponse.json({
      data: {
        id: sub.id,
        subscriptionType: sub.subscriptionType,
        status,
        autoRenew: sub.autoRenew,
        trialEndsAt: sub.trialEndsAt,
        gstin: sub.gstin,
        nextRenewal,
        totalMonthly,
        totalYearly,
        modules: sub.modules.map((m) => {
          let usedCount: number | null = null;
          if (m.moduleCode === "GRC") usedCount = grcUsers;
          else if (m.moduleCode === "TPRM") usedCount = tprmUsers;
          else if (m.moduleCode === "INTERNAL_AUDIT") usedCount = iaUsers;

          return {
            id: m.id,
            moduleCode: m.moduleCode,
            tier: m.tier,
            billingCycle: m.billingCycle,
            unitPrice: Number(m.unitPrice),
            cycleStart: m.cycleStart,
            cycleEnd: m.cycleEnd,
            cancelledAt: m.cancelledAt,
            status: computeModuleStatus({
              subscriptionType: sub.subscriptionType,
              trialEndsAt: sub.trialEndsAt,
              cycleEnd: m.cycleEnd,
              cancelledAt: m.cancelledAt,
              now,
            }),
            // V2 lifecycle (null on V1 rows)
            planType: m.planType,
            nextPlanType: m.nextPlanType,
            baseEndDate: m.baseEndDate,
            contractEndDate: m.contractEndDate,
            generalBillingCycle: m.generalBillingCycle,
            generalStartDate: m.generalStartDate,
            cancellationRequestedAt: m.cancellationRequestedAt,
            limits: {
              userLimit: m.userLimit,
              userUsed: usedCount,
              vendorLimit: m.vendorLimit,
              vendorUsed: m.moduleCode === "TPRM" ? vendors : null,
              assessmentLimit: m.assessmentLimit,
              assessmentUsed: m.moduleCode === "TPRM" ? tprmAssessments : null,
              frameworkLimit: m.frameworkLimit,
              frameworkUsed: m.moduleCode === "GRC" ? frameworks : null,
              auditLimit: m.auditLimit,
              auditUsed: m.moduleCode === "INTERNAL_AUDIT" ? audits : null,
            },
          };
        }),
        invoices: sub.invoices.map((inv) => ({
          id: inv.id,
          invoiceNumber: inv.invoiceNumber,
          issueDate: inv.issueDate,
          periodStart: inv.periodStart,
          periodEnd: inv.periodEnd,
          total: Number(inv.total),
          status: inv.status,
          pdfPath: inv.pdfPath,
        })),
      },
    });
  },
  { resource: "subscription.customer-portal", action: "view" }
);
