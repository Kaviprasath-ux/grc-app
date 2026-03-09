import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth, validateTenantAccess, forbidden } from "@/lib/api-auth";

interface RouteContext {
  params: Promise<{ id: string }>;
}

// POST /api/qpost-compliance/artifacts/[id]/link-evidences - Link QPost artifact to evidences
export const POST = withAuth(
  async (req: NextRequest, context: RouteContext, session) => {
    try {
      const { id } = await context.params;
      const body = await req.json();
      const { evidenceIds } = body;

      if (!evidenceIds || !Array.isArray(evidenceIds)) {
        return NextResponse.json(
          { error: "Evidence IDs are required" },
          { status: 400 }
        );
      }

      // Verify artifact exists and user has access
      const artifact = await prisma.qPostArtifact.findUnique({
        where: { id },
        select: { customerAccountId: true },
      });

      if (!artifact) {
        return NextResponse.json(
          { error: "Artifact not found" },
          { status: 404 }
        );
      }

      if (!validateTenantAccess(session, artifact.customerAccountId)) {
        return forbidden("Access denied to this artifact");
      }

      // Delete existing links
      await prisma.qPostEvidenceArtifact.deleteMany({
        where: { artifactId: id },
      });

      // Create new links
      if (evidenceIds.length > 0) {
        await prisma.qPostEvidenceArtifact.createMany({
          data: evidenceIds.map((evidenceId: string) => ({
            evidenceId,
            artifactId: id,
          })),
          skipDuplicates: true,
        });

        // Update evidence status to Draft if currently "Not Uploaded"
        await prisma.qPostEvidence.updateMany({
          where: {
            id: { in: evidenceIds },
            status: "Not Uploaded",
          },
          data: {
            status: "Draft",
          },
        });
      }

      // Fetch updated artifact with linked evidences
      const updatedArtifact = await prisma.qPostArtifact.findUnique({
        where: { id },
        include: {
          linkedEvidences: {
            include: {
              evidence: {
                select: { id: true, evidenceCode: true, name: true },
              },
            },
          },
        },
      });

      return NextResponse.json({
        message: "Evidences linked successfully",
        linkedEvidences: updatedArtifact?.linkedEvidences.map((le) => ({
          evidenceId: le.evidenceId,
          evidence: le.evidence,
        })),
      });
    } catch (error) {
      console.error("Error linking QPost evidences:", error);
      return NextResponse.json(
        { error: "Failed to link evidences" },
        { status: 500 }
      );
    }
  },
  { resource: "qpost-compliance.artifacts", action: "edit" }
);
