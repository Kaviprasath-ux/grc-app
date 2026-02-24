import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth, getTenantFilter, getCustomerAccountId } from "@/lib/api-auth";
import { translateRecord } from '@/lib/translation-service';

// GET all user document types
export const GET = withAuth(
  async (req: NextRequest, context, session) => {
    try {
      const tenantFilter = getTenantFilter(session);

      const types = await prisma.userDocumentType.findMany({
        where: { ...tenantFilter },
        orderBy: { name: "asc" },
      });

      return NextResponse.json(types);
    } catch (error) {
      console.error("Error fetching user document types:", error);
      return NextResponse.json(
        { error: "Failed to fetch user document types" },
        { status: 500 }
      );
    }
  },
  { resource: "organization.settings", action: "view" }
);

// POST create a new user document type
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
      const existing = await prisma.userDocumentType.findFirst({
        where: {
          name,
          customerAccountId,
        },
      });

      if (existing) {
        return NextResponse.json(
          { error: "User document type with this name already exists" },
          { status: 400 }
        );
      }

      const docType = await prisma.userDocumentType.create({
        data: {
          name,
          customerAccountId,
        },
      });

      if (customerAccountId) void translateRecord(customerAccountId, 'UserDocumentType', docType.id, { name: docType.name });

      return NextResponse.json(docType, { status: 201 });
    } catch (error) {
      console.error("Error creating user document type:", error);
      return NextResponse.json(
        { error: "Failed to create user document type" },
        { status: 500 }
      );
    }
  },
  { resource: "organization.settings", action: "create" }
);
