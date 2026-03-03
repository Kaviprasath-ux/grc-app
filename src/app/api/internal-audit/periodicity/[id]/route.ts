import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth } from "@/lib/api-auth";
import { translateRecord, deleteRecordTranslations } from '@/lib/translation-service';

// GET a single periodicity
// Note: AuditPeriodicity model doesn't have customerAccountId field yet - tenant filtering disabled
export const GET = withAuth(
  async (_req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    try {
      const { id } = await params;

      const periodicity = await prisma.auditPeriodicity.findUnique({
        where: { id },
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
  { resource: "audit.settings", action: "view" }
);

// PUT update a periodicity
// Note: AuditPeriodicity model doesn't have customerAccountId field yet - tenant filtering disabled
export const PUT = withAuth(
  async (req: NextRequest, { params }: { params: Promise<{ id: string }> }, session) => {
    try {
      const { id } = await params;
      const body = await req.json();
      const { interval, months } = body;

      const existing = await prisma.auditPeriodicity.findUnique({
        where: { id },
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
          where: { interval, NOT: { id } },
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

      if (session.customerAccountId) void translateRecord(session.customerAccountId, 'AuditPeriodicity', id, { interval: periodicity.interval });

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
// Note: AuditPeriodicity model doesn't have customerAccountId field yet - tenant filtering disabled
export const DELETE = withAuth(
  async (_req: NextRequest, { params }: { params: Promise<{ id: string }> }, session) => {
    try {
      const { id } = await params;

      const existing = await prisma.auditPeriodicity.findUnique({
        where: { id },
      });

      if (!existing) {
        return NextResponse.json(
          { error: "Periodicity not found" },
          { status: 404 }
        );
      }

      await prisma.auditPeriodicity.delete({ where: { id } });

      if (session.customerAccountId) void deleteRecordTranslations(session.customerAccountId, 'AuditPeriodicity', id);

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
