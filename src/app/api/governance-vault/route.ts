import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth, getTenantFilter, getCustomerAccountId } from "@/lib/api-auth";

// GET all vault documents - filtered by customer account
export const GET = withAuth(
  async (req, context, session) => {
    try {
      const tenantFilter = getTenantFilter(session);

      const documents = await prisma.governanceVaultDocument.findMany({
        where: tenantFilter,
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

      // Generate document code (VD-001, VD-002, etc.)
      const lastDocument = await prisma.governanceVaultDocument.findFirst({
        where: { customerAccountId },
        orderBy: { documentCode: "desc" },
        select: { documentCode: true },
      });

      let nextNum = 1;
      if (lastDocument?.documentCode) {
        const match = lastDocument.documentCode.match(/Gov-(\d+)/);
        if (match) {
          nextNum = parseInt(match[1]) + 1;
        }
      }
      const documentCode = `Gov-${nextNum.toString().padStart(3, "0")}`;

      // Get file details
      const fileName = file.name;
      const fileType = fileName.split(".").pop()?.toLowerCase() || "unknown";
      const fileSize = file.size;

      // Read file into buffer for database storage
      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);

      // Store a virtual path for reference
      const uniqueFileName = `${documentCode}_${Date.now()}_${fileName}`;
      const relativePath = `/uploads/vault/${customerAccountId}/${uniqueFileName}`;

      // Create document record with file data stored in DB
      const document = await prisma.governanceVaultDocument.create({
        data: {
          customerAccountId,
          documentCode,
          fileName,
          fileType,
          fileSize,
          filePath: relativePath,
          fileData: buffer,
          status: "Active",
        },
        include: {
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
