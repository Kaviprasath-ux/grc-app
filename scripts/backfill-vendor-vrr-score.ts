/**
 * One-off backfill: recompute TPRMVendor.vrrScore from stored onboarding answers.
 *
 * Why this is needed: the numeric VRR score was historically computed at
 * onboarding, used to pick a label ("Critical", "High", …), and then thrown
 * away — only the label was persisted. The risk-rating gauge could therefore
 * only fall back to the minimum of the labelled band, so every Critical vendor
 * displayed the same number. `vrrScore` now stores the real value; this script
 * fills it in for vendors onboarded before the column existed.
 *
 * The score is the sum of `score` over the onboarding questions the vendor
 * answered "Yes", counting each question ONCE. Note the questions endpoint
 * returns children both nested and as their own top-level rows; this script
 * reads from the database directly and walks parents only, so it does not
 * reproduce the double-counting that the UI used to do.
 *
 * IMPORTANT — recomputed scores can disagree with the stored label. Any vendor
 * whose label was inflated by the old double-counting will now compute lower,
 * and may fall into a different band. This script NEVER rewrites `vrr`; it only
 * fills `vrrScore` and reports the mismatches so the change of risk band stays
 * a business decision. Run with --dry-run first and review that list.
 *
 * Usage:
 *   npx tsx scripts/backfill-vendor-vrr-score.ts --dry-run
 *   npx tsx scripts/backfill-vendor-vrr-score.ts
 *   DATABASE_URL="postgresql://..." npx tsx scripts/backfill-vendor-vrr-score.ts --dry-run
 *
 * Idempotent: only touches rows where vrrScore IS NULL unless --force is given.
 */
import prisma from "../src/lib/prisma";

const dryRun = process.argv.includes("--dry-run");
const force = process.argv.includes("--force");

interface Band { name: string; min: number }

// Mirrors the UI's vrrLevels: thresholds come from the customer's due-diligence
// config, falling back to the same defaults the UI uses when fewer than 5 are set.
const DEFAULT_BANDS: Band[] = [
  { name: "Nominal", min: 0 },
  { name: "Low", min: 20 },
  { name: "Moderate", min: 30 },
  { name: "High", min: 40 },
  { name: "Critical", min: 50 },
];

function bandFor(score: number, bands: Band[]): string {
  return [...bands].reverse().find((b) => score >= b.min)?.name || bands[0].name;
}

async function main() {
  const vendors = await prisma.tPRMVendor.findMany({
    where: force ? {} : { vrrScore: null },
    select: {
      id: true, name: true, vrr: true, vrrScore: true,
      customerAccountId: true, onboardingAnswers: true,
    },
  });

  console.log(`${vendors.length} vendor(s) to consider${dryRun ? " (dry run)" : ""}\n`);

  // Cache per-tenant question scores and bands.
  const questionCache = new Map<string, Map<string, number>>();
  const bandCache = new Map<string, Band[]>();

  let updated = 0, skipped = 0;
  const mismatches: string[] = [];

  for (const v of vendors) {
    if (!v.onboardingAnswers) { skipped++; continue; }

    let answers: Record<string, string>;
    try {
      const parsed = JSON.parse(v.onboardingAnswers);
      if (!parsed || typeof parsed !== "object") { skipped++; continue; }
      answers = parsed as Record<string, string>;
    } catch { skipped++; continue; }

    if (!questionCache.has(v.customerAccountId)) {
      const qs = await prisma.tPRMOnboardingQuestion.findMany({
        where: { customerAccountId: v.customerAccountId },
        select: { id: true, score: true },
      });
      questionCache.set(v.customerAccountId, new Map(qs.map((q) => [q.id, q.score])));

      // VRR thresholds live as columns on TPRMConfiguration (one row per
      // tenant). Absent row → the same defaults the UI falls back to.
      const cfg = await prisma.tPRMConfiguration.findUnique({
        where: { customerAccountId: v.customerAccountId },
        select: { vrrNominal: true, vrrLow: true, vrrModerate: true, vrrHigh: true, vrrCritical: true },
      });
      bandCache.set(
        v.customerAccountId,
        cfg
          ? [
              { name: "Nominal", min: cfg.vrrNominal },
              { name: "Low", min: cfg.vrrLow },
              { name: "Moderate", min: cfg.vrrModerate },
              { name: "High", min: cfg.vrrHigh },
              { name: "Critical", min: cfg.vrrCritical },
            ].sort((a, b) => a.min - b.min)
          : DEFAULT_BANDS,
      );
    }

    const scores = questionCache.get(v.customerAccountId)!;
    const bands = bandCache.get(v.customerAccountId)!;

    // Each answered question contributes once — no parent/child double count.
    let total = 0;
    for (const [questionId, answer] of Object.entries(answers)) {
      if (String(answer).trim().toLowerCase() !== "yes") continue;
      total += scores.get(questionId) ?? 0;
    }

    const computedBand = bandFor(total, bands);
    if (v.vrr && computedBand !== v.vrr) {
      mismatches.push(`  ${v.name}: stored label "${v.vrr}" but score ${total} => "${computedBand}"`);
    }

    if (!dryRun) {
      await prisma.tPRMVendor.update({ where: { id: v.id }, data: { vrrScore: total } });
    }
    updated++;
  }

  console.log(`${dryRun ? "would update" : "updated"}: ${updated}`);
  console.log(`skipped (no usable onboarding answers): ${skipped}`);

  if (mismatches.length) {
    console.log(`\n${mismatches.length} vendor(s) whose recomputed score disagrees with the stored label.`);
    console.log("The label was NOT changed — review these and decide whether to re-rate:\n");
    console.log(mismatches.join("\n"));
  } else {
    console.log("\nNo label/score disagreements found.");
  }

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
