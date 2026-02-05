import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth, getTenantFilter, getCustomerAccountId } from "@/lib/api-auth";

// GET all organization-level nature of implementations (auditHeadId = null)
export const GET = withAuth(
  async (req: NextRequest, context, session) => {
    try {
      const tenantFilter = getTenantFilter(session);

      const implementations = await prisma.natureOfImplementation.findMany({
        where: { ...tenantFilter, auditHeadId: null },
        orderBy: { name: "asc" },
      });

      return NextResponse.json(implementations);
    } catch (error) {
      console.error("Error fetching nature of implementations:", error);
      return NextResponse.json(
        { error: "Failed to fetch nature of implementations" },
        { status: 500 }
      );
    }
  },
  { resource: "organization.process", action: "view" }
);

// POST create a new organization-level nature of implementation
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

      // Check for duplicate within the same tenant (org-level, no auditHeadId)
      const existing = await prisma.natureOfImplementation.findFirst({
        where: {
          name,
          customerAccountId,
          auditHeadId: null,
        },
      });

      if (existing) {
        return NextResponse.json(
          { error: "Nature of implementation with this name already exists" },
          { status: 400 }
        );
      }

      const implementation = await prisma.natureOfImplementation.create({
        data: {
          name,
          customerAccountId,
          auditHeadId: null,
        },
      });

      return NextResponse.json(implementation, { status: 201 });
    } catch (error) {
      console.error("Error creating nature of implementation:", error);
      return NextResponse.json(
        { error: "Failed to create nature of implementation" },
        { status: 500 }
      );
    }
  },
  { resource: "organization.settings", action: "create" }
);
