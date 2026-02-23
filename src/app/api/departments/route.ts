import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth, getTenantFilter, getCustomerAccountId } from "@/lib/api-auth";
import { translateRecord } from '@/lib/translation-service';

// GET all departments - filtered by customer account
// Uses organization.department (basic view) instead of organization.settings.departments (admin)
// This allows roles like Auditee to see department names for display purposes
export const GET = withAuth(
  async (req, context, session) => {
    try {
      const tenantFilter = getTenantFilter(session);

      const departments = await prisma.department.findMany({
        where: tenantFilter,
        include: {
          _count: {
            select: { users: true, issues: true, stakeholders: true },
          },
        },
        orderBy: { name: "asc" },
      });
      return NextResponse.json(departments);
    } catch (error) {
      console.error("Error fetching departments:", error);
      return NextResponse.json(
        { error: "Failed to fetch departments" },
        { status: 500 }
      );
    }
  },
  { resource: "organization.department", action: "view" }
);

// POST create new department - with customer account assignment
export const POST = withAuth(
  async (req, context, session) => {
    try {
      const body = await req.json();
      const { name, description, headId } = body;

      if (!name) {
        return NextResponse.json(
          { error: "Department name is required" },
          { status: 400 }
        );
      }

      // Get customer account ID for the new record
      const customerAccountId = getCustomerAccountId(session);

      const department = await prisma.department.create({
        data: {
          customerAccountId,
          name,
          description: description || null,
          headId: headId || null,
        },
      });

      if (customerAccountId) void translateRecord(customerAccountId, 'Department', department.id, { name: department.name, description: department.description });

      return NextResponse.json(department, { status: 201 });
    } catch (error: unknown) {
      console.error("Error creating department:", error);
      if ((error as { code?: string }).code === "P2002") {
        return NextResponse.json(
          { error: "Department with this name already exists" },
          { status: 409 }
        );
      }
      return NextResponse.json(
        { error: "Failed to create department" },
        { status: 500 }
      );
    }
  },
  { resource: "organization.settings.departments", action: "create" }
);
