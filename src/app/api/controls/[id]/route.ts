import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth, getTenantFilter, validateTenantAccess, forbidden } from "@/lib/api-auth";
import { notificationService, NOTIFICATION_CHANNELS } from "@/lib/notification-service";

interface RouteContext {
  params: Promise<{ id: string }>;
}

// GET single control with all related data - filtered by customer account
export const GET = withAuth(
  async (req, context: RouteContext, session) => {
    try {
      const { id } = await context.params;
      const tenantFilter = getTenantFilter(session);

      const controlInclude = {
        domain: true,
        framework: true,
        department: true,
        owner: true,
        assignee: true,
        evidences: {
          include: {
            assignee: true,
            attachments: true,
          },
        },
        evidenceControls: {
          include: {
            evidence: {
              include: {
                assignee: true,
                attachments: true,
              },
            },
          },
        },
        exceptions: true,
        requirements: {
          include: {
            requirement: {
              include: {
                framework: true,
              },
            },
          },
        },
        controlRisks: {
          include: {
            risk: {
              include: {
                category: true,
                owner: true,
              },
            },
          },
        },
        policyControls: {
          include: {
            policy: true,
          },
        },
      };

      // First try with tenant filter (fast path for same-tenant controls)
      let control = await prisma.control.findFirst({
        where: { id, ...tenantFilter },
        include: controlInclude,
      });

      // If not found, try without tenant filter and validate access through linked framework
      if (!control) {
        control = await prisma.control.findFirst({
          where: { id },
          include: controlInclude,
        });

        if (control) {
          // Check if user can access this control through a linked framework
          const linkedFramework = await prisma.framework.findFirst({
            where: {
              OR: [
                { controls: { some: { id: control.id } } },
                { requirements: { some: { controls: { some: { controlId: control.id } } } } },
              ],
            },
            select: { id: true, customerAccountId: true },
          });

          if (!linkedFramework) {
            // Control exists but user has no access path to it
            return NextResponse.json(
              { error: "Control not found" },
              { status: 404 }
            );
          }

          // Check if user can access the linked framework
          // GRCAdministrators can access all frameworks
          // Other users must be in the same tenant or the framework must be a master template
          let hasFrameworkAccess = false;
          if (session.roles.includes("GRCAdministrator")) {
            hasFrameworkAccess = true;
          } else if (linkedFramework.customerAccountId === session.customerAccountId) {
            hasFrameworkAccess = true;
          } else if (linkedFramework.customerAccountId) {
            // Check if the framework is from a GRC Admin account (master framework)
            const frameworkAccount = await prisma.customerAccount.findUnique({
              where: { id: linkedFramework.customerAccountId },
              select: { code: true },
            });
            if (frameworkAccount?.code?.startsWith("GRC_ADMIN_")) {
              hasFrameworkAccess = true;
            }
          }

          if (!hasFrameworkAccess) {
            return NextResponse.json(
              { error: "Control not found" },
              { status: 404 }
            );
          }
        }
      }

      if (!control) {
        return NextResponse.json(
          { error: "Control not found" },
          { status: 404 }
        );
      }

      return NextResponse.json(control);
    } catch (error) {
      console.error("Error fetching control:", error);
      return NextResponse.json(
        { error: "Failed to fetch control" },
        { status: 500 }
      );
    }
  },
  { resource: "compliance.controls", action: "view" }
);

// PUT update control - with tenant validation
export const PUT = withAuth(
  async (req, context: RouteContext, session) => {
    try {
      const { id } = await context.params;
      const body = await req.json();
      const {
        name,
        controlCode,
        description,
        controlQuestion,
        functionalGrouping,
        status,
        entities,
        isControlList,
        relativeControlWeighting,
        scope,
        // CMM Maturity Level Descriptions
        notPerformed,
        performedInformally,
        plannedAndTracked,
        wellDefined,
        quantitativelyControlled,
        continuouslyImproving,
        // Relations
        domainId,
        frameworkId,
        departmentId,
        ownerId,
        assigneeId,
        // Multi-select relations
        riskIds,
        requirementIds,
      } = body;

      // First, verify the control belongs to the user's customer account
      // Also fetch existing owner/assignee for notification comparison
      const existing = await prisma.control.findUnique({
        where: { id },
        select: { customerAccountId: true, ownerId: true, assigneeId: true, controlCode: true, name: true },
      });

      if (!existing) {
        return NextResponse.json(
          { error: "Control not found" },
          { status: 404 }
        );
      }

      if (!validateTenantAccess(session, existing.customerAccountId)) {
        return forbidden("Access denied to this control");
      }

      // Build update data object, only including defined values
      const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name;
    if (controlCode !== undefined) updateData.controlCode = controlCode;
    if (description !== undefined) updateData.description = description;
    if (controlQuestion !== undefined) updateData.controlQuestion = controlQuestion;
    if (functionalGrouping !== undefined) updateData.functionalGrouping = functionalGrouping;
    if (status !== undefined) updateData.status = status;
    if (entities !== undefined) updateData.entities = entities;
    if (isControlList !== undefined) updateData.isControlList = isControlList;
    if (relativeControlWeighting !== undefined) updateData.relativeControlWeighting = relativeControlWeighting;
    if (scope !== undefined) updateData.scope = scope;
    if (notPerformed !== undefined) updateData.notPerformed = notPerformed;
    if (performedInformally !== undefined) updateData.performedInformally = performedInformally;
    if (plannedAndTracked !== undefined) updateData.plannedAndTracked = plannedAndTracked;
    if (wellDefined !== undefined) updateData.wellDefined = wellDefined;
    if (quantitativelyControlled !== undefined) updateData.quantitativelyControlled = quantitativelyControlled;
    if (continuouslyImproving !== undefined) updateData.continuouslyImproving = continuouslyImproving;
    if (domainId !== undefined) updateData.domainId = domainId;
    if (frameworkId !== undefined) updateData.frameworkId = frameworkId;
    if (departmentId !== undefined) updateData.departmentId = departmentId;
    if (ownerId !== undefined) updateData.ownerId = ownerId;
    if (assigneeId !== undefined) updateData.assigneeId = assigneeId;

    // Update the control
    const control = await prisma.control.update({
      where: { id },
      data: updateData,
      include: {
        domain: true,
        framework: true,
        department: true,
        owner: true,
        assignee: true,
      },
    });

    // Handle risk associations if provided
    if (riskIds !== undefined) {
      // Delete existing risk associations
      await prisma.controlRisk.deleteMany({
        where: { controlId: id },
      });
      // Create new risk associations
      if (riskIds.length > 0) {
        await prisma.controlRisk.createMany({
          data: riskIds.map((riskId: string) => ({
            controlId: id,
            riskId,
          })),
        });
      }
    }

    // Handle requirement associations if provided
    if (requirementIds !== undefined) {
      // Delete existing requirement associations
      await prisma.requirementControl.deleteMany({
        where: { controlId: id },
      });
      // Create new requirement associations
      if (requirementIds.length > 0) {
        await prisma.requirementControl.createMany({
          data: requirementIds.map((requirementId: string) => ({
            controlId: id,
            requirementId,
          })),
        });
      }
    }

    // Notify new assignee/reviewer if changed (owner notifications removed per requirements)
    if (assigneeId && assigneeId !== existing.assigneeId && assigneeId !== session.id && session.customerAccountId) {
      await notificationService.notifyControlAssigned({
        customerAccountId: session.customerAccountId,
        actorId: session.id,
        ownerId: assigneeId,
        controlId: control.id,
        controlCode: control.controlCode,
        controlName: control.name,
        channels: [NOTIFICATION_CHANNELS.INBOX, NOTIFICATION_CHANNELS.EMAIL],
      });
    }

      return NextResponse.json(control);
    } catch (error: unknown) {
      console.error("Error updating control:", error);
      if ((error as { code?: string }).code === "P2025") {
        return NextResponse.json(
          { error: "Control not found" },
          { status: 404 }
        );
      }
      return NextResponse.json(
        { error: "Failed to update control" },
        { status: 500 }
      );
    }
  },
  { resource: "compliance.controls", action: "edit" }
);

// DELETE control - with tenant validation
export const DELETE = withAuth(
  async (req, context: RouteContext, session) => {
    try {
      const { id } = await context.params;

      // First, verify the control belongs to the user's customer account
      const existing = await prisma.control.findUnique({
        where: { id },
        select: { customerAccountId: true },
      });

      if (!existing) {
        return NextResponse.json(
          { error: "Control not found" },
          { status: 404 }
        );
      }

      if (!validateTenantAccess(session, existing.customerAccountId)) {
        return forbidden("Access denied to this control");
      }

      await prisma.control.delete({
        where: { id },
      });

      return NextResponse.json({ message: "Control deleted successfully" });
    } catch (error: unknown) {
      console.error("Error deleting control:", error);
      if ((error as { code?: string }).code === "P2025") {
        return NextResponse.json(
          { error: "Control not found" },
          { status: 404 }
        );
      }
      return NextResponse.json(
        { error: "Failed to delete control" },
        { status: 500 }
      );
    }
  },
  { resource: "compliance.controls", action: "delete" }
);
