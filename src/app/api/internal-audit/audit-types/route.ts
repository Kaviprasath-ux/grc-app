import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth, getTenantFilter, getCustomerAccountId } from "@/lib/api-auth";

// GET all audit types
// Requires 'edit' action so only AuditHead can access (CustomerAdmin has only 'view')
export const GET = withAuth(
  async (req: NextRequest, context, session) => {
    try {
      const tenantFilter = getTenantFilter(session);

      const auditTypes = await prisma.auditType.findMany({
        where: tenantFilter,
        include: {
          _count: {
            select: { internalAuditRisks: true },
          },
        },
        orderBy: { name: "asc" },
      });

      return NextResponse.json(auditTypes);
    } catch (error) {
      console.error("Error fetching audit types:", error);
      return NextResponse.json(
        { error: "Failed to fetch audit types" },
        { status: 500 }
      );
    }
  },
  { resource: "audit.settings", action: "edit" }
);

// POST create a new audit type
export const POST = withAuth(
  async (req: NextRequest, context, session) => {
    try {
      const customerAccountId = getCustomerAccountId(session);
      const body = await req.json();
      const { name } = body;

      if (!name) {
        return NextResponse.json(
          { error: "Audit type name is required" },
          { status: 400 }
        );
      }

      // Check for duplicate within the same tenant
      const tenantFilter = getTenantFilter(session);
      const existing = await prisma.auditType.findFirst({
        where: {
          name,
          ...tenantFilter,
        },
      });

      if (existing) {
        return NextResponse.json(
          { error: "Audit type with this name already exists" },
          { status: 400 }
        );
      }

      const auditType = await prisma.auditType.create({
        data: {
          name,
          customerAccountId,
        },
      });

      return NextResponse.json(auditType, { status: 201 });
    } catch (error) {
      console.error("Error creating audit type:", error);
      return NextResponse.json(
        { error: "Failed to create audit type" },
        { status: 500 }
      );
    }
  },
  { resource: "audit.settings", action: "create" }
);
