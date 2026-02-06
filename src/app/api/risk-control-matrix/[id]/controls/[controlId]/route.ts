import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth, getTenantFilter } from "@/lib/api-auth";

interface RouteContext {
  params: Promise<{ id: string; controlId: string }>;
}

// DELETE (unlink) a control from a matrix entry
export const DELETE = withAuth(
  async (req, context: RouteContext, session) => {
    try {
      const { id, controlId } = await context.params;
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

      // Find and delete the link
      const link = await prisma.riskControlMatrixControl.findFirst({
        where: {
          riskControlMatrixEntryId: id,
          controlId,
        },
      });

      if (!link) {
        return NextResponse.json(
          { error: "Control link not found" },
          { status: 404 }
        );
      }

      await prisma.riskControlMatrixControl.delete({
        where: { id: link.id },
      });

      return NextResponse.json({ message: "Control unlinked" });
    } catch (error) {
      console.error("Error unlinking control:", error);
      return NextResponse.json(
        { error: "Failed to unlink control" },
        { status: 500 }
      );
    }
  },
  { resource: "risk.risk-matrix", action: "delete" }
);
