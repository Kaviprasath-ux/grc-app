import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth, getTenantFilter } from "@/lib/api-auth";

interface RouteContext {
  params: Promise<{ id: string }>;
}

// GET - Get a single regulatory profile
export const GET = withAuth(
  async (req, context, session) => {
    try {
      const { id } = await (context as RouteContext).params;
      const tenantFilter = getTenantFilter(session);

      const profile = await prisma.regulatoryProfile.findFirst({
        where: { id, ...tenantFilter },
      });

      if (!profile) {
        return NextResponse.json(
          { error: "Profile not found" },
          { status: 404 }
        );
      }

      return NextResponse.json({ data: profile });
    } catch (error) {
      console.error("Error fetching regulatory profile:", error);
      return NextResponse.json(
        { error: "Failed to fetch regulatory profile" },
        { status: 500 }
      );
    }
  },
  { resource: "qpost-compliance.regulatory-intelligence", action: "view" }
);

// PUT - Update a regulatory profile
export const PUT = withAuth(
  async (req, context, session) => {
    try {
      const { id } = await (context as RouteContext).params;
      const tenantFilter = getTenantFilter(session);
      const body = await req.json();

      const existing = await prisma.regulatoryProfile.findFirst({
        where: { id, ...tenantFilter },
      });

      if (!existing) {
        return NextResponse.json(
          { error: "Profile not found" },
          { status: 404 }
        );
      }

      const {
        fullLegalEntityName,
        registrationNo,
        url,
        country,
        industrySectors,
        otherIndustry,
        organisationType,
        countriesOfOperation,
        headquarterAddress,
        adminContactEmail,
        timeZone,
        language,
        businessModel,
        targetAudience,
        technologyUsed,
      } = body;

      const profile = await prisma.regulatoryProfile.update({
        where: { id },
        data: {
          fullLegalEntityName,
          registrationNo,
          url,
          country,
          industrySectors: JSON.stringify(industrySectors || []),
          otherIndustry: otherIndustry || null,
          organisationType,
          countriesOfOperation: JSON.stringify(countriesOfOperation || []),
          headquarterAddress,
          adminContactEmail,
          timeZone,
          language,
          businessModel,
          targetAudience: JSON.stringify(targetAudience || []),
          technologyUsed: JSON.stringify(technologyUsed || []),
        },
      });

      return NextResponse.json(profile);
    } catch (error) {
      console.error("Error updating regulatory profile:", error);
      return NextResponse.json(
        { error: "Failed to update regulatory profile" },
        { status: 500 }
      );
    }
  },
  { resource: "qpost-compliance.regulatory-intelligence", action: "edit" }
);

// DELETE - Delete a regulatory profile
export const DELETE = withAuth(
  async (req, context, session) => {
    try {
      const { id } = await (context as RouteContext).params;
      const tenantFilter = getTenantFilter(session);

      const existing = await prisma.regulatoryProfile.findFirst({
        where: { id, ...tenantFilter },
      });

      if (!existing) {
        return NextResponse.json(
          { error: "Profile not found" },
          { status: 404 }
        );
      }

      await prisma.regulatoryProfile.delete({ where: { id } });

      return NextResponse.json({ message: "Profile deleted successfully" });
    } catch (error) {
      console.error("Error deleting regulatory profile:", error);
      return NextResponse.json(
        { error: "Failed to delete regulatory profile" },
        { status: 500 }
      );
    }
  },
  { resource: "qpost-compliance.regulatory-intelligence", action: "delete" }
);
