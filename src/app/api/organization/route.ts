import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// GET organization profile
export async function GET() {
  try {
    const organization = await prisma.organization.findFirst();
    if (!organization) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }
    return NextResponse.json(organization);
  } catch (error) {
    console.error("Error fetching organization:", error);
    return NextResponse.json({ error: "Failed to fetch organization" }, { status: 500 });
  }
}

// PUT update organization
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      name,
      establishedDate,
      employeeCount,
      branchCount,
      headOfficeLocation,
      headOfficeAddress,
      website,
      description,
      vision,
      mission,
    } = body;

    const organization = await prisma.organization.findFirst();
    if (!organization) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    const updated = await prisma.organization.update({
      where: { id: organization.id },
      data: {
        name,
        establishedDate,
        employeeCount,
        branchCount,
        headOfficeLocation,
        headOfficeAddress,
        website,
        description,
        vision,
        mission,
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Error updating organization:", error);
    return NextResponse.json({ error: "Failed to update organization" }, { status: 500 });
  }
}
