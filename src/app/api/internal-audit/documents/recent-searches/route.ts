import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api-auth";

// GET recent document searches - filtered by current user
export const GET = withAuth(
  async (request: NextRequest, context, session) => {
    try {
      const { searchParams } = new URL(request.url);
      const limit = parseInt(searchParams.get("limit") || "10");

      // Only show searches made by the current user
      const recentSearches = await prisma.documentSearch.findMany({
        where: {
          userId: session.id,
        },
        orderBy: { createdAt: "desc" },
        take: limit,
      });

      return NextResponse.json(recentSearches);
    } catch (error) {
      console.error("Error fetching recent searches:", error);
      return NextResponse.json(
        { error: "Failed to fetch recent searches" },
        { status: 500 }
      );
    }
  },
  { resource: "audit.documents", action: "view" }
);

// DELETE - Clear search history for current user only
export const DELETE = withAuth(
  async (request: NextRequest, context, session) => {
    try {
      // Only delete searches belonging to the current user
      await prisma.documentSearch.deleteMany({
        where: {
          userId: session.id,
        },
      });
      return NextResponse.json({ message: "Search history cleared" });
    } catch (error) {
      console.error("Error clearing search history:", error);
      return NextResponse.json(
        { error: "Failed to clear search history" },
        { status: 500 }
      );
    }
  },
  { resource: "audit.documents", action: "delete" }
);
