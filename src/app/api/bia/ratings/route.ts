import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth, getTenantFilter } from "@/lib/api-auth";
import { translateRecord } from "@/lib/translation-service";

// GET all BIA ratings
export const GET = withAuth(
  async (req, _context, session) => {
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

// POST create new BIA rating
export const POST = withAuth(
  async (req, _context, session) => {
    try {
      const body = await req.json();
      const { label, score, description, color, sortOrder, isActive } = body;
      const customerAccountId = session.customerAccountId;

      if (!customerAccountId) {
        return NextResponse.json(
          { error: "Customer account not found" },
          { status: 400 }
        );
      }

      if (!label?.trim()) {
        return NextResponse.json(
          { error: "Rating label is required" },
          { status: 400 }
        );
      }

      const rating = await prisma.bIARating.create({
        data: {
          label: label.trim(),
          score: score ?? 0,
          description: description?.trim() || null,
          color: color?.trim() || null,
          sortOrder: sortOrder ?? 0,
          isActive: isActive ?? true,
          customerAccountId,
        },
      });

      if (customerAccountId) {
        void translateRecord(customerAccountId, 'BIARating', rating.id, { label: rating.label, description: rating.description ?? undefined });
      }

      return NextResponse.json(rating, { status: 201 });
    } catch (error: unknown) {
      console.error("Error creating BIA rating:", error);
      if (error && typeof error === 'object' && 'code' in error && error.code === "P2002") {
        return NextResponse.json(
          { error: "Rating with this label already exists" },
          { status: 400 }
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
