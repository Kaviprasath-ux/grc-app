import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth, getCustomerAccountId } from "@/lib/api-auth";
import regulatoryAIClient, {
  RegulatoryIntelligenceRequest,
  RegulatoryIntelligenceResponse,
} from "@/lib/regulatory-ai-client";

// POST - Call AI service to suggest regulations for a profile (QPost version)
export const POST = withAuth(
  async (req, context, session) => {
    try {
      const customerAccountId = getCustomerAccountId(session);
      const body = await req.json();
      const { profileId, targetLanguage } = body;

      if (!profileId) {
        return NextResponse.json(
          { error: "Profile ID is required" },
          { status: 400 }
        );
      }

      // Fetch the profile (shared RegulatoryProfile table)
      const profile = await prisma.regulatoryProfile.findFirst({
        where: {
          id: profileId,
          customerAccountId,
        },
      });

      if (!profile) {
        return NextResponse.json(
          { error: "Profile not found" },
          { status: 404 }
        );
      }

      // Parse JSON fields
      const industrySectors = JSON.parse(profile.industrySectors || "[]") as string[];
      const countriesOfOperation = JSON.parse(profile.countriesOfOperation || "[]") as string[];
      const technologyUsed = JSON.parse(profile.technologyUsed || "[]") as string[];

      // Build request for AI service
      const aiRequest: RegulatoryIntelligenceRequest = {
        company_name: profile.fullLegalEntityName,
        country_of_incorporation: profile.country,
        countries_of_operation: countriesOfOperation,
        industry: industrySectors.length > 0 ? industrySectors[0] : "",
        organisation_type: profile.organisationType.toLowerCase(),
        technology_used: technologyUsed,
        target_language: targetLanguage || "en",
      };

      // Call AI service
      const aiResponse = await regulatoryAIClient.suggestRegulations(aiRequest);
      const aiData: RegulatoryIntelligenceResponse = aiResponse.data;

      // Delete existing suggestions for this profile (to replace with new ones)
      await prisma.suggestedRegulation.deleteMany({
        where: {
          regulatoryProfileId: profileId,
          customerAccountId,
        },
      });

      // Prepare records for batch insert
      const regulationsToCreate: {
        customerAccountId: string;
        regulatoryProfileId: string;
        name: string;
        type: string;
        applicability: string;
        reason: string;
        masterFrameworkId: string | null;
        isSubscribed: boolean;
      }[] = [];

      // Helper to find matching master framework
      const findMasterFramework = async (name: string) => {
        const framework = await prisma.framework.findFirst({
          where: {
            name: {
              contains: name,
              mode: "insensitive",
            },
            isMasterTemplate: true, // Only match master frameworks
          },
          select: { id: true },
        });
        return framework?.id || null;
      };

      // Process mandatory regulations
      for (const reg of aiData.mandatory || []) {
        const masterFrameworkId = await findMasterFramework(reg.name);
        regulationsToCreate.push({
          customerAccountId,
          regulatoryProfileId: profileId,
          name: reg.name,
          type: reg.type,
          applicability: "Mandatory",
          reason: reg.reason,
          masterFrameworkId,
          isSubscribed: false,
        });
      }

      // Process recommended regulations
      for (const reg of aiData.recommended || []) {
        const masterFrameworkId = await findMasterFramework(reg.name);
        regulationsToCreate.push({
          customerAccountId,
          regulatoryProfileId: profileId,
          name: reg.name,
          type: reg.type,
          applicability: "Recommended",
          reason: reg.reason,
          masterFrameworkId,
          isSubscribed: false,
        });
      }

      // Process optional regulations
      for (const reg of aiData.optional || []) {
        const masterFrameworkId = await findMasterFramework(reg.name);
        regulationsToCreate.push({
          customerAccountId,
          regulatoryProfileId: profileId,
          name: reg.name,
          type: reg.type,
          applicability: "Optional",
          reason: reg.reason,
          masterFrameworkId,
          isSubscribed: false,
        });
      }

      // Batch insert all regulations
      if (regulationsToCreate.length > 0) {
        await prisma.suggestedRegulation.createMany({
          data: regulationsToCreate,
        });
      }

      // Fetch the created regulations to return
      const createdRegulations = await prisma.suggestedRegulation.findMany({
        where: {
          regulatoryProfileId: profileId,
          customerAccountId,
        },
        orderBy: [
          { applicability: "asc" }, // Mandatory first, then Recommended, then Optional
          { name: "asc" },
        ],
      });

      return NextResponse.json({
        success: true,
        data: createdRegulations,
        count: createdRegulations.length,
      });
    } catch (error) {
      console.error("Error suggesting regulations:", error);
      const err = error as { status?: number; message?: string };
      return NextResponse.json(
        { error: "Unable to complete the request. Please try again." },
        { status: err.status || 500 }
      );
    }
  },
  { resource: "qpost-compliance.regulatory-intelligence", action: "create" }
);
