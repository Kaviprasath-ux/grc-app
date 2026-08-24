import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth, forbidden, getCustomerAccountId } from "@/lib/api-auth";
import { validateUploadedFile } from "@/lib/upload-validation";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

// GET /api/evidence-artifacts - List all artifacts for the customer
// Includes both: standalone artifacts AND evidence attachments
export const GET = withAuth(
  async (req: NextRequest, context, session) => {
    try {
      const customerAccountId = getCustomerAccountId(session);

      if (!customerAccountId) {
        return forbidden("Customer account not found");
      }

      // Fetch standalone artifacts
      const artifacts = await prisma.artifact.findMany({
        where: { customerAccountId },
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
        orderBy: { createdAt: "desc" },
      });

      // Fetch evidence attachments (documents uploaded directly to evidences)
      const evidenceAttachments = await prisma.evidenceAttachment.findMany({
        where: {
          evidence: {
            customerAccountId,
          },
        },
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
        orderBy: { uploadedAt: "desc" },
      });

      // Combine both sources
      const allDocuments = [
        // Standalone artifacts
        ...artifacts.map((art) => ({
          id: art.id,
          documentCode: art.artifactCode,
          fileName: art.fileName,
          fileType: art.fileType,
          fileSize: art.fileSize,
          filePath: art.filePath,
          status: "Active",
          uploadedAt: art.createdAt.toISOString(),
          uploadedBy: art.uploader?.fullName || art.uploadedBy || null,
          source: "artifact" as const,
          linkedEvidences: art.linkedEvidences.map((le) => ({
            id: le.evidence.id,
            code: le.evidence.evidenceCode,
            name: le.evidence.name,
            status: le.evidence.status,
            linkedAt: le.createdAt.toISOString(),
          })),
        })),
        // Evidence attachments (directly uploaded to evidences)
        ...evidenceAttachments.map((att, index) => ({
          id: att.id,
          documentCode: `EA-${String(index + 1).padStart(3, "0")}`,
          fileName: att.fileName,
          fileType: att.fileType,
          fileSize: att.fileSize,
          filePath: att.filePath,
          status: "Active",
          uploadedAt: att.uploadedAt.toISOString(),
          uploadedBy: null,
          source: "attachment" as const,
          linkedEvidences: [{
            id: att.evidence.id,
            code: att.evidence.evidenceCode,
            name: att.evidence.name,
            status: att.evidence.status,
            linkedAt: att.uploadedAt.toISOString(),
          }],
        })),
      ];

      // Sort by upload date (newest first)
      allDocuments.sort((a, b) =>
        new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
      );

      return NextResponse.json({ data: allDocuments });
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

// POST /api/evidence-artifacts - Upload a new artifact
export const POST = withAuth(
  async (req: NextRequest, context, session) => {
    try {
      const customerAccountId = getCustomerAccountId(session);

      if (!customerAccountId) {
        return forbidden("Customer account not found");
      }

      // Parse form data
      const formData = await req.formData();
      const file = formData.get("file") as File;

      if (!file) {
        return NextResponse.json(
          { error: "No file provided" },
          { status: 400 }
        );
      }

      const check = validateUploadedFile(file);
      if (!check.ok) {
        return NextResponse.json({ error: check.reason }, { status: 400 });
      }

      // Generate artifact code
      const lastArtifact = await prisma.artifact.findFirst({
        where: { customerAccountId },
        orderBy: { artifactCode: "desc" },
        select: { artifactCode: true },
      });

      let nextNumber = 1;
      if (lastArtifact?.artifactCode) {
        const match = lastArtifact.artifactCode.match(/ART-(\d+)/);
        if (match) {
          nextNumber = parseInt(match[1], 10) + 1;
        }
      }
      const artifactCode = `ART-${String(nextNumber).padStart(3, "0")}`;

      // Create upload directory
      const uploadDir = path.join(process.cwd(), "uploads", "artifacts", customerAccountId);
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
          filePath: `/uploads/artifacts/${customerAccountId}/${fileName}`,
          uploadedById: session.id || null,
          uploadedBy: session.name || null,
        },
      });

      return NextResponse.json(
        {
          message: "Artifact uploaded successfully",
          artifact: {
            id: artifact.id,
            documentCode: artifact.artifactCode,
            fileName: artifact.fileName,
            fileType: artifact.fileType,
            fileSize: artifact.fileSize,
            filePath: artifact.filePath,
            status: "Active",
            uploadedAt: artifact.createdAt.toISOString(),
            linkedEvidences: [],
          },
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
