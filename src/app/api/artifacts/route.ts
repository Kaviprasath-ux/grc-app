import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth, getTenantFilter, getCustomerAccountId } from "@/lib/api-auth";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

// GET /api/artifacts - List all artifacts
export const GET = withAuth(
  async (req: NextRequest, context, session) => {
    try {
      const tenantFilter = getTenantFilter(session);

      const artifacts = await prisma.artifact.findMany({
        where: tenantFilter,
        include: {
          uploader: {
            select: { id: true, fullName: true },
          },
          linkedEvidences: {
            include: {
              evidence: {
                select: { id: true, evidenceCode: true, name: true },
              },
            },
          },
        },
        orderBy: { createdAt: "desc" },
      });

      return NextResponse.json({
        data: artifacts.map((a) => ({
          id: a.id,
          artifactCode: a.artifactCode,
          fileName: a.fileName,
          fileType: a.fileType,
          filePath: a.filePath,
          uploadedAt: a.createdAt.toISOString(),
          uploadedBy: a.uploader,
          linkedEvidences: a.linkedEvidences.map((le) => ({
            evidenceId: le.evidenceId,
            evidence: le.evidence,
          })),
        })),
      });
    } catch (error) {
      console.error("Error fetching artifacts:", error);
      return NextResponse.json(
        { error: "Failed to fetch artifacts" },
        { status: 500 }
      );
    }
  },
  { resource: "compliance.evidence", action: "view" }
);

// POST /api/artifacts - Upload new artifact
export const POST = withAuth(
  async (req: NextRequest, context, session) => {
    try {
      const formData = await req.formData();
      const file = formData.get("file") as File;

      if (!file) {
        return NextResponse.json(
          { error: "No file provided" },
          { status: 400 }
        );
      }

      const customerAccountId = getCustomerAccountId(session);

      // Generate artifact code
      const count = await prisma.artifact.count({
        where: { customerAccountId },
      });
      const artifactCode = `ART-${count + 1}`;

      // Create upload directory
      const uploadDir = path.join(process.cwd(), "uploads", "artifacts");
      await mkdir(uploadDir, { recursive: true });

      // Generate unique filename
      const timestamp = Date.now();
      const originalName = file.name;
      const ext = path.extname(originalName);
      const baseName = path.basename(originalName, ext);
      const fileName = `${baseName}_${timestamp}${ext}`;
      const filePath = path.join(uploadDir, fileName);

      // Write file to disk
      const buffer = Buffer.from(await file.arrayBuffer());
      await writeFile(filePath, buffer);

      // Get file type from extension
      const fileType = ext.replace(".", "").toLowerCase() || file.type;

      // Create artifact record
      const artifact = await prisma.artifact.create({
        data: {
          customerAccountId,
          artifactCode,
          name: originalName,
          fileName: originalName,
          fileType,
          fileSize: file.size,
          filePath: `/uploads/artifacts/${fileName}`,
          uploadedById: session.id,
        },
        include: {
          uploader: {
            select: { id: true, fullName: true },
          },
        },
      });

      return NextResponse.json(
        {
          id: artifact.id,
          artifactCode: artifact.artifactCode,
          fileName: artifact.fileName,
          fileType: artifact.fileType,
          filePath: artifact.filePath,
          uploadedAt: artifact.createdAt.toISOString(),
          uploadedBy: artifact.uploader,
        },
        { status: 201 }
      );
    } catch (error) {
      console.error("Error uploading artifact:", error);
      return NextResponse.json(
        { error: "Failed to upload artifact" },
        { status: 500 }
      );
    }
  },
  { resource: "compliance.evidence", action: "create" }
);
