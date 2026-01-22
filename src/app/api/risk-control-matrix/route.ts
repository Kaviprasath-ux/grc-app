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

// GET all risk control matrix entries - filtered by customer account
export const GET = withAuth(
  async (req, context, session) => {
    try {
      const { searchParams } = new URL(req.url);
      const search = searchParams.get("search") || "";
      const status = searchParams.get("status");
      const riskRating = searchParams.get("riskRating");
      const limit = parseInt(searchParams.get("limit") || "50");
      const offset = parseInt(searchParams.get("offset") || "0");

      // Get tenant filter for multi-tenant isolation
      const tenantFilter = getTenantFilter(session);

      const where: Record<string, unknown> = {
        ...tenantFilter,
      };

      if (search) {
        where.OR = [
          { name: { contains: search } },
          { riskCode: { contains: search } },
          { matrixEntryId: { contains: search } },
          { description: { contains: search } },
        ];
      }

      if (status) where.status = status;
      if (riskRating) where.riskRating = riskRating;

      const [entries, total] = await Promise.all([
        prisma.riskControlMatrixEntry.findMany({
          where,
          include: {
            risk: {
              select: {
                id: true,
                riskId: true,
                name: true,
                status: true,
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
          skip: offset,
        }),
        prisma.riskControlMatrixEntry.count({ where }),
      ]);

      return NextResponse.json({
        data: entries,
        pagination: {
          total,
          limit,
          offset,
          currentPage: Math.floor(offset / limit) + 1,
          totalPages: Math.ceil(total / limit),
          hasMore: offset + entries.length < total,
        },
      });
    } catch (error) {
      console.error("Error fetching risk control matrix entries:", error);
      return NextResponse.json(
        { error: "Failed to fetch risk control matrix entries" },
        { status: 500 }
      );
    }
  },
  { resource: "risk.risk-matrix", action: "view" }
);

// POST create a new risk control matrix entry
// Can create from existing risk or as a new standalone entry
export const POST = withAuth(
  async (req, context, session) => {
    try {
      const body = await req.json();
      const {
        riskId,           // Optional: Create from existing risk
        name,             // Required if not from risk
        description,
        riskCode,         // Required if not from risk
        riskRating,
        residualRiskRating,
        status = "Open",
        ownerName,
        controlIds = [],  // Array of control IDs to link
      } = body;

      const customerAccountId = getCustomerAccountId(session);
      const matrixEntryId = await generateMatrixEntryId(customerAccountId);

      // If creating from existing risk, fetch risk data
      let entryData: {
        customerAccountId: string;
        matrixEntryId: string;
        riskId?: string;
        riskCode: string;
        name: string;
        description?: string;
        riskRating?: string;
        residualRiskRating?: string;
        status: string;
        ownerName?: string;
      };

      if (riskId) {
        // Creating from existing risk - fetch risk details
        const risk = await prisma.risk.findFirst({
          where: {
            id: riskId,
            customerAccountId,
          },
          include: {
            owner: {
              select: { fullName: true },
            },
          },
        });

        if (!risk) {
          return NextResponse.json(
            { error: "Risk not found" },
            { status: 404 }
          );
        }

        entryData = {
          customerAccountId,
          matrixEntryId,
          riskId: risk.id,
          riskCode: risk.riskId,
          name: risk.name,
          description: risk.description || undefined,
          riskRating: risk.riskRating,
          residualRiskRating: risk.residualRiskScore
            ? calculateRiskRatingFromScore(risk.residualRiskScore)
            : undefined,
          status: risk.status,
          ownerName: risk.owner?.fullName || undefined,
        };
      } else {
        // Creating standalone entry
        if (!name || !riskCode) {
          return NextResponse.json(
            { error: "Name and riskCode are required for standalone entries" },
            { status: 400 }
          );
        }

        entryData = {
          customerAccountId,
          matrixEntryId,
          riskCode,
          name,
          description,
          riskRating,
          residualRiskRating,
          status,
          ownerName,
        };
      }

      // Create entry with linked controls
      const entry = await prisma.riskControlMatrixEntry.create({
        data: {
          ...entryData,
          linkedControls: {
            create: controlIds.map((controlId: string) => ({
              controlId,
            })),
          },
        },
        include: {
          risk: {
            select: {
              id: true,
              riskId: true,
              name: true,
              status: true,
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
      });

      return NextResponse.json(entry, { status: 201 });
    } catch (error) {
      console.error("Error creating risk control matrix entry:", error);
      return NextResponse.json(
        { error: "Failed to create risk control matrix entry" },
        { status: 500 }
      );
    }
  },
  { resource: "risk.risk-matrix", action: "create" }
);

// DELETE all risk control matrix entries (CustomerAdmin only)
export const DELETE = withAuth(
  async (req, context, session) => {
    try {
      const customerAccountId = getCustomerAccountId(session);

      // Delete all matrix entries for this customer account
      // This does NOT delete the underlying Risk records
      const deleted = await prisma.riskControlMatrixEntry.deleteMany({
        where: { customerAccountId },
      });

      return NextResponse.json({
        message: `Deleted ${deleted.count} risk control matrix entries`,
        count: deleted.count,
      });
    } catch (error) {
      console.error("Error deleting risk control matrix entries:", error);
      return NextResponse.json(
        { error: "Failed to delete risk control matrix entries" },
        { status: 500 }
      );
    }
  },
  { resource: "risk.risk-matrix", action: "delete" }
);

// Helper function to calculate risk rating from score
function calculateRiskRatingFromScore(score: number): string {
  if (score >= 20) return "Catastrophic";
  if (score >= 15) return "Very high";
  if (score >= 10) return "High";
  return "Low Risk";
}
