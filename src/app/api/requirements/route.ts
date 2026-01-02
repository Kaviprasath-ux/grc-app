import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// GET all requirements with filters
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const frameworkId = searchParams.get("frameworkId");
    const categoryId = searchParams.get("categoryId");
    const parentId = searchParams.get("parentId");
    const search = searchParams.get("search");

    const where: Record<string, unknown> = {};
    if (frameworkId) where.frameworkId = frameworkId;
    if (categoryId) where.categoryId = categoryId;
    if (parentId) where.parentId = parentId;
    if (search) {
      where.OR = [
        { code: { contains: search } },
        { name: { contains: search } },
        { description: { contains: search } },
      ];
    }

    const requirements = await prisma.requirement.findMany({
      where,
      include: {
        framework: true,
        category: true,
        parent: true,
        children: true,
        controls: {
          include: {
            control: true,
          },
        },
      },
      orderBy: { sortOrder: "asc" },
    });

    return NextResponse.json(requirements);
  } catch (error) {
    console.error("Error fetching requirements:", error);
    return NextResponse.json(
      { error: "Failed to fetch requirements" },
      { status: 500 }
    );
  }
}

// POST create new requirement
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      code,
      name,
      description,
      frameworkId,
      categoryId,
      parentId,
      sortOrder,
      requirementType,
      chapterType,
      level,
      applicability,
      justification,
      implementationStatus,
    } = body;

    if (!code) {
      return NextResponse.json(
        { error: "Requirement code is required" },
        { status: 400 }
      );
    }

    if (!name) {
      return NextResponse.json(
        { error: "Requirement name is required" },
        { status: 400 }
      );
    }

    if (!frameworkId) {
      return NextResponse.json(
        { error: "Framework ID is required" },
        { status: 400 }
      );
    }

    const requirement = await prisma.requirement.create({
      data: {
        code,
        name,
        description,
        frameworkId,
        categoryId,
        parentId,
        sortOrder: sortOrder || 0,
        requirementType: requirementType || "Mandatory",
        chapterType: chapterType || "Domain",
        level: level || 1,
        applicability,
        justification,
        implementationStatus,
      },
      include: {
        framework: true,
        category: true,
        parent: true,
      },
    });

    return NextResponse.json(requirement, { status: 201 });
  } catch (error: unknown) {
    console.error("Error creating requirement:", error);
    if ((error as { code?: string }).code === "P2002") {
      return NextResponse.json(
        { error: "Requirement with this code already exists for this framework" },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: "Failed to create requirement" },
      { status: 500 }
    );
  }
}
