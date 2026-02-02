import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth } from "@/lib/api-auth";

// GET a single nature of control
// Note: AuditNatureOfControl model doesn't have customerAccountId field yet - tenant filtering disabled
export const GET = withAuth(
  async (_req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    try {
      const { id } = await params;

      const control = await prisma.auditNatureOfControl.findUnique({
        where: { id },
      });

      if (!control) {
        return NextResponse.json(
          { error: "Nature of control not found" },
          { status: 404 }
        );
      }

      return NextResponse.json(control);
    } catch (error) {
      console.error("Error fetching nature of control:", error);
      return NextResponse.json(
        { error: "Failed to fetch nature of control" },
        { status: 500 }
      );
    }
  },
  { resource: "audit.settings", action: "edit" }
);

// PUT update a nature of control
// Note: AuditNatureOfControl model doesn't have customerAccountId field yet - tenant filtering disabled
export const PUT = withAuth(
  async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    try {
      const { id } = await params;
      const body = await req.json();
      const { label } = body;

      const existing = await prisma.auditNatureOfControl.findUnique({
        where: { id },
      });

      if (!existing) {
        return NextResponse.json(
          { error: "Nature of control not found" },
          { status: 404 }
        );
      }

      // Check for duplicate label if label is being changed
      if (label && label !== existing.label) {
        const duplicate = await prisma.auditNatureOfControl.findFirst({
          where: { label, NOT: { id } },
        });
        if (duplicate) {
          return NextResponse.json(
            { error: "Nature of control with this label already exists" },
            { status: 400 }
          );
        }
      }

      const control = await prisma.auditNatureOfControl.update({
        where: { id },
        data: { label },
      });

      return NextResponse.json(control);
    } catch (error) {
      console.error("Error updating nature of control:", error);
      return NextResponse.json(
        { error: "Failed to update nature of control" },
        { status: 500 }
      );
    }
  },
  { resource: "audit.settings", action: "edit" }
);

// DELETE a nature of control
// Note: AuditNatureOfControl model doesn't have customerAccountId field yet - tenant filtering disabled
export const DELETE = withAuth(
  async (_req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    try {
      const { id } = await params;

      const existing = await prisma.auditNatureOfControl.findUnique({
        where: { id },
      });

      if (!existing) {
        return NextResponse.json(
          { error: "Nature of control not found" },
          { status: 404 }
        );
      }

      await prisma.auditNatureOfControl.delete({ where: { id } });

      return NextResponse.json({ message: "Nature of control deleted successfully" });
    } catch (error) {
      console.error("Error deleting nature of control:", error);
      return NextResponse.json(
        { error: "Failed to delete nature of control" },
        { status: 500 }
      );
    }
  },
  { resource: "audit.settings", action: "delete" }
);
