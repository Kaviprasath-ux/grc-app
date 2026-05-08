/**
 * Phase 8 smoke test - Complimentary migration.
 *
 *   1. Set up a fake "old V1 customer" — Subscription with PAID type and
 *      ModuleSubscription rows where planType is null
 *   2. Add a DRAFT invoice to verify it gets voided
 *   3. Run the migration script (in-process, not via shell)
 *   4. Verify: envelope = COMPLIMENTARY, modules.planType = COMPLIMENTARY,
 *      V2 fields cleared, cycleEnd ~10 years out, invoice marked REFUNDED,
 *      legacy SubscriptionPlan synced with unlimited values
 *   5. Run migration again -> idempotent (already-complimentary skipped)
 *   6. Verify a fake V2-only customer is NOT touched
 *   7. Cleanup
 *
 * Run: npx tsx scripts/smoke-test-v2-comp-migration.ts
 */

import prisma from "../src/lib/prisma";
import { spawn } from "child_process";

const TEST_ORG_V1 = `Smoke V1->Comp ${Date.now().toString(36).slice(-5)}`;
const TEST_ORG_V2 = `Smoke V2 untouched ${Date.now().toString(36).slice(-5)}`;

let pass = 0, fail = 0;
function ok(label: string, actual: unknown, expected: unknown) {
  const isPass = JSON.stringify(actual) === JSON.stringify(expected);
  console.log(`${isPass ? "✓" : "✗"} ${label}: got ${JSON.stringify(actual)}${isPass ? "" : " (expected " + JSON.stringify(expected) + ")"}`);
  if (isPass) pass++; else { fail++; process.exitCode = 1; }
}

function runMigrationScript(args: string[] = []): Promise<{ stdout: string; stderr: string; code: number }> {
  return new Promise((resolve) => {
    const child = spawn("npx", ["tsx", "scripts/migrate-existing-to-complimentary.ts", ...args], {
      cwd: "E:/VSCode/GRC-AI/grc-app",
      shell: true,
    });
    let stdout = "", stderr = "";
    child.stdout.on("data", (d) => { stdout += d.toString(); });
    child.stderr.on("data", (d) => { stderr += d.toString(); });
    child.on("close", (code) => resolve({ stdout, stderr, code: code ?? -1 }));
  });
}

async function createV1Customer(orgName: string) {
  const code = `SMOKE_${Date.now().toString(36).toUpperCase().slice(-6)}`;
  const customer = await prisma.customerAccount.create({
    data: {
      code,
      name: orgName,
      isActive: true,
      isGrcAdded: true,
      isTprmAdded: true,
      isInternalAuditEnabled: false,
    },
  });
  const sub = await prisma.subscription.create({
    data: {
      customerAccountId: customer.id,
      status: "ACTIVE",
      subscriptionType: "PAID",
      autoRenew: true,
    },
  });
  const cycleEnd = new Date(Date.now() + 30 * 86400000);
  // V1 ModuleSubscriptions — planType deliberately not set
  await prisma.moduleSubscription.create({
    data: {
      subscriptionId: sub.id,
      moduleCode: "GRC",
      tier: "MEDIUM",
      billingCycle: "YEARLY",
      unitPrice: 5000,
      userLimit: 10,
      frameworkLimit: 5,
      cycleStart: new Date(),
      cycleEnd,
    },
  });
  await prisma.moduleSubscription.create({
    data: {
      subscriptionId: sub.id,
      moduleCode: "TPRM",
      tier: "BASIC",
      billingCycle: "MONTHLY",
      unitPrice: 800,
      userLimit: 5,
      vendorLimit: 10,
      assessmentLimit: 25,
      cycleStart: new Date(),
      cycleEnd,
    },
  });
  // Open invoice — should get voided
  await prisma.invoice.create({
    data: {
      subscriptionId: sub.id,
      customerAccountId: customer.id,
      invoiceNumber: `SMOKE-${Date.now()}`,
      status: "ISSUED",
      subtotal: 5000,
      taxAmount: 900,
      total: 5900,
      periodStart: new Date(),
      periodEnd: cycleEnd,
    },
  });
  return { customerId: customer.id, customerCode: code, subscriptionId: sub.id };
}

async function createV2Customer(orgName: string) {
  const code = `SMOKE_V2_${Date.now().toString(36).toUpperCase().slice(-6)}`;
  const customer = await prisma.customerAccount.create({
    data: { code, name: orgName, isActive: true, isGrcAdded: true, isTprmAdded: false, isInternalAuditEnabled: false },
  });
  const sub = await prisma.subscription.create({
    data: { customerAccountId: customer.id, status: "ACTIVE", subscriptionType: "PAID", autoRenew: true },
  });
  const baseEnd = new Date(Date.now() + 365 * 86400000);
  const contractEnd = new Date(Date.now() + 730 * 86400000);
  await prisma.moduleSubscription.create({
    data: {
      subscriptionId: sub.id,
      moduleCode: "GRC",
      tier: "BASIC",
      billingCycle: "YEARLY",
      unitPrice: 100,
      userLimit: 5,
      cycleStart: new Date(),
      cycleEnd: baseEnd,
      planType: "BASE",
      nextPlanType: "GENERAL",
      baseStartDate: new Date(),
      baseEndDate: baseEnd,
      contractStartDate: new Date(),
      contractEndDate: contractEnd,
      generalBillingCycle: "MONTHLY",
      generalStartDate: baseEnd,
      mandateId: "STUB-MANDATE-V2-CHECK",
      mandateStatus: "active",
    },
  });
  return { customerId: customer.id, customerCode: code, subscriptionId: sub.id };
}

async function run() {
  console.log("=== Phase 8 Complimentary migration smoke ===\n");

  // 1. Set up fixtures
  const v1 = await createV1Customer(TEST_ORG_V1);
  const v2 = await createV2Customer(TEST_ORG_V2);
  console.log(`  Created V1 fixture: ${v1.customerCode}`);
  console.log(`  Created V2 fixture: ${v2.customerCode}\n`);

  // 2. Pre-state
  const preV1 = await prisma.subscription.findUnique({
    where: { id: v1.subscriptionId },
    include: { modules: true, invoices: true },
  });
  ok("V1 fixture has PAID type", preV1?.subscriptionType, "PAID");
  ok("V1 modules planType null (V1)", preV1?.modules.every(m => m.planType === null), true);
  ok("V1 has open invoice", preV1?.invoices.some(i => i.status === "ISSUED"), true);

  // 3. Run migration (in subprocess to exercise the actual entry point)
  console.log("\n— Running migration —");
  const r1 = await runMigrationScript();
  ok("Migration script exit 0", r1.code, 0);
  ok("Migration logged the V1 fixture", r1.stdout.includes(v1.customerCode), true);

  // 4. Verify V1 customer migrated
  const postV1 = await prisma.subscription.findUnique({
    where: { id: v1.subscriptionId },
    include: { modules: true, invoices: true, customerAccount: { include: { subscriptionPlans: true } } },
  });
  ok("V1 envelope -> COMPLIMENTARY", postV1?.subscriptionType, "COMPLIMENTARY");
  ok("V1 envelope autoRenew=false", postV1?.autoRenew, false);
  ok("V1 modules planType=COMPLIMENTARY", postV1?.modules.every(m => m.planType === "COMPLIMENTARY"), true);
  ok("V1 modules cleared mandateId", postV1?.modules.every(m => m.mandateId === null), true);
  ok("V1 modules cleared contractEndDate", postV1?.modules.every(m => m.contractEndDate === null), true);
  ok("V1 modules cleared baseEndDate", postV1?.modules.every(m => m.baseEndDate === null), true);
  ok("V1 modules cycleEnd >= +9y", postV1?.modules.every(m => m.cycleEnd.getTime() > Date.now() + 9 * 365 * 86400000), true);
  ok("V1 invoice voided (REFUNDED)", postV1?.invoices.every(i => i.status === "REFUNDED"), true);

  // Legacy SubscriptionPlan should reflect unlimited
  ok("Legacy SubscriptionPlans synced (2 rows)", postV1?.customerAccount.subscriptionPlans.length, 2);
  for (const sp of postV1?.customerAccount.subscriptionPlans ?? []) {
    ok(`  ${sp.moduleCode} maxAccountsAllowed=999999 (unlimited via COMPLIMENTARY branch)`, sp.maxAccountsAllowed, 999999);
  }

  // 5. V2 customer should be UNTOUCHED
  const postV2 = await prisma.subscription.findUnique({
    where: { id: v2.subscriptionId },
    include: { modules: true },
  });
  ok("V2 envelope still PAID", postV2?.subscriptionType, "PAID");
  ok("V2 modules still planType=BASE", postV2?.modules.every(m => m.planType === "BASE"), true);
  ok("V2 mandateId preserved", postV2?.modules.every(m => m.mandateId === "STUB-MANDATE-V2-CHECK"), true);
  ok("V2 contractEndDate preserved", postV2?.modules.every(m => m.contractEndDate !== null), true);

  // 6. Idempotency — re-run, should not touch anything
  console.log("\n— Re-running migration (idempotency) —");
  const r2 = await runMigrationScript();
  ok("Re-run exit 0", r2.code, 0);
  ok("Re-run reports skipped-already-comp >= 1", /skipped-already-comp:\s*[1-9]/.test(r2.stdout), true);
  // Re-run must NOT log V1 fixture as freshly migrated
  ok("Re-run did NOT re-migrate V1 fixture", !r2.stdout.includes(`+ ${v1.customerCode}`), true);

  // 7. Cleanup
  console.log("\nCleaning up...");
  for (const sid of [v1.subscriptionId, v2.subscriptionId]) {
    const inv = await prisma.invoice.findMany({ where: { subscriptionId: sid } });
    for (const i of inv) await prisma.invoiceItem.deleteMany({ where: { invoiceId: i.id } });
    await prisma.invoice.deleteMany({ where: { subscriptionId: sid } });
    await prisma.payment.deleteMany({ where: { subscriptionId: sid } });
    await prisma.moduleSubscription.deleteMany({ where: { subscriptionId: sid } });
    const sub = await prisma.subscription.findUnique({ where: { id: sid } });
    if (sub) {
      await prisma.subscriptionPlan.deleteMany({ where: { customerAccountId: sub.customerAccountId } });
      await prisma.subscription.delete({ where: { id: sid } });
      await prisma.customerAccount.delete({ where: { id: sub.customerAccountId } });
    }
  }
  console.log("  Done.");

  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
}

run()
  .catch(e => { console.error("FATAL:", e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
