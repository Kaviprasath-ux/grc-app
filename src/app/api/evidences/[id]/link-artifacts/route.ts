import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth } from "@/lib/api-auth";

interface RouteContext {
  params: Promise<{ id: string }>;
}

// POST - Link artifacts to evidence
export const POST = withAuth(
  async (req, context: RouteContext) => {
    try {
      const { id } = await context.params;
      const body = await req.json();
      const { artifactIds } = body;

      if (!artifactIds || !Array.isArray(artifactIds) || artifactIds.length === 0) {
        return NextResponse.json(
          { error: "Artifact IDs are required" },
          { status: 400 }
        );
      }

      // Verify evidence exists
      const evidence = await prisma.evidence.findUnique({
        where: { id },
      });

      if (!evidence) {
        return NextResponse.json(
          { error: "Evidence not found" },
          { status: 404 }
        );
      }

      // Link artifacts
      const results = [];
      for (const artifactId of artifactIds) {
        try {
          const link = await prisma.evidenceArtifact.create({
            data: {
              evidenceId: id,
              artifactId,
            },
          });
          results.push(link);
        } catch (err) {
          // Ignore duplicate errors
          console.log(`Artifact ${artifactId} already linked or error:`, err);
        }
      }

      // Update evidence status to Draft if currently "Not Uploaded"
      if (evidence.status === "Not Uploaded" && results.length > 0) {
        await prisma.evidence.update({
          where: { id },
          data: { status: "Draft" },
        });
      }

      return NextResponse.json({
        message: "Artifacts linked successfully",
        linked: results.length,
      });
    } catch (error) {
      console.error("Error linking artifacts:", error);
      return NextResponse.json(
        { error: "Failed to link artifacts" },
        { status: 500 }
      );
    }
  },
  { resource: "compliance.evidence", action: "edit" }
);

// DELETE - Unlink artifact from evidence
export const DELETE = withAuth(
  async (req, context: RouteContext) => {
    try {
      const { id } = await context.params;
      const body = await req.json();
      const { artifactId } = body;

      if (!artifactId) {
        return NextResponse.json(
          { error: "Artifact ID is required" },
          { status: 400 }
        );
      }

      // Delete the link
      await prisma.evidenceArtifact.deleteMany({
        where: {
          evidenceId: id,
          artifactId,
        },
      });

      return NextResponse.json({ message: "Artifact unlinked successfully" });
    } catch (error) {
      console.error("Error unlinking artifact:", error);
      return NextResponse.json(
        { error: "Failed to unlink artifact" },
        { status: 500 }
      );
    }
  },
  { resource: "compliance.evidence", action: "edit" }
);
