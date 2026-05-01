/**
 * Verifies grc-subscription.ts and internal-audit-subscription.ts against
 * a synthetic customer with controlled state. Cleans up after itself.
 *
 * Run: npx tsx scripts/verify-limit-checks.ts
 */

import { PrismaClient } from "@prisma/client";
import { checkGrcUserLimit, checkFrameworkLimit } from "@/lib/grc-subscription";
import {
  checkInternalAuditUserLimit,
  checkAuditProjectLimit,
} from "@/lib/internal-audit-subscription";

const prisma = new PrismaClient();
const TEST_CODE = "_LIMIT_TEST_CUSTOMER";
const TEST_USER_PREFIX = "_limit_test_user_";

let pass = 0, fail = 0;
function assert(cond: boolean, label: string) {
  if (cond) { console.log(`  ✓ ${label}`); pass++; }
  else      { console.error(`  ✗ ${label}`); fail++; process.exitCode = 1; }
}

async function cleanup() {
  await prisma.user.deleteMany({ where: { userName: { startsWith: TEST_USER_PREFIX } } });
  const c = await prisma.customerAccount.findUnique({ where: { code: TEST_CODE } });
  if (c) {
    await prisma.framework.deleteMany({ where: { customerAccountId: c.id } });
    await prisma.subscriptionPlan.deleteMany({ where: { customerAccountId: c.id } });
    await prisma.customerPlanOverride.deleteMany({ where: { customerAccountId: c.id } });
    await prisma.moduleSubscription.deleteMany({ where: { subscription: { customerAccountId: c.id } } });
    await prisma.subscription.deleteMany({ where: { customerAccountId: c.id } });
    await prisma.customerAccount.delete({ where: { id: c.id } });
  }
}

async function ensureRole(name: string) {
  return prisma.role.upsert({
    where: { name },
    update: {},
    create: { name, description: `Test role ${name}`, isSystem: true },
  });
}

async function createTestUser(customerId: string, idx: number, roleNames: string[]) {
  const user = await prisma.user.create({
    data: {
      userName: `${TEST_USER_PREFIX}${idx}`,
      fullName: `Test User ${idx}`,
      firstName: "Test",
      lastName: `${idx}`,
      email: `${TEST_USER_PREFIX}${idx}@test.local`,
      password: "x",
      customerAccountId: customerId,
      role: roleNames[0] ?? "User",
    },
  });
  for (const rn of roleNames) {
    const role = await ensureRole(rn);
    await prisma.userRole.create({ data: { userId: user.id, roleId: role.id } });
  }
  return user;
}

async function main() {
  await cleanup();

  // ── Setup customer with all 3 modules ─────────────────────────────
  console.log("Setting up synthetic customer with GRC Basic, IA Basic...");
  const customer = await prisma.customerAccount.create({
    data: {
      code: TEST_CODE,
      name: "Limit Check Test",
      isGrcAdded: true,
      isInternalAuditEnabled: true,
    },
  });
  const sub = await prisma.subscription.create({
    data: { customerAccountId: customer.id, status: "ACTIVE", subscriptionType: "PAID", autoRenew: false },
  });

  const cycleStart = new Date();
  const cycleEnd = new Date();
  cycleEnd.setUTCFullYear(cycleEnd.getUTCFullYear() + 1);

  // GRC Basic: 5 users, 3 frameworks
  await prisma.moduleSubscription.create({
    data: {
      subscriptionId: sub.id, moduleCode: "GRC", tier: "BASIC", billingCycle: "YEARLY",
      unitPrice: 50000, userLimit: 5, frameworkLimit: 3,
      cycleStart, cycleEnd,
    },
  });

  // IA Basic: 5 users, 5 audits
  await prisma.moduleSubscription.create({
    data: {
      subscriptionId: sub.id, moduleCode: "INTERNAL_AUDIT", tier: "BASIC", billingCycle: "YEARLY",
      unitPrice: 50000, userLimit: 5, auditLimit: 5,
      cycleStart, cycleEnd,
    },
  });

  // ── Section 1 — GRC user limit, empty ──────────────────────────────
  console.log("\nSection 1 — GRC user limit, empty customer");
  const r1 = await checkGrcUserLimit(customer.id);
  assert(r1.allowed === true, "0/5 → allowed");
  assert(r1.current === 0, "current=0");
  assert(r1.limit === 5, "limit=5");

  // ── Section 2 — Add 5 GRC users → at cap ───────────────────────────
  console.log("\nSection 2 — fill GRC user pool");
  for (let i = 0; i < 5; i++) {
    await createTestUser(customer.id, i, ["Reviewer"]);
  }
  const r2 = await checkGrcUserLimit(customer.id);
  assert(r2.allowed === false, "5/5 → blocked");
  assert(r2.current === 5, "current=5");
  assert(typeof r2.message === "string", "blocked has message");

  // ── Section 3 — IA pool independent (Reviewer doesn't count for IA) ──
  console.log("\nSection 3 — IA pool independent of GRC");
  const r3 = await checkInternalAuditUserLimit(customer.id);
  assert(r3.allowed === true, "0/5 IA users (Reviewer-only users don't count for IA)");
  assert(r3.current === 0, "IA current=0");

  // Add an Auditor user → counts for IA only
  await createTestUser(customer.id, 100, ["Auditor"]);
  const r3b = await checkInternalAuditUserLimit(customer.id);
  assert(r3b.current === 1, "IA current=1 after adding Auditor");
  const r3c = await checkGrcUserLimit(customer.id);
  assert(r3c.current === 5, "GRC current still=5 (Auditor doesn't count for GRC)");

  // CustomerAdministrator counts for BOTH
  await createTestUser(customer.id, 101, ["CustomerAdministrator"]);
  const r3d = await checkInternalAuditUserLimit(customer.id);
  const r3e = await checkGrcUserLimit(customer.id);
  assert(r3d.current === 2, "IA current=2 (Auditor + CustomerAdmin)");
  assert(r3e.current === 6, "GRC current=6 (5 Reviewers + CustomerAdmin) — over cap, blocked");
  assert(r3e.allowed === false, "GRC blocked at 6/5");

  // ── Section 4 — Framework limit ────────────────────────────────────
  console.log("\nSection 4 — Framework limit");
  const f1 = await checkFrameworkLimit(customer.id);
  assert(f1.allowed === true && f1.current === 0 && f1.limit === 3, "0/3 frameworks → allowed");

  for (let i = 0; i < 3; i++) {
    await prisma.framework.create({
      data: {
        code: `_TEST_FRWK_${i}`,
        name: `Test Framework ${i}`,
        customerAccountId: customer.id,
      },
    });
  }
  const f2 = await checkFrameworkLimit(customer.id);
  assert(f2.allowed === false, "3/3 frameworks → blocked");
  assert(f2.current === 3, "current=3");

  // ── Section 5 — Unlimited tier (frameworkLimit=null) ────────────────
  console.log("\nSection 5 — Unlimited tier returns Infinity");
  await prisma.moduleSubscription.updateMany({
    where: { subscriptionId: sub.id, moduleCode: "GRC" },
    data: { tier: "PRO", frameworkLimit: null, userLimit: 50 },
  });
  const f3 = await checkFrameworkLimit(customer.id);
  assert(f3.allowed === true, "Pro tier unlimited → allowed");
  assert(f3.limit === Number.POSITIVE_INFINITY, "limit=Infinity");

  // ── Section 6 — Audit project limit ─────────────────────────────────
  console.log("\nSection 6 — Audit project limit");
  const a1 = await checkAuditProjectLimit(customer.id);
  assert(a1.allowed === true && a1.current === 0 && a1.limit === 5, "0/5 audits → allowed");

  for (let i = 0; i < 5; i++) {
    await prisma.auditEngagement.create({
      data: {
        customerAccountId: customer.id,
        auditId: `_TEST_AUD${i}`,
        engagementTitle: `Test Audit ${i}`,
      },
    });
  }
  const a2 = await checkAuditProjectLimit(customer.id);
  assert(a2.allowed === false, "5/5 → blocked");

  // ── Section 7 — SUSPENDED customer blocks all checks ────────────────
  console.log("\nSection 7 — SUSPENDED subscription blocks");
  const past = new Date();
  past.setDate(past.getDate() - 60);
  await prisma.moduleSubscription.updateMany({
    where: { subscriptionId: sub.id, moduleCode: "GRC" },
    data: { cycleEnd: past },
  });
  const s1 = await checkGrcUserLimit(customer.id);
  assert(s1.allowed === false, "SUSPENDED GRC → blocked");
  assert(s1.message?.includes("No active GRC"), "message indicates no active subscription");

  // ── Section 8 — Customer with no Subscription at all ────────────────
  console.log("\nSection 8 — customer with no Subscription");
  const noSub = await prisma.customerAccount.create({
    data: { code: TEST_CODE + "_NO_SUB", name: "No Sub", isGrcAdded: true },
  });
  const s2 = await checkGrcUserLimit(noSub.id);
  assert(s2.allowed === false, "no Subscription → blocked");
  await prisma.customerAccount.delete({ where: { id: noSub.id } });

  // Cleanup
  await prisma.auditEngagement.deleteMany({ where: { customerAccountId: customer.id } });
  await cleanup();

  console.log(`\n${pass} passed · ${fail} failed`);
  if (fail > 0) process.exit(1);
}

main()
  .catch(async (e) => { console.error(e); await cleanup(); process.exit(1); })
  .finally(() => prisma.$disconnect());
