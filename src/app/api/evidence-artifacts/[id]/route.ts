import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth, forbidden, validateTenantAccess, getCustomerAccountId } from "@/lib/api-auth";
import { unlink } from "fs/promises";
import path from "path";

interface RouteContext {
  params: Promise<{ id: string }>;
}

// GET /api/evidence-artifacts/[id] - Get single artifact details
export const GET = withAuth(
  async (req: NextRequest, context: RouteContext, session) => {
    try {
      const { id } = await context.params;

      const artifact = await prisma.artifact.findUnique({
        where: { id },
        include: {
          uploader: {
            select: {
              id: true,
              fullName: true,
            },
          },
          linkedEvidences: {
            include: {
              evidence: {
                select: {
                  id: true,
                  evidenceCode: true,
                  name: true,
                  status: true,
                },
              },
            },
          },
        },
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

      return NextResponse.json({
        id: artifact.id,
        documentCode: artifact.artifactCode,
        fileName: artifact.fileName,
        fileType: artifact.fileType,
        fileSize: artifact.fileSize,
        filePath: artifact.filePath,
        status: "Active",
        uploadedAt: artifact.createdAt.toISOString(),
        uploadedBy: artifact.uploader?.fullName || artifact.uploadedBy || null,
        linkedEvidences: artifact.linkedEvidences.map((le) => ({
          id: le.evidence.id,
          code: le.evidence.evidenceCode,
          name: le.evidence.name,
          status: le.evidence.status,
          linkedAt: le.createdAt.toISOString(),
        })),
      });
    } catch (error) {
      console.error("Error fetching artifact:", error);
      return NextResponse.json(
        { error: "Failed to fetch artifact" },
        { status: 500 }
      );
    }
  },
  { resource: "compliance.evidence", action: "view" }
);

// PATCH /api/evidence-artifacts/[id] - Update artifact links to evidences
export const PATCH = withAuth(
  async (req: NextRequest, context: RouteContext, session) => {
    try {
      const { id } = await context.params;
      const body = await req.json();
      const { evidenceIds } = body;

      if (!Array.isArray(evidenceIds)) {
        return NextResponse.json(
          { error: "evidenceIds must be an array" },
          { status: 400 }
        );
      }

      const artifact = await prisma.artifact.findUnique({
        where: { id },
        select: { id: true, customerAccountId: true },
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

      // Get current links
      const currentLinks = await prisma.evidenceArtifact.findMany({
        where: { artifactId: id },
        select: { evidenceId: true },
      });
      const currentEvidenceIds = currentLinks.map((l) => l.evidenceId);

      // Determine what to add and remove
      const toAdd = evidenceIds.filter((eid: string) => !currentEvidenceIds.includes(eid));
      const toRemove = currentEvidenceIds.filter((eid) => !evidenceIds.includes(eid));

      // Remove old links
      if (toRemove.length > 0) {
        await prisma.evidenceArtifact.deleteMany({
          where: {
            artifactId: id,
            evidenceId: { in: toRemove },
          },
        });
      }

      // Add new links
      if (toAdd.length > 0) {
        await prisma.evidenceArtifact.createMany({
          data: toAdd.map((evidenceId: string) => ({
            artifactId: id,
            evidenceId,
          })),
          skipDuplicates: true,
        });
      }

      // Fetch updated artifact with links
      const updatedArtifact = await prisma.artifact.findUnique({
        where: { id },
        include: {
          linkedEvidences: {
            include: {
              evidence: {
                select: {
                  id: true,
                  evidenceCode: true,
                  name: true,
                  status: true,
                },
              },
            },
          },
        },
      });

      return NextResponse.json({
        message: "Links updated successfully",
        linkedEvidences: updatedArtifact?.linkedEvidences.map((le) => ({
          id: le.evidence.id,
          code: le.evidence.evidenceCode,
          name: le.evidence.name,
          status: le.evidence.status,
        })) || [],
      });
    } catch (error) {
      console.error("Error updating artifact links:", error);
      return NextResponse.json(
        { error: "Failed to update artifact links" },
        { status: 500 }
      );
    }
  },
  { resource: "compliance.evidence", action: "edit" }
);

// DELETE /api/evidence-artifacts/[id] - Delete an artifact
export const DELETE = withAuth(
  async (req: NextRequest, context: RouteContext, session) => {
    try {
      const { id } = await context.params;

      const artifact = await prisma.artifact.findUnique({
        where: { id },
        select: { id: true, customerAccountId: true, filePath: true },
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

      // Delete all evidence links first
      await prisma.evidenceArtifact.deleteMany({
        where: { artifactId: id },
      });

      // Delete the artifact record
      await prisma.artifact.delete({
        where: { id },
      });

      // Try to delete the physical file
      try {
        const fullPath = path.join(process.cwd(), artifact.filePath);
        await unlink(fullPath);
      } catch (fileError) {
        // File might not exist, that's ok
        console.warn("Could not delete artifact file:", fileError);
      }

      return NextResponse.json({ message: "Artifact deleted successfully" });
    } catch (error) {
      console.error("Error deleting artifact:", error);
      return NextResponse.json(
        { error: "Failed to delete artifact" },
        { status: 500 }
      );
    }
  },
  { resource: "compliance.evidence", action: "delete" }
);
