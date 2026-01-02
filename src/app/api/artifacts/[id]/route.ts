import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { unlink } from "fs/promises";
import path from "path";

// GET single artifact
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Try to find standalone artifact first
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
            evidence: true,
          },
        },
      },
    });

    if (artifact) {
      return NextResponse.json(artifact);
    }

    // If not found, try evidence attachment
    const attachment = await prisma.evidenceAttachment.findUnique({
      where: { id },
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
}

// PUT update artifact
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
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

    // Try to update standalone artifact first
    try {
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
    } catch {
      // Not a standalone artifact, try evidence attachment
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
}

// DELETE artifact
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Try to find and delete standalone artifact first
    const artifact = await prisma.artifact.findUnique({
      where: { id },
    });

    if (artifact) {
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

    // If not a standalone artifact, try evidence attachment
    const attachment = await prisma.evidenceAttachment.findUnique({
      where: { id },
    });

    if (!attachment) {
      return NextResponse.json(
        { error: "Artifact not found" },
        { status: 404 }
      );
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
}
