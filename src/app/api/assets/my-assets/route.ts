import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth, getTenantFilter, getCustomerAccountId } from "@/lib/api-auth";

// GET assets owned by the current user
export const GET = withAuth(
  async (req, context, session) => {
    try {
      const tenantFilter = getTenantFilter(session);
      const currentUserId = session.id;

      const assets = await prisma.asset.findMany({
        where: {
          ...tenantFilter,
          ownerId: currentUserId, // Only return assets owned by the current user
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
        orderBy: { assetId: "asc" },
      });
      return NextResponse.json(assets);
    } catch (error) {
      console.error("Error fetching my assets:", error);
      return NextResponse.json(
        { error: "Failed to fetch assets" },
        { status: 500 }
      );
    }
  },
  { resource: "asset.my-inventory", action: "view" }
);

// POST create new asset owned by current user
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

      if (!name) {
        return NextResponse.json(
          { error: "Asset name is required" },
          { status: 400 }
        );
      }

      // Get customer account ID for the new record
      const customerAccountId = getCustomerAccountId(session);
      const currentUserId = session.id;

      // Generate unique asset ID if not provided or if it already exists
      let finalAssetId = assetId;
      if (finalAssetId) {
        // Check if asset ID already exists within the tenant
        const existingAsset = await prisma.asset.findFirst({
          where: { assetId: finalAssetId, customerAccountId },
        });

        if (existingAsset) {
          // Generate a new unique ID
          finalAssetId = null;
        }
      }

      if (!finalAssetId) {
        // Generate next sequential asset ID
        const lastAsset = await prisma.asset.findFirst({
          where: { customerAccountId },
          orderBy: { assetId: 'desc' },
        });

        let nextNum = 1;
        if (lastAsset?.assetId) {
          const match = lastAsset.assetId.match(/ASSET(\d+)/);
          if (match) {
            nextNum = parseInt(match[1]) + 1;
          }
        }
        finalAssetId = `ASSET${String(nextNum).padStart(4, "0")}`;

        // Ensure uniqueness by checking again
        let exists = await prisma.asset.findFirst({
          where: { assetId: finalAssetId, customerAccountId },
        });
        while (exists) {
          nextNum++;
          finalAssetId = `ASSET${String(nextNum).padStart(4, "0")}`;
          exists = await prisma.asset.findFirst({
            where: { assetId: finalAssetId, customerAccountId },
          });
        }
      }

      const asset = await prisma.asset.create({
        data: {
          customerAccountId,
          assetId: finalAssetId,
          name,
          description: description || null,
          assetType: assetType || null,
          categoryId: categoryId || null,
          subCategoryId: subCategoryId || null,
          groupId: groupId || null,
          departmentId: departmentId || null,
          ownerId: currentUserId, // Always set owner to current user
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
  { resource: "asset.my-inventory", action: "create" }
);
