import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth, getTenantFilter, getCustomerAccountId } from "@/lib/api-auth";
import { notificationService, NOTIFICATION_CHANNELS } from "@/lib/notification-service";

// Helper function to generate evidence code (format: EVD-001, EVD-002, etc.)
// Scoped to customer account
async function generateEvidenceCode(customerAccountId: string): Promise<string> {
  const lastEvidence = await prisma.evidence.findFirst({
    where: { customerAccountId },
    orderBy: { createdAt: "desc" },
    select: { evidenceCode: true },
  });

  if (!lastEvidence) {
    return "EVD-001";
  }

  // Extract the number from the last evidence code (e.g., "EVD-042" -> 42)
  const match = lastEvidence.evidenceCode.match(/EVD-(\d+)/);
  if (match) {
    const nextNum = parseInt(match[1], 10) + 1;
    return `EVD-${String(nextNum).padStart(3, "0")}`;
  }

  // Fallback: count-based within customer account
  const count = await prisma.evidence.count({ where: { customerAccountId } });
  return `EVD-${String(count + 1).padStart(3, "0")}`;
}

// GET all evidences with filters - filtered by customer account and department for department roles
export const GET = withAuth(
  async (req, context, session) => {
    try {
      const { searchParams } = new URL(req.url);
      const status = searchParams.get("status");
      const frameworkId = searchParams.get("frameworkId");
      const controlId = searchParams.get("controlId");
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
      if (controlId) where.controlId = controlId;
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
        prisma.evidence.findMany({
          where,
          include: {
            framework: true,
            control: true,
            department: true,
            assignee: true,
            evidenceControls: {
              include: {
                control: {
                  include: {
                    domain: true,
                  },
                },
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
        prisma.evidence.count({ where }),
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
      console.error("Error fetching evidences:", error);
      return NextResponse.json(
        { error: "Failed to fetch evidences" },
        { status: 500 }
      );
    }
  },
  { resource: "compliance.evidence", action: "view" }
);

// POST create new evidence - with customer account assignment
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
        controlId,
        departmentId,
        assigneeId,
        dueDate,
        reviewDate,
        recurrence,
        status,
        controlIds, // Array of control IDs to link during creation
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
      const code = evidenceCode || await generateEvidenceCode(customerAccountId);

      const evidence = await prisma.evidence.create({
        data: {
          customerAccountId,
          evidenceCode: code,
          name,
          description,
          domain,
          frameworkId,
          controlId,
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
          control: true,
          department: true,
          assignee: true,
        },
      });

      // Link controls if provided
      if (controlIds && Array.isArray(controlIds) && controlIds.length > 0) {
        for (const ctrlId of controlIds) {
          try {
            await prisma.evidenceControl.create({
              data: {
                evidenceId: evidence.id,
                controlId: ctrlId,
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
          controlCode: evidence.control?.controlCode ?? undefined,
          channels: [NOTIFICATION_CHANNELS.INBOX, NOTIFICATION_CHANNELS.EMAIL],
        });
      }

      return NextResponse.json(evidence, { status: 201 });
    } catch (error: unknown) {
      console.error("Error creating evidence:", error);
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
  { resource: "compliance.evidence", action: "create" }
);
