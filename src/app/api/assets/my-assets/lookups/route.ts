import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth, getTenantFilter } from "@/lib/api-auth";

// GET all lookup data for my-assets page (categories, sub-categories, groups, lifecycle statuses, departments, users, classifications, sensitivities)
// NOTE: Many asset lookup models don't have customerAccountId yet - tenant filtering disabled for those models
export const GET = withAuth(
  async (req, context, session) => {
    try {
      const tenantFilter = getTenantFilter(session);

      const [categories, subCategories, groups, lifecycleStatuses, departments, users, classifications, sensitivities] = await Promise.all([
        // AssetCategory has customerAccountId
        prisma.assetCategory.findMany({
          where: tenantFilter as Record<string, unknown>,
          orderBy: { name: "asc" },
        }),
        // AssetSubCategory doesn't have customerAccountId - no tenant filter
        prisma.assetSubCategory.findMany({
          include: { category: true },
          orderBy: { name: "asc" },
        }),
        // AssetGroup doesn't have customerAccountId - no tenant filter
        prisma.assetGroup.findMany({
          orderBy: { name: "asc" },
        }),
        // AssetLifecycleStatus doesn't have customerAccountId - no tenant filter
        prisma.assetLifecycleStatus.findMany({
          orderBy: { order: "asc" },
        }),
        // Department has customerAccountId
        prisma.department.findMany({
          where: tenantFilter as Record<string, unknown>,
          orderBy: { name: "asc" },
        }),
        // User has customerAccountId
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
        // AssetClassification doesn't have customerAccountId - no tenant filter
        prisma.assetClassification.findMany({
          orderBy: { name: "asc" },
        }),
        // AssetSensitivity doesn't have customerAccountId - no tenant filter
        prisma.assetSensitivity.findMany({
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
// NOTE: Many asset lookup models don't have customerAccountId yet - tenant filtering disabled for those models
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

      // Get customerAccountId for models that support it
      const customerAccountId = session.customerAccountId;

      let result;

      switch (type) {
        case "category":
          // AssetCategory has customerAccountId
          // Check for duplicate
          const existingCat = await prisma.assetCategory.findFirst({
            where: { name: name.trim(), ...(customerAccountId ? { customerAccountId } : {}) },
          });
          if (existingCat) {
            return NextResponse.json({ error: "Category already exists" }, { status: 400 });
          }
          result = await prisma.assetCategory.create({
            data: {
              ...(customerAccountId ? { customerAccountId } : {}),
              name: name.trim(),
              status: status || "Active",
            },
          });
          break;

        case "subCategory":
          // AssetSubCategory doesn't have customerAccountId
          if (!categoryId) {
            return NextResponse.json({ error: "Category ID is required for sub-category" }, { status: 400 });
          }
          // Check for duplicate
          const existingSubCat = await prisma.assetSubCategory.findFirst({
            where: { name: name.trim(), categoryId },
          });
          if (existingSubCat) {
            return NextResponse.json({ error: "Sub-category already exists" }, { status: 400 });
          }
          result = await prisma.assetSubCategory.create({
            data: {
              name: name.trim(),
              categoryId,
              status: status || "Active",
            },
            include: { category: true },
          });
          break;

        case "group":
          // AssetGroup doesn't have customerAccountId
          // Check for duplicate
          const existingGroup = await prisma.assetGroup.findFirst({
            where: { name: name.trim() },
          });
          if (existingGroup) {
            return NextResponse.json({ error: "Group already exists" }, { status: 400 });
          }
          result = await prisma.assetGroup.create({
            data: {
              name: name.trim(),
            },
          });
          break;

        case "lifecycleStatus":
          // AssetLifecycleStatus doesn't have customerAccountId
          // Check for duplicate
          const existingStatus = await prisma.assetLifecycleStatus.findFirst({
            where: { name: name.trim() },
          });
          if (existingStatus) {
            return NextResponse.json({ error: "Lifecycle status already exists" }, { status: 400 });
          }
          // Get max order
          const maxOrder = await prisma.assetLifecycleStatus.findFirst({
            orderBy: { order: "desc" },
          });
          result = await prisma.assetLifecycleStatus.create({
            data: {
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
