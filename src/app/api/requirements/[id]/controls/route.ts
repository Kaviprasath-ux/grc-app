import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth, getTenantFilter, validateTenantAccess, forbidden } from "@/lib/api-auth";

interface RouteContext {
  params: Promise<{ id: string }>;
}

// GET all controls linked to a requirement - with tenant validation
export const GET = withAuth(
  async (req, context, session) => {
    try {
      const { id: requirementId } = await (context as RouteContext).params;
      const tenantFilter = getTenantFilter(session);

      // First verify the requirement belongs to the tenant
      const requirement = await prisma.requirement.findFirst({
        where: { id: requirementId, ...tenantFilter },
      });

      if (!requirement) {
        return NextResponse.json(
          { error: "Requirement not found" },
          { status: 404 }
        );
      }

      const links = await prisma.requirementControl.findMany({
        where: { requirementId },
        include: {
          control: {
            include: {
              domain: true,
              owner: true,
            },
          },
        },
      });

      return NextResponse.json(links);
    } catch (error) {
      console.error("Error fetching linked controls:", error);
      return NextResponse.json(
        { error: "Failed to fetch linked controls" },
        { status: 500 }
      );
    }
  },
  { resource: "compliance.framework", action: "view" }
);

// POST link control(s) to requirement - with tenant validation
export const POST = withAuth(
  async (req, context, session) => {
    try {
      const { id: requirementId } = await (context as RouteContext).params;
      const body = await req.json();
      const { controlId, controlIds } = body;

      // Support both single controlId and array of controlIds
      const idsToLink = controlIds || (controlId ? [controlId] : []);

      if (idsToLink.length === 0) {
        return NextResponse.json(
          { error: "Control ID(s) required" },
          { status: 400 }
        );
      }

      // First verify the requirement exists and belongs to the tenant
      const requirement = await prisma.requirement.findUnique({
        where: { id: requirementId },
      });

      if (!requirement) {
        return NextResponse.json(
          { error: "Requirement not found" },
          { status: 404 }
        );
      }

      // Validate tenant access
      if (!validateTenantAccess(session, requirement.customerAccountId)) {
        return forbidden("Access denied");
      }

      // Create links for all controls
      const results = await Promise.all(
        idsToLink.map(async (cId: string) => {
          try {
            return await prisma.requirementControl.create({
              data: {
                controlId: cId,
                requirementId,
              },
              include: {
                control: true,
              },
            });
          } catch (err) {
            // Skip duplicates
            console.log(`Control ${cId} already linked or error:`, err);
            return null;
          }
        })
      );

      // Update requirement compliance
      await updateRequirementCompliance(requirementId);

      const successfulLinks = results.filter((r) => r !== null);
      return NextResponse.json(successfulLinks, { status: 201 });
    } catch (error: unknown) {
      console.error("Error linking control to requirement:", error);
      return NextResponse.json(
        { error: "Failed to link control to requirement" },
        { status: 500 }
      );
    }
  },
  { resource: "compliance.framework", action: "edit" }
);

// DELETE unlink control from requirement - with tenant validation
export const DELETE = withAuth(
  async (req, context, session) => {
    try {
      const { id: requirementId } = await (context as RouteContext).params;
      const { searchParams } = new URL(req.url);
      const controlId = searchParams.get("controlId");

      if (!controlId) {
        return NextResponse.json(
          { error: "Control ID is required" },
          { status: 400 }
        );
      }

      // First verify the requirement exists and belongs to the tenant
      const requirement = await prisma.requirement.findUnique({
        where: { id: requirementId },
      });

      if (!requirement) {
        return NextResponse.json(
          { error: "Requirement not found" },
          { status: 404 }
        );
      }

      // Validate tenant access
      if (!validateTenantAccess(session, requirement.customerAccountId)) {
        return forbidden("Access denied");
      }

      await prisma.requirementControl.delete({
        where: {
          requirementId_controlId: {
            controlId,
            requirementId,
          },
        },
      });

      // Update requirement compliance
      await updateRequirementCompliance(requirementId);

      return NextResponse.json({ message: "Control unlinked from requirement successfully" });
    } catch (error: unknown) {
      console.error("Error unlinking control from requirement:", error);
      if ((error as { code?: string }).code === "P2025") {
        return NextResponse.json(
          { error: "Link not found" },
          { status: 404 }
        );
      }
      return NextResponse.json(
        { error: "Failed to unlink control from requirement" },
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
