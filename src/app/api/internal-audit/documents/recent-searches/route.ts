import { NextRequest, NextResponse } from "next/server";

// GET recent document searches
export async function GET(request: NextRequest) {
  try {
    // Placeholder: In production, this would fetch from a search history table
    // For now, return sample recent searches
    const recentSearches = [
      {
        id: "1",
        query: "What is the principle of Demonstrating integrity",
        result: null,
        timestamp: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
      },
      {
        id: "2",
        query: "Audit",
        result: null,
        timestamp: new Date(Date.now() - 172800000).toISOString(), // 2 days ago
      },
    ];

    return NextResponse.json(recentSearches);
  } catch (error) {
    console.error("Error fetching recent searches:", error);
    return NextResponse.json(
      { error: "Failed to fetch recent searches" },
      { status: 500 }
    );
  }
}
