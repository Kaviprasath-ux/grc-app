import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth, getTenantFilter, getAuditHeadId, resolveAuditHeadIdForCreate } from "@/lib/api-auth";
import { translateRecord } from '@/lib/translation-service';

// GET all audit sub-categories
export const GET = withAuth(
  async (req, context, session) => {
    try {
      const tenantFilter = getTenantFilter(session);
      const auditHeadId = getAuditHeadId(session);

      const subCategories = await prisma.auditSubCategory.findMany({
        where: {
          ...tenantFilter,
          ...(auditHeadId ? { auditHeadId } : {}),
        },
        include: {
          category: { select: { id: true, name: true } },
          _count: {
            select: { internalAuditRisks: true },
          },
        },
        orderBy: { name: "asc" },
      });

      return NextResponse.json(subCategories);
    } catch (error) {
      console.error("Error fetching audit sub-categories:", error);
      return NextResponse.json(
        { error: "Failed to fetch audit sub-categories" },
        { status: 500 }
      );
    }
  },
  { resource: "audit.settings", action: "view" }
);

// POST create a new audit sub-category
export const POST = withAuth(
  async (req: NextRequest, context, session) => {
    try {
      const body = await req.json();
      const { name, categoryId } = body;

      if (!name) {
        return NextResponse.json(
          { error: "Sub-category name is required" },
          { status: 400 }
        );
      }

      if (!categoryId) {
        return NextResponse.json(
          { error: "Category is required" },
          { status: 400 }
        );
      }

      const tenantFilter = getTenantFilter(session);
      const auditHeadId = await resolveAuditHeadIdForCreate(session);

      // Check for duplicate within same tenant, audit head, and category
      const existing = await prisma.auditSubCategory.findFirst({
        where: {
          name,
          categoryId,
          ...tenantFilter,
          ...(auditHeadId ? { auditHeadId } : {}),
        },
      });

      if (existing) {
        return NextResponse.json(
          { error: "Sub-category with this name already exists in this category" },
          { status: 400 }
        );
      }

      const subCategory = await prisma.auditSubCategory.create({
        data: {
          name,
          categoryId,
          customerAccountId: session.customerAccountId,
          auditHeadId: auditHeadId,
        },
        include: {
          category: { select: { id: true, name: true } },
        },
      });

      if (session.customerAccountId) void translateRecord(session.customerAccountId, 'AuditSubCategory', subCategory.id, { name: subCategory.name });

      return NextResponse.json(subCategory, { status: 201 });
    } catch (error) {
      console.error("Error creating audit sub-category:", error);
      return NextResponse.json(
        { error: "Failed to create audit sub-category" },
        { status: 500 }
      );
    }
  },
  { resource: "audit.settings", action: "create" }
);
