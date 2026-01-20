import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// POST - Smart document search
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { query, userId } = body;

    if (!query) {
      return NextResponse.json(
        { error: "Query is required" },
        { status: 400 }
      );
    }

    // Search documents in database matching query
    const documents = await prisma.internalAuditDocument.findMany({
      where: {
        OR: [
          { name: { contains: query } },
          { description: { contains: query } },
          { fileName: { contains: query } },
        ],
      },
      take: 10,
    });

    // Generate AI-like response based on search results
    let result: string;
    let status: string;

    if (documents.length > 0) {
      const docNames = documents.map(d => d.name).join(", ");
      result = `Found ${documents.length} document(s) related to "${query}". Documents include: ${docNames}. These documents contain information relevant to your query about ${query.toLowerCase()}.`;
      status = "Satisfactory";
    } else {
      result = `Unsatisfactory: The retrieved document content does not provide any relevant information regarding ${query}, as no matching entries were found in the document library.`;
      status = "Unsatisfactory";
    }

    // Store search in history
    const search = await prisma.documentSearch.create({
      data: {
        query,
        result,
        status,
        userId: userId || null,
      },
    });

    return NextResponse.json({
      id: search.id,
      query,
      result,
      status,
      documents,
      timestamp: search.createdAt,
    });
  } catch (error) {
    console.error("Error searching documents:", error);
    return NextResponse.json(
      { error: "Failed to search documents" },
      { status: 500 }
    );
  }
}
