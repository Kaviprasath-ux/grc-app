import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth, getTenantFilter, getCustomerAccountId } from "@/lib/api-auth";
import { notificationService, NOTIFICATION_EVENTS, NOTIFICATION_CHANNELS } from "@/lib/notification-service";

// GET all policies with filters
export const GET = withAuth(
  async (req, context, session) => {
    try {
      const { searchParams } = new URL(req.url);
      const status = searchParams.get("status");
      const documentType = searchParams.get("documentType");
      const departmentId = searchParams.get("departmentId");
      const frameworkId = searchParams.get("frameworkId");
      const search = searchParams.get("search");
      const page = parseInt(searchParams.get("page") || "1");
      const limit = parseInt(searchParams.get("limit") || "50");

      const tenantFilter = getTenantFilter(session);
      const where: Record<string, unknown> = { ...tenantFilter };

      // Department-based filtering for DepartmentContributor and DepartmentReviewer roles
      // These roles should only see governance documents assigned to their department
      const isDepartmentRole = session.roles.some(role =>
        ['DepartmentContributor', 'DepartmentReviewer'].includes(role)
      );
      if (isDepartmentRole && session.departmentId) {
        where.departmentId = session.departmentId;
      } else if (departmentId) {
        // For other roles, apply departmentId filter from query params if provided
        where.departmentId = departmentId;
      }

      if (status) where.status = status;
      if (documentType) where.documentType = documentType;
      // Filter by framework through PolicyControl -> Control -> Framework relationship
      if (frameworkId) {
        where.policyControls = {
          some: {
            control: {
              frameworkId: frameworkId,
            },
          },
        };
      }
      if (search) {
        where.OR = [
          { name: { contains: search } },
          { code: { contains: search } },
        ];
      }

      const [policies, total] = await Promise.all([
        prisma.policy.findMany({
          where,
          include: {
            department: true,
            assignee: true,
            approver: true,
            _count: {
              select: { policyControls: true, attachments: true },
            },
          },
          orderBy: { createdAt: "desc" },
          skip: (page - 1) * limit,
          take: limit,
        }),
        prisma.policy.count({ where }),
      ]);

      return NextResponse.json({
        data: policies,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      });
    } catch (error) {
      console.error("Error fetching policies:", error);
      return NextResponse.json(
        { error: "Failed to fetch policies" },
        { status: 500 }
      );
    }
  },
  { resource: "compliance.governance", action: "view" }
);

// POST create new policy
export const POST = withAuth(
  async (req, context, session) => {
    try {
      const body = await req.json();
      const {
        code,
        name,
        version,
        documentType,
        recurrence,
        departmentId,
        assigneeId,
        approverId,
        status,
        effectiveDate,
        reviewDate,
        content,
        aiReviewStatus,
        aiReviewScore,
        aiReviewJustification,
        controlIds, // Array of control IDs to link during creation
      } = body;

      if (!name) {
        return NextResponse.json(
          { error: "Policy name is required" },
          { status: 400 }
        );
      }

      const customerAccountId = getCustomerAccountId(session);

      // Generate policy code based on document type
      const prefix = documentType === "Standard" ? "STD" : documentType === "Procedure" ? "PRC" : "POL";
      const policyCode = code || `${prefix}-${Date.now()}`;

      const policy = await prisma.policy.create({
        data: {
          customerAccountId,
          code: policyCode,
          name,
          version: version || "1.0",
          documentType: documentType || "Policy",
          recurrence,
          departmentId,
          assigneeId,
          approverId,
          status: status || "Not Uploaded",
          effectiveDate: effectiveDate ? new Date(effectiveDate) : null,
          reviewDate: reviewDate ? new Date(reviewDate) : null,
          content,
          aiReviewStatus: aiReviewStatus || "Pending",
          aiReviewScore: aiReviewScore || 0,
          aiReviewJustification,
        },
        include: {
          department: true,
          assignee: true,
          approver: true,
        },
      });

      // Link controls if provided
      if (controlIds && Array.isArray(controlIds) && controlIds.length > 0) {
        // Create each policy-control link individually to handle duplicates gracefully
        for (const controlId of controlIds) {
          try {
            await prisma.policyControl.create({
              data: {
                policyId: policy.id,
                controlId,
              },
            });
          } catch {
            // Ignore duplicate errors
          }
        }
      }

      // Send notifications for policy assignments
      if (customerAccountId) {
        // Notify assignee if different from actor
        if (assigneeId && assigneeId !== session.id) {
          await notificationService.send({
            customerAccountId,
            actorId: session.id,
            recipientId: assigneeId,
            event: NOTIFICATION_EVENTS.POLICY_ASSIGNED,
            title: "Policy assigned to you",
            message: `Policy "${policy.name}" has been assigned to you`,
            relatedEntityType: "policy",
            relatedEntityId: policy.id,
            link: `/compliance/governance/${policy.id}`,
            metadata: { entityName: policy.name, policyCode: policy.code },
            channels: [NOTIFICATION_CHANNELS.INBOX, NOTIFICATION_CHANNELS.EMAIL],
          });
        }

        // Notify approver if different from actor and different from assignee
        if (approverId && approverId !== session.id && approverId !== assigneeId) {
          await notificationService.send({
            customerAccountId,
            actorId: session.id,
            recipientId: approverId,
            event: NOTIFICATION_EVENTS.POLICY_ASSIGNED,
            title: "Policy assigned for your approval",
            message: `Policy "${policy.name}" has been assigned to you for approval`,
            relatedEntityType: "policy",
            relatedEntityId: policy.id,
            link: `/compliance/governance/${policy.id}`,
            metadata: { entityName: policy.name, policyCode: policy.code },
            channels: [NOTIFICATION_CHANNELS.INBOX, NOTIFICATION_CHANNELS.EMAIL],
          });
        }
      }

      return NextResponse.json(policy, { status: 201 });
    } catch (error: unknown) {
      console.error("Error creating policy:", error);
      if ((error as { code?: string }).code === "P2002") {
        return NextResponse.json(
          { error: "Policy with this code already exists" },
          { status: 409 }
        );
      }
      return NextResponse.json(
        { error: "Failed to create policy" },
        { status: 500 }
      );
    }
  },
  { resource: "compliance.governance", action: "create" }
);
