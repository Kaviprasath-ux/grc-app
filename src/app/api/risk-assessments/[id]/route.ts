import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const assessmentIncludes = {
  risk: {
    include: {
      category: true,
      department: true,
      owner: true,
      riskThreats: {
        include: {
          threat: true,
          threatImpacts: true,
        },
      },
      riskVulnerabilities: {
        include: {
          vulnerability: true,
        },
      },
      riskAssetGroups: {
        include: {
          assetGroup: {
            include: {
              assets: true,
            },
          },
        },
      },
      riskControls: {
        include: {
          control: true,
        },
      },
    },
  },
};

// Helper function to calculate risk rating from score
async function getRiskRating(score: number): Promise<string> {
  const ranges = await prisma.riskRange.findMany({
    orderBy: { lowRange: "asc" },
  });

  for (const range of ranges) {
    if (score >= range.lowRange && score <= range.highRange) {
      return range.title;
    }
  }

  return "Low Risk"; // Default
}

// Helper to calculate inherent risk score
function calculateInherentRisk(
  likelihood: number | null,
  impact: number | null,
  vulnerability: number | null,
  methodology: { includeLikelihood: boolean; includeImpact: boolean; includeVulnerability: boolean }
): number {
  let score = 1;

  if (methodology.includeLikelihood && likelihood) {
    score *= likelihood;
  }
  if (methodology.includeImpact && impact) {
    score *= impact;
  }
  if (methodology.includeVulnerability && vulnerability) {
    score *= vulnerability;
  }

  return score;
}

// GET single risk assessment
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const assessment = await prisma.riskAssessment.findUnique({
      where: { id },
      include: assessmentIncludes,
    });

    if (!assessment) {
      return NextResponse.json(
        { error: "Risk assessment not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(assessment);
  } catch (error) {
    console.error("Error fetching risk assessment:", error);
    return NextResponse.json(
      { error: "Failed to fetch risk assessment" },
      { status: 500 }
    );
  }
}

// PUT update risk assessment (step by step)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const {
      currentStep,
      // Step 2: Likelihood
      threatLikelihoods, // Array of { threatId, likelihoodScore }
      // Step 3: Impact
      threatImpacts, // Array of { threatId, impactCategory, impactRating, impactScore }
      // Step 4: Vulnerability
      vulnerabilityRatings, // Array of { vulnerabilityId, rating, score }
      // Step 5/6: Final scores (can be calculated or provided)
      likelihoodScore,
      impactScore,
      vulnerabilityScore,
      inherentRiskRating,
      controlRating,
      residualRiskRating,
      riskRating,
      // Status
      status,
      isCompleted,
    } = body;

    const existing = await prisma.riskAssessment.findUnique({
      where: { id },
      include: {
        risk: true,
      },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Risk assessment not found" },
        { status: 404 }
      );
    }

    // Get methodology for calculations
    const methodology = await prisma.riskMethodology.findFirst();

    // Use transaction for complex updates
    const assessment = await prisma.$transaction(async (tx) => {
      // Update threat likelihoods (Step 2)
      if (threatLikelihoods?.length) {
        for (const tl of threatLikelihoods) {
          await tx.riskThreat.updateMany({
            where: {
              riskId: existing.riskId,
              threatId: tl.threatId,
            },
            data: {
              likelihoodScore: tl.likelihoodScore,
            },
          });
        }
      }

      // Update threat impacts (Step 3)
      if (threatImpacts?.length) {
        for (const ti of threatImpacts) {
          const riskThreat = await tx.riskThreat.findFirst({
            where: {
              riskId: existing.riskId,
              threatId: ti.threatId,
            },
          });

          if (riskThreat) {
            await tx.threatImpact.upsert({
              where: {
                riskThreatId_impactCategory: {
                  riskThreatId: riskThreat.id,
                  impactCategory: ti.impactCategory,
                },
              },
              create: {
                riskThreatId: riskThreat.id,
                impactCategory: ti.impactCategory,
                impactRating: ti.impactRating,
                impactScore: ti.impactScore,
              },
              update: {
                impactRating: ti.impactRating,
                impactScore: ti.impactScore,
              },
            });
          }
        }
      }

      // Update vulnerability ratings (Step 4)
      if (vulnerabilityRatings?.length) {
        for (const vr of vulnerabilityRatings) {
          await tx.riskVulnerability.updateMany({
            where: {
              riskId: existing.riskId,
              vulnerabilityId: vr.vulnerabilityId,
            },
            data: {
              rating: vr.rating,
              score: vr.score,
            },
          });
        }
      }

      // Calculate scores if needed
      let finalLikelihood = likelihoodScore;
      let finalImpact = impactScore;
      let finalVulnerability = vulnerabilityScore;
      let finalInherentRisk = inherentRiskRating;
      let finalRiskRating = riskRating;

      // Auto-calculate if completing assessment
      if (isCompleted && !finalInherentRisk) {
        // Get all threat likelihoods and calculate average/max
        const riskThreats = await tx.riskThreat.findMany({
          where: { riskId: existing.riskId },
          include: { threatImpacts: true },
        });

        if (riskThreats.length > 0) {
          // Max likelihood
          const likelihoods = riskThreats.map(rt => rt.likelihoodScore || 0);
          finalLikelihood = Math.max(...likelihoods);

          // Max impact across all threats and categories
          const impacts: number[] = [];
          riskThreats.forEach(rt => {
            rt.threatImpacts.forEach(ti => {
              if (ti.impactScore) impacts.push(ti.impactScore);
            });
          });
          finalImpact = impacts.length > 0 ? Math.max(...impacts) : 0;
        }

        // Get vulnerability scores
        const riskVulns = await tx.riskVulnerability.findMany({
          where: { riskId: existing.riskId },
        });
        if (riskVulns.length > 0) {
          const vulnScores = riskVulns.map(rv => rv.score || 0);
          finalVulnerability = Math.max(...vulnScores);
        }

        // Calculate inherent risk
        if (methodology) {
          finalInherentRisk = calculateInherentRisk(
            finalLikelihood,
            finalImpact,
            finalVulnerability,
            methodology
          );
        } else {
          finalInherentRisk = (finalLikelihood || 1) * (finalImpact || 1) * (finalVulnerability || 1);
        }

        // Get risk rating
        finalRiskRating = await getRiskRating(finalInherentRisk);
      }

      // Calculate residual risk if control rating provided
      let finalResidualRisk = residualRiskRating;
      if (controlRating !== undefined && finalInherentRisk) {
        const controlEffectiveness = controlRating / 100;
        finalResidualRisk = finalInherentRisk * (1 - controlEffectiveness);
      }

      // Update assessment
      const updatedAssessment = await tx.riskAssessment.update({
        where: { id },
        data: {
          currentStep: currentStep || existing.currentStep,
          likelihoodScore: finalLikelihood !== undefined ? finalLikelihood : existing.likelihoodScore,
          impactScore: finalImpact !== undefined ? finalImpact : existing.impactScore,
          vulnerabilityScore: finalVulnerability !== undefined ? finalVulnerability : existing.vulnerabilityScore,
          inherentRiskRating: finalInherentRisk !== undefined ? finalInherentRisk : existing.inherentRiskRating,
          controlRating: controlRating !== undefined ? controlRating : existing.controlRating,
          residualRiskRating: finalResidualRisk !== undefined ? finalResidualRisk : existing.residualRiskRating,
          riskRating: finalRiskRating || existing.riskRating,
          status: status || existing.status,
          isCompleted: isCompleted !== undefined ? isCompleted : existing.isCompleted,
        },
      });

      // Update risk with assessment scores if completed
      if (isCompleted) {
        await tx.risk.update({
          where: { id: existing.riskId },
          data: {
            likelihoodScore: finalLikelihood,
            impactScore: finalImpact,
            vulnerabilityScore: finalVulnerability,
            inherentRiskRating: finalInherentRisk,
            controlRating: controlRating,
            residualRiskRating: finalResidualRisk,
            riskRating: finalRiskRating,
            status: "Completed",
            assessmentStatus: "Assessed",
            assessmentDate: new Date(),
          },
        });
      }

      return updatedAssessment;
    });

    // Fetch full assessment with relations
    const fullAssessment = await prisma.riskAssessment.findUnique({
      where: { id },
      include: assessmentIncludes,
    });

    return NextResponse.json(fullAssessment);
  } catch (error) {
    console.error("Error updating risk assessment:", error);
    return NextResponse.json(
      { error: "Failed to update risk assessment" },
      { status: 500 }
    );
  }
}

// DELETE risk assessment
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const existing = await prisma.riskAssessment.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Risk assessment not found" },
        { status: 404 }
      );
    }

    await prisma.riskAssessment.delete({
      where: { id },
    });

    return NextResponse.json({ message: "Risk assessment deleted successfully" });
  } catch (error) {
    console.error("Error deleting risk assessment:", error);
    return NextResponse.json(
      { error: "Failed to delete risk assessment" },
      { status: 500 }
    );
  }
}
