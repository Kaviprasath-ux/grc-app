import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET all assets
export async function GET() {
  try {
    const assets = await prisma.asset.findMany({
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
}

// POST create new asset
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
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

    // Check if asset ID already exists
    const existingAsset = await prisma.asset.findUnique({
      where: { assetId },
    });

    if (existingAsset) {
      return NextResponse.json(
        { error: "Asset ID already exists" },
        { status: 400 }
      );
    }

    const asset = await prisma.asset.create({
      data: {
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
}
