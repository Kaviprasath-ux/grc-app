import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth } from "@/lib/api-auth";

// GET all nature of controls
// Note: AuditNatureOfControl model doesn't have customerAccountId field yet - tenant filtering disabled
export const GET = withAuth(
  async () => {
    try {
      const controls = await prisma.auditNatureOfControl.findMany({
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
// Note: AuditNatureOfControl model doesn't have customerAccountId field yet - tenant assignment disabled
export const POST = withAuth(
  async (req: NextRequest) => {
    try {
      const body = await req.json();
      const { label } = body;

      if (!label) {
        return NextResponse.json(
          { error: "Label is required" },
          { status: 400 }
        );
      }

      // Check for duplicate
      const existing = await prisma.auditNatureOfControl.findFirst({
        where: { label },
      });

      if (existing) {
        return NextResponse.json(
          { error: "Nature of control with this label already exists" },
          { status: 400 }
        );
      }

      const control = await prisma.auditNatureOfControl.create({
        data: { label },
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
