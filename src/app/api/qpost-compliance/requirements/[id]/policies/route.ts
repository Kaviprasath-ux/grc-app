import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth } from "@/lib/api-auth";

interface RouteContext {
  params: Promise<{ id: string }>;
}

// GET policies linked to a requirement
export const GET = withAuth(
  async (req: NextRequest, context: RouteContext) => {
    try {
      const { id } = await context.params;

      const links = await prisma.qPostRequirementPolicy.findMany({
        where: { requirementId: id },
        include: {
          policy: {
            include: {
              department: true,
              assignee: true,
              approver: true,
            },
          },
        },
      });

      const policies = links.map((link) => link.policy);
      return NextResponse.json(policies);
    } catch (error) {
      console.error("Error fetching requirement policies:", error);
      return NextResponse.json(
        { error: "Failed to fetch policies" },
        { status: 500 }
      );
    }
  },
  { resource: "qpost-compliance.controls", action: "view" }
);

// POST link policy to requirement
export const POST = withAuth(
  async (req: NextRequest, context: RouteContext) => {
    try {
      const { id } = await context.params;
      const { policyId } = await req.json();

      if (!policyId) {
        return NextResponse.json(
          { error: "policyId is required" },
          { status: 400 }
        );
      }

      const link = await prisma.qPostRequirementPolicy.create({
        data: {
          requirementId: id,
          policyId,
        },
      });

      return NextResponse.json(link, { status: 201 });
    } catch (error: unknown) {
      console.error("Error linking policy to requirement:", error);
      if ((error as { code?: string }).code === "P2002") {
        return NextResponse.json(
          { error: "Policy is already linked to this requirement" },
          { status: 409 }
        );
      }
      return NextResponse.json(
        { error: "Failed to link policy" },
        { status: 500 }
      );
    }
  },
  { resource: "qpost-compliance.controls", action: "edit" }
);

// DELETE unlink policy from requirement
export const DELETE = withAuth(
  async (req: NextRequest, context: RouteContext) => {
    try {
      const { id } = await context.params;
      const { searchParams } = new URL(req.url);
      const policyId = searchParams.get("policyId");

      if (!policyId) {
        return NextResponse.json(
          { error: "policyId query parameter is required" },
          { status: 400 }
        );
      }

      await prisma.qPostRequirementPolicy.delete({
        where: {
          requirementId_policyId: {
            requirementId: id,
            policyId,
          },
        },
      });

      return NextResponse.json({ success: true });
    } catch (error) {
      console.error("Error unlinking policy from requirement:", error);
      return NextResponse.json(
        { error: "Failed to unlink policy" },
        { status: 500 }
      );
    }
  },
  { resource: "qpost-compliance.controls", action: "edit" }
);
