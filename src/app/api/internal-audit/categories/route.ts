import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth, getTenantFilter, getAuditHeadId } from "@/lib/api-auth";

// GET all audit categories
// Multi-tenant: Filter by customerAccountId and auditHeadId
export const GET = withAuth(
  async (req, context, session) => {
    try {
      const tenantFilter = getTenantFilter(session);
      const auditHeadId = getAuditHeadId(session);

      const categories = await prisma.auditCategory.findMany({
        where: {
          ...tenantFilter,
          ...(auditHeadId ? { auditHeadId } : {}),
        },
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
  { resource: "audit.settings", action: "view" }
);

// POST create a new audit category
// Multi-tenant: Associate with customerAccountId and auditHeadId
export const POST = withAuth(
  async (req: NextRequest, context, session) => {
    try {
      const body = await req.json();
      const { name } = body;

      if (!name) {
        return NextResponse.json(
          { error: "Category name is required" },
          { status: 400 }
        );
      }

      const tenantFilter = getTenantFilter(session);
      const auditHeadId = getAuditHeadId(session);

      // Check for duplicate within same tenant and audit head
      const existing = await prisma.auditCategory.findFirst({
        where: {
          name,
          ...tenantFilter,
          ...(auditHeadId ? { auditHeadId } : {}),
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
          customerAccountId: session.customerAccountId,
          auditHeadId: auditHeadId,
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
