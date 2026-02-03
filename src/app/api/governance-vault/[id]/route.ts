import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth, validateTenantAccess, forbidden } from "@/lib/api-auth";
import { unlink } from "fs/promises";
import path from "path";

interface RouteContext {
  params: Promise<{ id: string }>;
}

// GET single vault document
export const GET = withAuth(
  async (req, context: RouteContext, session) => {
    try {
      const { id } = await context.params;

      const document = await prisma.governanceVaultDocument.findUnique({
        where: { id },
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
      });

      if (!document) {
        return NextResponse.json(
          { error: "Document not found" },
          { status: 404 }
        );
      }

      // Validate tenant access
      if (!validateTenantAccess(session, document.customerAccountId)) {
        return forbidden("Access denied to this document");
      }

      return NextResponse.json({
        id: document.id,
        documentId: document.documentCode,
        name: document.fileName,
        type: document.fileType,
        status: document.status,
        uploadedAt: document.uploadedAt.toISOString(),
        filePath: document.filePath,
        linkedGovernanceIds: document.linkedPolicies.map((link) => link.policyId),
        linkedPolicies: document.linkedPolicies.map((link) => ({
          id: link.policy.id,
          code: link.policy.code,
          name: link.policy.name,
          documentType: link.policy.documentType,
        })),
      });
    } catch (error) {
      console.error("Error fetching vault document:", error);
      return NextResponse.json(
        { error: "Failed to fetch document" },
        { status: 500 }
      );
    }
  },
  { resource: "compliance.governance", action: "view" }
);

// DELETE vault document
export const DELETE = withAuth(
  async (req, context: RouteContext, session) => {
    try {
      const { id } = await context.params;

      // First check if document exists and verify tenant access
      const document = await prisma.governanceVaultDocument.findUnique({
        where: { id },
        select: { customerAccountId: true, filePath: true },
      });

      if (!document) {
        return NextResponse.json(
          { error: "Document not found" },
          { status: 404 }
        );
      }

      if (!validateTenantAccess(session, document.customerAccountId)) {
        return forbidden("Access denied to this document");
      }

      // Delete the file from disk
      try {
        const fullPath = path.join(process.cwd(), document.filePath);
        await unlink(fullPath);
      } catch (fileError) {
        // File might not exist, continue with database deletion
        console.warn("Could not delete file:", fileError);
      }

      // Delete linked policies first (due to foreign key constraints)
      await prisma.governanceVaultDocumentLink.deleteMany({
        where: { documentId: id },
      });

      // Delete the document record
      await prisma.governanceVaultDocument.delete({
        where: { id },
      });

      return NextResponse.json({ message: "Document deleted successfully" });
    } catch (error) {
      console.error("Error deleting vault document:", error);
      return NextResponse.json(
        { error: "Failed to delete document" },
        { status: 500 }
      );
    }
  },
  { resource: "compliance.governance", action: "delete" }
);
