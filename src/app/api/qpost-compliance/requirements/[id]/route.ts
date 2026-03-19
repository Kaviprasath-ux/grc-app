import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth, getCustomerAccountId } from "@/lib/api-auth";
import { translateRecord } from "@/lib/translation-service";

interface RouteContext {
  params: Promise<{ id: string }>;
}

// GET single QPost requirement by ID
export const GET = withAuth(
  async (req: NextRequest, context: RouteContext) => {
    try {
      const { id } = await context.params;

      const requirement = await prisma.qPostRequirement.findUnique({
        where: { id },
        include: {
          framework: true,
          category: true,
          parent: true,
          children: {
            orderBy: { sortOrder: "asc" },
          },
          evidences: {
            include: {
              evidence: {
                include: {
                  department: true,
                  assignee: true,
                },
              },
            },
          },
          policies: {
            include: {
              policy: {
                include: {
                  department: true,
                  assignee: true,
                },
              },
            },
          },
          exceptions: true,
          complianceExceptions: true,
        },
      });

      if (!requirement) {
        return NextResponse.json(
          { error: "Requirement not found" },
          { status: 404 }
        );
      }

      return NextResponse.json(requirement);
    } catch (error) {
      console.error("Error fetching QPost requirement:", error);
      return NextResponse.json(
        { error: "Failed to fetch requirement" },
        { status: 500 }
      );
    }
  },
  { resource: "qpost-compliance.controls", action: "view" }
);

// PUT update QPost requirement
export const PUT = withAuth(
  async (req: NextRequest, context: RouteContext, session) => {
    try {
      const { id } = await context.params;
      const body = await req.json();
      const {
        code,
        name,
        description,
        requirementType,
        chapterType,
        sortOrder,
        level,
        parentId,
        categoryId,
        applicability,
        justification,
        implementationStatus,
        controlCompliance,
        soaPolicy,
        soaEvidence,
        // Gap Assessment fields
        gapCurrentState,
        gapExpectedRequirement,
        gapEvidence,
        gapIdentified,
        gapRiskLevel,
        gapRecommendation,
        gapOwner,
        gapTargetDate,
        gapStatus,
        gapCompliant,
      } = body;

      const requirement = await prisma.qPostRequirement.update({
        where: { id },
        data: {
          ...(code !== undefined && { code }),
          ...(name !== undefined && { name }),
          ...(description !== undefined && { description }),
          ...(requirementType !== undefined && { requirementType }),
          ...(chapterType !== undefined && { chapterType }),
          ...(sortOrder !== undefined && { sortOrder }),
          ...(level !== undefined && { level }),
          ...(parentId !== undefined && { parentId }),
          ...(categoryId !== undefined && { categoryId }),
          ...(applicability !== undefined && { applicability }),
          ...(justification !== undefined && { justification }),
          ...(implementationStatus !== undefined && { implementationStatus }),
          ...(controlCompliance !== undefined && { controlCompliance }),
          ...(soaPolicy !== undefined && { soaPolicy }),
          ...(soaEvidence !== undefined && { soaEvidence }),
          // Gap Assessment fields
          ...(gapCurrentState !== undefined && { gapCurrentState }),
          ...(gapExpectedRequirement !== undefined && { gapExpectedRequirement }),
          ...(gapEvidence !== undefined && { gapEvidence }),
          ...(gapIdentified !== undefined && { gapIdentified }),
          ...(gapRiskLevel !== undefined && { gapRiskLevel }),
          ...(gapRecommendation !== undefined && { gapRecommendation }),
          ...(gapOwner !== undefined && { gapOwner }),
          ...(gapTargetDate !== undefined && { gapTargetDate }),
          ...(gapStatus !== undefined && { gapStatus }),
          ...(gapCompliant !== undefined && { gapCompliant }),
        },
        include: {
          framework: true,
          category: true,
        },
      });

      // Fire-and-forget translation
      const customerAccountId = await getCustomerAccountId(session);
      if (customerAccountId) {
        void translateRecord(customerAccountId, "QPostRequirement", requirement.id, {
          name: requirement.name,
          description: requirement.description,
        });
      }

      return NextResponse.json(requirement);
    } catch (error) {
      console.error("Error updating QPost requirement:", error);
      return NextResponse.json(
        { error: "Failed to update requirement" },
        { status: 500 }
      );
    }
  },
  { resource: "qpost-compliance.controls", action: "edit" }
);

// DELETE QPost requirement
export const DELETE = withAuth(
  async (req: NextRequest, context: RouteContext) => {
    try {
      const { id } = await context.params;

      await prisma.qPostRequirement.delete({
        where: { id },
      });

      return NextResponse.json({ success: true });
    } catch (error) {
      console.error("Error deleting QPost requirement:", error);
      return NextResponse.json(
        { error: "Failed to delete requirement" },
        { status: 500 }
      );
    }
  },
  { resource: "qpost-compliance.controls", action: "delete" }
);
