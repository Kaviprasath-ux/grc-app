import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth, getTenantFilter, getCustomerAccountId } from "@/lib/api-auth";

// GET all lookup data for my-assets page (categories, sub-categories, groups, lifecycle statuses, departments, users, classifications, sensitivities)
export const GET = withAuth(
  async (req, context, session) => {
    try {
      const tenantFilter = getTenantFilter(session);

      const [categories, subCategories, groups, lifecycleStatuses, departments, users, classifications, sensitivities] = await Promise.all([
        prisma.assetCategory.findMany({
          where: tenantFilter as Record<string, unknown>,
          orderBy: { name: "asc" },
        }),
        prisma.assetSubCategory.findMany({
          where: tenantFilter as Record<string, unknown>,
          include: { category: true },
          orderBy: { name: "asc" },
        }),
        prisma.assetGroup.findMany({
          where: tenantFilter as Record<string, unknown>,
          orderBy: { name: "asc" },
        }),
        prisma.assetLifecycleStatus.findMany({
          where: tenantFilter as Record<string, unknown>,
          orderBy: { order: "asc" },
        }),
        prisma.department.findMany({
          where: tenantFilter as Record<string, unknown>,
          orderBy: { name: "asc" },
        }),
        prisma.user.findMany({
          where: {
            ...tenantFilter as Record<string, unknown>,
            isActive: true,
          },
          select: {
            id: true,
            fullName: true,
            departmentId: true,
          },
          orderBy: { fullName: "asc" },
        }),
        prisma.assetClassification.findMany({
          where: tenantFilter as Record<string, unknown>,
          orderBy: { name: "asc" },
        }),
        prisma.assetSensitivity.findMany({
          where: tenantFilter as Record<string, unknown>,
          orderBy: { name: "asc" },
        }),
      ]);

      return NextResponse.json({
        categories,
        subCategories,
        groups,
        lifecycleStatuses,
        departments,
        users,
        classifications,
        sensitivities,
      });
    } catch (error) {
      console.error("Error fetching lookup data:", error);
      return NextResponse.json(
        { error: "Failed to fetch lookup data" },
        { status: 500 }
      );
    }
  },
  { resource: "asset.my-inventory", action: "view" }
);

// POST create new lookup item (category, sub-category, group, or lifecycle status)
export const POST = withAuth(
  async (req, context, session) => {
    try {
      const body = await req.json();
      const { type, name, categoryId, status } = body;

      if (!name?.trim()) {
        return NextResponse.json(
          { error: "Name is required" },
          { status: 400 }
        );
      }

      if (!type || !["category", "subCategory", "group", "lifecycleStatus"].includes(type)) {
        return NextResponse.json(
          { error: "Invalid type. Must be: category, subCategory, group, or lifecycleStatus" },
          { status: 400 }
        );
      }

      const customerAccountId = getCustomerAccountId(session);

      let result;

      switch (type) {
        case "category":
          // Check for duplicate
          const existingCat = await prisma.assetCategory.findFirst({
            where: { name: name.trim(), customerAccountId },
          });
          if (existingCat) {
            return NextResponse.json({ error: "Category already exists" }, { status: 400 });
          }
          result = await prisma.assetCategory.create({
            data: {
              customerAccountId,
              name: name.trim(),
              status: status || "Active",
            },
          });
          break;

        case "subCategory":
          if (!categoryId) {
            return NextResponse.json({ error: "Category ID is required for sub-category" }, { status: 400 });
          }
          // Check for duplicate
          const existingSubCat = await prisma.assetSubCategory.findFirst({
            where: { name: name.trim(), categoryId, customerAccountId },
          });
          if (existingSubCat) {
            return NextResponse.json({ error: "Sub-category already exists" }, { status: 400 });
          }
          result = await prisma.assetSubCategory.create({
            data: {
              customerAccountId,
              name: name.trim(),
              categoryId,
              status: status || "Active",
            },
            include: { category: true },
          });
          break;

        case "group":
          // Check for duplicate
          const existingGroup = await prisma.assetGroup.findFirst({
            where: { name: name.trim(), customerAccountId },
          });
          if (existingGroup) {
            return NextResponse.json({ error: "Group already exists" }, { status: 400 });
          }
          result = await prisma.assetGroup.create({
            data: {
              customerAccountId,
              name: name.trim(),
            },
          });
          break;

        case "lifecycleStatus":
          // Check for duplicate
          const existingStatus = await prisma.assetLifecycleStatus.findFirst({
            where: { name: name.trim(), customerAccountId },
          });
          if (existingStatus) {
            return NextResponse.json({ error: "Lifecycle status already exists" }, { status: 400 });
          }
          // Get max order
          const maxOrder = await prisma.assetLifecycleStatus.findFirst({
            where: { customerAccountId },
            orderBy: { order: "desc" },
          });
          result = await prisma.assetLifecycleStatus.create({
            data: {
              customerAccountId,
              name: name.trim(),
              order: (maxOrder?.order || 0) + 1,
            },
          });
          break;
      }

      return NextResponse.json({ type, data: result }, { status: 201 });
    } catch (error) {
      console.error("Error creating lookup item:", error);
      return NextResponse.json(
        { error: "Failed to create item" },
        { status: 500 }
      );
    }
  },
  { resource: "asset.my-inventory", action: "create" }
);
