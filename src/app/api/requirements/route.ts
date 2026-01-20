import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth, getTenantFilter, getCustomerAccountId } from "@/lib/api-auth";

// GET all requirements with filters - filtered by customer account
export const GET = withAuth(
  async (req, context, session) => {
    try {
      const { searchParams } = new URL(req.url);
      const frameworkId = searchParams.get("frameworkId");
      const categoryId = searchParams.get("categoryId");
      const parentId = searchParams.get("parentId");
      const search = searchParams.get("search");

      const tenantFilter = getTenantFilter(session);
      const where: Record<string, unknown> = { ...tenantFilter };

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
  },
  { resource: "compliance.framework", action: "view" }
);

// POST create new requirement - with customer account assignment
export const POST = withAuth(
  async (req, context, session) => {
    try {
      const body = await req.json();
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

      // Get customer account ID for the new record
      const customerAccountId = getCustomerAccountId(session);

      const requirement = await prisma.requirement.create({
        data: {
          customerAccountId,
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
  },
  { resource: "compliance.framework", action: "create" }
);
