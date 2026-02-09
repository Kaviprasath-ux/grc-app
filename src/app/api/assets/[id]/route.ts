import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth, getTenantFilter, validateTenantAccess, forbidden } from "@/lib/api-auth";
import { notificationService } from "@/lib/notification-service";

interface RouteContext {
  params: Promise<{ id: string }>;
}

const assetIncludes = {
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
};

// GET single asset - filtered by customer account
export const GET = withAuth(
  async (req, context: RouteContext, session) => {
    try {
      const { id } = await context.params;
      const tenantFilter = getTenantFilter(session);

      const asset = await prisma.asset.findFirst({
        where: { id, ...tenantFilter },
        include: assetIncludes,
      });

      if (!asset) {
        return NextResponse.json(
          { error: "Asset not found" },
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
  { resource: "asset.inventory", action: "view" }
);

// PUT update asset - with tenant validation
export const PUT = withAuth(
  async (req, context: RouteContext, session) => {
    try {
      const { id } = await context.params;
      const body = await req.json();
      const {
        assetId,
        name,
        description,
        assetType,
        categoryId,
        subCategoryId,
        groupId,
        departmentId,
        ownerId,
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

      // Check if asset exists and verify tenant access
      const existingAsset = await prisma.asset.findUnique({
        where: { id },
        select: { customerAccountId: true, assetId: true, name: true, description: true, assetType: true, categoryId: true, subCategoryId: true, groupId: true, departmentId: true, ownerId: true, custodianId: true, classificationId: true, sensitivityId: true, lifecycleStatusId: true, status: true, value: true, location: true, acquisitionDate: true, nextReviewDate: true },
      });

      if (!existingAsset) {
        return NextResponse.json(
          { error: "Asset not found" },
          { status: 404 }
        );
      }

      if (!validateTenantAccess(session, existingAsset.customerAccountId)) {
        return forbidden("Access denied to this asset");
      }

      // Check if new assetId conflicts with another asset within the tenant
      if (assetId && assetId !== existingAsset.assetId) {
        const conflictingAsset = await prisma.asset.findFirst({
          where: { assetId, customerAccountId: existingAsset.customerAccountId },
        });
        if (conflictingAsset) {
          return NextResponse.json(
            { error: "Asset ID already exists" },
            { status: 400 }
          );
        }
      }

      const asset = await prisma.asset.update({
        where: { id },
        data: {
          assetId: assetId || existingAsset.assetId,
          name: name || existingAsset.name,
          description: description !== undefined ? description : existingAsset.description,
          assetType: assetType !== undefined ? assetType : existingAsset.assetType,
          categoryId: categoryId !== undefined ? (categoryId || null) : existingAsset.categoryId,
          subCategoryId: subCategoryId !== undefined ? (subCategoryId || null) : existingAsset.subCategoryId,
          groupId: groupId !== undefined ? (groupId || null) : existingAsset.groupId,
          departmentId: departmentId !== undefined ? (departmentId || null) : existingAsset.departmentId,
          ownerId: ownerId !== undefined ? (ownerId || null) : existingAsset.ownerId,
          custodianId: custodianId !== undefined ? (custodianId || null) : existingAsset.custodianId,
          classificationId: classificationId !== undefined ? (classificationId || null) : existingAsset.classificationId,
          sensitivityId: sensitivityId !== undefined ? (sensitivityId || null) : existingAsset.sensitivityId,
          lifecycleStatusId: lifecycleStatusId !== undefined ? (lifecycleStatusId || null) : existingAsset.lifecycleStatusId,
          status: status || existingAsset.status,
          value: value !== undefined ? (value ? parseFloat(value) : null) : existingAsset.value,
          location: location !== undefined ? location : existingAsset.location,
          acquisitionDate: acquisitionDate !== undefined
            ? (acquisitionDate ? new Date(acquisitionDate) : null)
            : existingAsset.acquisitionDate,
          nextReviewDate: nextReviewDate !== undefined
            ? (nextReviewDate ? new Date(nextReviewDate) : null)
            : existingAsset.nextReviewDate,
        },
        include: assetIncludes,
      });

      // Notify new owner if changed and different from current user
      const newOwnerId = ownerId !== undefined ? (ownerId || null) : existingAsset.ownerId;
      if (newOwnerId && newOwnerId !== existingAsset.ownerId && newOwnerId !== session.id && session.customerAccountId) {
        await notificationService.notifyAssetAssigned({
          customerAccountId: session.customerAccountId,
          actorId: session.id,
          ownerId: newOwnerId,
          assetId: asset.id,
          assetCode: asset.assetId,
          assetName: asset.name,
          role: 'owner',
        });
      }
      // Notify new custodian if changed and different from current user
      const newCustodianId = custodianId !== undefined ? (custodianId || null) : existingAsset.custodianId;
      if (newCustodianId && newCustodianId !== existingAsset.custodianId && newCustodianId !== session.id && session.customerAccountId) {
        await notificationService.notifyAssetAssigned({
          customerAccountId: session.customerAccountId,
          actorId: session.id,
          ownerId: newCustodianId,
          assetId: asset.id,
          assetCode: asset.assetId,
          assetName: asset.name,
          role: 'custodian',
        });
      }

      return NextResponse.json(asset);
    } catch (error) {
      console.error("Error updating asset:", error);
      return NextResponse.json(
        { error: "Failed to update asset" },
        { status: 500 }
      );
    }
  },
  { resource: "asset.inventory", action: "edit" }
);

// DELETE asset - with tenant validation
export const DELETE = withAuth(
  async (req, context: RouteContext, session) => {
    try {
      const { id } = await context.params;

      // Check if asset exists and verify tenant access
      const existingAsset = await prisma.asset.findUnique({
        where: { id },
        select: { customerAccountId: true },
      });

      if (!existingAsset) {
        return NextResponse.json(
          { error: "Asset not found" },
          { status: 404 }
        );
      }

      if (!validateTenantAccess(session, existingAsset.customerAccountId)) {
        return forbidden("Access denied to this asset");
      }

      await prisma.asset.delete({
        where: { id },
      });

      return NextResponse.json({ message: "Asset deleted successfully" });
    } catch (error) {
      console.error("Error deleting asset:", error);
      return NextResponse.json(
        { error: "Failed to delete asset" },
        { status: 500 }
      );
    }
  },
  { resource: "asset.inventory", action: "delete" }
);
