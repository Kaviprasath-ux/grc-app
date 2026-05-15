import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth, getTenantFilter } from "@/lib/api-auth";

// GET - List all technical evidence collections for the tenant
export const GET = withAuth(
  async (req, context, session) => {
    try {
      const { searchParams } = new URL(req.url);
      const platform = searchParams.get("platform");
      const credentialId = searchParams.get("credentialId");
      const tenantFilter = getTenantFilter(session);

      const where: Record<string, unknown> = { ...tenantFilter };
      if (platform) where.platform = platform;
      if (credentialId) where.credentialId = credentialId;

      const collections = await prisma.technicalEvidenceCollection.findMany({
        where,
        orderBy: [{ platform: "asc" }, { displayName: "asc" }],
        include: {
          credential: {
            select: { id: true, name: true, platform: true, isActive: true },
          },
          collectedBy: {
            select: { id: true, fullName: true },
          },
          _count: {
            select: { records: true, controlMappings: true },
          },
          autoCreatedEvidence: {
            select: { id: true, evidenceCode: true, status: true },
          },
        },
      });

      return NextResponse.json({ data: collections });
    } catch (error) {
      console.error("Error fetching technical evidence collections:", error);
      return NextResponse.json(
        { error: "Failed to fetch technical evidence collections" },
        { status: 500 }
      );
    }
  },
  { resource: "technical-evidence.dashboard", action: "view" }
);
