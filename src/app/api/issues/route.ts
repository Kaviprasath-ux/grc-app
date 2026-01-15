import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";

// GET all issues
export async function GET() {
  try {
    const session = await auth();
    const userRoles = session?.user?.roles || [];

    // Debug logging
    console.log("Issues API - Session user:", {
      id: session?.user?.id,
      name: session?.user?.name,
      roles: userRoles,
    });

    // Check if user is DeptReviewer or DeptContributor (read-only roles that can only see their own issues)
    const isReadOnlyRole = userRoles.some((r: string) =>
      ["DepartmentReviewer", "DepartmentContributor"].includes(r)
    ) && !userRoles.some((r: string) =>
      ["Administrator", "CustomerAdministrator", "Reviewer", "Contributor"].includes(r)
    );

    // Build where clause - if read-only role, filter by ownerId directly
    const whereClause = isReadOnlyRole && session?.user?.id
      ? { ownerId: session.user.id }
      : {};

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
}

// POST create new issue
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
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

    const issue = await prisma.issue.create({
      data: {
        title,
        description,
        domain,
        category,
        issueType,
        status: status || "Open",
        dueDate: dueDate ? new Date(dueDate) : null,
        // Use connect syntax for relations
        department: departmentId ? { connect: { id: departmentId } } : undefined,
        owner: ownerId ? { connect: { id: ownerId } } : undefined,
        // Create regulation associations
        regulations: selectedRegulations?.length
          ? {
              create: selectedRegulations.map((regulationId: string) => ({
                regulation: { connect: { id: regulationId } },
              })),
            }
          : undefined,
        // Create process associations
        processes: selectedProcesses?.length
          ? {
              create: selectedProcesses.map((processId: string) => ({
                process: { connect: { id: processId } },
              })),
            }
          : undefined,
        // Create stakeholder associations with need/expectation
        stakeholders: stakeholderNeeds?.length
          ? {
              create: stakeholderNeeds.map(
                (item: { stakeholderId: string; needExpectation: string }) => ({
                  stakeholder: { connect: { id: item.stakeholderId } },
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
}
