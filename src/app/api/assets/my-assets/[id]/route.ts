import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth, getTenantFilter } from "@/lib/api-auth";

interface RouteContext {
  params: Promise<{ id: string }>;
}

// GET single asset owned by current user
export const GET = withAuth(
  async (req, context: RouteContext, session) => {
    try {
      const { id } = await context.params;
      const tenantFilter = getTenantFilter(session);
      const currentUserId = session.id;

      const asset = await prisma.asset.findFirst({
        where: {
          id,
          ...tenantFilter,
          ownerId: currentUserId, // Only allow access to owned assets
        },
        include: {
          category: true,
          subCategory: {
            include: {
              category: true,
            },
          },
          group: true,
          department: true,
          owner: true,
          custodian: true,
          classification: true,
          sensitivity: true,
          lifecycleStatus: true,
        },
      });

      if (!asset) {
        return NextResponse.json(
          { error: "Asset not found or you don't have access" },
          { status: 404 }
        );
      }

      return NextResponse.json(asset);
    } catch (error) {
      console.error("Error fetching asset:", error);
      return NextResponse.json(
        { error: "Failed to fetch asset" },
        { status: 500 }
      );
    }
  },
  { resource: "asset.my-inventory", action: "view" }
);

// PUT update asset owned by current user
export const PUT = withAuth(
  async (req, context: RouteContext, session) => {
    try {
      const { id } = await context.params;
      const tenantFilter = getTenantFilter(session);
      const currentUserId = session.id;

      // First check if the asset exists and is owned by current user
      const existingAsset = await prisma.asset.findFirst({
        where: {
          id,
          ...tenantFilter,
          ownerId: currentUserId,
        },
      });

      if (!existingAsset) {
        return NextResponse.json(
          { error: "Asset not found or you don't have permission to edit" },
          { status: 404 }
        );
      }

      const body = await req.json();
      const {
        name,
        description,
        assetType,
        categoryId,
        subCategoryId,
        groupId,
        departmentId,
        custodianId,
        classificationId,
        sensitivityId,
        lifecycleStatusId,
        status,
        value,
        location,
        acquisitionDate,
        nextReviewDate,
      } = body;

      const asset = await prisma.asset.update({
        where: { id },
        data: {
          name,
          description: description || null,
          assetType: assetType || null,
          categoryId: categoryId || null,
          subCategoryId: subCategoryId || null,
          groupId: groupId || null,
          departmentId: departmentId || null,
          // ownerId stays the same - user cannot change ownership
          custodianId: custodianId || null,
          classificationId: classificationId || null,
          sensitivityId: sensitivityId || null,
          lifecycleStatusId: lifecycleStatusId || null,
          status: status || "Active",
          value: value ? parseFloat(value) : null,
          location: location || null,
          acquisitionDate: acquisitionDate ? new Date(acquisitionDate) : null,
          nextReviewDate: nextReviewDate ? new Date(nextReviewDate) : null,
        },
        include: {
          category: true,
          subCategory: {
            include: {
              category: true,
            },
          },
          group: true,
          department: true,
          owner: true,
          custodian: true,
          classification: true,
          sensitivity: true,
          lifecycleStatus: true,
        },
      });

      return NextResponse.json(asset);
    } catch (error) {
      console.error("Error updating asset:", error);
      return NextResponse.json(
        { error: "Failed to update asset" },
        { status: 500 }
      );
    }
  },
  { resource: "asset.my-inventory", action: "edit" }
);

// DELETE asset owned by current user
export const DELETE = withAuth(
  async (req, context: RouteContext, session) => {
    try {
      const { id } = await context.params;
      const tenantFilter = getTenantFilter(session);
      const currentUserId = session.id;

      // First check if the asset exists and is owned by current user
      const existingAsset = await prisma.asset.findFirst({
        where: {
          id,
          ...tenantFilter,
          ownerId: currentUserId,
        },
      });

      if (!existingAsset) {
        return NextResponse.json(
          { error: "Asset not found or you don't have permission to delete" },
          { status: 404 }
        );
      }

      await prisma.asset.delete({
        where: { id },
      });

      return NextResponse.json({ success: true });
    } catch (error) {
      console.error("Error deleting asset:", error);
      return NextResponse.json(
        { error: "Failed to delete asset" },
        { status: 500 }
      );
    }
  },
  { resource: "asset.my-inventory", action: "delete" }
);
