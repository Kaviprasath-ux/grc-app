import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth, getTenantFilter, getCustomerAccountId } from "@/lib/api-auth";

// GET - List all regulatory profiles for the tenant
export const GET = withAuth(
  async (req, context, session) => {
    try {
      const tenantFilter = getTenantFilter(session);

      const profiles = await prisma.regulatoryProfile.findMany({
        where: tenantFilter,
        orderBy: { createdAt: "desc" },
      });

      return NextResponse.json({ data: profiles });
    } catch (error) {
      console.error("Error fetching regulatory profiles:", error);
      return NextResponse.json(
        { error: "Failed to fetch regulatory profiles" },
        { status: 500 }
      );
    }
  },
  { resource: "qpost-compliance.regulatory-intelligence", action: "view" }
);

// POST - Create a new regulatory profile
export const POST = withAuth(
  async (req, context, session) => {
    try {
      const customerAccountId = getCustomerAccountId(session);
      const body = await req.json();

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

      if (!fullLegalEntityName) {
        return NextResponse.json(
          { error: "Full Legal Entity Name is required" },
          { status: 400 }
        );
      }

      const profile = await prisma.regulatoryProfile.create({
        data: {
          customerAccountId,
          fullLegalEntityName,
          registrationNo: registrationNo || "",
          url: url || "",
          country: country || "",
          industrySectors: JSON.stringify(industrySectors || []),
          otherIndustry: otherIndustry || null,
          organisationType: organisationType || "",
          countriesOfOperation: JSON.stringify(countriesOfOperation || []),
          headquarterAddress: headquarterAddress || "",
          adminContactEmail: adminContactEmail || "",
          timeZone: timeZone || "",
          language: language || "",
          businessModel: businessModel || "",
          targetAudience: JSON.stringify(targetAudience || []),
          technologyUsed: JSON.stringify(technologyUsed || []),
          createdBy: session.id,
        },
      });

      return NextResponse.json(profile, { status: 201 });
    } catch (error) {
      console.error("Error creating regulatory profile:", error);
      return NextResponse.json(
        { error: "Failed to create regulatory profile" },
        { status: 500 }
      );
    }
  },
  { resource: "qpost-compliance.regulatory-intelligence", action: "create" }
);
