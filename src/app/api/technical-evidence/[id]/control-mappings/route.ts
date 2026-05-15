import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth, getTenantFilter } from "@/lib/api-auth";

interface RouteContext {
  params: Promise<{ id: string }>;
}

// GET - List control mappings for a collection
export const GET = withAuth(
  async (req, context: RouteContext, session) => {
    try {
      const { id } = await context.params;
      const tenantFilter = getTenantFilter(session);

      // Verify collection belongs to tenant
      const collection = await prisma.technicalEvidenceCollection.findFirst({
        where: { id, ...tenantFilter },
        select: { id: true },
      });

      if (!collection) {
        return NextResponse.json({ error: "Collection not found" }, { status: 404 });
      }

      const mappings = await prisma.technicalEvidenceControlMapping.findMany({
        where: { collectionId: id },
        include: {
          control: {
            select: {
              id: true,
              controlCode: true,
              name: true,
              frameworkId: true,
              framework: { select: { id: true, name: true } },
            },
          },
          framework: { select: { id: true, name: true } },
        },
        orderBy: [{ confirmedByUser: "desc" }, { confidenceScore: "desc" }],
      });

      return NextResponse.json({ data: mappings });
    } catch (error) {
      console.error("Error fetching control mappings:", error);
      return NextResponse.json({ error: "Failed to fetch control mappings" }, { status: 500 });
    }
  },
  { resource: "technical-evidence.dashboard", action: "view" }
);

// PATCH - Confirm or reject an AI suggestion
export const PATCH = withAuth(
  async (req, context: RouteContext, session) => {
    try {
      const { id } = await context.params;
      const tenantFilter = getTenantFilter(session);

      // Verify collection belongs to tenant
      const collection = await prisma.technicalEvidenceCollection.findFirst({
        where: { id, ...tenantFilter },
        select: { id: true },
      });

      if (!collection) {
        return NextResponse.json({ error: "Collection not found" }, { status: 404 });
      }

      const body = await req.json();
      const { mappingId, confirmed } = body;

      if (!mappingId || confirmed === undefined) {
        return NextResponse.json(
          { error: "mappingId and confirmed are required" },
          { status: 400 }
        );
      }

      const mapping = await prisma.technicalEvidenceControlMapping.findFirst({
        where: { id: mappingId, collectionId: id },
      });

      if (!mapping) {
        return NextResponse.json({ error: "Mapping not found" }, { status: 404 });
      }

      if (confirmed) {
        await prisma.technicalEvidenceControlMapping.update({
          where: { id: mappingId },
          data: { confirmedByUser: true },
        });
      } else {
        // Reject = delete the mapping
        await prisma.technicalEvidenceControlMapping.delete({
          where: { id: mappingId },
        });
      }

      return NextResponse.json({
        message: confirmed ? "Mapping confirmed" : "Mapping rejected",
      });
    } catch (error) {
      console.error("Error updating control mapping:", error);
      return NextResponse.json({ error: "Failed to update mapping" }, { status: 500 });
    }
  },
  { resource: "technical-evidence.dashboard", action: "edit" }
);

// POST - Manually add a control mapping
export const POST = withAuth(
  async (req, context: RouteContext, session) => {
    try {
      const { id } = await context.params;
      const tenantFilter = getTenantFilter(session);

      const collection = await prisma.technicalEvidenceCollection.findFirst({
        where: { id, ...tenantFilter },
        select: { id: true },
      });

      if (!collection) {
        return NextResponse.json({ error: "Collection not found" }, { status: 404 });
      }

      const body = await req.json();
      const { controlId, frameworkId } = body;

      if (!controlId) {
        return NextResponse.json({ error: "controlId is required" }, { status: 400 });
      }

      const mapping = await prisma.technicalEvidenceControlMapping.create({
        data: {
          collectionId: id,
          controlId,
          frameworkId: frameworkId || null,
          suggestedByAI: false,
          confirmedByUser: true,
          confidenceScore: 1.0,
        },
        include: {
          control: {
            select: { id: true, controlCode: true, name: true },
          },
        },
      });

      return NextResponse.json({ data: mapping }, { status: 201 });
    } catch (error: unknown) {
      if (error && typeof error === "object" && "code" in error && (error as { code: string }).code === "P2002") {
        return NextResponse.json({ error: "This control is already mapped" }, { status: 409 });
      }
      console.error("Error creating control mapping:", error);
      return NextResponse.json({ error: "Failed to create mapping" }, { status: 500 });
    }
  },
  { resource: "technical-evidence.dashboard", action: "edit" }
);
