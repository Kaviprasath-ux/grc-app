import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api-auth";

interface RouteContext {
  params: Promise<{ id: string }>;
}

// GET - Calculate asset/process score for a risk based on its type and linked entities
export const GET = withAuth(
  async (_req, context: RouteContext) => {
    try {
      const { id } = await context.params;

      const risk = await prisma.risk.findUnique({
        where: { id },
        select: {
          type: { select: { name: true } },
          impactedAssetGroupId: true,
          impactedAssetGroup: {
            select: {
              id: true,
              name: true,
              assetCIAClassifications: {
                select: {
                  assetCriticality: true,
                  assetCriticalityScore: true,
                },
              },
            },
          },
          impactedProcessId: true,
          impactedProcess: {
            select: {
              id: true,
              name: true,
              biaAssessment: {
                select: {
                  impactRating: true,
                  processCriticality: true,
                },
              },
            },
          },
        },
      });

      if (!risk) {
        return NextResponse.json({ error: "Risk not found" }, { status: 404 });
      }

      const riskTypeName = risk.type?.name || "";
      console.log("[asset-score] Risk ID:", id, "Type:", riskTypeName);
      console.log("[asset-score] Asset Group:", risk.impactedAssetGroup?.name, "Process:", risk.impactedProcess?.name);

      // --- Asset Risk: Calculate from AssetCIAClassification with highest criticality score ---
      if (riskTypeName === "Asset Risk") {
        if (!risk.impactedAssetGroupId || !risk.impactedAssetGroup) {
          console.log("[asset-score] No asset group linked to this risk");
          return NextResponse.json({
            assetScore: 0,
            assetScoreLabel: "",
          });
        }

        const ciaClassifications = risk.impactedAssetGroup.assetCIAClassifications || [];
        console.log("[asset-score] CIA Classifications found:", ciaClassifications.length, ciaClassifications);

        // Find the classification with the highest assetCriticalityScore
        let highestClassification: { assetCriticality: string; assetCriticalityScore: number } | null = null;

        for (const classification of ciaClassifications) {
          if (!highestClassification) {
            highestClassification = classification;
          } else if (classification.assetCriticalityScore > highestClassification.assetCriticalityScore) {
            highestClassification = classification;
          }
        }

        console.log("[asset-score] Highest classification:", highestClassification);
        return NextResponse.json({
          assetScore: highestClassification?.assetCriticalityScore || 1,
          assetScoreLabel: highestClassification?.assetCriticality || "",
        });
      }

      // --- Process Risk: Calculate from ProcessBIA with highest impactRating ---
      if (riskTypeName === "Process Risk") {
        if (!risk.impactedProcessId || !risk.impactedProcess) {
          console.log("[asset-score] No process linked to this risk");
          return NextResponse.json({
            assetScore: 0,
            assetScoreLabel: "",
          });
        }

        const biaAssessment = risk.impactedProcess.biaAssessment;
        console.log("[asset-score] BIA Assessment:", biaAssessment);

        return NextResponse.json({
          assetScore: biaAssessment?.impactRating || 1,
          assetScoreLabel: biaAssessment?.processCriticality || "",
        });
      }

      // Unknown risk type - return defaults
      console.log("[asset-score] Unknown or no risk type, returning defaults");
      return NextResponse.json({
        assetScore: 0,
        assetScoreLabel: "",
      });
    } catch (error) {
      console.error("Error calculating asset score:", error);
      return NextResponse.json({ error: "Failed to calculate asset score" }, { status: 500 });
    }
  },
  { resource: "risk.assessment", action: "view" }
);
