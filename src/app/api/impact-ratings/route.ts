import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth, getTenantFilter, getCustomerAccountId } from "@/lib/api-auth";

// GET all impact ratings - with tenant filtering
export const GET = withAuth(
  async (req: NextRequest, context, session) => {
    try {
      const tenantFilter = getTenantFilter(session);

      const ratings = await prisma.impactRating.findMany({
        where: tenantFilter,
        orderBy: { score: "asc" },
      });
      return NextResponse.json(ratings);
    } catch (error) {
      console.error("Error fetching impact ratings:", error);
      return NextResponse.json(
        { error: "Failed to fetch impact ratings" },
        { status: 500 }
      );
    }
  },
  { resource: "risk.settings", action: "view" }
);

// POST create impact rating - with tenant assignment
export const POST = withAuth(
  async (req: NextRequest, context, session) => {
    try {
      const customerAccountId = getCustomerAccountId(session);
      const body = await req.json();
      const { name, score, description } = body;

      if (!name?.trim()) {
        return NextResponse.json(
          { error: "Name is required" },
          { status: 400 }
        );
      }

      // Check for duplicate within tenant
      const existing = await prisma.impactRating.findFirst({
        where: {
          customerAccountId,
          name: name.trim(),
        },
      });

      if (existing) {
        return NextResponse.json(
          { error: "Rating with this name already exists" },
          { status: 409 }
        );
      }

      const rating = await prisma.impactRating.create({
        data: {
          customerAccountId,
          name: name.trim(),
          score: parseInt(score) || 0,
          description: description?.trim() || null,
        },
      });

      return NextResponse.json(rating, { status: 201 });
    } catch (error: unknown) {
      console.error("Error creating impact rating:", error);
      if ((error as { code?: string }).code === "P2002") {
        return NextResponse.json(
          { error: "Rating with this name already exists" },
          { status: 409 }
        );
      }
      return NextResponse.json(
        { error: "Failed to create impact rating" },
        { status: 500 }
      );
    }
  },
  { resource: "risk.settings", action: "create" }
);
