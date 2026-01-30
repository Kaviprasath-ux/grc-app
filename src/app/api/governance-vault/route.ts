import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth, forbidden, getCustomerAccountId } from "@/lib/api-auth";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

// GET /api/governance-vault - List all vault documents for the customer
// Includes both: vault-uploaded documents AND policy attachments
export const GET = withAuth(
  async (req: NextRequest, context, session) => {
    try {
      const customerAccountId = getCustomerAccountId(session);

      if (!customerAccountId) {
        return forbidden("Customer account not found");
      }

      // Fetch vault documents
      const vaultDocuments = await prisma.governanceVaultDocument.findMany({
        where: { customerAccountId },
        include: {
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

      // Fetch policy attachments (documents uploaded directly to policies)
      const policyAttachments = await prisma.policyAttachment.findMany({
        where: {
          policy: {
            customerAccountId,
          },
        },
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
        orderBy: { uploadedAt: "desc" },
      });

      // Combine both sources
      const allDocuments = [
        // Vault documents
        ...vaultDocuments.map((doc) => ({
          id: doc.id,
          documentCode: doc.documentCode,
          fileName: doc.fileName,
          fileType: doc.fileType,
          fileSize: doc.fileSize,
          filePath: doc.filePath,
          status: doc.status,
          uploadedAt: doc.uploadedAt.toISOString(),
          source: "vault" as const,
          linkedPolicies: doc.linkedPolicies.map((lp) => ({
            id: lp.policy.id,
            code: lp.policy.code,
            name: lp.policy.name,
            documentType: lp.policy.documentType,
            linkedAt: lp.linkedAt.toISOString(),
          })),
        })),
        // Policy attachments (directly uploaded to policies)
        ...policyAttachments.map((att, index) => ({
          id: att.id,
          documentCode: `PA-${String(index + 1).padStart(3, "0")}`,
          fileName: att.fileName,
          fileType: att.fileType,
          fileSize: att.fileSize,
          filePath: att.filePath,
          status: "Active",
          uploadedAt: att.uploadedAt.toISOString(),
          source: "policy" as const,
          linkedPolicies: [{
            id: att.policy.id,
            code: att.policy.code,
            name: att.policy.name,
            documentType: att.policy.documentType,
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
      console.error("Error fetching vault documents:", error);
      return NextResponse.json(
        { error: "Failed to fetch vault documents" },
        { status: 500 }
      );
    }
  },
  { resource: "compliance.governance", action: "view" }
);

// POST /api/governance-vault - Upload a new document to the vault
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

      // Generate document code
      const lastDoc = await prisma.governanceVaultDocument.findFirst({
        where: { customerAccountId },
        orderBy: { documentCode: "desc" },
        select: { documentCode: true },
      });

      let nextNumber = 1;
      if (lastDoc?.documentCode) {
        const match = lastDoc.documentCode.match(/VD-(\d+)/);
        if (match) {
          nextNumber = parseInt(match[1], 10) + 1;
        }
      }
      const documentCode = `VD-${String(nextNumber).padStart(3, "0")}`;

      // Create upload directory
      const uploadDir = path.join(process.cwd(), "uploads", "vault", customerAccountId);
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

      // Create vault document record
      const document = await prisma.governanceVaultDocument.create({
        data: {
          customerAccountId,
          documentCode,
          fileName: originalName,
          fileType,
          fileSize: file.size,
          filePath: `/uploads/vault/${customerAccountId}/${fileName}`,
          status: "Active",
        },
      });

      return NextResponse.json(
        {
          message: "Document uploaded successfully",
          document: {
            id: document.id,
            documentCode: document.documentCode,
            fileName: document.fileName,
            fileType: document.fileType,
            fileSize: document.fileSize,
            filePath: document.filePath,
            status: document.status,
            uploadedAt: document.uploadedAt.toISOString(),
            linkedPolicies: [],
          },
        },
        { status: 201 }
      );
    } catch (error) {
      console.error("Error uploading vault document:", error);
      return NextResponse.json(
        { error: "Failed to upload document" },
        { status: 500 }
      );
    }
  },
  { resource: "compliance.governance", action: "create" }
);
