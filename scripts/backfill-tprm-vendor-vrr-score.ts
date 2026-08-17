/**
 * Backfill TPRMVendor.vrrScore for vendors created before the column
 * existed.
 *
 * Why: the risk-rating gauge on bo-inventory / rm-inventory / monitoring
 * previously read `vendor.vrr` (a band label like "High"), which meant
 * every vendor in the same band showed the same band-min score on the
 * needle. The fix in commit `6c8ddfcb` added a `vrrScore` column that
 * new/updated vendors populate. Existing rows still have vrrScore=null
 * and keep rendering the band-min until this script re-computes them
 * from their stored onboardingAnswers.
 *
 * Idempotent — only touches rows where vrrScore IS NULL and
 * onboardingAnswers is present.
 *
 * Usage (PowerShell):
 *   $env:DATABASE_URL = "<direct-url>"
 *   npx tsx scripts/backfill-tprm-vendor-vrr-score.ts
 *
 * Add --dry-run to preview without writing.
 */
import { PrismaClient } from "@prisma/client";

const p = new PrismaClient();
const DRY_RUN = process.argv.includes("--dry-run");

// Mirrors the frontend calculateVrrScore in bo-inventory/rm-inventory:
//   sum(parent.score for parents answered "Yes") +
//   sum(child.score for active children of Yes-parents that are also "Yes")
function computeScore(
  answers: Record<string, string>,
  questions: Array<{
    id: string;
    parentId: string | null;
    score: number;
    isActive: boolean;
    children: Array<{ id: string; score: number; isActive: boolean }>;
  }>,
): number {
  let total = 0;
  for (const parent of questions.filter((q) => !q.parentId)) {
    if (answers[parent.id] !== "Yes") continue;
    total += parent.score || 0;
    for (const child of parent.children || []) {
      if (child.isActive && answers[child.id] === "Yes") {
        total += child.score || 0;
      }
    }
  }
  return Math.min(100, Math.max(0, total));
}

function safeParseAnswers(raw: string | null | undefined): Record<string, string> | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, string>;
    }
    return null;
  } catch {
    return null;
  }
}

async function main() {
  const vendors = await p.tPRMVendor.findMany({
    where: {
      vrrScore: null,
      onboardingAnswers: { not: null },
    },
    select: {
      id: true,
      name: true,
      vrr: true,
      customerAccountId: true,
      onboardingAnswers: true,
    },
  });

  console.log(
    `${DRY_RUN ? "[DRY RUN] " : ""}Found ${vendors.length} vendor(s) with onboardingAnswers but no vrrScore.\n`,
  );
  if (vendors.length === 0) {
    await p.$disconnect();
    return;
  }

  // Preload onboarding questions per tenant so we don't re-query for
  // every vendor.
  const tenantIds = Array.from(new Set(vendors.map((v) => v.customerAccountId)));
  const questionsByTenant = new Map<
    string,
    Awaited<ReturnType<typeof loadTenantQuestions>>
  >();
  async function loadTenantQuestions(customerAccountId: string) {
    return p.tPRMOnboardingQuestion.findMany({
      where: { customerAccountId },
      select: {
        id: true,
        parentId: true,
        score: true,
        isActive: true,
        children: { select: { id: true, score: true, isActive: true } },
      },
    });
  }
  for (const tid of tenantIds) {
    questionsByTenant.set(tid, await loadTenantQuestions(tid));
  }

  let updated = 0;
  let skippedNoAnswers = 0;
  let skippedZeroScore = 0;

  for (const v of vendors) {
    const answers = safeParseAnswers(v.onboardingAnswers);
    if (!answers || Object.keys(answers).length === 0) {
      skippedNoAnswers++;
      console.log(`  skip  ${v.name} — onboardingAnswers unparseable/empty`);
      continue;
    }
    const questions = questionsByTenant.get(v.customerAccountId) || [];
    const score = computeScore(answers, questions);
    if (score === 0) {
      // A legitimate zero (all "No" answers) is fine to store, but log it
      // so someone reviewing this output can tell the difference from an
      // "unable to compute" case.
      skippedZeroScore++;
    }
    console.log(`  ${DRY_RUN ? "would set" : "set     "} ${v.name.padEnd(30)} vrr=${(v.vrr ?? "—").padEnd(10)} vrrScore=${score}`);
    if (!DRY_RUN) {
      await p.tPRMVendor.update({
        where: { id: v.id },
        data: { vrrScore: score },
      });
    }
    updated++;
  }

  console.log(
    `\n${DRY_RUN ? "[DRY RUN] " : ""}Done. Updated ${updated} vendor(s). ` +
      `Skipped ${skippedNoAnswers} with unparseable answers. ` +
      `Note: ${skippedZeroScore} landed on vrrScore=0 (all answers "No" — legitimate but worth reviewing if unexpected).`,
  );
  await p.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
