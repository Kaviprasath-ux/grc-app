import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth, getCustomerAccountId } from "@/lib/api-auth";

// Helper function to generate matrix entry ID (format: RCM-001, RCM-002, etc.)
async function generateMatrixEntryId(customerAccountId: string): Promise<string> {
  const lastEntry = await prisma.riskControlMatrixEntry.findFirst({
    where: { customerAccountId },
    orderBy: { createdAt: "desc" },
    select: { matrixEntryId: true },
  });

  if (!lastEntry) {
    return "RCM-001";
  }

  const match = lastEntry.matrixEntryId.match(/RCM-(\d+)/);
  if (match) {
    const nextNum = parseInt(match[1], 10) + 1;
    return `RCM-${String(nextNum).padStart(3, "0")}`;
  }

  const count = await prisma.riskControlMatrixEntry.count({ where: { customerAccountId } });
  return `RCM-${String(count + 1).padStart(3, "0")}`;
}

// POST - Import risks from Risk Register into Risk Control Matrix
export const POST = withAuth(
  async (req, context, session) => {
    try {
      const customerAccountId = getCustomerAccountId(session);
      const body = await req.json();
      const includeControls = body?.includeControls ?? true;

      // Get all risks for this customer
      const risks = await prisma.risk.findMany({
        where: { customerAccountId },
        include: {
          owner: {
            select: { fullName: true },
          },
          ...(includeControls
            ? {
                controlRisks: {
                  include: {
                    control: {
                      select: { id: true },
                    },
                  },
                },
              }
            : {}),
        },
      });

      // Get existing matrix entries to check which risks already have one
      const existingEntries = await prisma.riskControlMatrixEntry.findMany({
        where: { customerAccountId },
        select: { riskId: true },
      });

      const existingRiskIds = new Set(existingEntries.map((e) => e.riskId).filter(Boolean));

      let imported = 0;
      let skipped = 0;

      for (const risk of risks) {
        if (existingRiskIds.has(risk.id)) {
          skipped++;
          continue;
        }

        const matrixEntryId = await generateMatrixEntryId(customerAccountId);

        // Calculate residual risk rating from scores
        let residualRiskRating: string | null = null;
        if (risk.residualRiskScore) {
          if (risk.residualRiskScore >= 20) residualRiskRating = "Catastrophic";
          else if (risk.residualRiskScore >= 15) residualRiskRating = "Very high";
          else if (risk.residualRiskScore >= 10) residualRiskRating = "High";
          else if (risk.residualRiskScore >= 5) residualRiskRating = "Medium";
          else residualRiskRating = "Low";
        }

        const controlRisks = includeControls && "controlRisks" in risk ? (risk as unknown as { controlRisks: { control: { id: string } }[] }).controlRisks : [];

        await prisma.riskControlMatrixEntry.create({
          data: {
            customerAccountId,
            riskId: risk.id,
            matrixEntryId,
            riskCode: risk.riskId,
            name: risk.name,
            description: risk.description,
            riskRating: risk.riskRating,
            residualRiskRating,
            status: risk.status,
            ownerName: risk.owner?.fullName || null,
            linkedControls: {
              create: controlRisks.map((cr) => ({
                controlId: cr.control.id,
              })),
            },
          },
        });

        imported++;
      }

      return NextResponse.json({ imported, skipped });
    } catch (error) {
      console.error("Error importing risks to matrix:", error);
      return NextResponse.json(
        { error: "Failed to import risks to matrix" },
        { status: 500 }
      );
    }
  },
  { resource: "risk.risk-matrix", action: "create" }
);
