import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth, getTenantFilter } from "@/lib/api-auth";

// GET a single periodicity
// Requires 'edit' action so only AuditHead can access
export const GET = withAuth(
  async (req: NextRequest, { params }: { params: Promise<{ id: string }> }, session) => {
    try {
      const { id } = await params;
      const tenantFilter = getTenantFilter(session);

      const periodicity = await prisma.auditPeriodicity.findFirst({
        where: { id, ...tenantFilter },
      });

      if (!periodicity) {
        return NextResponse.json(
          { error: "Periodicity not found" },
          { status: 404 }
        );
      }

      return NextResponse.json(periodicity);
    } catch (error) {
      console.error("Error fetching periodicity:", error);
      return NextResponse.json(
        { error: "Failed to fetch periodicity" },
        { status: 500 }
      );
    }
  },
  { resource: "audit.settings", action: "edit" }
);

// PUT update a periodicity
export const PUT = withAuth(
  async (req: NextRequest, { params }: { params: Promise<{ id: string }> }, session) => {
    try {
      const { id } = await params;
      const tenantFilter = getTenantFilter(session);
      const body = await req.json();
      const { interval, months } = body;

      const existing = await prisma.auditPeriodicity.findFirst({
        where: { id, ...tenantFilter },
      });

      if (!existing) {
        return NextResponse.json(
          { error: "Periodicity not found" },
          { status: 404 }
        );
      }

      // Check for duplicate interval if interval is being changed
      if (interval && interval !== existing.interval) {
        const duplicate = await prisma.auditPeriodicity.findFirst({
          where: { interval, ...tenantFilter, NOT: { id } },
        });
        if (duplicate) {
          return NextResponse.json(
            { error: "Periodicity with this interval already exists" },
            { status: 400 }
          );
        }
      }

      const periodicity = await prisma.auditPeriodicity.update({
        where: { id },
        data: {
          ...(interval !== undefined && { interval }),
          ...(months !== undefined && { months }),
        },
      });

      return NextResponse.json(periodicity);
    } catch (error) {
      console.error("Error updating periodicity:", error);
      return NextResponse.json(
        { error: "Failed to update periodicity" },
        { status: 500 }
      );
    }
  },
  { resource: "audit.settings", action: "edit" }
);

// DELETE a periodicity
export const DELETE = withAuth(
  async (req: NextRequest, { params }: { params: Promise<{ id: string }> }, session) => {
    try {
      const { id } = await params;
      const tenantFilter = getTenantFilter(session);

      const existing = await prisma.auditPeriodicity.findFirst({
        where: { id, ...tenantFilter },
      });

      if (!existing) {
        return NextResponse.json(
          { error: "Periodicity not found" },
          { status: 404 }
        );
      }

      await prisma.auditPeriodicity.delete({ where: { id } });

      return NextResponse.json({ message: "Periodicity deleted successfully" });
    } catch (error) {
      console.error("Error deleting periodicity:", error);
      return NextResponse.json(
        { error: "Failed to delete periodicity" },
        { status: 500 }
      );
    }
  },
  { resource: "audit.settings", action: "delete" }
);
