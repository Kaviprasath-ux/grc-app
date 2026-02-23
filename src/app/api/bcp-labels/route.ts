import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth, getTenantFilter, getCustomerAccountId } from "@/lib/api-auth";
import { translateRecord } from '@/lib/translation-service';

// GET all BCP labels - filtered by customer account
export const GET = withAuth(
  async (req, context, session) => {
    try {
      const tenantFilter = getTenantFilter(session);

      const labels = await prisma.bCPLabel.findMany({
        where: tenantFilter,
        orderBy: { sortOrder: "asc" },
      });
      return NextResponse.json(labels);
    } catch (error) {
      console.error("Error fetching BCP labels:", error);
      return NextResponse.json(
        { error: "Failed to fetch BCP labels" },
        { status: 500 }
      );
    }
  },
  { resource: "organization.bia", action: "view" }
);

// POST create new BCP label - with tenant isolation
export const POST = withAuth(
  async (req, context, session) => {
    try {
      const body = await req.json();
      const { name, type, hours, description, sortOrder } = body;
      const customerAccountId = getCustomerAccountId(session);
      const tenantFilter = getTenantFilter(session);

      if (!name) {
        return NextResponse.json(
          { error: "Name is required" },
          { status: 400 }
        );
      }

      // Get the max sortOrder if not provided
      let order = sortOrder;
      if (order === undefined) {
        const maxOrder = await prisma.bCPLabel.findFirst({
          where: tenantFilter,
          orderBy: { sortOrder: "desc" },
          select: { sortOrder: true },
        });
        order = (maxOrder?.sortOrder ?? -1) + 1;
      }

      const label = await prisma.bCPLabel.create({
        data: {
          customerAccountId,
          name,
          type: type || "RTO",
          hours: hours ?? 0,
          description,
          sortOrder: order,
          isActive: true,
        },
      });

      if (customerAccountId) void translateRecord(customerAccountId, 'BCPLabel', label.id, { name: label.name, description: label.description });

      return NextResponse.json(label, { status: 201 });
    } catch (error: unknown) {
      console.error("Error creating BCP label:", error);
      if (error && typeof error === "object" && "code" in error && error.code === "P2002") {
        return NextResponse.json(
          { error: "A label with this name already exists" },
          { status: 409 }
        );
      }
      return NextResponse.json(
        { error: "Failed to create BCP label" },
        { status: 500 }
      );
    }
  },
  { resource: "organization.bia", action: "create" }
);
