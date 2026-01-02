import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// GET all artifacts with filters
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const evidenceId = searchParams.get("evidenceId");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "50");

    // If evidenceId is provided, get evidence attachments
    if (evidenceId) {
      const attachments = await prisma.evidenceAttachment.findMany({
        where: { evidenceId },
        include: {
          evidence: true,
        },
        orderBy: { createdAt: "desc" },
      });

      return NextResponse.json({
        data: attachments,
      });
    }

    // Otherwise, get standalone artifacts
    const [artifacts, total] = await Promise.all([
      prisma.artifact.findMany({
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
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.artifact.count(),
    ]);

    return NextResponse.json({
      data: artifacts,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching artifacts:", error);
    return NextResponse.json(
      { error: "Failed to fetch artifacts" },
      { status: 500 }
    );
  }
}

// POST create new artifact
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      name,
      fileName,
      fileType,
      fileSize,
      filePath,
      uploadedBy,
      uploadedById,
      evidenceId, // If provided, create evidence attachment instead
    } = body;

    // If evidenceId is provided, create evidence attachment
    if (evidenceId) {
      if (!fileName || !filePath) {
        return NextResponse.json(
          { error: "File name and file path are required" },
          { status: 400 }
        );
      }

      const attachment = await prisma.evidenceAttachment.create({
        data: {
          fileName,
          fileType,
          fileSize,
          filePath,
          evidenceId,
        },
        include: {
          evidence: true,
        },
      });

      return NextResponse.json(attachment, { status: 201 });
    }

    // Otherwise, create standalone artifact
    if (!name || !fileName || !filePath) {
      return NextResponse.json(
        { error: "Name, file name, and file path are required" },
        { status: 400 }
      );
    }

    // Generate artifact code
    const artifactCode = `ART-${Date.now()}`;

    const artifact = await prisma.artifact.create({
      data: {
        artifactCode,
        name,
        fileName,
        fileType,
        fileSize,
        filePath,
        uploadedBy,
        uploadedById,
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

    return NextResponse.json(artifact, { status: 201 });
  } catch (error: unknown) {
    console.error("Error creating artifact:", error);
    return NextResponse.json(
      { error: "Failed to create artifact" },
      { status: 500 }
    );
  }
}
