import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth, validateTenantAccess, forbidden } from "@/lib/api-auth";

interface RouteContext {
  params: Promise<{ id: string }>;
}

// GET all artifacts linked to evidence - with tenant validation
export const GET = withAuth(
  async (req, context: RouteContext, session) => {
    try {
      const { id } = await context.params;

      // Check if evidence belongs to user's tenant
      const evidence = await prisma.evidence.findUnique({
        where: { id },
        select: { customerAccountId: true },
      });

      if (!evidence) {
        return NextResponse.json(
          { error: "Evidence not found" },
          { status: 404 }
        );
      }

      if (!validateTenantAccess(session, evidence.customerAccountId)) {
        return forbidden("Access denied to this evidence");
      }

      const evidenceArtifacts = await prisma.evidenceArtifact.findMany({
        where: { evidenceId: id },
        include: {
          artifact: {
            include: {
              uploader: {
                select: {
                  id: true,
                  fullName: true,
                },
              },
            },
          },
        },
      });

      return NextResponse.json(evidenceArtifacts);
    } catch (error) {
      console.error("Error fetching evidence artifacts:", error);
      return NextResponse.json(
        { error: "Failed to fetch evidence artifacts" },
        { status: 500 }
      );
    }
  },
  { resource: "compliance.evidence", action: "view" }
);

// POST link artifact to evidence - with tenant validation
export const POST = withAuth(
  async (req, context: RouteContext, session) => {
    try {
      const { id } = await context.params;
      const body = await req.json();
      const { artifactId, artifactIds } = body;

      // Check if evidence exists and verify tenant access
      const evidence = await prisma.evidence.findUnique({
        where: { id },
        select: { id: true, customerAccountId: true },
      });

      if (!evidence) {
        return NextResponse.json(
          { error: "Evidence not found" },
          { status: 404 }
        );
      }

      if (!validateTenantAccess(session, evidence.customerAccountId)) {
        return forbidden("Access denied to this evidence");
      }

    // Handle multiple artifact IDs
    const idsToLink = artifactIds || (artifactId ? [artifactId] : []);

    if (idsToLink.length === 0) {
      return NextResponse.json(
        { error: "Artifact ID(s) required" },
        { status: 400 }
      );
    }

    const results = [];
    for (const artId of idsToLink) {
      // Check if artifact exists
      const artifact = await prisma.artifact.findUnique({
        where: { id: artId },
      });

      if (!artifact) continue;

      // Check if already linked
      const existingLink = await prisma.evidenceArtifact.findFirst({
        where: {
          evidenceId: id,
          artifactId: artId,
        },
      });

      if (existingLink) continue;

      // Create the link
      const evidenceArtifact = await prisma.evidenceArtifact.create({
        data: {
          evidenceId: id,
          artifactId: artId,
        },
        include: {
          artifact: {
            include: {
              uploader: {
                select: {
                  id: true,
                  fullName: true,
                },
              },
            },
          },
        },
      });

      results.push(evidenceArtifact);
    }

      return NextResponse.json(results, { status: 201 });
    } catch (error) {
      console.error("Error linking artifact to evidence:", error);
      return NextResponse.json(
        { error: "Failed to link artifact" },
        { status: 500 }
      );
    }
  },
  { resource: "compliance.evidence", action: "edit" }
);

// DELETE unlink artifact from evidence - with tenant validation
export const DELETE = withAuth(
  async (req, context: RouteContext, session) => {
    try {
      const { id } = await context.params;

      // Check if evidence exists and verify tenant access
      const evidence = await prisma.evidence.findUnique({
        where: { id },
        select: { customerAccountId: true },
      });

      if (!evidence) {
        return NextResponse.json(
          { error: "Evidence not found" },
          { status: 404 }
        );
      }

      if (!validateTenantAccess(session, evidence.customerAccountId)) {
        return forbidden("Access denied to this evidence");
      }

      let artifactId: string | null = null;
      try {
        const body = await req.json();
        artifactId = body.artifactId;
      } catch {
        // No body provided, that's ok
      }

      if (artifactId) {
        // Delete specific link
        const link = await prisma.evidenceArtifact.findFirst({
          where: {
            evidenceId: id,
            artifactId,
          },
        });

        if (!link) {
          return NextResponse.json(
            { error: "Artifact is not linked to this evidence" },
            { status: 404 }
          );
        }

        await prisma.evidenceArtifact.delete({
          where: { id: link.id },
        });

        return NextResponse.json({ message: "Artifact unlinked successfully" });
      }

      // Delete all links for this evidence
      await prisma.evidenceArtifact.deleteMany({
        where: { evidenceId: id },
      });

      return NextResponse.json({ message: "All artifacts unlinked successfully" });
    } catch (error) {
      console.error("Error unlinking artifact from evidence:", error);
      return NextResponse.json(
        { error: "Failed to unlink artifact" },
        { status: 500 }
      );
    }
  },
  { resource: "compliance.evidence", action: "edit" }
);
