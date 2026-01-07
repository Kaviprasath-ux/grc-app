import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// GET organization profile with related data
export async function GET() {
  try {
    const organization = await prisma.organization.findFirst({
      include: {
        branches: true,
        dataCenters: true,
        cloudProviders: true,
      },
    });
    // Return null if no organization exists (allows frontend to show "New Profile" button)
    if (!organization) {
      return NextResponse.json(null);
    }
    return NextResponse.json(organization);
  } catch (error) {
    console.error("Error fetching organization:", error);
    return NextResponse.json({ error: "Failed to fetch organization" }, { status: 500 });
  }
}

// PUT create or update organization with all related data
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      name,
      email,
      phone,
      logo,
      establishedDate,
      employeeCount,
      branchCount,
      headOfficeLocation,
      headOfficeAddress,
      website,
      description,
      vision,
      mission,
      value,
      ceoMessage,
      facebook,
      youtube,
      twitter,
      linkedin,
      brochure,
      branches,
      dataCenters,
      cloudProviders,
    } = body;

    const existingOrg = await prisma.organization.findFirst();

    // Create or update organization and related data in a transaction
    const result = await prisma.$transaction(async (tx) => {
      let organizationId: string;

      if (existingOrg) {
        // Update existing organization
        await tx.organization.update({
          where: { id: existingOrg.id },
          data: {
            name,
            email,
            phone,
            logo,
            establishedDate,
            employeeCount,
            branchCount,
            headOfficeLocation,
            headOfficeAddress,
            website,
            description,
            vision,
            mission,
            value,
            ceoMessage,
            facebook,
            youtube,
            twitter,
            linkedin,
            brochure,
          },
        });
        organizationId = existingOrg.id;
      } else {
        // Create new organization
        const newOrg = await tx.organization.create({
          data: {
            name: name || "New Organization",
            email,
            phone,
            logo,
            establishedDate,
            employeeCount: employeeCount || 0,
            branchCount: branchCount || 0,
            headOfficeLocation,
            headOfficeAddress,
            website,
            description,
            vision,
            mission,
            value,
            ceoMessage,
            facebook,
            youtube,
            twitter,
            linkedin,
            brochure,
          },
        });
        organizationId = newOrg.id;
      }

      // Update branches - delete existing and create new ones
      if (branches !== undefined) {
        await tx.branch.deleteMany({
          where: { organizationId },
        });
        if (branches.length > 0) {
          await tx.branch.createMany({
            data: branches.map((branch: { location: string; address: string }) => ({
              location: branch.location,
              address: branch.address,
              organizationId,
            })),
          });
        }
      }

      // Update data centers - delete existing and create new ones
      if (dataCenters !== undefined) {
        await tx.dataCenter.deleteMany({
          where: { organizationId },
        });
        if (dataCenters.length > 0) {
          await tx.dataCenter.createMany({
            data: dataCenters.map((dc: { locationType: string; address?: string; vendor?: string }) => ({
              locationType: dc.locationType,
              address: dc.address || null,
              vendor: dc.vendor || null,
              organizationId,
            })),
          });
        }
      }

      // Update cloud providers - delete existing and create new ones
      if (cloudProviders !== undefined) {
        await tx.cloudProvider.deleteMany({
          where: { organizationId },
        });
        if (cloudProviders.length > 0) {
          await tx.cloudProvider.createMany({
            data: cloudProviders.map((cp: { name: string; serviceType: string }) => ({
              name: cp.name,
              serviceType: cp.serviceType,
              organizationId,
            })),
          });
        }
      }

      // Fetch the organization with relations
      return await tx.organization.findUnique({
        where: { id: organizationId },
        include: {
          branches: true,
          dataCenters: true,
          cloudProviders: true,
        },
      });
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error saving organization:", error);
    return NextResponse.json({ error: "Failed to save organization" }, { status: 500 });
  }
}
