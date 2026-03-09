import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth } from "@/lib/api-auth";

interface RouteContext {
  params: Promise<{ id: string }>;
}

// GET evidences linked to a requirement
export const GET = withAuth(
  async (req: NextRequest, context: RouteContext) => {
    try {
      const { id } = await context.params;

      const links = await prisma.qPostRequirementEvidence.findMany({
        where: { requirementId: id },
        include: {
          evidence: {
            include: {
              department: true,
              assignee: true,
              framework: true,
            },
          },
        },
      });

      const evidences = links.map((link) => link.evidence);
      return NextResponse.json(evidences);
    } catch (error) {
      console.error("Error fetching requirement evidences:", error);
      return NextResponse.json(
        { error: "Failed to fetch evidences" },
        { status: 500 }
      );
    }
  },
  { resource: "qpost-compliance.controls", action: "view" }
);

// POST link evidence to requirement
export const POST = withAuth(
  async (req: NextRequest, context: RouteContext) => {
    try {
      const { id } = await context.params;
      const { evidenceId } = await req.json();

      if (!evidenceId) {
        return NextResponse.json(
          { error: "evidenceId is required" },
          { status: 400 }
        );
      }

      const link = await prisma.qPostRequirementEvidence.create({
        data: {
          requirementId: id,
          evidenceId,
        },
      });

      return NextResponse.json(link, { status: 201 });
    } catch (error: unknown) {
      console.error("Error linking evidence to requirement:", error);
      if ((error as { code?: string }).code === "P2002") {
        return NextResponse.json(
          { error: "Evidence is already linked to this requirement" },
          { status: 409 }
        );
      }
      return NextResponse.json(
        { error: "Failed to link evidence" },
        { status: 500 }
      );
    }
  },
  { resource: "qpost-compliance.controls", action: "edit" }
);

// DELETE unlink evidence from requirement
export const DELETE = withAuth(
  async (req: NextRequest, context: RouteContext) => {
    try {
      const { id } = await context.params;
      const { searchParams } = new URL(req.url);
      const evidenceId = searchParams.get("evidenceId");

      if (!evidenceId) {
        return NextResponse.json(
          { error: "evidenceId query parameter is required" },
          { status: 400 }
        );
      }

      await prisma.qPostRequirementEvidence.delete({
        where: {
          requirementId_evidenceId: {
            requirementId: id,
            evidenceId,
          },
        },
      });

      return NextResponse.json({ success: true });
    } catch (error) {
      console.error("Error unlinking evidence from requirement:", error);
      return NextResponse.json(
        { error: "Failed to unlink evidence" },
        { status: 500 }
      );
    }
  },
  { resource: "qpost-compliance.controls", action: "edit" }
);
