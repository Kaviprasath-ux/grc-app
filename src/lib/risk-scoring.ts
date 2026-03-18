import prisma from "@/lib/prisma";

interface RiskScoreResult {
  riskScore: number;
  riskRating: string;
}

/**
 * Calculate risk score using the tenant's RiskScoreConfig formula
 * and look up the rating from the tenant's RiskRange table.
 */
export async function calculateRiskScore(
  customerAccountId: string,
  factors: {
    likelihood?: number | null;
    impact?: number | null;
  }
): Promise<RiskScoreResult | null> {
  const { likelihood, impact } = factors;

  // If required factors are missing, return null (no score)
  if (!likelihood || !impact) return null;

  // Fetch the tenant's score config to determine the formula
  const config = await prisma.riskScoreConfig.findFirst({
    where: { customerAccountId },
  });

  // Default formula: Likelihood × Impact
  // If config has useAssetScore/useVulnerabilityScore enabled, those would
  // multiply into the score too — but Risk model doesn't have those fields yet,
  // so we only use likelihood × impact for now
  let riskScore = 1;
  if (!config || config.useLikelihood) riskScore *= likelihood;
  if (!config || config.useImpact) riskScore *= impact;

  // Look up risk rating from tenant's RiskRange table
  const riskRating = await getRiskRating(customerAccountId, riskScore);

  return { riskScore, riskRating };
}

/**
 * Look up the risk rating label from the tenant's RiskRange entries
 * based on the calculated score.
 */
export async function getRiskRating(
  customerAccountId: string,
  score: number
): Promise<string> {
  const ranges = await prisma.riskRange.findMany({
    where: { customerAccountId },
    orderBy: { lowRange: "asc" },
  });

  // If no ranges configured, return empty string
  if (ranges.length === 0) return "";

  // Find the range that contains this score
  for (const range of ranges) {
    if (score >= range.lowRange && score <= range.highRange) {
      return range.title;
    }
  }

  // If score exceeds all ranges, return the highest range title
  const highest = ranges[ranges.length - 1];
  if (score > highest.highRange) return highest.title;

  // If score is below all ranges, return the lowest range title
  return ranges[0].title;
}
