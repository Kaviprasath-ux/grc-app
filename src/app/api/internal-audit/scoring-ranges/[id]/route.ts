import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth, getTenantFilter, getAuditHeadId } from "@/lib/api-auth";
import { translateRecord, deleteRecordTranslations } from "@/lib/translation-service";

// GET a single scoring range
// Multi-tenant: Filter by customerAccountId and auditHeadId
export const GET = withAuth(
  async (req: NextRequest, { params }: { params: Promise<{ id: string }> }, session) => {
    try {
      const { id } = await params;
      const tenantFilter = getTenantFilter(session);
      const auditHeadId = getAuditHeadId(session);

      const range = await prisma.auditScoringRange.findFirst({
        where: {
          id,
          ...tenantFilter,
          ...(auditHeadId ? { auditHeadId } : {}),
        },
      });

      if (!range) {
        return NextResponse.json(
          { error: "Scoring range not found" },
          { status: 404 }
        );
      }

      return NextResponse.json(range);
    } catch (error) {
      console.error("Error fetching scoring range:", error);
      return NextResponse.json(
        { error: "Failed to fetch scoring range" },
        { status: 500 }
      );
    }
  },
  { resource: "audit.settings", action: "view" }
);

// PUT update a scoring range
// Multi-tenant: Filter by customerAccountId and auditHeadId
export const PUT = withAuth(
  async (req: NextRequest, { params }: { params: Promise<{ id: string }> }, session) => {
    try {
      const { id } = await params;
      const tenantFilter = getTenantFilter(session);
      const auditHeadId = getAuditHeadId(session);
      const body = await req.json();
      const { label, lowValue, highValue, calculationType } = body;

      const existing = await prisma.auditScoringRange.findFirst({
        where: {
          id,
          ...tenantFilter,
          ...(auditHeadId ? { auditHeadId } : {}),
        },
      });

      if (!existing) {
        return NextResponse.json(
          { error: "Scoring range not found" },
          { status: 404 }
        );
      }

      // Check for duplicate label if label or calculationType is being changed
      const newLabel = label ?? existing.label;
      const newCalcType = calculationType ?? existing.calculationType;

      if (newLabel !== existing.label || newCalcType !== existing.calculationType) {
        const duplicate = await prisma.auditScoringRange.findFirst({
          where: {
            label: newLabel,
            calculationType: newCalcType,
            ...tenantFilter,
            ...(auditHeadId ? { auditHeadId } : {}),
            NOT: { id },
          },
        });
        if (duplicate) {
          return NextResponse.json(
            { error: "Scoring range with this label already exists for this calculation type" },
            { status: 400 }
          );
        }
      }

      const range = await prisma.auditScoringRange.update({
        where: { id },
        data: {
          ...(label !== undefined && { label }),
          ...(lowValue !== undefined && { lowValue }),
          ...(highValue !== undefined && { highValue }),
          ...(calculationType !== undefined && { calculationType }),
        },
      });

      if (session.customerAccountId) void translateRecord(session.customerAccountId, 'AuditScoringRange', range.id, { label: range.label });

      return NextResponse.json(range);
    } catch (error) {
      console.error("Error updating scoring range:", error);
      return NextResponse.json(
        { error: "Failed to update scoring range" },
        { status: 500 }
      );
    }
  },
  { resource: "audit.settings", action: "edit" }
);

// DELETE a scoring range
// Multi-tenant: Filter by customerAccountId and auditHeadId
export const DELETE = withAuth(
  async (req: NextRequest, { params }: { params: Promise<{ id: string }> }, session) => {
    try {
      const { id } = await params;
      const tenantFilter = getTenantFilter(session);
      const auditHeadId = getAuditHeadId(session);

      const existing = await prisma.auditScoringRange.findFirst({
        where: {
          id,
          ...tenantFilter,
          ...(auditHeadId ? { auditHeadId } : {}),
        },
      });

      if (!existing) {
        return NextResponse.json(
          { error: "Scoring range not found" },
          { status: 404 }
        );
      }

      await prisma.auditScoringRange.delete({ where: { id } });

      if (session.customerAccountId) void deleteRecordTranslations(session.customerAccountId, 'AuditScoringRange', id);

      return NextResponse.json({ message: "Scoring range deleted successfully" });
    } catch (error) {
      console.error("Error deleting scoring range:", error);
      return NextResponse.json(
        { error: "Failed to delete scoring range" },
        { status: 500 }
      );
    }
  },
  { resource: "audit.settings", action: "delete" }
);
