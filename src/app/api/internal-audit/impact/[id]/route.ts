import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth, getTenantFilter, getAuditHeadId } from "@/lib/api-auth";
import { translateRecord, deleteRecordTranslations } from "@/lib/translation-service";

// GET a single impact
// Multi-tenant: Filter by customerAccountId and auditHeadId
export const GET = withAuth(
  async (req: NextRequest, { params }: { params: Promise<{ id: string }> }, session) => {
    try {
      const { id } = await params;
      const tenantFilter = getTenantFilter(session);
      const auditHeadId = getAuditHeadId(session);

      const impact = await prisma.auditImpact.findFirst({
        where: {
          id,
          ...tenantFilter,
          ...(auditHeadId ? { auditHeadId } : {}),
        },
      });

      if (!impact) {
        return NextResponse.json(
          { error: "Impact not found" },
          { status: 404 }
        );
      }

      return NextResponse.json(impact);
    } catch (error) {
      console.error("Error fetching impact:", error);
      return NextResponse.json(
        { error: "Failed to fetch impact" },
        { status: 500 }
      );
    }
  },
  { resource: "audit.settings", action: "view" }
);

// PUT update an impact
// Multi-tenant: Filter by customerAccountId and auditHeadId
export const PUT = withAuth(
  async (req: NextRequest, { params }: { params: Promise<{ id: string }> }, session) => {
    try {
      const { id } = await params;
      const tenantFilter = getTenantFilter(session);
      const auditHeadId = getAuditHeadId(session);
      const body = await req.json();
      const { label, value } = body;

      const existing = await prisma.auditImpact.findFirst({
        where: {
          id,
          ...tenantFilter,
          ...(auditHeadId ? { auditHeadId } : {}),
        },
      });

      if (!existing) {
        return NextResponse.json(
          { error: "Impact not found" },
          { status: 404 }
        );
      }

      // Check for duplicate label if label is being changed
      if (label && label !== existing.label) {
        const duplicate = await prisma.auditImpact.findFirst({
          where: {
            label,
            ...tenantFilter,
            ...(auditHeadId ? { auditHeadId } : {}),
            NOT: { id },
          },
        });
        if (duplicate) {
          return NextResponse.json(
            { error: "Impact with this label already exists" },
            { status: 400 }
          );
        }
      }

      const impact = await prisma.auditImpact.update({
        where: { id },
        data: {
          ...(label !== undefined && { label }),
          ...(value !== undefined && { value }),
        },
      });

      if (session.customerAccountId) void translateRecord(session.customerAccountId, 'AuditImpact', impact.id, { label: impact.label });

      return NextResponse.json(impact);
    } catch (error) {
      console.error("Error updating impact:", error);
      return NextResponse.json(
        { error: "Failed to update impact" },
        { status: 500 }
      );
    }
  },
  { resource: "audit.settings", action: "edit" }
);

// DELETE an impact
// Multi-tenant: Filter by customerAccountId and auditHeadId
export const DELETE = withAuth(
  async (req: NextRequest, { params }: { params: Promise<{ id: string }> }, session) => {
    try {
      const { id } = await params;
      const tenantFilter = getTenantFilter(session);
      const auditHeadId = getAuditHeadId(session);

      const existing = await prisma.auditImpact.findFirst({
        where: {
          id,
          ...tenantFilter,
          ...(auditHeadId ? { auditHeadId } : {}),
        },
      });

      if (!existing) {
        return NextResponse.json(
          { error: "Impact not found" },
          { status: 404 }
        );
      }

      await prisma.auditImpact.delete({ where: { id } });

      if (session.customerAccountId) void deleteRecordTranslations(session.customerAccountId, 'AuditImpact', id);

      return NextResponse.json({ message: "Impact deleted successfully" });
    } catch (error) {
      console.error("Error deleting impact:", error);
      return NextResponse.json(
        { error: "Failed to delete impact" },
        { status: 500 }
      );
    }
  },
  { resource: "audit.settings", action: "delete" }
);
