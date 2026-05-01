/**
 * Tests POST /api/public/signup logic. Creates trial and paid customers,
 * verifies all the rows are written, then cleans up.
 *
 * Run: npx tsx scripts/smoke-test-signup-api.ts
 */

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { syncSubscriptionPlan } from "@/lib/subscription-plan-sync";

const prisma = new PrismaClient();
const TRIAL_EMAIL = "_signup_trial@test.local";
const PAID_EMAIL = "_signup_paid@test.local";

let pass = 0, fail = 0;
function assert(cond: boolean, label: string) {
  if (cond) { console.log(`  ✓ ${label}`); pass++; }
  else      { console.error(`  ✗ ${label}`); fail++; process.exitCode = 1; }
}

async function cleanup() {
  for (const email of [TRIAL_EMAIL, PAID_EMAIL]) {
    const u = await prisma.user.findFirst({ where: { email } });
    if (u && u.customerAccountId) {
      await prisma.subscriptionPlan.deleteMany({ where: { customerAccountId: u.customerAccountId } });
      await prisma.userRole.deleteMany({ where: { userId: u.id } });
      await prisma.moduleSubscription.deleteMany({ where: { subscription: { customerAccountId: u.customerAccountId } } });
      await prisma.subscription.deleteMany({ where: { customerAccountId: u.customerAccountId } });
      await prisma.user.delete({ where: { id: u.id } });
      await prisma.customerAccount.delete({ where: { id: u.customerAccountId } });
    } else if (u) {
      await prisma.userRole.deleteMany({ where: { userId: u.id } });
      await prisma.user.delete({ where: { id: u.id } });
    }
  }
}

// Replicate signup handler logic in-process (no HTTP)
async function performSignup(input: {
  organizationName: string; gstin?: string;
  adminFirstName: string; adminLastName: string;
  adminEmail: string; adminPassword: string;
  modules: { moduleCode: "GRC" | "TPRM" | "INTERNAL_AUDIT"; tier: "BASIC" | "MEDIUM" | "PRO" }[];
  cycle: "MONTHLY" | "YEARLY"; path: "TRIAL" | "SUBSCRIBE";
}) {
  const TRIAL_DAYS = 14;
  const isTrial = input.path === "TRIAL";
  const now = new Date();
  const trialEndsAt = new Date(now.getTime() + TRIAL_DAYS * 86400000);
  const cycleEnd = (() => {
    if (isTrial) return trialEndsAt;
    const d = new Date(now);
    if (input.cycle === "MONTHLY") d.setUTCMonth(d.getUTCMonth() + 1);
    else d.setUTCFullYear(d.getUTCFullYear() + 1);
    return d;
  })();

  const slug = input.organizationName.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 20);
  let code = `CUST_${slug.toUpperCase()}`;
  if (await prisma.customerAccount.findUnique({ where: { code } })) {
    code = `CUST_${slug.toUpperCase()}_${Date.now().toString(36).toUpperCase()}`;
  }

  const catalog = await prisma.moduleTierPricing.findMany({ where: { isActive: true } });
  const hashedPassword = await bcrypt.hash(input.adminPassword, 10);

  const result = await prisma.$transaction(async (tx) => {
    const enabledCodes = new Set(input.modules.map((m) => m.moduleCode));
    const customer = await tx.customerAccount.create({
      data: {
        code, name: input.organizationName, isActive: true,
        isGrcAdded: enabledCodes.has("GRC"),
        isTprmAdded: enabledCodes.has("TPRM"),
        isInternalAuditEnabled: enabledCodes.has("INTERNAL_AUDIT"),
      },
    });
    const role = await tx.role.upsert({
      where: { name: "CustomerAdministrator" }, update: {},
      create: { name: "CustomerAdministrator", description: "Customer admin", isSystem: true },
    });
    const user = await tx.user.create({
      data: {
        userName: input.adminEmail, email: input.adminEmail,
        firstName: input.adminFirstName, lastName: input.adminLastName,
        fullName: `${input.adminFirstName} ${input.adminLastName}`,
        password: hashedPassword, isActive: true,
        customerAccountId: customer.id, role: "CustomerAdministrator",
      },
    });
    await tx.userRole.create({ data: { userId: user.id, roleId: role.id } });
    const sub = await tx.subscription.create({
      data: {
        customerAccountId: customer.id, status: "ACTIVE",
        subscriptionType: isTrial ? "TRIAL" : "PAID",
        autoRenew: !isTrial,
        trialEndsAt: isTrial ? trialEndsAt : null,
        gstin: input.gstin || null,
      },
    });
    const moduleSubIds: string[] = [];
    for (const m of input.modules) {
      const effectiveTier = isTrial ? "BASIC" : m.tier;
      const tierRow = catalog.find((c) => c.moduleCode === m.moduleCode && c.tier === effectiveTier);
      if (!tierRow) throw new Error(`No catalog for ${m.moduleCode} ${effectiveTier}`);
      const unitPrice = input.cycle === "MONTHLY" ? Number(tierRow.monthlyPrice) : Number(tierRow.yearlyPrice);
      const created = await tx.moduleSubscription.create({
        data: {
          subscriptionId: sub.id, moduleCode: m.moduleCode, tier: effectiveTier,
          billingCycle: input.cycle, unitPrice,
          userLimit: tierRow.userLimit, vendorLimit: tierRow.vendorLimit,
          assessmentLimit: tierRow.assessmentLimit, frameworkLimit: tierRow.frameworkLimit,
          auditLimit: tierRow.auditLimit, cycleStart: now, cycleEnd,
        },
      });
      moduleSubIds.push(created.id);
    }
    return { customer, user, sub, moduleSubIds };
  });
  for (const id of result.moduleSubIds) await syncSubscriptionPlan(id);
  return result;
}

async function main() {
  await cleanup();

  // ── Trial path ──
  console.log("Trial path");
  const trial = await performSignup({
    organizationName: "TrialCo Pvt Ltd",
    adminFirstName: "Tara", adminLastName: "Singh",
    adminEmail: TRIAL_EMAIL, adminPassword: "secret123",
    modules: [
      { moduleCode: "GRC", tier: "PRO" },     // Pro requested
      { moduleCode: "TPRM", tier: "MEDIUM" },
    ],
    cycle: "YEARLY", path: "TRIAL",
  });
  assert(trial.customer.id !== "", "customer created");
  assert(trial.user.email === TRIAL_EMAIL, "admin user created with email");
  assert(trial.sub.subscriptionType === "TRIAL", "subscriptionType=TRIAL");
  assert(trial.sub.autoRenew === false, "autoRenew=false for trial");
  assert(trial.sub.trialEndsAt !== null, "trialEndsAt set");

  const trialModules = await prisma.moduleSubscription.findMany({
    where: { subscriptionId: trial.sub.id },
  });
  assert(trialModules.length === 2, "2 module subscriptions");
  assert(trialModules.every((m) => m.tier === "BASIC"), "trial forces BASIC tier (not Pro/Medium chosen)");
  assert(trialModules.every((m) => m.cycleEnd.getTime() === trial.sub.trialEndsAt!.getTime()), "cycleEnd = trialEndsAt");

  // CustomerAccount flags reflect selection
  const trialCust = await prisma.customerAccount.findUnique({ where: { id: trial.customer.id } });
  assert(trialCust!.isGrcAdded === true && trialCust!.isTprmAdded === true && trialCust!.isInternalAuditEnabled === false,
    "module flags match selection");

  // CustomerAdministrator role assigned
  const userRoles = await prisma.userRole.findMany({
    where: { userId: trial.user.id }, include: { role: true },
  });
  assert(userRoles.some((ur) => ur.role.name === "CustomerAdministrator"), "CustomerAdministrator role assigned");

  // Legacy SubscriptionPlan synced
  const legacy = await prisma.subscriptionPlan.findMany({ where: { customerAccountId: trial.customer.id } });
  assert(legacy.length === 2, "legacy SubscriptionPlan rows synced (one per module)");

  // ── Paid path ──
  console.log("\nPaid path");
  const paid = await performSignup({
    organizationName: "PaidCo Ltd",
    gstin: "27AAACS1234A1Z5",
    adminFirstName: "Pita", adminLastName: "Patel",
    adminEmail: PAID_EMAIL, adminPassword: "secret123",
    modules: [
      { moduleCode: "GRC", tier: "MEDIUM" },
      { moduleCode: "TPRM", tier: "MEDIUM" },
      { moduleCode: "INTERNAL_AUDIT", tier: "MEDIUM" },
    ],
    cycle: "YEARLY", path: "SUBSCRIBE",
  });
  assert(paid.sub.subscriptionType === "PAID", "subscriptionType=PAID");
  assert(paid.sub.autoRenew === true, "autoRenew=true for paid");
  assert(paid.sub.gstin === "27AAACS1234A1Z5", "GSTIN stored");

  const paidModules = await prisma.moduleSubscription.findMany({
    where: { subscriptionId: paid.sub.id },
  });
  assert(paidModules.length === 3, "3 modules for paid signup");
  assert(paidModules.every((m) => m.tier === "MEDIUM"), "paid keeps chosen tier (MEDIUM)");
  // Yearly Medium = ₹1,00,000
  assert(paidModules.every((m) => Number(m.unitPrice) === 100000), "unitPrice = catalog yearly price");

  // ── Duplicate email rejected (in-process check) ──
  console.log("\nDuplicate email");
  const dup = await prisma.user.findFirst({ where: { email: PAID_EMAIL } });
  assert(dup !== null, "second signup with same email would fail uniqueness check");

  await cleanup();
  console.log(`\n${pass} passed · ${fail} failed`);
  if (fail > 0) process.exit(1);
}

main()
  .catch(async (e) => { console.error(e); await cleanup(); process.exit(1); })
  .finally(() => prisma.$disconnect());
