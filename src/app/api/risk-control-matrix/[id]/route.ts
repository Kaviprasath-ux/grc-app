import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth, getTenantFilter } from "@/lib/api-auth";

interface RouteContext {
  params: Promise<{ id: string }>;
}

// GET a single risk control matrix entry
export const GET = withAuth(
  async (req, context: RouteContext, session) => {
    try {
      const { id } = await context.params;
      const tenantFilter = getTenantFilter(session);

      const entry = await prisma.riskControlMatrixEntry.findFirst({
        where: {
          id,
          ...tenantFilter,
        },
        include: {
          risk: {
            select: {
              id: true,
              riskId: true,
              name: true,
              status: true,
              riskRating: true,
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

      if (!entry) {
        return NextResponse.json(
          { error: "Risk control matrix entry not found" },
          { status: 404 }
        );
      }

      return NextResponse.json(entry);
    } catch (error) {
      console.error("Error fetching risk control matrix entry:", error);
      return NextResponse.json(
        { error: "Failed to fetch risk control matrix entry" },
        { status: 500 }
      );
    }
  },
  { resource: "risk.risk-matrix", action: "view" }
);

// PATCH update a risk control matrix entry
export const PATCH = withAuth(
  async (req, context: RouteContext, session) => {
    try {
      const { id } = await context.params;
      const tenantFilter = getTenantFilter(session);
      const body = await req.json();

      const {
        name,
        description,
        riskRating,
        residualRiskRating,
        status,
        ownerName,
      } = body;

      // Verify entry exists and belongs to this tenant
      const existingEntry = await prisma.riskControlMatrixEntry.findFirst({
        where: {
          id,
          ...tenantFilter,
        },
      });

      if (!existingEntry) {
        return NextResponse.json(
          { error: "Risk control matrix entry not found" },
          { status: 404 }
        );
      }

      const entry = await prisma.riskControlMatrixEntry.update({
        where: { id },
        data: {
          ...(name !== undefined && { name }),
          ...(description !== undefined && { description }),
          ...(riskRating !== undefined && { riskRating }),
          ...(residualRiskRating !== undefined && { residualRiskRating }),
          ...(status !== undefined && { status }),
          ...(ownerName !== undefined && { ownerName }),
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

      return NextResponse.json(entry);
    } catch (error) {
      console.error("Error updating risk control matrix entry:", error);
      return NextResponse.json(
        { error: "Failed to update risk control matrix entry" },
        { status: 500 }
      );
    }
  },
  { resource: "risk.risk-matrix", action: "edit" }
);

// DELETE a single risk control matrix entry
// This does NOT delete the underlying Risk
export const DELETE = withAuth(
  async (req, context: RouteContext, session) => {
    try {
      const { id } = await context.params;
      const tenantFilter = getTenantFilter(session);

      // Verify entry exists and belongs to this tenant
      const existingEntry = await prisma.riskControlMatrixEntry.findFirst({
        where: {
          id,
          ...tenantFilter,
        },
      });

      if (!existingEntry) {
        return NextResponse.json(
          { error: "Risk control matrix entry not found" },
          { status: 404 }
        );
      }

      // Delete the matrix entry (cascade will delete linked controls junction records)
      await prisma.riskControlMatrixEntry.delete({
        where: { id },
      });

      return NextResponse.json({
        message: "Risk control matrix entry deleted successfully",
      });
    } catch (error) {
      console.error("Error deleting risk control matrix entry:", error);
      return NextResponse.json(
        { error: "Failed to delete risk control matrix entry" },
        { status: 500 }
      );
    }
  },
  { resource: "risk.risk-matrix", action: "delete" }
);
