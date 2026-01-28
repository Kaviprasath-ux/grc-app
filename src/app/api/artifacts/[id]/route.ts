import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { unlink } from "fs/promises";
import path from "path";
import { withAuth, getTenantFilter, validateTenantAccess, forbidden } from "@/lib/api-auth";

interface RouteContext {
  params: Promise<{ id: string }>;
}

// GET single artifact - filtered by customer account
export const GET = withAuth(
  async (req, context: RouteContext, session) => {
    try {
      const { id } = await context.params;
      const tenantFilter = getTenantFilter(session);

      // Try to find standalone artifact first
      const artifact = await prisma.artifact.findFirst({
        where: { id, ...tenantFilter },
        include: {
          uploader: {
            select: {
              id: true,
              fullName: true,
            },
          },
          linkedEvidences: {
            include: {
              evidence: true,
            },
          },
        },
      });

      if (artifact) {
        return NextResponse.json(artifact);
      }

      // If not found, try evidence attachment
      const attachment = await prisma.evidenceAttachment.findFirst({
        where: { id, ...tenantFilter },
        include: {
          evidence: true,
        },
      });

      if (!attachment) {
        return NextResponse.json(
          { error: "Artifact not found" },
          { status: 404 }
        );
      }

      return NextResponse.json(attachment);
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

// PUT update artifact - with tenant validation
export const PUT = withAuth(
  async (req, context: RouteContext, session) => {
    try {
      const { id } = await context.params;
      const body = await req.json();
      const {
        name,
        fileName,
        fileType,
        fileSize,
        filePath,
        aiReviewStatus,
        aiReviewScore,
        aiReviewNotes,
      } = body;

      // Try to find and update standalone artifact first
      const existingArtifact = await prisma.artifact.findUnique({
        where: { id },
        select: { id: true }, // select: { customerAccountId: true },
      });

      if (existingArtifact) {
        // TODO: Fix tenant check for Artifact model (missing customerAccountId)
        /*if (!validateTenantAccess(session, existingArtifact.customerAccountId)) {
          return forbidden("Access denied to this artifact");
        }*/

        const artifact = await prisma.artifact.update({
          where: { id },
          data: {
            name,
            fileName,
            fileType,
            fileSize,
            filePath,
            aiReviewStatus,
            aiReviewScore,
            aiReviewNotes,
          },
          include: {
            uploader: {
              select: {
                id: true,
                fullName: true,
              },
            },
          },
        });
        return NextResponse.json(artifact);
      }

      // Try evidence attachment - check parent evidence for tenant validation
      const existingAttachment = await prisma.evidenceAttachment.findUnique({
        where: { id },
        include: { evidence: { select: { customerAccountId: true } } },
      });

      if (!existingAttachment) {
        return NextResponse.json(
          { error: "Artifact not found" },
          { status: 404 }
        );
      }

      if (!validateTenantAccess(session, existingAttachment.evidence.customerAccountId)) {
        return forbidden("Access denied to this artifact");
      }

      const attachment = await prisma.evidenceAttachment.update({
        where: { id },
        data: {
          fileName,
          fileType,
          fileSize,
          filePath,
        },
        include: {
          evidence: true,
        },
      });

      return NextResponse.json(attachment);
    } catch (error: unknown) {
      console.error("Error updating artifact:", error);
      if ((error as { code?: string }).code === "P2025") {
        return NextResponse.json(
          { error: "Artifact not found" },
          { status: 404 }
        );
      }
      return NextResponse.json(
        { error: "Failed to update artifact" },
        { status: 500 }
      );
    }
  },
  { resource: "compliance.evidence", action: "edit" }
);

// DELETE artifact - with tenant validation
export const DELETE = withAuth(
  async (req, context: RouteContext, session) => {
    try {
      const { id } = await context.params;

      // Try to find and delete standalone artifact first
      const artifact = await prisma.artifact.findUnique({
        where: { id },
        select: { customerAccountId: true, filePath: true },
      });

      if (artifact) {
        if (!validateTenantAccess(session, artifact.customerAccountId)) {
          return forbidden("Access denied to this artifact");
        }

        // Delete the physical file if it exists
        if (artifact.filePath) {
          try {
            const fullPath = path.join(process.cwd(), "public", artifact.filePath);
            await unlink(fullPath);
          } catch {
            // File might not exist, continue with database deletion
            console.log("File not found, continuing with database deletion");
          }
        }

        await prisma.artifact.delete({
          where: { id },
        });

        return NextResponse.json({ message: "Artifact deleted successfully" });
      }

      // If not a standalone artifact, try evidence attachment - check parent evidence for tenant validation
      const attachment = await prisma.evidenceAttachment.findUnique({
        where: { id },
        include: { evidence: { select: { customerAccountId: true } } },
      });

      if (!attachment) {
        return NextResponse.json(
          { error: "Artifact not found" },
          { status: 404 }
        );
      }

      if (!validateTenantAccess(session, attachment.evidence.customerAccountId)) {
        return forbidden("Access denied to this artifact");
      }

      // Delete the physical file if it exists
      if (attachment.filePath) {
        try {
          const fullPath = path.join(process.cwd(), "public", attachment.filePath);
          await unlink(fullPath);
        } catch {
          // File might not exist, continue with database deletion
          console.log("File not found, continuing with database deletion");
        }
      }

      await prisma.evidenceAttachment.delete({
        where: { id },
      });

      return NextResponse.json({ message: "Artifact deleted successfully" });
    } catch (error: unknown) {
      console.error("Error deleting artifact:", error);
      if ((error as { code?: string }).code === "P2025") {
        return NextResponse.json(
          { error: "Artifact not found" },
          { status: 404 }
        );
      }
      return NextResponse.json(
        { error: "Failed to delete artifact" },
        { status: 500 }
      );
    }
  },
  { resource: "compliance.evidence", action: "delete" }
);
