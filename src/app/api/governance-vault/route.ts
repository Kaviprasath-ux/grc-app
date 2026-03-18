import { NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import prisma from "@/lib/prisma";
import { withAuth, getTenantFilter, getCustomerAccountId } from "@/lib/api-auth";

// Allow larger file uploads (up to 50MB)
export const maxDuration = 60;
export const dynamic = "force-dynamic";

// GET all vault documents - filtered by customer account
export const GET = withAuth(
  async (req, context, session) => {
    try {
      const tenantFilter = getTenantFilter(session);

      const documents = await prisma.governanceVaultDocument.findMany({
        where: tenantFilter,
        select: {
          id: true,
          documentCode: true,
          fileName: true,
          fileType: true,
          fileSize: true,
          filePath: true,
          status: true,
          uploadedAt: true,
          customerAccountId: true,
          linkedPolicies: {
            include: {
              policy: {
                select: {
                  id: true,
                  code: true,
                  name: true,
                  documentType: true,
                },
              },
            },
          },
        },
        orderBy: { uploadedAt: "desc" },
      });

      // Transform the data to match the frontend interface
      const transformedDocuments = documents.map((doc) => ({
        id: doc.id,
        documentId: doc.documentCode,
        name: doc.fileName,
        type: doc.fileType || "Unknown",
        status: doc.status,
        uploadedAt: doc.uploadedAt.toISOString(),
        filePath: doc.filePath,
        linkedGovernanceIds: doc.linkedPolicies.map((link) => link.policyId),
        linkedPolicies: doc.linkedPolicies.map((link) => ({
          id: link.policy.id,
          code: link.policy.code,
          name: link.policy.name,
          documentType: link.policy.documentType,
        })),
      }));

      return NextResponse.json({ data: transformedDocuments });
    } catch (error) {
      console.error("Error fetching vault documents:", error);
      return NextResponse.json(
        { error: "Failed to fetch vault documents" },
        { status: 500 }
      );
    }
  },
  { resource: "compliance.governance", action: "view" }
);

// POST upload new vault document
export const POST = withAuth(
  async (req, context, session) => {
    try {
      const customerAccountId = getCustomerAccountId(session);

      if (!customerAccountId) {
        return NextResponse.json(
          { error: "Customer account not found" },
          { status: 400 }
        );
      }

      const formData = await req.formData();
      const file = formData.get("file") as File;

      if (!file) {
        return NextResponse.json(
          { error: "No file provided" },
          { status: 400 }
        );
      }

      // Generate document code (Gov-001, Gov-002, etc.)
      const existingDocs = await prisma.governanceVaultDocument.findMany({
        where: { customerAccountId },
        select: { documentCode: true },
      });

      let nextNum = 1;
      for (const doc of existingDocs) {
        const match = doc.documentCode.match(/Gov-(\d+)/);
        if (match) {
          const num = parseInt(match[1]);
          if (num >= nextNum) {
            nextNum = num + 1;
          }
        }
      }
      const documentCode = `Gov-${nextNum.toString().padStart(3, "0")}`;

      // Get file details
      const fileName = file.name;
      const fileType = fileName.split(".").pop()?.toLowerCase() || "unknown";
      const fileSize = file.size;

      // Read file into buffer
      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);

      // Save file to disk
      const uniqueFileName = `${documentCode}_${Date.now()}_${fileName}`;
      const uploadDir = join(process.cwd(), "uploads", "vault", customerAccountId);
      await mkdir(uploadDir, { recursive: true });
      await writeFile(join(uploadDir, uniqueFileName), buffer);
      const relativePath = `/uploads/vault/${customerAccountId}/${uniqueFileName}`;

      // Create document record in DB (fileData stored on disk, not in DB)
      const document = await prisma.governanceVaultDocument.create({
        data: {
          customerAccountId,
          documentCode,
          fileName,
          fileType,
          fileSize,
          filePath: relativePath,
          status: "Active",
          uploadedById: session.id,
        },
        select: {
          id: true,
          documentCode: true,
          fileName: true,
          fileType: true,
          fileSize: true,
          filePath: true,
          status: true,
          uploadedAt: true,
          customerAccountId: true,
          linkedPolicies: true,
        },
      });

      return NextResponse.json({
        id: document.id,
        documentId: document.documentCode,
        name: document.fileName,
        type: document.fileType,
        status: document.status,
        uploadedAt: document.uploadedAt.toISOString(),
        filePath: document.filePath,
        linkedGovernanceIds: [],
      }, { status: 201 });
    } catch (error: unknown) {
      console.error("Error uploading vault document:", error);
      const message = error instanceof Error ? error.message : "Failed to upload document";
      return NextResponse.json(
        { error: "Unable to complete the request. Please try again." },
        { status: 500 }
      );
    }
  },
  { resource: "compliance.governance", action: "create" }
);
