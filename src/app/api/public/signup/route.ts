/**
 * POST /api/public/signup — UNAUTHENTICATED
 *
 * Creates a new customer account from the public signup wizard:
 *   1. Validates input (org details, admin user, modules + tiers + cycle, path)
 *   2. Checks email uniqueness
 *   3. Generates a unique customer code
 *   4. Creates CustomerAccount + admin User (CustomerAdministrator) + Subscription
 *      + per-module ModuleSubscription rows in a single transaction.
 *   5. Trial path: type=TRIAL, all selected modules forced to BASIC, cycleEnd=trial end
 *   6. Paid path: type=PAID, modules at chosen tier, cycleEnd = today+cycle
 *      (Step 26 will introduce a real payment step before activation;
 *       in dev/MVP the account is created immediately for testing.)
 *
 * Response: { customerCode, userName } so the client can call NextAuth signIn().
 */

import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import prisma from "@/lib/prisma";
import { syncSubscriptionPlan } from "@/lib/subscription-plan-sync";
import { z } from "zod";

const TRIAL_DAYS = 14;

// Personal email domains to block (work email required)
const PERSONAL_EMAIL_DOMAINS = [
  "gmail.com", "googlemail.com",
  "yahoo.com", "yahoo.in", "yahoo.co.in", "yahoo.co.uk",
  "hotmail.com", "hotmail.co.uk", "outlook.com", "live.com", "msn.com",
  "aol.com",
  "icloud.com", "me.com", "mac.com",
  "protonmail.com", "proton.me",
  "zoho.com",
  "yandex.com", "yandex.ru",
  "mail.com", "email.com",
  "gmx.com", "gmx.net",
  "rediffmail.com", "rediff.com",
  "inbox.com",
  "fastmail.com",
  "tutanota.com",
];

function isWorkEmail(email: string): boolean {
  const domain = email.split("@")[1]?.toLowerCase();
  if (!domain) return false;
  return !PERSONAL_EMAIL_DOMAINS.includes(domain);
}

const Schema = z.object({
  // Step 1: Org & admin
  organizationName: z.string().min(2).max(120),
  country: z.string().min(2).max(2).optional(),
  adminFirstName: z.string().min(1).max(60),
  adminLastName: z.string().min(1).max(60),
  adminEmail: z.string().email(),
  adminPhone: z.string().min(10).max(20),
  adminPassword: z.string().min(8).max(128),

  // Step 2 + 3: modules + tiers + cycle
  modules: z.array(z.object({
    moduleCode: z.enum(["GRC", "TPRM", "INTERNAL_AUDIT"]),
    tier: z.enum(["BASIC", "MEDIUM", "PRO"]),
  })).min(1).max(3),
  cycle: z.enum(["MONTHLY", "YEARLY"]),

  // Step 4: trial vs paid
  path: z.enum(["TRIAL", "SUBSCRIBE"]),
});

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 20);
}

async function generateUniqueCustomerCode(orgName: string): Promise<string> {
  const slug = slugify(orgName) || "cust";
  // Try slug+number suffix; fall back to slug+timestamp if too many collisions
  for (let i = 0; i < 5; i++) {
    const suffix = i === 0 ? "" : `-${i}`;
    const candidate = `CUST_${slug.toUpperCase()}${suffix}`;
    const exists = await prisma.customerAccount.findUnique({ where: { code: candidate } });
    if (!exists) return candidate;
  }
  // Fallback: timestamp-based
  return `CUST_${slug.toUpperCase()}_${Date.now().toString(36).toUpperCase()}`;
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", details: parsed.error.flatten() }, { status: 400 });
  }
  const data = parsed.data;

  // ── Pre-flight checks ─────────────────────────────────────
  // 0. Work email validation
  if (!isWorkEmail(data.adminEmail)) {
    return NextResponse.json(
      { error: "Please use a work email address, not a personal one (e.g., gmail, yahoo, hotmail)" },
      { status: 400 }
    );
  }

  // 1. Email/userName uniqueness (we use email as userName)
  const existingUser = await prisma.user.findFirst({
    where: { OR: [{ email: data.adminEmail }, { userName: data.adminEmail }] },
  });
  if (existingUser) {
    return NextResponse.json(
      { error: "An account with this email already exists. Please log in instead." },
      { status: 409 }
    );
  }

  // 2. Reject duplicate moduleCode in selection
  const codes = new Set(data.modules.map((m) => m.moduleCode));
  if (codes.size !== data.modules.length) {
    return NextResponse.json({ error: "Duplicate moduleCode in selection" }, { status: 400 });
  }

  // ── Lookup catalog prices for snapshotting ────────────────
  const catalog = await prisma.moduleTierPricing.findMany({
    where: { isActive: true },
  });
  function findCatalog(moduleCode: string, tier: string) {
    return catalog.find((c) => c.moduleCode === moduleCode && c.tier === tier);
  }

  // For trial: force all selected modules to BASIC and cycleEnd to trialEnd
  const isTrial = data.path === "TRIAL";
  const now = new Date();
  const trialEndsAt = new Date(now.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000);

  const cycleEnd = (() => {
    if (isTrial) return trialEndsAt;
    const d = new Date(now);
    if (data.cycle === "MONTHLY") d.setUTCMonth(d.getUTCMonth() + 1);
    else d.setUTCFullYear(d.getUTCFullYear() + 1);
    return d;
  })();

  // Hash password
  const hashedPassword = await bcrypt.hash(data.adminPassword, 10);

  const customerCode = await generateUniqueCustomerCode(data.organizationName);

  // ── Transactional creation ────────────────────────────────
  try {
    const result = await prisma.$transaction(async (tx) => {
      // 1. CustomerAccount with module flags set based on selection
      const enabledCodes = new Set(data.modules.map((m) => m.moduleCode));
      const customer = await tx.customerAccount.create({
        data: {
          code: customerCode,
          name: data.organizationName,
          isActive: true,
          isGrcAdded: enabledCodes.has("GRC"),
          isTprmAdded: enabledCodes.has("TPRM"),
          isInternalAuditEnabled: enabledCodes.has("INTERNAL_AUDIT"),
        },
      });

      // 2. Find/create CustomerAdministrator role
      const role = await tx.role.upsert({
        where: { name: "CustomerAdministrator" },
        update: {},
        create: { name: "CustomerAdministrator", description: "Customer-level admin", isSystem: true },
      });

      // 3. Create admin user
      const user = await tx.user.create({
        data: {
          userName: data.adminEmail,
          email: data.adminEmail,
          phone: data.adminPhone,
          firstName: data.adminFirstName,
          lastName: data.adminLastName,
          fullName: `${data.adminFirstName} ${data.adminLastName}`,
          password: hashedPassword,
          isActive: true,
          customerAccountId: customer.id,
          role: "CustomerAdministrator",
        },
      });
      await tx.userRole.create({ data: { userId: user.id, roleId: role.id } });

      // 4. Subscription envelope
      const sub = await tx.subscription.create({
        data: {
          customerAccountId: customer.id,
          status: "ACTIVE",
          subscriptionType: isTrial ? "TRIAL" : "PAID",
          autoRenew: !isTrial,
          trialEndsAt: isTrial ? trialEndsAt : null,
          notes: `Self-signup on ${now.toISOString()} via ${isTrial ? "TRIAL" : "SUBSCRIBE"} path`,
        },
      });

      // 5. ModuleSubscription rows (per module)
      // For trial: force BASIC tier. For paid: use chosen tier.
      const moduleSubIds: string[] = [];
      for (const m of data.modules) {
        const effectiveTier = isTrial ? "BASIC" : m.tier;
        const tierRow = findCatalog(m.moduleCode, effectiveTier);
        if (!tierRow) {
          throw new Error(`Catalog missing for ${m.moduleCode} ${effectiveTier}`);
        }
        const unitPrice = data.cycle === "MONTHLY" ? Number(tierRow.monthlyPrice) : Number(tierRow.yearlyPrice);
        const created = await tx.moduleSubscription.create({
          data: {
            subscriptionId: sub.id,
            moduleCode: m.moduleCode,
            tier: effectiveTier,
            billingCycle: data.cycle,
            unitPrice,
            userLimit: tierRow.userLimit,
            vendorLimit: tierRow.vendorLimit,
            assessmentLimit: tierRow.assessmentLimit,
            frameworkLimit: tierRow.frameworkLimit,
            auditLimit: tierRow.auditLimit,
            cycleStart: now,
            cycleEnd,
          },
        });
        moduleSubIds.push(created.id);
      }

      return { customerId: customer.id, customerCode: customer.code, userName: user.userName, moduleSubIds };
    }, { timeout: 15000 });

    // 6. Sync legacy SubscriptionPlan rows (outside the txn — best-effort)
    for (const id of result.moduleSubIds) {
      try { await syncSubscriptionPlan(id); } catch { /* non-fatal */ }
    }

    // 7. Welcome email — best effort, don't fail signup if email fails
    // (Real implementation deferred to Phase 2 alerts; here we just log.)
    console.log(`[SIGNUP] New customer ${result.customerCode} (${data.adminEmail}) — ${isTrial ? "trial" : "paid"} path`);

    return NextResponse.json({
      data: {
        customerCode: result.customerCode,
        userName: result.userName,
        path: data.path,
        trialEndsAt: isTrial ? trialEndsAt : null,
      },
    }, { status: 201 });
  } catch (e) {
    console.error("[SIGNUP] failed:", e);
    return NextResponse.json({ error: (e as Error).message || "Signup failed" }, { status: 500 });
  }
}
