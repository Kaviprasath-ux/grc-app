import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth, getTenantFilter, getAuditHeadId } from "@/lib/api-auth";
import { translateRecord, deleteRecordTranslations } from '@/lib/translation-service';

// PUT update an audit sub-category
export const PUT = withAuth(
  async (req: NextRequest, { params }: { params: Promise<{ id: string }> }, session) => {
    try {
      const { id } = await params;
      const tenantFilter = getTenantFilter(session);
      const auditHeadId = getAuditHeadId(session);
      const body = await req.json();
      const { name, categoryId } = body;

      const existing = await prisma.auditSubCategory.findFirst({
        where: {
          id,
          ...tenantFilter,
          ...(auditHeadId ? { auditHeadId } : {}),
        },
      });

      if (!existing) {
        return NextResponse.json(
          { error: "Audit sub-category not found" },
          { status: 404 }
        );
      }

      const subCategory = await prisma.auditSubCategory.update({
        where: { id },
        data: {
          ...(name !== undefined ? { name } : {}),
          ...(categoryId !== undefined ? { categoryId } : {}),
        },
        include: {
          category: { select: { id: true, name: true } },
        },
      });

      if (session.customerAccountId) void translateRecord(session.customerAccountId, 'AuditSubCategory', id, { name: subCategory.name });

      return NextResponse.json(subCategory);
    } catch (error) {
      console.error("Error updating audit sub-category:", error);
      return NextResponse.json(
        { error: "Failed to update audit sub-category" },
        { status: 500 }
      );
    }
  },
  { resource: "audit.settings", action: "edit" }
);

// DELETE an audit sub-category
export const DELETE = withAuth(
  async (req: NextRequest, { params }: { params: Promise<{ id: string }> }, session) => {
    try {
      const { id } = await params;
      const tenantFilter = getTenantFilter(session);
      const auditHeadId = getAuditHeadId(session);

      const existing = await prisma.auditSubCategory.findFirst({
        where: {
          id,
          ...tenantFilter,
          ...(auditHeadId ? { auditHeadId } : {}),
        },
        include: { _count: { select: { internalAuditRisks: true } } },
      });

      if (!existing) {
        return NextResponse.json(
          { error: "Audit sub-category not found" },
          { status: 404 }
        );
      }

      if (existing._count.internalAuditRisks > 0) {
        return NextResponse.json(
          { error: "Cannot delete sub-category with associated risks" },
          { status: 400 }
        );
      }

      await prisma.auditSubCategory.delete({ where: { id } });

      if (session.customerAccountId) void deleteRecordTranslations(session.customerAccountId, 'AuditSubCategory', id);

      return NextResponse.json({ message: "Audit sub-category deleted successfully" });
    } catch (error) {
      console.error("Error deleting audit sub-category:", error);
      return NextResponse.json(
        { error: "Failed to delete audit sub-category" },
        { status: 500 }
      );
    }
  },
  { resource: "audit.settings", action: "delete" }
);
