import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth, getTenantFilter, getCustomerAccountId } from "@/lib/api-auth";

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

// Auto-sync risks to matrix entries - creates entries for risks that don't have one
async function syncRisksToMatrix(customerAccountId: string): Promise<void> {
  // Get all risks with their relations
  const risks = await prisma.risk.findMany({
    where: { customerAccountId },
    include: {
      owner: { select: { fullName: true } },
      controlRisks: {
        include: { control: { select: { id: true } } },
      },
    },
  });

  // Get existing matrix entries
  const existingEntries = await prisma.riskControlMatrixEntry.findMany({
    where: { customerAccountId },
    select: { id: true, riskId: true },
  });

  const existingByRiskId = new Map(
    existingEntries.filter(e => e.riskId).map(e => [e.riskId!, e.id])
  );

  function calcResidualRating(score: number | null): string | null {
    if (!score) return null;
    if (score >= 20) return "Catastrophic";
    if (score >= 15) return "Very high";
    if (score >= 10) return "High";
    if (score >= 5) return "Medium";
    return "Low";
  }

  for (const risk of risks) {
    const residualRiskRating = calcResidualRating(risk.residualRiskScore);
    const controlIds = risk.controlRisks.map(cr => cr.control.id);

    if (existingByRiskId.has(risk.id)) {
      // Update existing entry — refresh all fields and re-sync linked controls
      const entryId = existingByRiskId.get(risk.id)!;

      await prisma.riskControlMatrixEntry.update({
        where: { id: entryId },
        data: {
          riskCode: risk.riskId,
          name: risk.name,
          description: risk.description,
          riskRating: risk.riskRating,
          residualRiskRating,
          status: risk.status,
          ownerName: risk.owner?.fullName || null,
        },
      });

      // Re-sync linked controls: delete old and create current
      await prisma.riskControlMatrixControl.deleteMany({ where: { riskControlMatrixEntryId: entryId } });
      if (controlIds.length > 0) {
        await prisma.riskControlMatrixControl.createMany({
          data: controlIds.map(controlId => ({ riskControlMatrixEntryId: entryId, controlId })),
        });
      }
    } else {
      // Create new entry
      const matrixEntryId = await generateMatrixEntryId(customerAccountId);

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
            create: controlIds.map(controlId => ({ controlId })),
          },
        },
      });
    }
  }
}

// GET all matrix entries with auto-sync from Risk Register
export const GET = withAuth(
  async (req, context, session) => {
    try {
      const { searchParams } = new URL(req.url);
      const page = parseInt(searchParams.get("page") || "1");
      const limit = parseInt(searchParams.get("limit") || "10");
      const skip = (page - 1) * limit;

      const customerAccountId = getCustomerAccountId(session);

      // Auto-sync risks to matrix on each load
      await syncRisksToMatrix(customerAccountId);

      const tenantFilter = getTenantFilter(session);

      const [entries, total] = await Promise.all([
        prisma.riskControlMatrixEntry.findMany({
          where: tenantFilter,
          include: {
            risk: {
              select: {
                id: true,
                riskId: true,
                name: true,
                status: true,
                impactedAsset: {
                  select: {
                    id: true,
                    assetId: true,
                    name: true,
                    description: true,
                    classification: {
                      select: { name: true },
                    },
                  },
                },
                impactedProcess: {
                  select: {
                    id: true,
                    processCode: true,
                    name: true,
                    description: true,
                    status: true,
                  },
                },
              },
            },
            linkedControls: {
              include: {
                control: {
                  select: {
                    id: true,
                    controlCode: true,
                    name: true,
                    status: true,
                  },
                },
              },
            },
          },
          orderBy: { createdAt: "desc" },
          take: limit,
          skip,
        }),
        prisma.riskControlMatrixEntry.count({ where: tenantFilter }),
      ]);

      return NextResponse.json({
        data: entries,
        pagination: {
          total,
          limit,
          page,
          totalPages: Math.ceil(total / limit),
        },
      });
    } catch (error) {
      console.error("Error fetching matrix entries:", error);
      return NextResponse.json(
        { error: "Failed to fetch matrix entries" },
        { status: 500 }
      );
    }
  },
  { resource: "risk.risk-matrix", action: "view" }
);

// DELETE all matrix entries
export const DELETE = withAuth(
  async (req, context, session) => {
    try {
      const tenantFilter = getTenantFilter(session);

      await prisma.riskControlMatrixEntry.deleteMany({
        where: tenantFilter,
      });

      return NextResponse.json({ message: "All matrix entries deleted" });
    } catch (error) {
      console.error("Error deleting matrix entries:", error);
      return NextResponse.json(
        { error: "Failed to delete matrix entries" },
        { status: 500 }
      );
    }
  },
  { resource: "risk.risk-matrix", action: "delete" }
);
