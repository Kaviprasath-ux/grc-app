import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { aiAuditService } from "@/services/ai-audit-service";

// POST - Smart document search
export async function POST(request: NextRequest) {
  const startTime = Date.now();
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

    // 1. Start AIOperation (Request)
    const operation = await aiAuditService.logOperation({
      endpoint: "/api/internal-audit/documents/search",
      method: "POST",
      requestBody: { query },
      userId: userId || null,
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

    // 2. Finalize AIOperation (Response)
    if (operation) {
      await prisma.aIOperation.update({
        where: { id: operation.id },
        data: {
          responseBody: JSON.stringify({ result, status }),
          statusCode: 200,
          latencyMs: Date.now() - startTime,
        },
      });
    }

    // 3. Store search in history (Projection)
    const search = await prisma.documentSearch.create({
      data: {
        query,
        result,
        status,
        userId: userId || null,
        aiOperationId: operation?.id,
      },
    });

    return NextResponse.json({
      id: search.id,
      query,
      result,
      status,
      documents,
      timestamp: search.createdAt,
      aiOperationId: operation?.id,
    });
  } catch (error) {
    console.error("Error searching documents:", error);
    return NextResponse.json(
      { error: "Failed to search documents" },
      { status: 500 }
    );
  }
}
