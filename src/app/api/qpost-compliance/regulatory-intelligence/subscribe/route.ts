import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth, getCustomerAccountId } from "@/lib/api-auth";

/**
 * POST /api/qpost-compliance/regulatory-intelligence/subscribe
 * Subscribe a master framework for the current customer account (QPost version).
 * This clones the master framework (with categories, requirements) into QPost tables.
 *
 * Body: { frameworkId: string }
 */
export const POST = withAuth(
  async (req, context, session) => {
    try {
      const customerAccountId = getCustomerAccountId(session);
      const body = await req.json();
      const { frameworkId, suggestedRegulationId } = body;

      if (!frameworkId) {
        return NextResponse.json(
          { error: "frameworkId is required" },
          { status: 400 }
        );
      }

      // Fetch the source (master) framework with related data
      // Note: Source framework comes from the main Framework table (master templates)
      const sourceFramework = await prisma.framework.findUnique({
        where: { id: frameworkId },
        include: {
          requirementCategories: true,
          requirements: true,
        },
      });

      if (!sourceFramework) {
        return NextResponse.json(
          { error: "Framework not found" },
          { status: 404 }
        );
      }

      // Check if customer already has a QPost framework with this name
      const existing = await prisma.qPostFramework.findFirst({
        where: {
          customerAccountId,
          name: sourceFramework.name,
        },
      });

      if (existing) {
        return NextResponse.json(
          { error: "You have already subscribed to this framework" },
          { status: 409 }
        );
      }

      // Clone framework and related data into QPost tables in a transaction
      const result = await prisma.$transaction(async (tx) => {
        // 1. Create cloned QPost framework
        const newFramework = await tx.qPostFramework.create({
          data: {
            customerAccountId,
            code: sourceFramework.code,
            name: sourceFramework.name,
            description: sourceFramework.description,
            version: sourceFramework.version,
            type: sourceFramework.type,
            status: "Subscribed",
            isMasterTemplate: false,
            sourceFrameworkId: sourceFramework.id,
          },
        });

        // 2. Clone requirement categories into QPost
        const categoryMap = new Map<string, string>();
        for (const cat of sourceFramework.requirementCategories) {
          const newCat = await tx.qPostRequirementCategory.create({
            data: {
              customerAccountId,
              frameworkId: newFramework.id,
              name: cat.name,
              description: cat.description,
              sortOrder: cat.sortOrder,
            },
          });
          categoryMap.set(cat.id, newCat.id);
        }

        // 3. Clone requirements into QPost (handle parent hierarchy)
        const requirementMap = new Map<string, string>();
        // First pass: create requirements without parentId
        const sortedReqs = [...sourceFramework.requirements].sort(
          (a, b) => (a.parentId ? 1 : 0) - (b.parentId ? 1 : 0)
        );

        for (const req of sortedReqs) {
          const newReq = await tx.qPostRequirement.create({
            data: {
              customerAccountId,
              frameworkId: newFramework.id,
              categoryId: req.categoryId ? categoryMap.get(req.categoryId) || null : null,
              parentId: req.parentId ? requirementMap.get(req.parentId) || null : null,
              code: req.code,
              name: req.name,
              description: req.description,
              sortOrder: req.sortOrder,
            },
          });
          requirementMap.set(req.id, newReq.id);
        }

        return newFramework;
      });

      // Update the SuggestedRegulation if provided (shared table)
      if (suggestedRegulationId) {
        await prisma.suggestedRegulation.update({
          where: { id: suggestedRegulationId },
          data: { isSubscribed: true },
        });
      }

      return NextResponse.json(result, { status: 201 });
    } catch (error) {
      console.error("Error subscribing QPost framework:", error);
      return NextResponse.json(
        { error: "Failed to subscribe framework" },
        { status: 500 }
      );
    }
  },
  { resource: "qpost-compliance.regulatory-intelligence", action: "create" }
);
