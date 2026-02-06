import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth, getTenantFilter } from "@/lib/api-auth";

interface RouteContext {
  params: Promise<{ id: string }>;
}

// DELETE a single matrix entry
export const DELETE = withAuth(
  async (req, context: RouteContext, session) => {
    try {
      const { id } = await context.params;
      const tenantFilter = getTenantFilter(session);

      // Check if entry exists and belongs to tenant
      const entry = await prisma.riskControlMatrixEntry.findFirst({
        where: {
          id,
          ...tenantFilter,
        },
      });

      if (!entry) {
        return NextResponse.json(
          { error: "Matrix entry not found" },
          { status: 404 }
        );
      }

      await prisma.riskControlMatrixEntry.delete({
        where: { id },
      });

      return NextResponse.json({ message: "Matrix entry deleted" });
    } catch (error) {
      console.error("Error deleting matrix entry:", error);
      return NextResponse.json(
        { error: "Failed to delete matrix entry" },
        { status: 500 }
      );
    }
  },
  { resource: "risk.risk-matrix", action: "delete" }
);
