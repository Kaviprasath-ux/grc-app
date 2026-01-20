import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth, getTenantFilter, validateTenantAccess, forbidden } from "@/lib/api-auth";

interface RouteContext {
  params: Promise<{ id: string }>;
}

// GET single requirement with all related data - with tenant validation
export const GET = withAuth(
  async (req, context, session) => {
    try {
      const { id } = await (context as RouteContext).params;
      const tenantFilter = getTenantFilter(session);

      const requirement = await prisma.requirement.findFirst({
        where: { id, ...tenantFilter },
        include: {
          framework: true,
          category: true,
          parent: true,
          children: {
            orderBy: { sortOrder: "asc" },
          },
          controls: {
            include: {
              control: {
                include: {
                  domain: true,
                  owner: true,
                },
              },
            },
          },
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
      console.error("Error fetching requirement:", error);
      return NextResponse.json(
        { error: "Failed to fetch requirement" },
        { status: 500 }
      );
    }
  },
  { resource: "compliance.framework", action: "view" }
);

// PUT update requirement - with tenant validation
export const PUT = withAuth(
  async (req, context, session) => {
    try {
      const { id } = await (context as RouteContext).params;
      const body = await req.json();
      const {
        code,
        name,
        description,
        categoryId,
        parentId,
        sortOrder,
        requirementType,
        chapterType,
        level,
        applicability,
        justification,
        implementationStatus,
        controlCompliance,
      } = body;

      // Check if requirement exists
      const existingRequirement = await prisma.requirement.findUnique({
        where: { id },
      });

      if (!existingRequirement) {
        return NextResponse.json(
          { error: "Requirement not found" },
          { status: 404 }
        );
      }

      // Validate tenant access
      if (!validateTenantAccess(session, existingRequirement.customerAccountId)) {
        return forbidden("Access denied");
      }

      const requirement = await prisma.requirement.update({
        where: { id },
        data: {
          code,
          name,
          description,
          categoryId,
          parentId,
          sortOrder,
          requirementType,
          chapterType,
          level,
          applicability,
          justification,
          implementationStatus,
          ...(controlCompliance && { controlCompliance }),
        },
        include: {
          framework: true,
          category: true,
          parent: true,
        },
      });

      // Only update control compliance based on linked controls if not explicitly set
      if (!controlCompliance) {
        await updateRequirementCompliance(id);
      }

      return NextResponse.json(requirement);
    } catch (error: unknown) {
      console.error("Error updating requirement:", error);
      if ((error as { code?: string }).code === "P2025") {
        return NextResponse.json(
          { error: "Requirement not found" },
          { status: 404 }
        );
      }
      return NextResponse.json(
        { error: "Failed to update requirement" },
        { status: 500 }
      );
    }
  },
  { resource: "compliance.framework", action: "edit" }
);

// Helper function to update requirement compliance based on linked controls
async function updateRequirementCompliance(requirementId: string) {
  const requirement = await prisma.requirement.findUnique({
    where: { id: requirementId },
    include: {
      controls: {
        include: {
          control: true,
        },
      },
    },
  });

  if (!requirement || requirement.controls.length === 0) {
    await prisma.requirement.update({
      where: { id: requirementId },
      data: { controlCompliance: "Non Compliant" },
    });
    return;
  }

  const compliantCount = requirement.controls.filter(
    (rc) => rc.control.status === "Compliant"
  ).length;
  const totalCount = requirement.controls.length;

  let compliance = "Non Compliant";
  if (compliantCount === totalCount) {
    compliance = "Compliant";
  } else if (compliantCount > 0) {
    compliance = "Partial Compliant";
  }

  await prisma.requirement.update({
    where: { id: requirementId },
    data: { controlCompliance: compliance },
  });
}

// DELETE requirement - with tenant validation
export const DELETE = withAuth(
  async (req, context, session) => {
    try {
      const { id } = await (context as RouteContext).params;

      // Check if requirement exists
      const existingRequirement = await prisma.requirement.findUnique({
        where: { id },
      });

      if (!existingRequirement) {
        return NextResponse.json(
          { error: "Requirement not found" },
          { status: 404 }
        );
      }

      // Validate tenant access
      if (!validateTenantAccess(session, existingRequirement.customerAccountId)) {
        return forbidden("Access denied");
      }

      await prisma.requirement.delete({
        where: { id },
      });

      return NextResponse.json({ message: "Requirement deleted successfully" });
    } catch (error: unknown) {
      console.error("Error deleting requirement:", error);
      if ((error as { code?: string }).code === "P2025") {
        return NextResponse.json(
          { error: "Requirement not found" },
          { status: 404 }
        );
      }
      return NextResponse.json(
        { error: "Failed to delete requirement" },
        { status: 500 }
      );
    }
  },
  { resource: "compliance.framework", action: "delete" }
);
