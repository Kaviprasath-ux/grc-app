import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth, getTenantFilter, getCustomerAccountId } from "@/lib/api-auth";

// GET all nature of controls
// Requires 'edit' action so only AuditHead can access (CustomerAdmin has only 'view')
export const GET = withAuth(
  async (req: NextRequest, context, session) => {
    try {
      const tenantFilter = getTenantFilter(session);

      const controls = await prisma.auditNatureOfControl.findMany({
        where: tenantFilter,
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

// POST create a new nature of control
export const POST = withAuth(
  async (req: NextRequest, context, session) => {
    try {
      const customerAccountId = getCustomerAccountId(session);
      const body = await req.json();
      const { label } = body;

      if (!label) {
        return NextResponse.json(
          { error: "Label is required" },
          { status: 400 }
        );
      }

      // Check for duplicate within the same tenant
      const tenantFilter = getTenantFilter(session);
      const existing = await prisma.auditNatureOfControl.findFirst({
        where: {
          label,
          ...tenantFilter,
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
