import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// GET all controls with filters
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const frameworkId = searchParams.get("frameworkId");
    const domainId = searchParams.get("domainId");
    const departmentId = searchParams.get("departmentId");
    const functionalGrouping = searchParams.get("functionalGrouping");
    const search = searchParams.get("search");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "50");

    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (frameworkId) where.frameworkId = frameworkId;
    if (domainId) where.domainId = domainId;
    if (departmentId) where.departmentId = departmentId;
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
}

// POST create new control
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
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

    // Validation - Required fields based on discovered validation rules
    if (!name) {
      return NextResponse.json(
        { error: "Control Name is required" },
        { status: 400 }
      );
    }
    if (!controlQuestion) {
      return NextResponse.json(
        { error: "Control Question is required" },
        { status: 400 }
      );
    }
    if (!functionalGrouping) {
      return NextResponse.json(
        { error: "Functional Grouping is required" },
        { status: 400 }
      );
    }

    // Generate control code if not provided
    const code = controlCode || `CTRL-${Date.now()}`;

    const control = await prisma.control.create({
      data: {
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
        domainId,
        frameworkId,
        departmentId,
        ownerId,
        assigneeId,
      },
      include: {
        domain: true,
        framework: true,
        department: true,
        owner: true,
        assignee: true,
      },
    });

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
}
