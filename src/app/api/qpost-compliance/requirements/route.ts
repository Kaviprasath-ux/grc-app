import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth, getTenantFilter, getCustomerAccountId } from "@/lib/api-auth";
import { translateRecord } from "@/lib/translation-service";

// GET all QPost requirements with filters
export const GET = withAuth(
  async (req, context, session) => {
    try {
      const { searchParams } = new URL(req.url);
      const frameworkId = searchParams.get("frameworkId");
      const categoryId = searchParams.get("categoryId");
      const search = searchParams.get("search");
      const page = parseInt(searchParams.get("page") || "1");
      const limit = parseInt(searchParams.get("limit") || "50");

      const tenantFilter = getTenantFilter(session);

      const where: Record<string, unknown> = {
        ...tenantFilter,
      };

      if (frameworkId) where.frameworkId = frameworkId;
      if (categoryId) where.categoryId = categoryId;
      if (search) {
        where.OR = [
          { name: { contains: search } },
          { code: { contains: search } },
          { description: { contains: search } },
        ];
      }

      const [requirements, total] = await Promise.all([
        prisma.qPostRequirement.findMany({
          where,
          include: {
            framework: true,
            category: true,
            _count: {
              select: {
                evidences: true,
                policies: true,
                exceptions: true,
                complianceExceptions: true,
              },
            },
          },
          orderBy: [{ sortOrder: "asc" }, { code: "asc" }],
          skip: (page - 1) * limit,
          take: limit,
        }),
        prisma.qPostRequirement.count({ where }),
      ]);

      return NextResponse.json({
        data: requirements,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      });
    } catch (error) {
      console.error("Error fetching QPost requirements:", error);
      return NextResponse.json(
        { error: "Failed to fetch requirements" },
        { status: 500 }
      );
    }
  },
  { resource: "qpost-compliance.controls", action: "view" }
);

// POST create new QPost requirement
export const POST = withAuth(
  async (req, context, session) => {
    try {
      const body = await req.json();
      const {
        code,
        name,
        description,
        requirementType,
        chapterType,
        sortOrder,
        level,
        parentId,
        frameworkId,
        categoryId,
        applicability,
        justification,
        implementationStatus,
        controlCompliance,
      } = body;

      if (!code || !name || !frameworkId) {
        return NextResponse.json(
          { error: "Code, name, and frameworkId are required" },
          { status: 400 }
        );
      }

      const customerAccountId = await getCustomerAccountId(session);
      if (!customerAccountId) {
        return NextResponse.json(
          { error: "Customer account not found" },
          { status: 400 }
        );
      }

      const requirement = await prisma.qPostRequirement.create({
        data: {
          code,
          name,
          description,
          requirementType: requirementType || "Mandatory",
          chapterType: chapterType || "Domain",
          sortOrder: sortOrder || 0,
          level: level || 1,
          parentId: parentId || null,
          frameworkId,
          categoryId: categoryId || null,
          applicability,
          justification,
          implementationStatus,
          controlCompliance,
          customerAccountId,
        },
        include: {
          framework: true,
          category: true,
        },
      });

      // Fire-and-forget translation
      void translateRecord(customerAccountId, "QPostRequirement", requirement.id, {
        name: requirement.name,
        description: requirement.description,
      });

      return NextResponse.json(requirement, { status: 201 });
    } catch (error: unknown) {
      console.error("Error creating QPost requirement:", error);
      if ((error as { code?: string }).code === "P2002") {
        return NextResponse.json(
          { error: "Requirement with this code already exists in this framework" },
          { status: 409 }
        );
      }
      return NextResponse.json(
        { error: "Failed to create requirement" },
        { status: 500 }
      );
    }
  },
  { resource: "qpost-compliance.controls", action: "create" }
);
