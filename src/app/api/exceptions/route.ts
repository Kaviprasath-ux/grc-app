import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth, getTenantFilter, getCustomerAccountId } from "@/lib/api-auth";
import { notificationService, NOTIFICATION_EVENTS, NOTIFICATION_CHANNELS } from "@/lib/notification-service";

// GET all exceptions with filters - filtered by customer account
export const GET = withAuth(
  async (req, context, session) => {
    try {
      const { searchParams } = new URL(req.url);
      const status = searchParams.get("status");
      const category = searchParams.get("category");
      const departmentId = searchParams.get("departmentId");
      const controlId = searchParams.get("controlId");
      const policyId = searchParams.get("policyId");
      const riskId = searchParams.get("riskId");
      const requesterId = searchParams.get("requesterId");
      const search = searchParams.get("search");
      const page = parseInt(searchParams.get("page") || "1");
      const limit = parseInt(searchParams.get("limit") || "50");

      const tenantFilter = getTenantFilter(session);
      const where: Record<string, unknown> = { ...tenantFilter };

      // DepartmentReviewer can only see exceptions from their own department
      const isDepartmentReviewer = session.roles.includes("DepartmentReviewer");
      const isDepartmentContributor = session.roles.includes("DepartmentContributor");
      const hasAdminRole = session.roles.some(role =>
        ["GRCAdministrator", "CustomerAdministrator", "Reviewer", "Contributor"].includes(role)
      );

      // If user is DepartmentReviewer/DepartmentContributor without admin roles, filter by their department
      if ((isDepartmentReviewer || isDepartmentContributor) && !hasAdminRole) {
        if (session.departmentId) {
          where.departmentId = session.departmentId;
        } else {
          // User has no department assigned, show no results
          where.departmentId = "__NO_DEPARTMENT__";
        }
      } else if (departmentId) {
        // For other users, allow department filter from query params
        where.departmentId = departmentId;
      }

      if (status) where.status = status;
      if (category) where.category = category;
      if (controlId) where.controlId = controlId;
      if (policyId) where.policyId = policyId;
      if (riskId) where.riskId = riskId;
      if (requesterId) where.requesterId = requesterId;
      if (search) {
        where.OR = [
          { name: { contains: search } },
          { exceptionCode: { contains: search } },
          { description: { contains: search } },
        ];
      }

      const [exceptions, total] = await Promise.all([
        prisma.exception.findMany({
          where,
          include: {
            department: true,
            control: true,
            policy: true,
            risk: true,
            framework: true,
            requirement: true,
            requester: {
              select: {
                id: true,
                userName: true,
                fullName: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
            approver: {
              select: {
                id: true,
                userName: true,
                fullName: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
            comments: {
              orderBy: { createdAt: "desc" },
            },
          },
          orderBy: { createdAt: "desc" },
          skip: (page - 1) * limit,
          take: limit,
        }),
        prisma.exception.count({ where }),
      ]);

      return NextResponse.json({
        data: exceptions,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      });
    } catch (error) {
      console.error("Error fetching exceptions:", error);
      return NextResponse.json(
        { error: "Failed to fetch exceptions" },
        { status: 500 }
      );
    }
  },
  { resource: "compliance.exceptions", action: "view" }
);

// POST create new exception - with customer account assignment
export const POST = withAuth(
  async (req, context, session) => {
    try {
      const body = await req.json();
      const {
        exceptionCode,
        name,
        description,
        category,
        departmentId,
        controlId,
        policyId,
        riskId,
        frameworkId,
        requirementId,
        requesterId,
        approverId,
        status,
        endDate,
      } = body;

      if (!name) {
        return NextResponse.json(
          { error: "Exception name is required" },
          { status: 400 }
        );
      }

      if (!category) {
        return NextResponse.json(
          { error: "Exception category is required" },
          { status: 400 }
        );
      }

      // Get customer account ID for the new record
      if (!session.customerAccountId) {
        return NextResponse.json(
          { error: "Your user account is not assigned to a customer account. Please contact your administrator to assign you to a customer account." },
          { status: 400 }
        );
      }
      const customerAccountId = session.customerAccountId;

      // Generate exception code if not provided (EC1, EC2, EC3... per customer account)
      let code = exceptionCode;
      if (!code) {
        // Find the last exception for THIS customer account only
        const lastException = await prisma.exception.findFirst({
          where: { customerAccountId },
          orderBy: { exceptionCode: "desc" },
          select: { exceptionCode: true },
        });

        let nextNum = 1;
        if (lastException?.exceptionCode) {
          const match = lastException.exceptionCode.match(/EC(\d+)/);
          if (match) {
            nextNum = parseInt(match[1]) + 1;
          }
        }
        code = `EC${nextNum}`;
      }

      const exception = await prisma.exception.create({
        data: {
          customerAccountId,
          exceptionCode: code,
          name,
          description,
          category,
          departmentId: departmentId || null,
          controlId: category === "Control" ? (controlId || null) : null,
          policyId: category === "Policy" ? (policyId || null) : null,
          riskId: category === "Risk" ? (riskId || null) : null,
          frameworkId: category === "Compliance" ? (frameworkId || null) : null,
          requirementId: category === "Compliance" ? (requirementId || null) : null,
          requesterId: requesterId || null,
          approverId: approverId || null,
          status: status || "Pending",
          endDate: endDate ? new Date(endDate) : null,
        },
        include: {
          department: true,
          control: true,
          policy: true,
          risk: true,
          framework: true,
          requirement: true,
          requester: {
            select: {
              id: true,
              userName: true,
              fullName: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
          approver: {
            select: {
              id: true,
              userName: true,
              fullName: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
          comments: true,
        },
      });

      // Send notifications for exception
      // Notify approver if assigned and different from actor
      if (approverId && approverId !== session.id) {
        await notificationService.send({
          customerAccountId,
          actorId: session.id,
          recipientId: approverId,
          event: NOTIFICATION_EVENTS.EXCEPTION_AUTHORIZATION_REQUIRED,
          title: 'Exception Authorization Required',
          message: `Exception "${exception.exceptionCode}: ${exception.name}" requires your authorization.`,
          relatedEntityType: 'exception',
          relatedEntityId: exception.id,
          link: `/compliance/exceptions/${exception.id}`,
          metadata: {
            entityName: exception.name,
            exceptionCode: exception.exceptionCode,
            exceptionName: exception.name,
            category: exception.category,
            requestedBy: session.name || 'User',
          },
          channels: [NOTIFICATION_CHANNELS.INBOX, NOTIFICATION_CHANNELS.EMAIL],
        });
      }

      // Notify requester if assigned and different from actor
      if (requesterId && requesterId !== session.id && requesterId !== approverId) {
        await notificationService.send({
          customerAccountId,
          actorId: session.id,
          recipientId: requesterId,
          event: NOTIFICATION_EVENTS.EXCEPTION_ASSIGNED,
          title: 'Exception Assigned',
          message: `Exception "${exception.exceptionCode}: ${exception.name}" has been assigned to you.`,
          relatedEntityType: 'exception',
          relatedEntityId: exception.id,
          link: `/compliance/exceptions/${exception.id}`,
          metadata: {
            entityName: exception.name,
            exceptionCode: exception.exceptionCode,
            exceptionName: exception.name,
            category: exception.category,
          },
          channels: [NOTIFICATION_CHANNELS.INBOX, NOTIFICATION_CHANNELS.EMAIL],
        });
      }

      return NextResponse.json(exception, { status: 201 });
    } catch (error: unknown) {
      console.error("Error creating exception:", error);
      if ((error as { code?: string }).code === "P2002") {
        return NextResponse.json(
          { error: "Exception with this code already exists" },
          { status: 409 }
        );
      }
      // Return more specific error message
      const errorMessage = error instanceof Error ? error.message : "Failed to create exception";
      return NextResponse.json(
        { error: "Unable to complete the request. Please try again." },
        { status: 500 }
      );
    }
  },
  { resource: "compliance.exceptions", action: "create" }
);
