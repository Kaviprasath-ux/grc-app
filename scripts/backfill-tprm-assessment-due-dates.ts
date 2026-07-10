/**
 * One-off backfill: set the `dueDate` on every TPRMAssessment row that
 * currently has it as null, computed from the vendor's VRR band and the
 * tenant's TPRMConfiguration.dueDate{Band} value, applied to the
 * assessment's createdAt timestamp.
 *
 * Why: assessment-creation routes only learned to compute dueDate in
 * commit `<this batch>`; rows created before that have dueDate=null and
 * the Assessments table shows "—" in the Due Date column. Run this once
 * per environment to populate them.
 *
 * Idempotent — only touches rows where dueDate is null. Safe to re-run.
 *
 * Usage (PowerShell):
 *   $env:DATABASE_URL = "<direct-url>"
 *   npx tsx scripts/backfill-tprm-assessment-due-dates.ts
 */
import { PrismaClient } from "@prisma/client";

const p = new PrismaClient();

const DEFAULT_DAYS_PER_BAND = {
  Critical: 30,
  High: 30,
  Moderate: 30,
  Low: 30,
  Nominal: 30,
};

type Band = keyof typeof DEFAULT_DAYS_PER_BAND;

function normaliseBand(vrr: string | null | undefined): Band {
  const v = (vrr || "").toLowerCase();
  if (v === "critical") return "Critical";
  if (v === "high") return "High";
  if (v === "moderate" || v === "medium") return "Moderate";
  if (v === "low") return "Low";
  return "Nominal";
}

async function main() {
  // Pull every customer that has at least one assessment with null dueDate.
  const customers = await p.customerAccount.findMany({
    where: { tprmAssessments: { some: { dueDate: null } } },
    select: { id: true, code: true, name: true },
  });
  console.log(`Customers with null-dueDate assessments: ${customers.length}\n`);

  let totalUpdated = 0;
  for (const c of customers) {
    const cfg = await p.tPRMConfiguration.findUnique({
      where: { customerAccountId: c.id },
      select: {
        dueDateCritical: true,
        dueDateHigh: true,
        dueDateModerate: true,
        dueDateLow: true,
        dueDateNominal: true,
      },
    });
    const days: Record<Band, number> = {
      Critical: cfg?.dueDateCritical ?? DEFAULT_DAYS_PER_BAND.Critical,
      High: cfg?.dueDateHigh ?? DEFAULT_DAYS_PER_BAND.High,
      Moderate: cfg?.dueDateModerate ?? DEFAULT_DAYS_PER_BAND.Moderate,
      Low: cfg?.dueDateLow ?? DEFAULT_DAYS_PER_BAND.Low,
      Nominal: cfg?.dueDateNominal ?? DEFAULT_DAYS_PER_BAND.Nominal,
    };

    const assessments = await p.tPRMAssessment.findMany({
      where: { customerAccountId: c.id, dueDate: null },
      select: { id: true, createdAt: true, assessmentCode: true, vendor: { select: { vrr: true } } },
    });

    let updated = 0;
    for (const a of assessments) {
      const band = normaliseBand(a.vendor?.vrr);
      const dueDate = new Date(a.createdAt.getTime() + days[band] * 24 * 60 * 60 * 1000);
      await p.tPRMAssessment.update({
        where: { id: a.id },
        data: { dueDate },
      });
      updated++;
    }
    console.log(`  ${c.code} (${c.name}): updated ${updated} assessment(s)`);
    totalUpdated += updated;
  }

  console.log(`\nDone. Total assessments updated: ${totalUpdated}`);
  await p.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
