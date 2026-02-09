import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth, getTenantFilter, getCustomerAccountId } from "@/lib/api-auth";

// GET all BIA scoring ranges - filtered by customer account
export const GET = withAuth(
  async (req, context, session) => {
    try {
      const { searchParams } = new URL(req.url);
      const calculationType = searchParams.get("calculationType");
      const tenantFilter = getTenantFilter(session);

      const whereClause = {
        ...tenantFilter,
        ...(calculationType && { calculationType }),
      };

      const ranges = await prisma.bIAScoringRange.findMany({
        where: whereClause,
        orderBy: { sortOrder: "asc" },
      });
      return NextResponse.json(ranges);
    } catch (error) {
      console.error("Error fetching BIA scoring ranges:", error);
      return NextResponse.json(
        { error: "Failed to fetch BIA scoring ranges" },
        { status: 500 }
      );
    }
  },
  { resource: "organization.bia", action: "view" }
);

// POST create new BIA scoring range - with tenant isolation
export const POST = withAuth(
  async (req, context, session) => {
    try {
      const body = await req.json();
      const { label, lowValue, highValue, color, calculationType, sortOrder } = body;
      const customerAccountId = getCustomerAccountId(session);
      const tenantFilter = getTenantFilter(session);

      if (!label) {
        return NextResponse.json(
          { error: "Label is required" },
          { status: 400 }
        );
      }

      // Get the max sortOrder if not provided
      let order = sortOrder;
      if (order === undefined) {
        const maxOrder = await prisma.bIAScoringRange.findFirst({
          where: {
            ...tenantFilter,
            calculationType: calculationType || "High of all"
          },
          orderBy: { sortOrder: "desc" },
          select: { sortOrder: true },
        });
        order = (maxOrder?.sortOrder ?? -1) + 1;
      }

      const range = await prisma.bIAScoringRange.create({
        data: {
          customerAccountId,
          label,
          lowValue: lowValue ?? 0,
          highValue: highValue ?? null,
          color,
          calculationType: calculationType || "High of all",
          sortOrder: order,
        },
      });

      return NextResponse.json(range, { status: 201 });
    } catch (error: unknown) {
      console.error("Error creating BIA scoring range:", error);
      if (error && typeof error === "object" && "code" in error && error.code === "P2002") {
        return NextResponse.json(
          { error: "A range with this label and calculation type already exists" },
          { status: 409 }
        );
      }
      return NextResponse.json(
        { error: "Failed to create BIA scoring range" },
        { status: 500 }
      );
    }
  },
  { resource: "organization.bia", action: "create" }
);
