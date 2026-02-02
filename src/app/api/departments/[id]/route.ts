import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth, getTenantFilter, validateTenantAccess, forbidden } from "@/lib/api-auth";

interface RouteContext {
  params: Promise<{ id: string }>;
}

// GET single department - filtered by customer account
export const GET = withAuth(
  async (req, context: RouteContext, session) => {
    try {
      const { id } = await context.params;
      const tenantFilter = getTenantFilter(session);

      const department = await prisma.department.findFirst({
        where: { id, ...tenantFilter },
        include: {
          users: true,
          issues: true,
          stakeholders: true,
        },
      });

      if (!department) {
        return NextResponse.json(
          { error: "Department not found" },
          { status: 404 }
        );
      }

      return NextResponse.json(department);
    } catch (error) {
      console.error("Error fetching department:", error);
      return NextResponse.json(
        { error: "Failed to fetch department" },
        { status: 500 }
      );
    }
  },
  { resource: "organization.settings.departments", action: "view" }
);

// PUT update department - with tenant validation
export const PUT = withAuth(
  async (req, context: RouteContext, session) => {
    try {
      const { id } = await context.params;
      const body = await req.json();
      const { name, description, headId } = body;

      // First, verify the department belongs to the user's customer account
      const existing = await prisma.department.findUnique({
        where: { id },
        select: { customerAccountId: true },
      });

      if (!existing) {
        return NextResponse.json(
          { error: "Department not found" },
          { status: 404 }
        );
      }

      if (!validateTenantAccess(session, existing.customerAccountId)) {
        return forbidden("Access denied to this department");
      }

      const department = await prisma.department.update({
        where: { id },
        data: {
          name,
          description: description || null,
          headId: headId || null,
        },
      });

      return NextResponse.json(department);
    } catch (error: unknown) {
      console.error("Error updating department:", error);
      if ((error as { code?: string }).code === "P2025") {
        return NextResponse.json(
          { error: "Department not found" },
          { status: 404 }
        );
      }
      return NextResponse.json(
        { error: "Failed to update department" },
        { status: 500 }
      );
    }
  },
  { resource: "organization.settings.departments", action: "edit" }
);

// DELETE department - with tenant validation
export const DELETE = withAuth(
  async (req, context: RouteContext, session) => {
    try {
      const { id } = await context.params;

      // First, verify the department belongs to the user's customer account
      const existing = await prisma.department.findUnique({
        where: { id },
        select: { customerAccountId: true },
      });

      if (!existing) {
        return NextResponse.json(
          { error: "Department not found" },
          { status: 404 }
        );
      }

      if (!validateTenantAccess(session, existing.customerAccountId)) {
        return forbidden("Access denied to this department");
      }

      await prisma.department.delete({
        where: { id },
      });

      return NextResponse.json({ message: "Department deleted successfully" });
    } catch (error: unknown) {
      console.error("Error deleting department:", error);
      if ((error as { code?: string }).code === "P2025") {
        return NextResponse.json(
          { error: "Department not found" },
          { status: 404 }
        );
      }
      return NextResponse.json(
        { error: "Failed to delete department" },
        { status: 500 }
      );
    }
  },
  { resource: "organization.settings.departments", action: "delete" }
);
