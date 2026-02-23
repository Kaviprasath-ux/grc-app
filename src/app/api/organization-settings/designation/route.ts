import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth, getTenantFilter, getCustomerAccountId } from "@/lib/api-auth";
import { translateRecord } from '@/lib/translation-service';

// GET all designations
export const GET = withAuth(
  async (req: NextRequest, context, session) => {
    try {
      const tenantFilter = getTenantFilter(session);

      const designations = await prisma.designation.findMany({
        where: { ...tenantFilter },
        orderBy: { name: "asc" },
      });

      return NextResponse.json(designations);
    } catch (error) {
      console.error("Error fetching designations:", error);
      return NextResponse.json(
        { error: "Failed to fetch designations" },
        { status: 500 }
      );
    }
  },
  { resource: "organization.settings", action: "view" }
);

// POST create a new designation
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
      const existing = await prisma.designation.findFirst({
        where: {
          name,
          customerAccountId,
        },
      });

      if (existing) {
        return NextResponse.json(
          { error: "Designation with this name already exists" },
          { status: 400 }
        );
      }

      const designation = await prisma.designation.create({
        data: {
          name,
          customerAccountId,
        },
      });

      if (customerAccountId) void translateRecord(customerAccountId, 'Designation', designation.id, { name: designation.name });

      return NextResponse.json(designation, { status: 201 });
    } catch (error) {
      console.error("Error creating designation:", error);
      return NextResponse.json(
        { error: "Failed to create designation" },
        { status: 500 }
      );
    }
  },
  { resource: "organization.settings", action: "create" }
);
