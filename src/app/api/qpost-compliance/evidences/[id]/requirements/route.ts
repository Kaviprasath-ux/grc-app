import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth } from "@/lib/api-auth";

interface RouteContext {
  params: Promise<{ id: string }>;
}

// GET requirements linked to an evidence
export const GET = withAuth(
  async (req: NextRequest, context: RouteContext) => {
    try {
      const { id } = await context.params;

      const links = await prisma.qPostRequirementEvidence.findMany({
        where: { evidenceId: id },
        include: {
          requirement: {
            include: {
              framework: true,
            },
          },
        },
      });

      const requirements = links.map((link) => link.requirement);
      return NextResponse.json(requirements);
    } catch (error) {
      console.error("Error fetching evidence requirements:", error);
      return NextResponse.json(
        { error: "Failed to fetch requirements" },
        { status: 500 }
      );
    }
  },
  { resource: "qpost-compliance.evidence", action: "view" }
);

// POST link requirement to evidence
export const POST = withAuth(
  async (req: NextRequest, context: RouteContext) => {
    try {
      const { id } = await context.params;
      const { requirementId } = await req.json();

      if (!requirementId) {
        return NextResponse.json(
          { error: "requirementId is required" },
          { status: 400 }
        );
      }

      const link = await prisma.qPostRequirementEvidence.create({
        data: {
          evidenceId: id,
          requirementId,
        },
      });

      return NextResponse.json(link, { status: 201 });
    } catch (error: unknown) {
      console.error("Error linking requirement to evidence:", error);
      if ((error as { code?: string }).code === "P2002") {
        return NextResponse.json(
          { error: "Requirement is already linked to this evidence" },
          { status: 409 }
        );
      }
      return NextResponse.json(
        { error: "Failed to link requirement" },
        { status: 500 }
      );
    }
  },
  { resource: "qpost-compliance.evidence", action: "edit" }
);

// DELETE unlink requirement from evidence
export const DELETE = withAuth(
  async (req: NextRequest, context: RouteContext) => {
    try {
      const { id } = await context.params;
      const { searchParams } = new URL(req.url);
      const requirementId = searchParams.get("requirementId");

      if (!requirementId) {
        return NextResponse.json(
          { error: "requirementId query parameter is required" },
          { status: 400 }
        );
      }

      await prisma.qPostRequirementEvidence.delete({
        where: {
          requirementId_evidenceId: {
            evidenceId: id,
            requirementId,
          },
        },
      });

      return NextResponse.json({ success: true });
    } catch (error) {
      console.error("Error unlinking requirement from evidence:", error);
      return NextResponse.json(
        { error: "Failed to unlink requirement" },
        { status: 500 }
      );
    }
  },
  { resource: "qpost-compliance.evidence", action: "edit" }
);
