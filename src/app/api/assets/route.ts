import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth, getTenantFilter, getCustomerAccountId } from "@/lib/api-auth";

// GET all assets - filtered by customer account
export const GET = withAuth(
  async (req, context, session) => {
    try {
      const tenantFilter = getTenantFilter(session);

      const assets = await prisma.asset.findMany({
        where: tenantFilter,
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
        orderBy: { assetId: "asc" },
      });
      return NextResponse.json(assets);
    } catch (error) {
      console.error("Error fetching assets:", error);
      return NextResponse.json(
        { error: "Failed to fetch assets" },
        { status: 500 }
      );
    }
  },
  { resource: "asset.inventory", action: "view" }
);

// POST create new asset - with customer account assignment
export const POST = withAuth(
  async (req, context, session) => {
    try {
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

      if (!assetId || !name) {
        return NextResponse.json(
          { error: "Asset ID and name are required" },
          { status: 400 }
        );
      }

      // Get customer account ID for the new record
      const customerAccountId = getCustomerAccountId(session);

      // Check if asset ID already exists within the tenant
      const existingAsset = await prisma.asset.findFirst({
        where: { assetId, customerAccountId },
      });

      if (existingAsset) {
        return NextResponse.json(
          { error: "Asset ID already exists" },
          { status: 400 }
        );
      }

      const asset = await prisma.asset.create({
        data: {
          customerAccountId,
          assetId,
          name,
          description: description || null,
          assetType: assetType || null,
          categoryId: categoryId || null,
          subCategoryId: subCategoryId || null,
          groupId: groupId || null,
          departmentId: departmentId || null,
          ownerId: ownerId || null,
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

      return NextResponse.json(asset, { status: 201 });
    } catch (error) {
      console.error("Error creating asset:", error);
      return NextResponse.json(
        { error: "Failed to create asset" },
        { status: 500 }
      );
    }
  },
  { resource: "asset.inventory", action: "create" }
);
