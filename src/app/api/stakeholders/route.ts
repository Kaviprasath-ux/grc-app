import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth, getTenantFilter, getCustomerAccountId } from "@/lib/api-auth";

// GET all stakeholders - filtered by customer account
export const GET = withAuth(
  async (req, context, session) => {
    try {
      const tenantFilter = getTenantFilter(session);

      const stakeholders = await prisma.stakeholder.findMany({
        where: tenantFilter,
        include: {
          department: true,
        },
        orderBy: { name: "asc" },
      });
      return NextResponse.json(stakeholders);
    } catch (error) {
      console.error("Error fetching stakeholders:", error);
      return NextResponse.json(
        { error: "Failed to fetch stakeholders" },
        { status: 500 }
      );
    }
  },
  { resource: "organization.context", action: "view" }
);

// POST create new stakeholder - with customer account assignment
export const POST = withAuth(
  async (req, context, session) => {
    try {
      const body = await req.json();
      const { name, email, type, status, departmentId } = body;

      if (!name) {
        return NextResponse.json(
          { error: "Stakeholder name is required" },
          { status: 400 }
        );
      }

      // Get customer account ID for the new record
      const customerAccountId = getCustomerAccountId(session);

      const stakeholder = await prisma.stakeholder.create({
        data: {
          customerAccountId,
          name,
          email,
          type: type || "Internal",
          status: status || "Active",
          departmentId,
        },
        include: {
          department: true,
        },
      });

      return NextResponse.json(stakeholder, { status: 201 });
    } catch (error) {
      console.error("Error creating stakeholder:", error);
      return NextResponse.json(
        { error: "Failed to create stakeholder" },
        { status: 500 }
      );
    }
  },
  { resource: "organization.context", action: "create" }
);
