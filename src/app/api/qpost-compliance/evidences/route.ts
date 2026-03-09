import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth, getTenantFilter, getCustomerAccountId } from "@/lib/api-auth";
import { notificationService, NOTIFICATION_CHANNELS } from "@/lib/notification-service";

// GET all QPost evidences with filters - filtered by customer account and department for department roles
export const GET = withAuth(
  async (req, context, session) => {
    try {
      const { searchParams } = new URL(req.url);
      const status = searchParams.get("status");
      const frameworkId = searchParams.get("frameworkId");
      const requirementId = searchParams.get("requirementId");
      const departmentId = searchParams.get("departmentId");
      const assigneeId = searchParams.get("assigneeId");
      const domain = searchParams.get("domain");
      const search = searchParams.get("search");
      const page = parseInt(searchParams.get("page") || "1");
      const limit = parseInt(searchParams.get("limit") || "50");

      const tenantFilter = getTenantFilter(session);
      const where: Record<string, unknown> = { ...tenantFilter };

      // Department-based filtering for DepartmentContributor and DepartmentReviewer roles
      // These roles should only see evidence assigned to their department
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
      if (frameworkId) where.frameworkId = frameworkId;
      if (requirementId) {
        where.requirements = { some: { requirementId } };
      }
      if (assigneeId) where.assigneeId = assigneeId;
      if (domain) where.domain = domain;
      if (search) {
        where.OR = [
          { name: { contains: search } },
          { evidenceCode: { contains: search } },
          { description: { contains: search } },
          { assignee: { fullName: { contains: search } } },
          { domain: { contains: search } },
        ];
      }

      const [evidences, total] = await Promise.all([
        prisma.qPostEvidence.findMany({
          where,
          include: {
            framework: true,
            department: true,
            assignee: true,
            requirements: {
              include: {
                requirement: true,
              },
            },
            _count: {
              select: { attachments: true, kpis: true, linkedArtifacts: true },
            },
          },
          orderBy: { createdAt: "desc" },
          skip: (page - 1) * limit,
          take: limit,
        }),
        prisma.qPostEvidence.count({ where }),
      ]);

      return NextResponse.json({
        data: evidences,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      });
    } catch (error) {
      console.error("Error fetching QPost evidences:", error);
      return NextResponse.json(
        { error: "Failed to fetch evidences" },
        { status: 500 }
      );
    }
  },
  { resource: "qpost-compliance.evidence", action: "view" }
);

// POST create new QPost evidence - with customer account assignment
export const POST = withAuth(
  async (req, context, session) => {
    try {
      const body = await req.json();
      const {
        evidenceCode,
        name,
        description,
        domain,
        frameworkId,
        departmentId,
        assigneeId,
        dueDate,
        reviewDate,
        recurrence,
        status,
        requirementIds, // Array of requirement IDs to link during creation
        kpiRequired,
        kpiObjective,
        kpiDataSource,
        kpiExpectedScore,
        kpiDescription,
        kpiCalculationFormula,
      } = body;

      if (!name) {
        return NextResponse.json(
          { error: "Evidence name is required" },
          { status: 400 }
        );
      }

      // Get customer account ID for the new record
      const customerAccountId = getCustomerAccountId(session);

      // Generate evidence code if not provided
      const code = evidenceCode || `E-${Date.now()}`;

      const evidence = await prisma.qPostEvidence.create({
        data: {
          customerAccountId,
          evidenceCode: code,
          name,
          description,
          domain,
          frameworkId,
          departmentId,
          assigneeId,
          dueDate: dueDate ? new Date(dueDate) : null,
          reviewDate: reviewDate ? new Date(reviewDate) : null,
          recurrence,
          status: status || "Not Uploaded",
          kpiRequired: kpiRequired || false,
          kpiObjective,
          kpiDataSource,
          kpiExpectedScore,
          kpiDescription,
          kpiCalculationFormula,
        },
        include: {
          framework: true,
          department: true,
          assignee: true,
        },
      });

      // Link requirements if provided
      if (requirementIds && Array.isArray(requirementIds) && requirementIds.length > 0) {
        for (const reqId of requirementIds) {
          try {
            await prisma.qPostRequirementEvidence.create({
              data: {
                evidenceId: evidence.id,
                requirementId: reqId,
              },
            });
          } catch {
            // Ignore duplicate errors
          }
        }
      }

      // Notify assignee if different from creator
      if (assigneeId && assigneeId !== session?.id && session?.customerAccountId) {
        await notificationService.notifyEvidenceAssigned({
          customerAccountId: session.customerAccountId,
          actorId: session.id,
          assigneeId: assigneeId,
          evidenceId: evidence.id,
          evidenceName: evidence.name,
          channels: [NOTIFICATION_CHANNELS.INBOX, NOTIFICATION_CHANNELS.EMAIL],
        });
      }

      return NextResponse.json(evidence, { status: 201 });
    } catch (error: unknown) {
      console.error("Error creating QPost evidence:", error);
      if ((error as { code?: string }).code === "P2002") {
        return NextResponse.json(
          { error: "Evidence with this code already exists" },
          { status: 409 }
        );
      }
      return NextResponse.json(
        { error: "Failed to create evidence" },
        { status: 500 }
      );
    }
  },
  { resource: "qpost-compliance.evidence", action: "create" }
);
