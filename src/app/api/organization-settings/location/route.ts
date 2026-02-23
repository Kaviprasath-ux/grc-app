import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth, getTenantFilter, getCustomerAccountId } from "@/lib/api-auth";
import { translateRecord } from '@/lib/translation-service';

// GET all organization locations - accessible to anyone who can view processes
export const GET = withAuth(
  async (req: NextRequest, context, session) => {
    try {
      const tenantFilter = getTenantFilter(session);

      const locations = await prisma.organizationLocation.findMany({
        where: { ...tenantFilter },
        orderBy: { name: "asc" },
      });

      return NextResponse.json(locations);
    } catch (error) {
      console.error("Error fetching organization locations:", error);
      return NextResponse.json(
        { error: "Failed to fetch locations" },
        { status: 500 }
      );
    }
  },
  { resource: "organization.process", action: "view" }
);

// POST create a new organization location
export const POST = withAuth(
  async (req: NextRequest, context, session) => {
    try {
      const customerAccountId = getCustomerAccountId(session);
      const body = await req.json();
      const { name } = body;

      if (!name) {
        return NextResponse.json(
          { error: "Name is required" },
          { status: 400 }
        );
      }

      // Check for duplicate within the same tenant
      const existing = await prisma.organizationLocation.findFirst({
        where: {
          name,
          customerAccountId,
        },
      });

      if (existing) {
        return NextResponse.json(
          { error: "Location with this name already exists" },
          { status: 400 }
        );
      }

      const location = await prisma.organizationLocation.create({
        data: {
          name,
          customerAccountId,
        },
      });

      if (customerAccountId) void translateRecord(customerAccountId, 'OrganizationLocation', location.id, { name: location.name });

      return NextResponse.json(location, { status: 201 });
    } catch (error) {
      console.error("Error creating organization location:", error);
      return NextResponse.json(
        { error: "Failed to create location" },
        { status: 500 }
      );
    }
  },
  { resource: "organization.settings", action: "create" }
);
