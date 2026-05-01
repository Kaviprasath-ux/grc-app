/**
 * Step 4 — Migrate existing customers to the new subscription model.
 *
 * Idempotent. Per customer:
 *   1. Set isInternalAuditEnabled = isGrcAdded (so existing GRC customers don't lose audit access).
 *   2. Determine enabled modules from flags (GRC, TPRM, INTERNAL_AUDIT).
 *   3. Snapshot existing limits from active SubscriptionPlan rows.
 *   4. Create Subscription envelope (status=ACTIVE, subscriptionType=PAID, autoRenew=false).
 *   5. Create one ModuleSubscription per enabled module at BASIC tier with snapshot limits =
 *      max(Basic tier limit, existing entitlement). cycleEnd = max(latest plan expiry, today+1yr).
 *   6. If any snapshot limit > Basic standard, create a CustomerPlanOverride row to preserve
 *      the elevated entitlement across renewals.
 *   7. Skip customer entirely if no GRC/TPRM/IA modules enabled (e.g., QPost-only).
 *   8. Skip customer entirely if Subscription already exists (idempotent re-run).
 *
 * Existing SubscriptionPlan rows are NOT modified — they continue to drive limit enforcement
 * (tprm-subscription.ts, framework checks) until customers renew/upgrade. Step 5's
 * syncSubscriptionPlan helper bridges the new system back to the legacy table going forward.
 *
 * Run: `npx tsx scripts/migrate-existing-customers-to-subscriptions.ts`
 *      Add `--dry-run` to preview without writing.
 */

import { PrismaClient, PlanTier, BillingCycle } from "@prisma/client";

const prisma = new PrismaClient();
const DRY_RUN = process.argv.includes("--dry-run");

type ModuleCode = "GRC" | "TPRM" | "INTERNAL_AUDIT";

interface ExistingLimits {
  maxFrameworks: number;
  maxAccounts: number;
  vendorLimit: number;
  assessmentLimit: number;
  latestExpiry: Date | null;
}

function sumExistingLimits(
  plans: { maxFrameworksAllowed: number; maxAccountsAllowed: number; vendorLimit: number; assessmentLimit: number; expiryDate: Date }[]
): ExistingLimits {
  return {
    maxFrameworks: plans.reduce((s, p) => s + p.maxFrameworksAllowed, 0),
    maxAccounts: plans.reduce((s, p) => s + p.maxAccountsAllowed, 0),
    vendorLimit: plans.reduce((s, p) => s + p.vendorLimit, 0),
    assessmentLimit: plans.reduce((s, p) => s + p.assessmentLimit, 0),
    latestExpiry: plans.length ? plans.reduce<Date>((max, p) => (p.expiryDate > max ? p.expiryDate : max), plans[0].expiryDate) : null,
  };
}

// max() that treats null as "unlimited" (always wins).
function maxOrUnlimited(a: number | null, b: number | null): number | null {
  if (a === null || b === null) return null;
  return Math.max(a, b);
}

// Compute one-year-from-today in UTC.
function todayPlusYear(): Date {
  const d = new Date();
  d.setUTCFullYear(d.getUTCFullYear() + 1);
  return d;
}

async function getBasicTier(moduleCode: ModuleCode) {
  const tier = await prisma.moduleTierPricing.findUnique({
    where: { moduleCode_tier: { moduleCode, tier: "BASIC" } },
  });
  if (!tier) throw new Error(`Missing BASIC tier for module ${moduleCode} — run seed-subscription-catalog first`);
  return tier;
}

interface ModuleSnapshot {
  moduleCode: ModuleCode;
  userLimit: number;
  vendorLimit: number | null;
  assessmentLimit: number | null;
  frameworkLimit: number | null;
  auditLimit: number | null;
  unitPrice: number;
  isElevated: boolean;
}

async function buildModuleSnapshot(moduleCode: ModuleCode, existing: ExistingLimits): Promise<ModuleSnapshot> {
  const basic = await getBasicTier(moduleCode);

  let userLimit: number;
  let vendorLimit: number | null = null;
  let assessmentLimit: number | null = null;
  let frameworkLimit: number | null = null;
  let auditLimit: number | null = null;
  let isElevated = false;

  if (moduleCode === "GRC") {
    userLimit = Math.max(basic.userLimit, existing.maxAccounts || 0);
    frameworkLimit = maxOrUnlimited(basic.frameworkLimit, existing.maxFrameworks || 0);
    if (userLimit > basic.userLimit) isElevated = true;
    if (basic.frameworkLimit !== null && (frameworkLimit === null || frameworkLimit > basic.frameworkLimit)) isElevated = true;
  } else if (moduleCode === "TPRM") {
    userLimit = Math.max(basic.userLimit, existing.maxAccounts || 0);
    vendorLimit = maxOrUnlimited(basic.vendorLimit, existing.vendorLimit || 0);
    assessmentLimit = maxOrUnlimited(basic.assessmentLimit, existing.assessmentLimit || 0);
    if (userLimit > basic.userLimit) isElevated = true;
    if (basic.vendorLimit !== null && (vendorLimit === null || vendorLimit > basic.vendorLimit)) isElevated = true;
    if (basic.assessmentLimit !== null && (assessmentLimit === null || assessmentLimit > basic.assessmentLimit)) isElevated = true;
  } else {
    // INTERNAL_AUDIT: no legacy data to consult — default to Basic.
    userLimit = basic.userLimit;
    auditLimit = basic.auditLimit;
  }

  return {
    moduleCode,
    userLimit,
    vendorLimit,
    assessmentLimit,
    frameworkLimit,
    auditLimit,
    // billingCycle is YEARLY for migration → unitPrice should be yearly price.
    // unitPrice represents the cost charged per billing period.
    unitPrice: Number(basic.yearlyPrice),
    isElevated,
  };
}

async function migrateOneCustomer(customerAccountId: string) {
  const customer = await prisma.customerAccount.findUnique({
    where: { id: customerAccountId },
    select: {
      id: true,
      code: true,
      name: true,
      isGrcAdded: true,
      isTprmAdded: true,
      isInternalAuditEnabled: true,
      isQpostComplianceEnabled: true,
      subscription: { select: { id: true } },
      subscriptionPlans: {
        where: { status: "Active" },
        select: {
          maxFrameworksAllowed: true,
          maxAccountsAllowed: true,
          vendorLimit: true,
          assessmentLimit: true,
          expiryDate: true,
        },
      },
    },
  });

  if (!customer) return { customerCode: customerAccountId, action: "missing" as const };

  // Idempotent: skip if Subscription already exists
  if (customer.subscription) {
    return { customerCode: customer.code, action: "skip-already-migrated" as const };
  }

  // Step 1: Backfill isInternalAuditEnabled = isGrcAdded if not yet set
  let isInternalAuditEnabled = customer.isInternalAuditEnabled;
  if (!isInternalAuditEnabled && customer.isGrcAdded) {
    if (!DRY_RUN) {
      await prisma.customerAccount.update({
        where: { id: customer.id },
        data: { isInternalAuditEnabled: true },
      });
    }
    isInternalAuditEnabled = true;
  }

  // Step 2: Determine enabled modules
  const enabledModules: ModuleCode[] = [];
  if (customer.isGrcAdded) enabledModules.push("GRC");
  if (customer.isTprmAdded) enabledModules.push("TPRM");
  if (isInternalAuditEnabled) enabledModules.push("INTERNAL_AUDIT");

  if (enabledModules.length === 0) {
    return { customerCode: customer.code, action: "skip-no-modules" as const };
  }

  // Step 3: Snapshot existing limits
  const existing = sumExistingLimits(customer.subscriptionPlans);
  const cycleStart = new Date();
  const cycleEnd = existing.latestExpiry && existing.latestExpiry > todayPlusYear()
    ? existing.latestExpiry
    : todayPlusYear();

  // Step 4-6: Build snapshots, create Subscription + ModuleSubscriptions + overrides
  const snapshots: ModuleSnapshot[] = [];
  for (const m of enabledModules) {
    snapshots.push(await buildModuleSnapshot(m, existing));
  }

  const today = new Date().toISOString().slice(0, 10);

  if (!DRY_RUN) {
    await prisma.$transaction(async (tx) => {
      const sub = await tx.subscription.create({
        data: {
          customerAccountId: customer.id,
          status: "ACTIVE",
          subscriptionType: "PAID",
          autoRenew: false,
          notes: `Migrated from legacy plan on ${today}`,
        },
      });

      for (const snap of snapshots) {
        await tx.moduleSubscription.create({
          data: {
            subscriptionId: sub.id,
            moduleCode: snap.moduleCode,
            tier: "BASIC",
            billingCycle: "YEARLY",
            unitPrice: snap.unitPrice,
            userLimit: snap.userLimit,
            vendorLimit: snap.vendorLimit,
            assessmentLimit: snap.assessmentLimit,
            frameworkLimit: snap.frameworkLimit,
            auditLimit: snap.auditLimit,
            cycleStart,
            cycleEnd,
          },
        });

        if (snap.isElevated) {
          await tx.customerPlanOverride.create({
            data: {
              customerAccountId: customer.id,
              moduleCode: snap.moduleCode,
              tier: "BASIC",
              userLimit: snap.userLimit,
              vendorLimit: snap.vendorLimit,
              assessmentLimit: snap.assessmentLimit,
              frameworkLimit: snap.frameworkLimit,
              auditLimit: snap.auditLimit,
              reason: "Legacy elevated limits preserved during migration",
              isActive: true,
              createdBy: "system-migration",
            },
          });
        }
      }
    });
  }

  return {
    customerCode: customer.code,
    action: "migrated" as const,
    enabledModules,
    cycleEnd: cycleEnd.toISOString().slice(0, 10),
    snapshots: snapshots.map(s => ({
      m: s.moduleCode,
      users: s.userLimit,
      vendors: s.vendorLimit,
      assess: s.assessmentLimit,
      frwks: s.frameworkLimit,
      audits: s.auditLimit,
      elevated: s.isElevated,
    })),
  };
}

async function main() {
  console.log(`🚀 Migrating existing customers to new subscription model${DRY_RUN ? " (DRY RUN)" : ""}\n`);

  const customers = await prisma.customerAccount.findMany({
    select: { id: true, code: true },
    orderBy: { code: "asc" },
  });

  console.log(`Found ${customers.length} customer accounts.\n`);

  const stats = { migrated: 0, skipped: 0, failed: 0 };
  for (const c of customers) {
    try {
      const result = await migrateOneCustomer(c.id);
      if (result.action === "migrated") {
        stats.migrated++;
        console.log(`  ✓ ${result.customerCode.padEnd(15)} → migrated [${result.enabledModules.join("+")}] cycleEnd=${result.cycleEnd}`);
        for (const s of result.snapshots) {
          const elev = s.elevated ? " [ELEVATED OVERRIDE]" : "";
          console.log(`      ${s.m.padEnd(16)} users=${s.users} vendors=${s.vendors ?? "—"} assess=${s.assess ?? "—"} frwks=${s.frwks ?? (s.frwks === null ? "∞" : "—")} audits=${s.audits ?? (s.audits === null ? "∞" : "—")}${elev}`);
        }
      } else {
        stats.skipped++;
        console.log(`  ⊘ ${result.customerCode.padEnd(15)} → ${result.action}`);
      }
    } catch (e) {
      stats.failed++;
      console.error(`  ✗ ${c.code} → FAILED: ${(e as Error).message}`);
    }
  }

  console.log(`\nDone: ${stats.migrated} migrated · ${stats.skipped} skipped · ${stats.failed} failed`);
  if (DRY_RUN) console.log("(no changes were written — re-run without --dry-run to apply)");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
