import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth, getTenantFilter, getCustomerAccountId } from "@/lib/api-auth";

// GET all issues
export const GET = withAuth(
  async (req, context, session) => {
    try {
      const userRoles = session.roles || [];
      const tenantFilter = getTenantFilter(session);

      // Debug logging
      console.log("Issues API - Session user:", {
        id: session.id,
        name: session.name,
        roles: userRoles,
      });

      // Check if user is DeptReviewer or DeptContributor (read-only roles that can only see their own issues)
      const isReadOnlyRole = userRoles.some((r: string) =>
        ["DepartmentReviewer", "DepartmentContributor"].includes(r)
      ) && !userRoles.some((r: string) =>
        ["Administrator", "CustomerAdministrator", "Reviewer", "Contributor"].includes(r)
      );

      // Build where clause - if read-only role, filter by ownerId directly
      const whereClause = isReadOnlyRole && session.id
        ? { ...tenantFilter, ownerId: session.id }
        : { ...tenantFilter };

      console.log("Issues API - isReadOnlyRole:", isReadOnlyRole, "whereClause:", JSON.stringify(whereClause));

      const issues = await prisma.issue.findMany({
        where: whereClause,
      include: {
        department: true,
        owner: {
          select: { id: true, fullName: true },
        },
        actions: {
          include: {
            createdBy: {
              select: { id: true, fullName: true },
            },
            comments: {
              orderBy: { createdAt: "desc" },
            },
          },
          orderBy: { createdAt: "desc" },
        },
        regulations: {
          include: {
            regulation: true,
          },
        },
        processes: {
          include: {
            process: {
              select: { id: true, processCode: true, name: true },
            },
          },
        },
        stakeholders: {
          include: {
            stakeholder: {
              select: { id: true, name: true, type: true },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      });
      console.log("Issues API - Returning", issues.length, "issues:", issues.map(i => i.title));
      return NextResponse.json(issues);
    } catch (error) {
      console.error("Error fetching issues:", error);
      return NextResponse.json({ error: "Failed to fetch issues" }, { status: 500 });
    }
  },
  { resource: "organization.context", action: "view" }
);

// POST create new issue
export const POST = withAuth(
  async (req, context, session) => {
    try {
      const body = await req.json();
    const {
      title,
      description,
      domain,
      category,
      issueType,
      status,
      dueDate,
      departmentId,
      ownerId,
      selectedRegulations,
      selectedProcesses,
      stakeholderNeeds,
    } = body;

      if (!title || !domain || !category) {
        return NextResponse.json(
          { error: "Title, domain, and category are required" },
          { status: 400 }
        );
      }

      const customerAccountId = getCustomerAccountId(session);

      const issue = await prisma.issue.create({
        data: {
          customerAccountId,
          title,
          description,
          domain,
          category,
          issueType,
          status: status || "Open",
          dueDate: dueDate ? new Date(dueDate) : null,
          departmentId: departmentId || null,
          ownerId: ownerId || null,
          // Create regulation associations
          regulations: selectedRegulations?.length
            ? {
                create: selectedRegulations.map((regulationId: string) => ({
                  regulationId,
                })),
              }
            : undefined,
          // Create process associations
          processes: selectedProcesses?.length
            ? {
                create: selectedProcesses.map((processId: string) => ({
                  processId,
                })),
              }
            : undefined,
          // Create stakeholder associations with need/expectation
          stakeholders: stakeholderNeeds?.length
            ? {
                create: stakeholderNeeds.map(
                  (item: { stakeholderId: string; needExpectation: string }) => ({
                    stakeholderId: item.stakeholderId,
                    needExpectation: item.needExpectation,
                  })
                ),
              }
            : undefined,
        },
      include: {
        department: true,
        owner: {
          select: { id: true, fullName: true },
        },
        regulations: {
          include: { regulation: true },
        },
        processes: {
          include: {
            process: {
              select: { id: true, processCode: true, name: true },
            },
          },
        },
        stakeholders: {
          include: {
            stakeholder: {
              select: { id: true, name: true, type: true },
            },
          },
        },
      },
      });

      return NextResponse.json(issue, { status: 201 });
    } catch (error) {
      console.error("Error creating issue:", error);
      return NextResponse.json({ error: "Failed to create issue" }, { status: 500 });
    }
  },
  { resource: "organization.context", action: "create" }
);
