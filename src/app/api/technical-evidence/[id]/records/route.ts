import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth, getTenantFilter } from "@/lib/api-auth";

interface RouteContext {
  params: Promise<{ id: string }>;
}

// GET - Paginated list of collected records for a collection
export const GET = withAuth(
  async (req, context: RouteContext, session) => {
    try {
      const { id } = await context.params;
      const { searchParams } = new URL(req.url);
      const page = parseInt(searchParams.get("page") || "1");
      const limit = parseInt(searchParams.get("limit") || "50");
      const tenantFilter = getTenantFilter(session);

      // Verify collection belongs to tenant
      const collection = await prisma.technicalEvidenceCollection.findFirst({
        where: { id, ...tenantFilter },
        select: {
          id: true,
          displayName: true,
          dataSource: true,
          platform: true,
          recordCount: true,
          lastCollectedAt: true,
        },
      });

      if (!collection) {
        return NextResponse.json(
          { error: "Collection not found" },
          { status: 404 }
        );
      }

      const [records, total] = await Promise.all([
        prisma.technicalEvidenceRecord.findMany({
          where: { collectionId: id },
          orderBy: { collectedAt: "desc" },
          skip: (page - 1) * limit,
          take: limit,
          select: {
            id: true,
            data: true,
            collectedAt: true,
          },
        }),
        prisma.technicalEvidenceRecord.count({
          where: { collectionId: id },
        }),
      ]);

      // Parse JSON data for each record
      const parsedRecords = records.map((r) => ({
        id: r.id,
        data: JSON.parse(r.data),
        collectedAt: r.collectedAt,
      }));

      return NextResponse.json({
        data: parsedRecords,
        collection,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      });
    } catch (error) {
      console.error("Error fetching records:", error);
      return NextResponse.json(
        { error: "Failed to fetch records" },
        { status: 500 }
      );
    }
  },
  { resource: "technical-evidence.dashboard", action: "view" }
);
