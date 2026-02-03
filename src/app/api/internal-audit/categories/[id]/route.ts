import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth, getTenantFilter, getAuditHeadId } from "@/lib/api-auth";

// GET a single audit category
// Multi-tenant: Filter by customerAccountId and auditHeadId
export const GET = withAuth(
  async (req: NextRequest, { params }: { params: Promise<{ id: string }> }, session) => {
    try {
      const { id } = await params;
      const tenantFilter = getTenantFilter(session);
      const auditHeadId = getAuditHeadId(session);

      const category = await prisma.auditCategory.findFirst({
        where: {
          id,
          ...tenantFilter,
          ...(auditHeadId ? { auditHeadId } : {}),
        },
        include: {
          _count: {
            select: { internalAuditRisks: true },
          },
        },
      });

      if (!category) {
        return NextResponse.json(
          { error: "Audit category not found" },
          { status: 404 }
        );
      }

      return NextResponse.json(category);
    } catch (error) {
      console.error("Error fetching audit category:", error);
      return NextResponse.json(
        { error: "Failed to fetch audit category" },
        { status: 500 }
      );
    }
  },
  { resource: "audit.settings", action: "edit" }
);

// PUT update an audit category
// Multi-tenant: Filter by customerAccountId and auditHeadId
export const PUT = withAuth(
  async (req: NextRequest, { params }: { params: Promise<{ id: string }> }, session) => {
    try {
      const { id } = await params;
      const tenantFilter = getTenantFilter(session);
      const auditHeadId = getAuditHeadId(session);
      const body = await req.json();
      const { name } = body;

      const existing = await prisma.auditCategory.findFirst({
        where: {
          id,
          ...tenantFilter,
          ...(auditHeadId ? { auditHeadId } : {}),
        },
      });

      if (!existing) {
        return NextResponse.json(
          { error: "Audit category not found" },
          { status: 404 }
        );
      }

      // Check for duplicate name if name is being changed
      if (name && name !== existing.name) {
        const duplicate = await prisma.auditCategory.findFirst({
          where: {
            name,
            ...tenantFilter,
            ...(auditHeadId ? { auditHeadId } : {}),
            NOT: { id },
          },
        });
        if (duplicate) {
          return NextResponse.json(
            { error: "Category with this name already exists" },
            { status: 400 }
          );
        }
      }

      const category = await prisma.auditCategory.update({
        where: { id },
        data: { name },
      });

      return NextResponse.json(category);
    } catch (error) {
      console.error("Error updating audit category:", error);
      return NextResponse.json(
        { error: "Failed to update audit category" },
        { status: 500 }
      );
    }
  },
  { resource: "audit.settings", action: "edit" }
);

// DELETE an audit category
// Multi-tenant: Filter by customerAccountId and auditHeadId
export const DELETE = withAuth(
  async (req: NextRequest, { params }: { params: Promise<{ id: string }> }, session) => {
    try {
      const { id } = await params;
      const tenantFilter = getTenantFilter(session);
      const auditHeadId = getAuditHeadId(session);

      const existing = await prisma.auditCategory.findFirst({
        where: {
          id,
          ...tenantFilter,
          ...(auditHeadId ? { auditHeadId } : {}),
        },
        include: { _count: { select: { internalAuditRisks: true } } },
      });

      if (!existing) {
        return NextResponse.json(
          { error: "Audit category not found" },
          { status: 404 }
        );
      }

      if (existing._count.internalAuditRisks > 0) {
        return NextResponse.json(
          { error: "Cannot delete category with associated risks" },
          { status: 400 }
        );
      }

      await prisma.auditCategory.delete({ where: { id } });

      return NextResponse.json({ message: "Audit category deleted successfully" });
    } catch (error) {
      console.error("Error deleting audit category:", error);
      return NextResponse.json(
        { error: "Failed to delete audit category" },
        { status: 500 }
      );
    }
  },
  { resource: "audit.settings", action: "delete" }
);
