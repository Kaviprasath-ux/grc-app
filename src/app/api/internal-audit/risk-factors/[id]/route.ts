import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth, getTenantFilter, getAuditHeadId } from "@/lib/api-auth";

// GET a single risk factor
// Multi-tenant: Filter by customerAccountId and auditHeadId
export const GET = withAuth(
  async (req: NextRequest, { params }: { params: Promise<{ id: string }> }, session) => {
    try {
      const { id } = await params;
      const tenantFilter = getTenantFilter(session);
      const auditHeadId = getAuditHeadId(session);

      const factor = await prisma.auditRiskFactor.findFirst({
        where: {
          id,
          ...tenantFilter,
          ...(auditHeadId ? { auditHeadId } : {}),
        },
      });

      if (!factor) {
        return NextResponse.json(
          { error: "Risk factor not found" },
          { status: 404 }
        );
      }

      return NextResponse.json(factor);
    } catch (error) {
      console.error("Error fetching risk factor:", error);
      return NextResponse.json(
        { error: "Failed to fetch risk factor" },
        { status: 500 }
      );
    }
  },
  { resource: "audit.settings", action: "view" }
);

// PUT update a risk factor
// Multi-tenant: Filter by customerAccountId and auditHeadId
export const PUT = withAuth(
  async (req: NextRequest, { params }: { params: Promise<{ id: string }> }, session) => {
    try {
      const { id } = await params;
      const tenantFilter = getTenantFilter(session);
      const auditHeadId = getAuditHeadId(session);
      const body = await req.json();
      const { label } = body;

      const existing = await prisma.auditRiskFactor.findFirst({
        where: {
          id,
          ...tenantFilter,
          ...(auditHeadId ? { auditHeadId } : {}),
        },
      });

      if (!existing) {
        return NextResponse.json(
          { error: "Risk factor not found" },
          { status: 404 }
        );
      }

      // Check for duplicate label if label is being changed
      if (label && label !== existing.label) {
        const duplicate = await prisma.auditRiskFactor.findFirst({
          where: {
            label,
            ...tenantFilter,
            ...(auditHeadId ? { auditHeadId } : {}),
            NOT: { id },
          },
        });
        if (duplicate) {
          return NextResponse.json(
            { error: "Risk factor with this label already exists" },
            { status: 400 }
          );
        }
      }

      const factor = await prisma.auditRiskFactor.update({
        where: { id },
        data: { label },
      });

      return NextResponse.json(factor);
    } catch (error) {
      console.error("Error updating risk factor:", error);
      return NextResponse.json(
        { error: "Failed to update risk factor" },
        { status: 500 }
      );
    }
  },
  { resource: "audit.settings", action: "edit" }
);

// DELETE a risk factor
// Multi-tenant: Filter by customerAccountId and auditHeadId
export const DELETE = withAuth(
  async (req: NextRequest, { params }: { params: Promise<{ id: string }> }, session) => {
    try {
      const { id } = await params;
      const tenantFilter = getTenantFilter(session);
      const auditHeadId = getAuditHeadId(session);

      const existing = await prisma.auditRiskFactor.findFirst({
        where: {
          id,
          ...tenantFilter,
          ...(auditHeadId ? { auditHeadId } : {}),
        },
      });

      if (!existing) {
        return NextResponse.json(
          { error: "Risk factor not found" },
          { status: 404 }
        );
      }

      await prisma.auditRiskFactor.delete({ where: { id } });

      return NextResponse.json({ message: "Risk factor deleted successfully" });
    } catch (error) {
      console.error("Error deleting risk factor:", error);
      return NextResponse.json(
        { error: "Failed to delete risk factor" },
        { status: 500 }
      );
    }
  },
  { resource: "audit.settings", action: "delete" }
);
