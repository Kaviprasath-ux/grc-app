import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth, getTenantFilter } from "@/lib/api-auth";

// GET a single audit type
// Requires 'edit' action so only AuditHead can access
export const GET = withAuth(
  async (req: NextRequest, { params }: { params: Promise<{ id: string }> }, session) => {
    try {
      const { id } = await params;
      const tenantFilter = getTenantFilter(session);

      const auditType = await prisma.auditType.findFirst({
        where: { id, ...tenantFilter },
        include: {
          _count: {
            select: { internalAuditRisks: true },
          },
        },
      });

      if (!auditType) {
        return NextResponse.json(
          { error: "Audit type not found" },
          { status: 404 }
        );
      }

      return NextResponse.json(auditType);
    } catch (error) {
      console.error("Error fetching audit type:", error);
      return NextResponse.json(
        { error: "Failed to fetch audit type" },
        { status: 500 }
      );
    }
  },
  { resource: "audit.settings", action: "edit" }
);

// PUT update an audit type
export const PUT = withAuth(
  async (req: NextRequest, { params }: { params: Promise<{ id: string }> }, session) => {
    try {
      const { id } = await params;
      const tenantFilter = getTenantFilter(session);
      const body = await req.json();
      const { name } = body;

      const existing = await prisma.auditType.findFirst({
        where: { id, ...tenantFilter },
      });

      if (!existing) {
        return NextResponse.json(
          { error: "Audit type not found" },
          { status: 404 }
        );
      }

      // Check for duplicate name if name is being changed
      if (name && name !== existing.name) {
        const duplicate = await prisma.auditType.findFirst({
          where: { name, ...tenantFilter, NOT: { id } },
        });
        if (duplicate) {
          return NextResponse.json(
            { error: "Audit type with this name already exists" },
            { status: 400 }
          );
        }
      }

      const auditType = await prisma.auditType.update({
        where: { id },
        data: { name },
      });

      return NextResponse.json(auditType);
    } catch (error) {
      console.error("Error updating audit type:", error);
      return NextResponse.json(
        { error: "Failed to update audit type" },
        { status: 500 }
      );
    }
  },
  { resource: "audit.settings", action: "edit" }
);

// DELETE an audit type
export const DELETE = withAuth(
  async (req: NextRequest, { params }: { params: Promise<{ id: string }> }, session) => {
    try {
      const { id } = await params;
      const tenantFilter = getTenantFilter(session);

      const existing = await prisma.auditType.findFirst({
        where: { id, ...tenantFilter },
        include: { _count: { select: { internalAuditRisks: true } } },
      });

      if (!existing) {
        return NextResponse.json(
          { error: "Audit type not found" },
          { status: 404 }
        );
      }

      if (existing._count.internalAuditRisks > 0) {
        return NextResponse.json(
          { error: "Cannot delete audit type with associated risks" },
          { status: 400 }
        );
      }

      await prisma.auditType.delete({ where: { id } });

      return NextResponse.json({ message: "Audit type deleted successfully" });
    } catch (error) {
      console.error("Error deleting audit type:", error);
      return NextResponse.json(
        { error: "Failed to delete audit type" },
        { status: 500 }
      );
    }
  },
  { resource: "audit.settings", action: "delete" }
);
