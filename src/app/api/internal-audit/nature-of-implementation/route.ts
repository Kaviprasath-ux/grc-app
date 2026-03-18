import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth, getTenantFilter, getCustomerAccountId, getAuditHeadFilter, getAuditHeadId, resolveAuditHeadIdForCreate } from "@/lib/api-auth";

// GET all nature of implementations - filtered by audit head
export const GET = withAuth(
  async (req: NextRequest, context, session) => {
    try {
      const tenantFilter = getTenantFilter(session);
      const auditHeadFilter = getAuditHeadFilter(session);

      const implementations = await prisma.natureOfImplementation.findMany({
        where: { ...tenantFilter, ...auditHeadFilter },
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
  { resource: "audit.settings", action: "view" }
);

// POST create a new nature of implementation - assigned to current audit head
export const POST = withAuth(
  async (req: NextRequest, context, session) => {
    try {
      const customerAccountId = getCustomerAccountId(session);
      const auditHeadId = await resolveAuditHeadIdForCreate(session);
      const body = await req.json();
      const { name } = body;

      if (!name) {
        return NextResponse.json(
          { error: "Name is required" },
          { status: 400 }
        );
      }

      // Check for duplicate within the same audit head's settings
      const existing = await prisma.natureOfImplementation.findFirst({
        where: {
          name,
          auditHeadId,
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
          auditHeadId,
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
  { resource: "audit.settings", action: "create" }
);
