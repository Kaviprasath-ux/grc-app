import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth, getTenantFilter, getCustomerAccountId, getAuditHeadFilter, getAuditHeadId } from "@/lib/api-auth";

// GET all nature of controls - filtered by audit head
export const GET = withAuth(
  async (req: NextRequest, context, session) => {
    try {
      const tenantFilter = getTenantFilter(session);
      const auditHeadFilter = getAuditHeadFilter(session);

      const controls = await prisma.auditNatureOfControl.findMany({
        where: { ...tenantFilter, ...auditHeadFilter },
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
  { resource: "audit.settings", action: "edit" }
);

// POST create a new nature of control - assigned to current audit head
export const POST = withAuth(
  async (req: NextRequest, context, session) => {
    try {
      const customerAccountId = getCustomerAccountId(session);
      const auditHeadId = getAuditHeadId(session);
      const body = await req.json();
      const { label } = body;

      if (!label) {
        return NextResponse.json(
          { error: "Label is required" },
          { status: 400 }
        );
      }

      // Check for duplicate within the same audit head's settings
      const existing = await prisma.auditNatureOfControl.findFirst({
        where: {
          label,
          auditHeadId,
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
          customerAccountId,
          auditHeadId,
        },
      });

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
