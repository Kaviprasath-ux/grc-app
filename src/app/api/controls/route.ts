import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth, getTenantFilter, getCustomerAccountId } from "@/lib/api-auth";
import { notificationService, NOTIFICATION_CHANNELS } from "@/lib/notification-service";
import { translateRecord } from '@/lib/translation-service';

// GET all controls with filters - filtered by customer account
export const GET = withAuth(
  async (req, context, session) => {
    try {
      const { searchParams } = new URL(req.url);
      const status = searchParams.get("status");
      const frameworkId = searchParams.get("frameworkId");
      const domainId = searchParams.get("domainId");
      const departmentId = searchParams.get("departmentId");
      const assigneeId = searchParams.get("assigneeId");
      const functionalGrouping = searchParams.get("functionalGrouping");
      const search = searchParams.get("search");
      const page = parseInt(searchParams.get("page") || "1");
      const limit = parseInt(searchParams.get("limit") || "50");

      const tenantFilter = getTenantFilter(session);

      const where: Record<string, unknown> = {
        ...tenantFilter,
      };

      // Department-based filtering for DepartmentContributor and DepartmentReviewer roles
      // These roles should only see controls belonging to their department
      const isDepartmentRole = session.roles?.some((role: string) =>
        ['DepartmentContributor', 'DepartmentReviewer'].includes(role)
      );
      if (isDepartmentRole && session.departmentId) {
        where.departmentId = session.departmentId;
      } else if (departmentId) {
        where.departmentId = departmentId;
      }

      if (status) where.status = status;
      if (frameworkId === "none") {
        where.frameworkId = null;
      } else if (frameworkId) {
        where.frameworkId = frameworkId;
      }
      if (domainId) where.domainId = domainId;
      if (assigneeId) where.assigneeId = assigneeId;
      if (functionalGrouping) where.functionalGrouping = functionalGrouping;
      if (search) {
        where.OR = [
          { name: { contains: search } },
          { controlCode: { contains: search } },
          { description: { contains: search } },
        ];
      }

      const [controls, total] = await Promise.all([
        prisma.control.findMany({
          where,
          include: {
            domain: true,
            framework: true,
            department: true,
            owner: true,
            assignee: true,
            _count: {
              select: { evidences: true, exceptions: true, requirements: true },
            },
          },
          orderBy: { controlCode: "asc" },
          skip: (page - 1) * limit,
          take: limit,
        }),
        prisma.control.count({ where }),
      ]);

      return NextResponse.json({
        data: controls,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      });
    } catch (error) {
      console.error("Error fetching controls:", error);
      return NextResponse.json(
        { error: "Failed to fetch controls" },
        { status: 500 }
      );
    }
  },
  { resource: "compliance.controls", action: "view" }
);

// POST create new control - with customer account assignment
export const POST = withAuth(
  async (req, context, session) => {
    try {
      const body = await req.json();
      const {
        controlCode,
        name,
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
      } = body;

      // Validation - Only name is strictly required
      if (!name) {
        return NextResponse.json(
          { error: "Control Name is required" },
          { status: 400 }
        );
      }

      // Get customer account ID for the new record
      const customerAccountId = getCustomerAccountId(session);

      // Generate control code if not provided
      const code = controlCode || `CTRL-${Date.now()}`;

      const control = await prisma.control.create({
        data: {
          customerAccountId,
          controlCode: code,
          name,
          description,
          controlQuestion,
          functionalGrouping,
          status: status || "Non Compliant",
          entities: entities || "Organization Wide",
          isControlList: isControlList || false,
          relativeControlWeighting,
          scope,
          notPerformed,
          performedInformally,
          plannedAndTracked,
          wellDefined,
          quantitativelyControlled,
          continuouslyImproving,
          // Only include optional foreign keys if they have valid values
          ...(domainId ? { domainId } : {}),
          ...(frameworkId ? { frameworkId } : {}),
          ...(departmentId ? { departmentId } : {}),
          ...(ownerId ? { ownerId } : {}),
          ...(assigneeId ? { assigneeId } : {}),
        },
        include: {
          domain: true,
          framework: true,
          department: true,
          owner: true,
          assignee: true,
        },
      });

      // Notify assignee/reviewer if different from creator (owner notifications removed per requirements)
      if (assigneeId && assigneeId !== session.id && session.customerAccountId) {
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

      // Fire-and-forget translation
      if (customerAccountId) {
        void translateRecord(customerAccountId, 'Control', control.id, {
          name: control.name,
          description: control.description,
          controlQuestion: control.controlQuestion,
        });
      }

      return NextResponse.json(control, { status: 201 });
    } catch (error: unknown) {
      console.error("Error creating control:", error);
      if ((error as { code?: string }).code === "P2002") {
        return NextResponse.json(
          { error: "Control with this code already exists" },
          { status: 409 }
        );
      }
      return NextResponse.json(
        { error: "Failed to create control" },
        { status: 500 }
      );
    }
  },
  { resource: "compliance.controls", action: "create" }
);
