import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth, getTenantFilter, getCustomerAccountId } from "@/lib/api-auth";

// GET all audit categories
// Requires 'edit' action so only AuditHead can access (CustomerAdmin has only 'view')
export const GET = withAuth(
  async (req: NextRequest, context, session) => {
    try {
      const tenantFilter = getTenantFilter(session);

      const categories = await prisma.auditCategory.findMany({
        where: tenantFilter,
        include: {
          _count: {
            select: { internalAuditRisks: true },
          },
        },
        orderBy: { name: "asc" },
      });

      return NextResponse.json(categories);
    } catch (error) {
      console.error("Error fetching audit categories:", error);
      return NextResponse.json(
        { error: "Failed to fetch audit categories" },
        { status: 500 }
      );
    }
  },
  { resource: "audit.settings", action: "edit" }
);

// POST create a new audit category
export const POST = withAuth(
  async (req: NextRequest, context, session) => {
    try {
      const customerAccountId = getCustomerAccountId(session);
      const body = await req.json();
      const { name } = body;

      if (!name) {
        return NextResponse.json(
          { error: "Category name is required" },
          { status: 400 }
        );
      }

      // Check for duplicate within the same tenant
      const tenantFilter = getTenantFilter(session);
      const existing = await prisma.auditCategory.findFirst({
        where: {
          name,
          ...tenantFilter,
        },
      });

      if (existing) {
        return NextResponse.json(
          { error: "Category with this name already exists" },
          { status: 400 }
        );
      }

      const category = await prisma.auditCategory.create({
        data: {
          name,
          customerAccountId,
        },
      });

      return NextResponse.json(category, { status: 201 });
    } catch (error) {
      console.error("Error creating audit category:", error);
      return NextResponse.json(
        { error: "Failed to create audit category" },
        { status: 500 }
      );
    }
  },
  { resource: "audit.settings", action: "create" }
);
