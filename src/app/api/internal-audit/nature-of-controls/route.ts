import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth, getTenantFilter, getAuditHeadId } from "@/lib/api-auth";
import { translateRecord } from '@/lib/translation-service';

// GET all nature of controls
// Multi-tenant: Filter by customerAccountId and auditHeadId
export const GET = withAuth(
  async (req, context, session) => {
    try {
      const tenantFilter = getTenantFilter(session);
      const auditHeadId = getAuditHeadId(session);

      const controls = await prisma.auditNatureOfControl.findMany({
        where: {
          ...tenantFilter,
          ...(auditHeadId ? { auditHeadId } : {}),
        },
        orderBy: { label: "asc" },
      });

      return NextResponse.json(controls);
    } catch (error) {
      console.error("Error fetching nature of controls:", error);
      return NextResponse.json(
        { error: "Failed to fetch nature of controls" },
        { status: 500 }
      );
    }
  },
  { resource: "audit.settings", action: "view" }
);

// POST create a new nature of control
// Multi-tenant: Associate with customerAccountId and auditHeadId
export const POST = withAuth(
  async (req: NextRequest, context, session) => {
    try {
      const body = await req.json();
      const { label } = body;

      if (!label) {
        return NextResponse.json(
          { error: "Label is required" },
          { status: 400 }
        );
      }

      const tenantFilter = getTenantFilter(session);
      const auditHeadId = getAuditHeadId(session);

      // Check for duplicate within same tenant and audit head
      const existing = await prisma.auditNatureOfControl.findFirst({
        where: {
          label,
          ...tenantFilter,
          ...(auditHeadId ? { auditHeadId } : {}),
        },
      });

      if (existing) {
        return NextResponse.json(
          { error: "Nature of control with this label already exists" },
          { status: 400 }
        );
      }

      const control = await prisma.auditNatureOfControl.create({
        data: {
          label,
          customerAccountId: session.customerAccountId,
          auditHeadId: auditHeadId,
        },
      });

      if (session.customerAccountId) void translateRecord(session.customerAccountId, 'AuditNatureOfControl', control.id, { label: control.label });

      return NextResponse.json(control, { status: 201 });
    } catch (error) {
      console.error("Error creating nature of control:", error);
      return NextResponse.json(
        { error: "Failed to create nature of control" },
        { status: 500 }
      );
    }
  },
  { resource: "audit.settings", action: "create" }
);
