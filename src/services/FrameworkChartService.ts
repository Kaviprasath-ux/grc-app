import { prisma } from "@/lib/prisma";

/**
 * FrameworkChartService.ts
 * 
 * Calculates dashboard chart percentages for frameworks:
 * 1. Compliance Control Chart: (Compliant Controls / Total Controls) × 100
 * 2. Policy Gauge Chart: (Published Policies / Total Policies) × 100
 * 3. Evidence Gauge Chart: (Published Evidences / Total Evidences) × 100
 * 
 * All calculations follow Mendix specifications exactly.
 */

export interface ChartData {
  compliancePercentage: number;
  policyPercentage: number;
  evidencePercentage: number;
  details?: {
    compliance: {
      compliant: number;
      total: number;
    };
    policy: {
      published: number;
      total: number;
    };
    evidence: {
      published: number;
      total: number;
    };
  };
}

/**
 * Calculate all chart percentages for a framework
 * 
 * @param frameworkId - The framework ID
 * @returns Chart data with all three percentages
 */
export async function calculateFrameworkCharts(
  frameworkId: string
): Promise<ChartData> {
  const startTime = Date.now();

  try {
    console.log(`


📋 CALCULATING CHARTS FOR FRAMEWORK: ${frameworkId}
`);

    // Calculate all three charts in parallel for performance
    const [compliance, policy, evidence] = await Promise.all([
      calculateComplianceChart(frameworkId),
      calculatePolicyChart(frameworkId),
      calculateEvidenceChart(frameworkId),
    ]);

    const totalTime = Date.now() - startTime;

    const result: ChartData = {
      compliancePercentage: compliance.percentage,
      policyPercentage: policy.percentage,
      evidencePercentage: evidence.percentage,
      details: {
        compliance: compliance.details,
        policy: policy.details,
        evidence: evidence.details,
      },
    };

    console.log(`✅ Charts calculated in ${totalTime}ms - Compliance: ${result.compliancePercentage.toFixed(1)}%, Policy: ${result.policyPercentage.toFixed(1)}%, Evidence: ${result.evidencePercentage.toFixed(1)}%`);

    return result;
  } catch (error) {
    console.error(`❌ Error calculating framework charts:`, error);
    // Return safe defaults on error
    return {
      compliancePercentage: 0,
      policyPercentage: 0,
      evidencePercentage: 0,
      details: {
        compliance: { compliant: 0, total: 0 },
        policy: { published: 0, total: 0 },
        evidence: { published: 0, total: 0 },
      },
    };
  }
}

/**
 * CHART 1: Compliance Control Chart
 * 
 * Logic (from Mendix specification):
 * 1. Get all Requirements for Framework
 * 2. For each Requirement, get linked Controls
 * 3. Filter controls:
 *    - Scope ≠ "Not in Scope"
 *    - Status ≠ "Not Applicable"
 * 4. Count controls where Status = "Compliant"
 * 5. Calculate: (Compliant / Total) × 100
 * 6. If Total = 0, return 0%
 * 
 * OPTIMIZATION: Uses single optimized query with nested includes
 * instead of N separate queries per requirement
 */
async function calculateComplianceChart(frameworkId: string) {
  console.log(`
🔍 CHART 1: Calculating Compliance Control Chart...`);

  try {
    // Optimized: Single query with nested includes (no N+1 problem)
    const framework = await prisma.framework.findUnique({
      where: { id: frameworkId },
      select: {
        requirements: {
          select: {
            id: true,
            controls: {
              select: {
                control: {
                  select: {
                    id: true,
                    scope: true,
                    status: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!framework || !framework.requirements) {
      console.log(`  • Framework not found or has no requirements`);
      return {
        percentage: 0,
        details: { compliant: 0, total: 0 },
      };
    }

    console.log(`  • Found ${framework.requirements.length} requirements`);

    // Collect all relevant controls (filter as we iterate)
    let compliantControls = 0;
    let totalControls = 0;

    for (const req of framework.requirements) {
      for (const link of req.controls) {
        const control = link.control;

        // Apply filters: Scope ≠ "Not in Scope" AND Status ≠ "Not Applicable"
        if (
          control.scope !== "Not in Scope" &&
          control.status !== "Not Applicable"
        ) {
          totalControls++;
          if (control.status === "Compliant") {
            compliantControls++;
          }
        }
      }
    }

    console.log(`  • Total relevant controls: ${totalControls}`);
    console.log(`  • Compliant controls: ${compliantControls}`);

    // Calculate percentage
    const percentage = totalControls > 0 ? (compliantControls / totalControls) * 100 : 0;

    console.log(`  ✅ Compliance: ${percentage.toFixed(1)}% (${compliantControls}/${totalControls})`);

    return {
      percentage: Math.max(0, Math.min(100, percentage)), // Ensure 0-100 range
      details: {
        compliant: compliantControls,
        total: totalControls,
      },
    };
  } catch (error) {
    console.error(`  ❌ Error calculating compliance:`, error);
    return {
      percentage: 0,
      details: { compliant: 0, total: 0 },
    };
  }
}

/**
 * CHART 2: Policy Gauge Chart
 * 
 * Logic (from Mendix specification):
 * 1. Get all Requirements for Framework
 * 2. For each Requirement, get linked Controls
 * 3. Filter controls:
 *    - Scope ≠ "Not in Scope"
 *    - Status ≠ "Not Applicable"
 * 4. For each Control, get linked Policies
 * 5. Filter: Status = "Published"
 * 6. Count total and published policies
 * 7. Calculate: (Published / Total) × 100
 * 8. If Total = 0, return 0%
 * 
 * OPTIMIZATION: Uses single optimized query with nested includes
 * instead of N separate queries per control
 */
async function calculatePolicyChart(frameworkId: string) {
  console.log(`
🔍 CHART 2: Calculating Policy Gauge Chart...`);

  try {
    // Optimized: Single query with nested includes (no N+1 problem)
    const framework = await prisma.framework.findUnique({
      where: { id: frameworkId },
      select: {
        requirements: {
          select: {
            id: true,
            controls: {
              select: {
                control: {
                  select: {
                    id: true,
                    scope: true,
                    status: true,
                    policyControls: {
                      select: {
                        policy: {
                          select: {
                            id: true,
                            status: true,
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!framework || !framework.requirements) {
      console.log(`  • Framework not found or has no requirements`);
      return {
        percentage: 0,
        details: { published: 0, total: 0 },
      };
    }

    console.log(`  • Found ${framework.requirements.length} requirements`);

    let totalPolicies = 0;
    let publishedPolicies = 0;

    // Iterate through requirements and controls (no N+1 queries)
    for (const req of framework.requirements) {
      for (const link of req.controls) {
        const control = link.control;

        // Apply control filters
        if (
          control.scope === "Not in Scope" ||
          control.status === "Not Applicable"
        ) {
          continue;
        }

        // Count policies for this control (already loaded)
        for (const policyLink of control.policyControls) {
          const policy = policyLink.policy;
          totalPolicies++;

          // Count published policies
          if (policy.status === "Published") {
            publishedPolicies++;
          }
        }
      }
    }

    console.log(`  • Total policies: ${totalPolicies}`);
    console.log(`  • Published policies: ${publishedPolicies}`);

    // Calculate percentage
    const percentage = totalPolicies > 0 ? (publishedPolicies / totalPolicies) * 100 : 0;

    console.log(`  ✅ Policy: ${percentage.toFixed(1)}% (${publishedPolicies}/${totalPolicies})`);

    return {
      percentage: Math.max(0, Math.min(100, percentage)),
      details: {
        published: publishedPolicies,
        total: totalPolicies,
      },
    };
  } catch (error) {
    console.error(`  ❌ Error calculating policy:`, error);
    return {
      percentage: 0,
      details: { published: 0, total: 0 },
    };
  }
}

/**
 * CHART 3: Evidence Gauge Chart
 * 
 * Logic (from Mendix specification):
 * 1. Get all Requirements for Framework
 * 2. For each Requirement, get linked Controls
 * 3. Filter controls:
 *    - Scope ≠ "Not in Scope"
 *    - Status ≠ "Not Applicable"
 * 4. For each Control, get linked Evidences
 * 5. Filter: Status = "Published"
 * 6. Count total and published evidences
 * 7. Calculate: (Published / Total) × 100
 * 8. If Total = 0, return 0%
 * 
 * OPTIMIZATION: Uses single optimized query with nested includes
 * instead of N separate queries per control
 */
async function calculateEvidenceChart(frameworkId: string) {
  console.log(`
🔍 CHART 3: Calculating Evidence Gauge Chart...`);

  try {
    // Optimized: Single query with nested includes (no N+1 problem)
    const framework = await prisma.framework.findUnique({
      where: { id: frameworkId },
      select: {
        requirements: {
          select: {
            id: true,
            controls: {
              select: {
                control: {
                  select: {
                    id: true,
                    scope: true,
                    status: true,
                    evidenceControls: {
                      select: {
                        evidence: {
                          select: {
                            id: true,
                            status: true,
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!framework || !framework.requirements) {
      console.log(`  • Framework not found or has no requirements`);
      return {
        percentage: 0,
        details: { published: 0, total: 0 },
      };
    }

    console.log(`  • Found ${framework.requirements.length} requirements`);

    let totalEvidences = 0;
    let publishedEvidences = 0;

    // Iterate through requirements and controls (no N+1 queries)
    for (const req of framework.requirements) {
      for (const link of req.controls) {
        const control = link.control;

        // Apply control filters
        if (
          control.scope === "Not in Scope" ||
          control.status === "Not Applicable"
        ) {
          continue;
        }

        // Count evidences for this control (already loaded)
        for (const evidenceLink of control.evidenceControls) {
          const evidence = evidenceLink.evidence;
          totalEvidences++;

          // Count published evidences
          if (evidence.status === "Published") {
            publishedEvidences++;
          }
        }
      }
    }

    console.log(`  • Total evidences: ${totalEvidences}`);
    console.log(`  • Published evidences: ${publishedEvidences}`);

    // Calculate percentage
    const percentage = totalEvidences > 0 ? (publishedEvidences / totalEvidences) * 100 : 0;

    console.log(`  ✅ Evidence: ${percentage.toFixed(1)}% (${publishedEvidences}/${totalEvidences})`);

    return {
      percentage: Math.max(0, Math.min(100, percentage)),
      details: {
        published: publishedEvidences,
        total: totalEvidences,
      },
    };
  } catch (error) {
    console.error(`  ❌ Error calculating evidence:`, error);
    return {
      percentage: 0,
      details: { published: 0, total: 0 },
    };
  }
}

/**
 * Batch calculate charts for multiple frameworks
 * Used for dashboard loading
 */
export async function calculateMultipleFrameworkCharts(
  frameworkIds: string[]
): Promise<Map<string, ChartData>> {
  const results = new Map<string, ChartData>();

  const charts = await Promise.all(
    frameworkIds.map((id) => calculateFrameworkCharts(id))
  );

  frameworkIds.forEach((id, idx) => {
    results.set(id, charts[idx]);
  });

  return results;
}