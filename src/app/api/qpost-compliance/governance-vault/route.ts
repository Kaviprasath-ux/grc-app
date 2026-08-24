import { NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import prisma from "@/lib/prisma";
import { withAuth, getTenantFilter, getCustomerAccountId } from "@/lib/api-auth";
import { validateUploadedFile } from "@/lib/upload-validation";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

// GET all QPost vault documents - filtered by customer account
export const GET = withAuth(
  async (req, context, session) => {
    try {
      const tenantFilter = getTenantFilter(session);

      const documents = await prisma.qPostGovernanceVaultDocument.findMany({
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
      console.error("Error fetching QPost vault documents:", error);
      return NextResponse.json(
        { error: "Failed to fetch vault documents" },
        { status: 500 }
      );
    }
  },
  { resource: "qpost-compliance.governance", action: "view" }
);

// POST upload new QPost vault document
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

      const check = validateUploadedFile(file);
      if (!check.ok) {
        return NextResponse.json({ error: check.reason }, { status: 400 });
      }

      // Generate document code (QGov-001, QGov-002, etc.)
      const existingDocs = await prisma.qPostGovernanceVaultDocument.findMany({
        where: { customerAccountId },
        select: { documentCode: true },
      });

      let nextNum = 1;
      for (const doc of existingDocs) {
        const match = doc.documentCode.match(/QGov-(\d+)/);
        if (match) {
          const num = parseInt(match[1]);
          if (num >= nextNum) {
            nextNum = num + 1;
          }
        }
      }
      const documentCode = `QGov-${nextNum.toString().padStart(3, "0")}`;

      const fileName = file.name;
      const fileType = fileName.split(".").pop()?.toLowerCase() || "unknown";
      const fileSize = file.size;

      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);

      const uniqueFileName = `${documentCode}_${Date.now()}_${fileName}`;
      const uploadDir = join(process.cwd(), "uploads", "qpost-vault", customerAccountId);
      await mkdir(uploadDir, { recursive: true });
      await writeFile(join(uploadDir, uniqueFileName), buffer);
      const relativePath = `/uploads/qpost-vault/${customerAccountId}/${uniqueFileName}`;

      const document = await prisma.qPostGovernanceVaultDocument.create({
        data: {
          customerAccountId,
          documentCode,
          fileName,
          fileType,
          fileSize,
          filePath: relativePath,
          status: "Active",
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
      console.error("Error uploading QPost vault document:", error);
      const message = error instanceof Error ? error.message : "Failed to upload document";
      return NextResponse.json(
        { error: "Unable to complete the request. Please try again." },
        { status: 500 }
      );
    }
  },
  { resource: "qpost-compliance.governance", action: "create" }
);
