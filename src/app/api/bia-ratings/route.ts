import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth, getTenantFilter, getCustomerAccountId } from "@/lib/api-auth";

// GET all BIA ratings - filtered by customer account
export const GET = withAuth(
  async (req, context, session) => {
    try {
      const tenantFilter = getTenantFilter(session);
      const ratings = await prisma.bIARating.findMany({
        where: tenantFilter,
        orderBy: { sortOrder: "asc" },
      });
      return NextResponse.json(ratings);
    } catch (error) {
      console.error("Error fetching BIA ratings:", error);
      return NextResponse.json(
        { error: "Failed to fetch BIA ratings" },
        { status: 500 }
      );
    }
  },
  { resource: "organization.bia", action: "view" }
);

// POST create new BIA rating - with customer account assignment
export const POST = withAuth(
  async (req, context, session) => {
    try {
      const body = await req.json();
      const { label, score, description, color, sortOrder } = body;

      if (!label) {
        return NextResponse.json(
          { error: "Label is required" },
          { status: 400 }
        );
      }

      const customerAccountId = getCustomerAccountId(session);
      const tenantFilter = getTenantFilter(session);

      // Get the max sortOrder if not provided
      let order = sortOrder;
      if (order === undefined) {
        const maxOrder = await prisma.bIARating.findFirst({
          where: tenantFilter,
          orderBy: { sortOrder: "desc" },
          select: { sortOrder: true },
        });
        order = (maxOrder?.sortOrder ?? -1) + 1;
      }

      const rating = await prisma.bIARating.create({
        data: {
          customerAccountId,
          label,
          score: score ?? 0,
          description,
          color,
          sortOrder: order,
          isActive: true,
        },
      });

      return NextResponse.json(rating, { status: 201 });
    } catch (error: unknown) {
      console.error("Error creating BIA rating:", error);
      if (error && typeof error === "object" && "code" in error && error.code === "P2002") {
        return NextResponse.json(
          { error: "A rating with this label already exists" },
          { status: 409 }
        );
      }
      return NextResponse.json(
        { error: "Failed to create BIA rating" },
        { status: 500 }
      );
    }
  },
  { resource: "organization.bia", action: "create" }
);
