import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET recent document searches
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "10");

    const recentSearches = await prisma.documentSearch.findMany({
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
}

// DELETE - Clear search history
export async function DELETE(request: NextRequest) {
  try {
    await prisma.documentSearch.deleteMany({});
    return NextResponse.json({ message: "Search history cleared" });
  } catch (error) {
    console.error("Error clearing search history:", error);
    return NextResponse.json(
      { error: "Failed to clear search history" },
      { status: 500 }
    );
  }
}
