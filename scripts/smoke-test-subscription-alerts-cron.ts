/**
 * Tests the alerts cron logic by exercising the same window-matching against
 * a synthetic customer with a 7-day-out cycleEnd. Verifies the cron picks the
 * right template + recipients without actually sending email.
 *
 * Run: npx tsx scripts/smoke-test-subscription-alerts-cron.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const CODE = "_ALERTS_CRON_TEST";
const ADMIN_EMAIL = "_alerts_admin@test.local";

let pass = 0, fail = 0;
function assert(cond: boolean, label: string) {
  if (cond) { console.log(`  ✓ ${label}`); pass++; }
  else      { console.error(`  ✗ ${label}`); fail++; process.exitCode = 1; }
}

async function cleanup() {
  const u = await prisma.user.findFirst({ where: { email: ADMIN_EMAIL } });
  if (u && u.customerAccountId) {
    await prisma.userRole.deleteMany({ where: { userId: u.id } });
    await prisma.subscriptionPlan.deleteMany({ where: { customerAccountId: u.customerAccountId } });
    await prisma.moduleSubscription.deleteMany({ where: { subscription: { customerAccountId: u.customerAccountId } } });
    await prisma.subscription.deleteMany({ where: { customerAccountId: u.customerAccountId } });
    await prisma.user.delete({ where: { id: u.id } });
    await prisma.customerAccount.delete({ where: { id: u.customerAccountId } });
  }
}

const WINDOWS = [
  { days:  30, template: "SUBSCRIPTION_REMINDER_30D", isUrgent: false },
  { days:  15, template: "SUBSCRIPTION_REMINDER_15D", isUrgent: false },
  { days:   7, template: "SUBSCRIPTION_REMINDER_7D",  isUrgent: true  },
  { days:   3, template: "SUBSCRIPTION_REMINDER_3D",  isUrgent: true  },
  { days:   2, template: "SUBSCRIPTION_REMINDER_3D",  isUrgent: true  },
  { days:   1, template: "SUBSCRIPTION_REMINDER_3D",  isUrgent: true  },
  { days:   0, template: "SUBSCRIPTION_EXPIRED",      isUrgent: true  },
  { days:  -1, template: "SUBSCRIPTION_GRACE_PERIOD", isUrgent: true  },
  { days:  -3, template: "SUBSCRIPTION_GRACE_PERIOD", isUrgent: true  },
  { days:  -7, template: "SUBSCRIPTION_GRACE_PERIOD", isUrgent: true  },
];

function startOfDayUTC(d: Date): Date {
  const x = new Date(d);
  x.setUTCHours(0, 0, 0, 0);
  return x;
}
function daysBetween(from: Date, to: Date): number {
  const ms = startOfDayUTC(to).getTime() - startOfDayUTC(from).getTime();
  return Math.round(ms / (24 * 60 * 60 * 1000));
}

async function main() {
  await cleanup();

  // ── Templates exist? ─────────────────────────────────────
  console.log("Templates seeded");
  const templateCodes = WINDOWS.map((w) => w.template).filter((v, i, a) => a.indexOf(v) === i);
  for (const code of templateCodes) {
    const t = await prisma.emailTemplate.findUnique({ where: { code } });
    assert(t !== null, `template ${code} present`);
  }

  // ── Setup: customer with module expiring exactly 7 days out ──
  console.log("\nSetup");
  const customer = await prisma.customerAccount.create({
    data: { code: CODE, name: "Alerts Cron Test", isGrcAdded: true },
  });
  const sub = await prisma.subscription.create({
    data: { customerAccountId: customer.id, status: "ACTIVE", subscriptionType: "PAID", autoRenew: true },
  });

  const today = startOfDayUTC(new Date());
  const sevenDaysOut = new Date(today);
  sevenDaysOut.setUTCDate(sevenDaysOut.getUTCDate() + 7);

  await prisma.moduleSubscription.create({
    data: {
      subscriptionId: sub.id, moduleCode: "GRC", tier: "BASIC", billingCycle: "YEARLY",
      unitPrice: 50000, userLimit: 5, frameworkLimit: 3,
      cycleStart: today, cycleEnd: sevenDaysOut,
    },
  });

  // Create a CustomerAdministrator user
  const role = await prisma.role.upsert({
    where: { name: "CustomerAdministrator" }, update: {},
    create: { name: "CustomerAdministrator", description: "Customer admin", isSystem: true },
  });
  const user = await prisma.user.create({
    data: {
      userName: ADMIN_EMAIL, email: ADMIN_EMAIL,
      firstName: "Alert", lastName: "Admin", fullName: "Alert Admin",
      password: "x", isActive: true, customerAccountId: customer.id, role: "CustomerAdministrator",
    },
  });
  await prisma.userRole.create({ data: { userId: user.id, roleId: role.id } });

  // ── Cron logic — find the window match ──────────────────
  console.log("\nWindow match");
  const subs = await prisma.subscription.findMany({
    where: { subscriptionType: { in: ["PAID", "TRIAL"] } },
    include: { modules: true, customerAccount: { select: { name: true } } },
  });
  const ourSub = subs.find((s) => s.customerAccountId === customer.id);
  assert(ourSub !== undefined, "test customer found in cron query");
  const m = ourSub!.modules[0];
  const delta = daysBetween(today, m.cycleEnd);
  assert(delta === 7, `delta = 7 (got ${delta})`);

  const window = WINDOWS.find((w) => w.days === delta);
  assert(window !== undefined, "window matched");
  assert(window!.template === "SUBSCRIPTION_REMINDER_7D", `picked SUBSCRIPTION_REMINDER_7D template (got ${window!.template})`);
  assert(window!.isUrgent === true, "7-day window flagged urgent");

  // ── Recipient lookup ────────────────────────────────────
  console.log("\nRecipient lookup");
  const admins = await prisma.user.findMany({
    where: {
      customerAccountId: customer.id,
      isActive: true,
      userRoles: { some: { role: { name: "CustomerAdministrator" } } },
    },
    select: { id: true, fullName: true, email: true },
  });
  assert(admins.length === 1, `1 customer admin (got ${admins.length})`);
  assert(admins[0].email === ADMIN_EMAIL, "admin email matches");

  // ── COMPLIMENTARY excluded ──────────────────────────────
  console.log("\nCOMPLIMENTARY filter");
  await prisma.subscription.update({
    where: { id: sub.id },
    data: { subscriptionType: "COMPLIMENTARY" },
  });
  const compSubs = await prisma.subscription.findMany({
    where: { subscriptionType: { in: ["PAID", "TRIAL"] } },
  });
  const compSub = compSubs.find((s) => s.customerAccountId === customer.id);
  assert(compSub === undefined, "COMPLIMENTARY excluded from cron query");

  await cleanup();
  console.log(`\n${pass} passed · ${fail} failed`);
  if (fail > 0) process.exit(1);
}

main()
  .catch(async (e) => { console.error(e); await cleanup(); process.exit(1); })
  .finally(() => prisma.$disconnect());
