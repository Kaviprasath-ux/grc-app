import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth, getTenantFilter } from "@/lib/api-auth";

// GET - List all suggested regulations for the tenant
export const GET = withAuth(
  async (req, context, session) => {
    try {
      const tenantFilter = getTenantFilter(session);
      const { searchParams } = new URL(req.url);
      const profileId = searchParams.get("profileId");

      const where = {
        ...tenantFilter,
        ...(profileId ? { regulatoryProfileId: profileId } : {}),
      };

      const regulations = await prisma.suggestedRegulation.findMany({
        where,
        orderBy: [
          { applicability: "asc" }, // Mandatory first, then Recommended, then Optional
          { name: "asc" },
        ],
        include: {
          regulatoryProfile: {
            select: {
              id: true,
              fullLegalEntityName: true,
            },
          },
        },
      });

      return NextResponse.json({ data: regulations });
    } catch (error) {
      console.error("Error fetching suggested regulations:", error);
      return NextResponse.json(
        { error: "Failed to fetch suggested regulations" },
        { status: 500 }
      );
    }
  },
  { resource: "compliance.regulatory-intelligence", action: "view" }
);
