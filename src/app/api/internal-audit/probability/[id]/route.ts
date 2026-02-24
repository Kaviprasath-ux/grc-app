import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth, getTenantFilter, getAuditHeadId } from "@/lib/api-auth";
import { translateRecord, deleteRecordTranslations } from "@/lib/translation-service";

// GET a single probability
// Multi-tenant: Filter by customerAccountId and auditHeadId
export const GET = withAuth(
  async (req: NextRequest, { params }: { params: Promise<{ id: string }> }, session) => {
    try {
      const { id } = await params;
      const tenantFilter = getTenantFilter(session);
      const auditHeadId = getAuditHeadId(session);

      const probability = await prisma.auditProbability.findFirst({
        where: {
          id,
          ...tenantFilter,
          ...(auditHeadId ? { auditHeadId } : {}),
        },
      });

      if (!probability) {
        return NextResponse.json(
          { error: "Probability not found" },
          { status: 404 }
        );
      }

      return NextResponse.json(probability);
    } catch (error) {
      console.error("Error fetching probability:", error);
      return NextResponse.json(
        { error: "Failed to fetch probability" },
        { status: 500 }
      );
    }
  },
  { resource: "audit.settings", action: "view" }
);

// PUT update a probability
// Multi-tenant: Filter by customerAccountId and auditHeadId
export const PUT = withAuth(
  async (req: NextRequest, { params }: { params: Promise<{ id: string }> }, session) => {
    try {
      const { id } = await params;
      const tenantFilter = getTenantFilter(session);
      const auditHeadId = getAuditHeadId(session);
      const body = await req.json();
      const { label, value } = body;

      const existing = await prisma.auditProbability.findFirst({
        where: {
          id,
          ...tenantFilter,
          ...(auditHeadId ? { auditHeadId } : {}),
        },
      });

      if (!existing) {
        return NextResponse.json(
          { error: "Probability not found" },
          { status: 404 }
        );
      }

      // Check for duplicate label if label is being changed
      if (label && label !== existing.label) {
        const duplicate = await prisma.auditProbability.findFirst({
          where: {
            label,
            ...tenantFilter,
            ...(auditHeadId ? { auditHeadId } : {}),
            NOT: { id },
          },
        });
        if (duplicate) {
          return NextResponse.json(
            { error: "Probability with this label already exists" },
            { status: 400 }
          );
        }
      }

      const probability = await prisma.auditProbability.update({
        where: { id },
        data: {
          ...(label !== undefined && { label }),
          ...(value !== undefined && { value }),
        },
      });

      if (session.customerAccountId) void translateRecord(session.customerAccountId, 'AuditProbability', probability.id, { label: probability.label });

      return NextResponse.json(probability);
    } catch (error) {
      console.error("Error updating probability:", error);
      return NextResponse.json(
        { error: "Failed to update probability" },
        { status: 500 }
      );
    }
  },
  { resource: "audit.settings", action: "edit" }
);

// DELETE a probability
// Multi-tenant: Filter by customerAccountId and auditHeadId
export const DELETE = withAuth(
  async (req: NextRequest, { params }: { params: Promise<{ id: string }> }, session) => {
    try {
      const { id } = await params;
      const tenantFilter = getTenantFilter(session);
      const auditHeadId = getAuditHeadId(session);

      const existing = await prisma.auditProbability.findFirst({
        where: {
          id,
          ...tenantFilter,
          ...(auditHeadId ? { auditHeadId } : {}),
        },
      });

      if (!existing) {
        return NextResponse.json(
          { error: "Probability not found" },
          { status: 404 }
        );
      }

      await prisma.auditProbability.delete({ where: { id } });

      if (session.customerAccountId) void deleteRecordTranslations(session.customerAccountId, 'AuditProbability', id);

      return NextResponse.json({ message: "Probability deleted successfully" });
    } catch (error) {
      console.error("Error deleting probability:", error);
      return NextResponse.json(
        { error: "Failed to delete probability" },
        { status: 500 }
      );
    }
  },
  { resource: "audit.settings", action: "delete" }
);
