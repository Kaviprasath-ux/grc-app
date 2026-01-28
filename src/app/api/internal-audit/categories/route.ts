import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth, getTenantFilter, getCustomerAccountId, getAuditHeadFilter, getAuditHeadId } from "@/lib/api-auth";

// GET all audit categories - filtered by audit head
export const GET = withAuth(
  async (req: NextRequest, context, session) => {
    try {
      const tenantFilter = getTenantFilter(session);
      const auditHeadFilter = getAuditHeadFilter(session);

      const categories = await prisma.auditCategory.findMany({
        where: { ...tenantFilter, ...auditHeadFilter },
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

// POST create a new audit category - assigned to current audit head
export const POST = withAuth(
  async (req: NextRequest, context, session) => {
    try {
      const customerAccountId = getCustomerAccountId(session);
      const auditHeadId = getAuditHeadId(session);
      const body = await req.json();
      const { name } = body;

      if (!name) {
        return NextResponse.json(
          { error: "Category name is required" },
          { status: 400 }
        );
      }

      // Check for duplicate within the same audit head's settings
      const existing = await prisma.auditCategory.findFirst({
        where: {
          name,
          auditHeadId,
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
          auditHeadId,
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
