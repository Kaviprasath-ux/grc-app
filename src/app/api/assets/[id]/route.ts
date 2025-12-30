import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

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

// GET single asset
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const asset = await prisma.asset.findUnique({
      where: { id },
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
}

// PUT update asset
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
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

    // Check if asset exists
    const existingAsset = await prisma.asset.findUnique({
      where: { id },
    });

    if (!existingAsset) {
      return NextResponse.json(
        { error: "Asset not found" },
        { status: 404 }
      );
    }

    // Check if new assetId conflicts with another asset
    if (assetId && assetId !== existingAsset.assetId) {
      const conflictingAsset = await prisma.asset.findUnique({
        where: { assetId },
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

    return NextResponse.json(asset);
  } catch (error) {
    console.error("Error updating asset:", error);
    return NextResponse.json(
      { error: "Failed to update asset" },
      { status: 500 }
    );
  }
}

// DELETE asset
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Check if asset exists
    const existingAsset = await prisma.asset.findUnique({
      where: { id },
    });

    if (!existingAsset) {
      return NextResponse.json(
        { error: "Asset not found" },
        { status: 404 }
      );
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
}
