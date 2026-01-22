import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth, getTenantFilter, getCustomerAccountId } from "@/lib/api-auth";

// Helper function to calculate risk rating from score
function calculateRiskRatingFromScore(score: number): string {
  if (score >= 20) return "Catastrophic";
  if (score >= 15) return "Very high";
  if (score >= 10) return "High";
  return "Low Risk";
}

// POST import/sync risks to risk control matrix entries
// Creates matrix entries for risks that don't have one yet
// Also copies over linked controls from ControlRisk junction table
export const POST = withAuth(
  async (req, context, session) => {
    try {
      const customerAccountId = getCustomerAccountId(session);
      const tenantFilter = getTenantFilter(session);
      const body = await req.json();
      const { riskIds, includeControls = true } = body;

      // Get risks to import (either specific ones or all)
      const risksToImport = await prisma.risk.findMany({
        where: {
          ...tenantFilter,
          ...(riskIds && riskIds.length > 0 ? { id: { in: riskIds } } : {}),
        },
        include: {
          owner: {
            select: { fullName: true },
          },
          controlRisks: {
            include: {
              control: {
                select: { id: true },
              },
            },
          },
        },
      });

      if (risksToImport.length === 0) {
        return NextResponse.json({
          message: "No risks found to import",
          imported: 0,
          skipped: 0,
        });
      }

      // Check which risks already have matrix entries
      const existingEntries = await prisma.riskControlMatrixEntry.findMany({
        where: {
          customerAccountId,
          riskId: { in: risksToImport.map((r) => r.id) },
        },
        select: { riskId: true },
      });

      const existingRiskIds = new Set(existingEntries.map((e) => e.riskId));

      // Filter out risks that already have matrix entries
      const risksToCreate = risksToImport.filter(
        (r) => !existingRiskIds.has(r.id)
      );

      if (risksToCreate.length === 0) {
        return NextResponse.json({
          message: "All risks already have matrix entries",
          imported: 0,
          skipped: risksToImport.length,
        });
      }

      // Get the last matrix entry ID to continue the sequence
      const lastEntry = await prisma.riskControlMatrixEntry.findFirst({
        where: { customerAccountId },
        orderBy: { createdAt: "desc" },
        select: { matrixEntryId: true },
      });

      let nextNum = 1;
      if (lastEntry) {
        const match = lastEntry.matrixEntryId.match(/RCM-(\d+)/);
        if (match) {
          nextNum = parseInt(match[1], 10) + 1;
        }
      }

      // Create matrix entries for each risk
      const createdEntries = [];
      for (const risk of risksToCreate) {
        const matrixEntryId = `RCM-${String(nextNum).padStart(3, "0")}`;
        nextNum++;

        const entry = await prisma.riskControlMatrixEntry.create({
          data: {
            customerAccountId,
            matrixEntryId,
            riskId: risk.id,
            riskCode: risk.riskId,
            name: risk.name,
            description: risk.description,
            riskRating: risk.riskRating,
            residualRiskRating: risk.residualRiskScore
              ? calculateRiskRatingFromScore(risk.residualRiskScore)
              : null,
            status: risk.status,
            ownerName: risk.owner?.fullName,
            // Copy over linked controls if requested
            ...(includeControls &&
              risk.controlRisks.length > 0 && {
                linkedControls: {
                  create: risk.controlRisks.map((cr) => ({
                    controlId: cr.control.id,
                  })),
                },
              }),
          },
          include: {
            linkedControls: {
              include: {
                control: {
                  select: {
                    id: true,
                    controlCode: true,
                    name: true,
                  },
                },
              },
            },
          },
        });

        createdEntries.push(entry);
      }

      return NextResponse.json({
        message: `Successfully imported ${createdEntries.length} risks to matrix`,
        imported: createdEntries.length,
        skipped: risksToImport.length - risksToCreate.length,
        entries: createdEntries,
      });
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
