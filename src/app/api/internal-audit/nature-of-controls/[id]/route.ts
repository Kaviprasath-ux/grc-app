import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth, getTenantFilter, getAuditHeadId } from "@/lib/api-auth";
import { translateRecord, deleteRecordTranslations } from '@/lib/translation-service';

// GET a single nature of control
// Multi-tenant: Filter by customerAccountId and auditHeadId
export const GET = withAuth(
  async (req: NextRequest, { params }: { params: Promise<{ id: string }> }, session) => {
    try {
      const { id } = await params;
      const tenantFilter = getTenantFilter(session);
      const auditHeadId = getAuditHeadId(session);

      const control = await prisma.auditNatureOfControl.findFirst({
        where: {
          id,
          ...tenantFilter,
          ...(auditHeadId ? { auditHeadId } : {}),
        },
      });

      if (!control) {
        return NextResponse.json(
          { error: "Nature of control not found" },
          { status: 404 }
        );
      }

      return NextResponse.json(control);
    } catch (error) {
      console.error("Error fetching nature of control:", error);
      return NextResponse.json(
        { error: "Failed to fetch nature of control" },
        { status: 500 }
      );
    }
  },
  { resource: "audit.settings", action: "view" }
);

// PUT update a nature of control
// Multi-tenant: Filter by customerAccountId and auditHeadId
export const PUT = withAuth(
  async (req: NextRequest, { params }: { params: Promise<{ id: string }> }, session) => {
    try {
      const { id } = await params;
      const tenantFilter = getTenantFilter(session);
      const auditHeadId = getAuditHeadId(session);
      const body = await req.json();
      const { label } = body;

      const existing = await prisma.auditNatureOfControl.findFirst({
        where: {
          id,
          ...tenantFilter,
          ...(auditHeadId ? { auditHeadId } : {}),
        },
      });

      if (!existing) {
        return NextResponse.json(
          { error: "Nature of control not found" },
          { status: 404 }
        );
      }

      // Check for duplicate label if label is being changed
      if (label && label !== existing.label) {
        const duplicate = await prisma.auditNatureOfControl.findFirst({
          where: {
            label,
            ...tenantFilter,
            ...(auditHeadId ? { auditHeadId } : {}),
            NOT: { id },
          },
        });
        if (duplicate) {
          return NextResponse.json(
            { error: "Nature of control with this label already exists" },
            { status: 400 }
          );
        }
      }

      const control = await prisma.auditNatureOfControl.update({
        where: { id },
        data: { label },
      });

      if (session.customerAccountId) void translateRecord(session.customerAccountId, 'AuditNatureOfControl', id, { label: control.label });

      return NextResponse.json(control);
    } catch (error) {
      console.error("Error updating nature of control:", error);
      return NextResponse.json(
        { error: "Failed to update nature of control" },
        { status: 500 }
      );
    }
  },
  { resource: "audit.settings", action: "edit" }
);

// DELETE a nature of control
// Multi-tenant: Filter by customerAccountId and auditHeadId
export const DELETE = withAuth(
  async (req: NextRequest, { params }: { params: Promise<{ id: string }> }, session) => {
    try {
      const { id } = await params;
      const tenantFilter = getTenantFilter(session);
      const auditHeadId = getAuditHeadId(session);

      const existing = await prisma.auditNatureOfControl.findFirst({
        where: {
          id,
          ...tenantFilter,
          ...(auditHeadId ? { auditHeadId } : {}),
        },
      });

      if (!existing) {
        return NextResponse.json(
          { error: "Nature of control not found" },
          { status: 404 }
        );
      }

      await prisma.auditNatureOfControl.delete({ where: { id } });

      if (session.customerAccountId) void deleteRecordTranslations(session.customerAccountId, 'AuditNatureOfControl', id);

      return NextResponse.json({ message: "Nature of control deleted successfully" });
    } catch (error) {
      console.error("Error deleting nature of control:", error);
      return NextResponse.json(
        { error: "Failed to delete nature of control" },
        { status: 500 }
      );
    }
  },
  { resource: "audit.settings", action: "delete" }
);
