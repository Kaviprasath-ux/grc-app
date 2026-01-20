import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth, getTenantFilter, validateTenantAccess, forbidden } from "@/lib/api-auth";

interface RouteContext {
  params: Promise<{ id: string }>;
}

// GET single evidence with all related data - filtered by customer account
export const GET = withAuth(
  async (req, context: RouteContext, session) => {
    try {
      const { id } = await context.params;
      const tenantFilter = getTenantFilter(session);

      const evidence = await prisma.evidence.findFirst({
        where: { id, ...tenantFilter },
        include: {
          framework: true,
          control: {
            include: {
              domain: true,
            },
          },
          department: true,
          assignee: true,
          attachments: true,
          kpis: true,
          evidenceControls: {
            include: {
              control: {
                include: {
                  domain: true,
                  framework: true,
                },
              },
            },
          },
          linkedArtifacts: {
            include: {
              artifact: true,
            },
          },
        },
      });

      if (!evidence) {
        return NextResponse.json(
          { error: "Evidence not found" },
          { status: 404 }
        );
      }

      return NextResponse.json(evidence);
    } catch (error) {
      console.error("Error fetching evidence:", error);
      return NextResponse.json(
        { error: "Failed to fetch evidence" },
        { status: 500 }
      );
    }
  },
  { resource: "compliance.evidence", action: "view" }
);

// PUT update evidence - with tenant validation
export const PUT = withAuth(
  async (req, context: RouteContext, session) => {
    try {
      const { id } = await context.params;
      const body = await req.json();
    const {
      name,
      description,
      domain,
      frameworkId,
      controlId,
      departmentId,
      assigneeId,
      dueDate,
      status,
      recurrence,
      reviewDate,
      publishedAt,
      kpiRequired,
      kpiObjective,
      kpiDataSource,
      kpiExpectedScore,
      kpiDescription,
      kpiCalculationFormula,
    } = body;

    // First, verify the evidence belongs to the user's customer account
    const existing = await prisma.evidence.findUnique({
      where: { id },
      select: { customerAccountId: true },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Evidence not found" },
        { status: 404 }
      );
    }

    if (!validateTenantAccess(session, existing.customerAccountId)) {
      return forbidden("Access denied to this evidence");
    }

    // Build update data, only including defined fields
    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (domain !== undefined) updateData.domain = domain;
    if (frameworkId !== undefined) updateData.frameworkId = frameworkId;
    if (controlId !== undefined) updateData.controlId = controlId;
    if (departmentId !== undefined) updateData.departmentId = departmentId;
    if (assigneeId !== undefined) updateData.assigneeId = assigneeId;
    if (dueDate !== undefined) updateData.dueDate = dueDate ? new Date(dueDate) : null;
    if (status !== undefined) updateData.status = status;
    if (recurrence !== undefined) updateData.recurrence = recurrence;
    if (reviewDate !== undefined) updateData.reviewDate = reviewDate ? new Date(reviewDate) : null;
    if (publishedAt !== undefined) updateData.publishedAt = publishedAt ? new Date(publishedAt) : null;
    if (kpiRequired !== undefined) updateData.kpiRequired = kpiRequired;
    if (kpiObjective !== undefined) updateData.kpiObjective = kpiObjective;
    if (kpiDataSource !== undefined) updateData.kpiDataSource = kpiDataSource;
    if (kpiExpectedScore !== undefined) updateData.kpiExpectedScore = kpiExpectedScore;
    if (kpiDescription !== undefined) updateData.kpiDescription = kpiDescription;
    if (kpiCalculationFormula !== undefined) updateData.kpiCalculationFormula = kpiCalculationFormula;

    const evidence = await prisma.evidence.update({
      where: { id },
      data: updateData,
      include: {
        framework: true,
        control: {
          include: {
            domain: true,
          },
        },
        department: true,
        assignee: true,
        attachments: true,
        kpis: true,
        evidenceControls: {
          include: {
            control: {
              include: {
                domain: true,
                framework: true,
              },
            },
          },
        },
        linkedArtifacts: {
          include: {
            artifact: true,
          },
        },
      },
    });

      return NextResponse.json(evidence);
    } catch (error: unknown) {
      console.error("Error updating evidence:", error);
      if ((error as { code?: string }).code === "P2025") {
        return NextResponse.json(
          { error: "Evidence not found" },
          { status: 404 }
        );
      }
      return NextResponse.json(
        { error: "Failed to update evidence" },
        { status: 500 }
      );
    }
  },
  { resource: "compliance.evidence", action: "edit" }
);

// DELETE evidence - with tenant validation
export const DELETE = withAuth(
  async (req, context: RouteContext, session) => {
    try {
      const { id } = await context.params;

      // First, verify the evidence belongs to the user's customer account
      const existing = await prisma.evidence.findUnique({
        where: { id },
        select: { customerAccountId: true },
      });

      if (!existing) {
        return NextResponse.json(
          { error: "Evidence not found" },
          { status: 404 }
        );
      }

      if (!validateTenantAccess(session, existing.customerAccountId)) {
        return forbidden("Access denied to this evidence");
      }

      await prisma.evidence.delete({
        where: { id },
      });

      return NextResponse.json({ message: "Evidence deleted successfully" });
    } catch (error: unknown) {
      console.error("Error deleting evidence:", error);
      if ((error as { code?: string }).code === "P2025") {
        return NextResponse.json(
          { error: "Evidence not found" },
          { status: 404 }
        );
      }
      return NextResponse.json(
        { error: "Failed to delete evidence" },
        { status: 500 }
      );
    }
  },
  { resource: "compliance.evidence", action: "delete" }
);
