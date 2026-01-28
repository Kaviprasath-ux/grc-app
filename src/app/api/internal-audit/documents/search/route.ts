import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth, getTenantFilter, getAuditHeadFilter } from "@/lib/api-auth";

// POST - Smart document search
// Documents are specific to each Audit Head - only search within their documents
export const POST = withAuth(
  async (request: NextRequest, context, session) => {
    try {
      const body = await request.json();
      const { query } = body;

      if (!query) {
        return NextResponse.json(
          { error: "Query is required" },
          { status: 400 }
        );
      }

      // Apply tenant and audit head filters - documents are NOT shared between Audit Heads
      const tenantFilter = getTenantFilter(session);
      const auditHeadFilter = getAuditHeadFilter(session);

      // Search documents in database matching query - filtered by auditHead
      const documents = await prisma.internalAuditDocument.findMany({
        where: {
          ...tenantFilter,
          ...auditHeadFilter,
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
      let searchStatus: string;

      if (documents.length > 0) {
        const docNames = documents.map(d => d.name).join(", ");
        result = `Found ${documents.length} document(s) related to "${query}". Documents include: ${docNames}. These documents contain information relevant to your query about ${query.toLowerCase()}.`;
        searchStatus = "Satisfactory";
      } else {
        result = `Unsatisfactory: The retrieved document content does not provide any relevant information regarding ${query}, as no matching entries were found in the document library.`;
        searchStatus = "Unsatisfactory";
      }

      // Store search in history with current user's ID
      const search = await prisma.documentSearch.create({
        data: {
          query,
          result,
          status: searchStatus,
          userId: session.id,
        },
      });

      return NextResponse.json({
        id: search.id,
        query,
        result,
        status: searchStatus,
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
  },
  { resource: "audit.documents", action: "view" }
);
