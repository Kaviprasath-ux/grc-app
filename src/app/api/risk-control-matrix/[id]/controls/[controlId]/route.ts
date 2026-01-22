import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth, getTenantFilter } from "@/lib/api-auth";

interface RouteContext {
  params: Promise<{ id: string; controlId: string }>;
}

// DELETE unlink a control from a matrix entry
// This only removes the association, it does NOT delete the control
export const DELETE = withAuth(
  async (req, context: RouteContext, session) => {
    try {
      const { id, controlId } = await context.params;
      const tenantFilter = getTenantFilter(session);

      // Verify entry exists and belongs to this tenant
      const entry = await prisma.riskControlMatrixEntry.findFirst({
        where: {
          id,
          ...tenantFilter,
        },
      });

      if (!entry) {
        return NextResponse.json(
          { error: "Risk control matrix entry not found" },
          { status: 404 }
        );
      }

      // Delete the link (this only removes the association, not the control)
      const deleted = await prisma.riskControlMatrixControl.deleteMany({
        where: {
          riskControlMatrixEntryId: id,
          controlId,
        },
      });

      if (deleted.count === 0) {
        return NextResponse.json(
          { error: "Control link not found" },
          { status: 404 }
        );
      }

      return NextResponse.json({
        message: "Control unlinked successfully",
      });
    } catch (error) {
      console.error("Error unlinking control:", error);
      return NextResponse.json(
        { error: "Failed to unlink control" },
        { status: 500 }
      );
    }
  },
  { resource: "risk.risk-matrix", action: "edit" }
);
