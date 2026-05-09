/**
 * Seed script to create Razorpay subscription plans.
 *
 * This creates 6 plans:
 *   - GRC BASE Yearly (₹1,200)
 *   - GRC GENERAL Monthly (₹15,000) and Yearly (₹180,000)
 *   - TPRM BASE Yearly (₹1,200)
 *   - TPRM GENERAL Monthly (₹15,000) and Yearly (₹180,000)
 *   - INTERNAL_AUDIT BASE Yearly (₹1,200)
 *   - INTERNAL_AUDIT GENERAL Monthly (₹15,000) and Yearly (₹180,000)
 *
 * Usage:
 *   PAYMENT_STUB=false npx tsx scripts/seed-razorpay-plans.ts
 *
 * In stub mode (PAYMENT_STUB=true), this creates local DB records with STUB plan IDs.
 * In real mode, this creates plans in Razorpay and stores the plan IDs in the database.
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Pricing constants
const BASE_YEARLY_PRICE = 1200; // ₹100/month x 12 = ₹1,200/year
const GENERAL_MONTHLY_PRICE = 15000; // ₹15,000/month
const GENERAL_YEARLY_PRICE = 180000; // ₹15,000 x 12 = ₹180,000/year

const MODULE_CODES = ["GRC", "TPRM", "INTERNAL_AUDIT"] as const;

const PLAN_CONFIGS = [
  // BASE plans (yearly only)
  ...MODULE_CODES.map((moduleCode) => ({
    moduleCode,
    planType: "BASE" as const,
    billingCycle: "YEARLY" as const,
    amount: BASE_YEARLY_PRICE,
  })),
  // GENERAL plans (monthly and yearly)
  ...MODULE_CODES.flatMap((moduleCode) => [
    {
      moduleCode,
      planType: "GENERAL" as const,
      billingCycle: "MONTHLY" as const,
      amount: GENERAL_MONTHLY_PRICE,
    },
    {
      moduleCode,
      planType: "GENERAL" as const,
      billingCycle: "YEARLY" as const,
      amount: GENERAL_YEARLY_PRICE,
    },
  ]),
];

const MODULE_NAMES: Record<string, string> = {
  GRC: "Verifai GRC",
  TPRM: "Verifai TPRM",
  INTERNAL_AUDIT: "Verifai Internal Audit",
};

function isStubMode(): boolean {
  if (process.env.PAYMENT_STUB === "true") return true;
  if (process.env.PAYMENT_STUB === "false") return false;
  return process.env.NODE_ENV !== "production";
}

interface RazorpayPlanEntity {
  id: string;
  item: {
    id: string;
    name: string;
    amount: number;
  };
}

interface RazorpayInstance {
  plans: {
    create: (options: {
      period: string;
      interval: number;
      item: {
        name: string;
        amount: number;
        currency: string;
        description?: string;
      };
      notes?: Record<string, string>;
    }) => Promise<RazorpayPlanEntity>;
  };
}

async function getRazorpayClient(): Promise<RazorpayInstance | null> {
  if (isStubMode()) {
    return null;
  }

  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;

  if (!keyId || !keySecret) {
    console.error("Razorpay credentials not configured");
    return null;
  }

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Razorpay = require("razorpay");
  return new Razorpay({
    key_id: keyId,
    key_secret: keySecret,
  });
}

async function main() {
  console.log("=".repeat(60));
  console.log("Razorpay Plans Seeder");
  console.log("=".repeat(60));
  console.log(`Mode: ${isStubMode() ? "STUB (local DB only)" : "REAL (creating in Razorpay)"}`);
  console.log("");

  const razorpay = await getRazorpayClient();

  let created = 0;
  let skipped = 0;
  let errors = 0;

  for (const config of PLAN_CONFIGS) {
    const { moduleCode, planType, billingCycle, amount } = config;
    const planName = `${MODULE_NAMES[moduleCode]} - ${planType} ${billingCycle === "YEARLY" ? "Annual" : "Monthly"}`;

    // Check if plan already exists
    const existing = await prisma.razorpayPlan.findUnique({
      where: {
        moduleCode_planType_billingCycle: {
          moduleCode,
          planType,
          billingCycle,
        },
      },
    });

    if (existing && existing.isActive) {
      console.log(`⏭️  SKIP: ${planName} (already exists: ${existing.razorpayPlanId})`);
      skipped++;
      continue;
    }

    try {
      let razorpayPlanId: string;

      if (isStubMode() || !razorpay) {
        // Stub mode: generate fake plan ID
        razorpayPlanId = `STUB-PLAN-${moduleCode}-${planType}-${billingCycle}`;
      } else {
        // Real mode: create plan in Razorpay
        const plan = await razorpay.plans.create({
          period: billingCycle === "YEARLY" ? "yearly" : "monthly",
          interval: 1,
          item: {
            name: planName,
            amount: amount * 100, // Convert to paise
            currency: "INR",
            description: `${MODULE_NAMES[moduleCode]} - ${planType === "BASE" ? "Year 1 Promotional" : "Standard"} Plan`,
          },
          notes: {
            moduleCode,
            planType,
            billingCycle,
          },
        });
        razorpayPlanId = plan.id;
      }

      // Upsert to database
      await prisma.razorpayPlan.upsert({
        where: {
          moduleCode_planType_billingCycle: {
            moduleCode,
            planType,
            billingCycle,
          },
        },
        update: {
          razorpayPlanId,
          amount,
          isActive: true,
        },
        create: {
          razorpayPlanId,
          moduleCode,
          planType,
          billingCycle,
          amount,
          currency: "INR",
          isActive: true,
        },
      });

      console.log(`✅ CREATE: ${planName}`);
      console.log(`   Plan ID: ${razorpayPlanId}`);
      console.log(`   Amount: ₹${amount.toLocaleString("en-IN")}`);
      created++;
    } catch (e) {
      console.error(`❌ ERROR: ${planName}`);
      console.error(`   ${(e as Error).message}`);
      errors++;
    }
  }

  console.log("");
  console.log("=".repeat(60));
  console.log(`Summary: ${created} created, ${skipped} skipped, ${errors} errors`);
  console.log("=".repeat(60));

  // List all plans
  console.log("\nAll Razorpay Plans in Database:");
  const allPlans = await prisma.razorpayPlan.findMany({
    orderBy: [{ moduleCode: "asc" }, { planType: "asc" }, { billingCycle: "asc" }],
  });

  console.log("-".repeat(80));
  console.log(
    "Module".padEnd(15) +
    "Type".padEnd(10) +
    "Cycle".padEnd(10) +
    "Amount".padEnd(15) +
    "Razorpay Plan ID"
  );
  console.log("-".repeat(80));

  for (const plan of allPlans) {
    console.log(
      plan.moduleCode.padEnd(15) +
      plan.planType.padEnd(10) +
      plan.billingCycle.padEnd(10) +
      `₹${Number(plan.amount).toLocaleString("en-IN")}`.padEnd(15) +
      plan.razorpayPlanId
    );
  }

  console.log("-".repeat(80));
}

main()
  .catch((e) => {
    console.error("Seeder failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
