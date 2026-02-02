import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth, validateTenantAccess, forbidden } from "@/lib/api-auth";

interface RouteContext {
  params: Promise<{ id: string }>;
}

// DELETE /api/artifacts/[id] - Delete an artifact
export const DELETE = withAuth(
  async (req: NextRequest, context: RouteContext, session) => {
    try {
      const { id } = await context.params;

      // Verify artifact exists and user has access
      const artifact = await prisma.artifact.findUnique({
        where: { id },
        select: { customerAccountId: true },
      });

      if (!artifact) {
        return NextResponse.json(
          { error: "Artifact not found" },
          { status: 404 }
        );
      }

      if (!validateTenantAccess(session, artifact.customerAccountId)) {
        return forbidden("Access denied to this artifact");
      }

      // Delete the artifact (cascade will delete linked evidences)
      await prisma.artifact.delete({
        where: { id },
      });

      return NextResponse.json({ message: "Artifact deleted successfully" });
    } catch (error) {
      console.error("Error deleting artifact:", error);
      return NextResponse.json(
        { error: "Failed to delete artifact" },
        { status: 500 }
      );
    }
  },
  { resource: "compliance.evidence", action: "delete" }
);
